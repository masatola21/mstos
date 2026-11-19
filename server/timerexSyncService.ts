/**
 * TimeRex Booking Parser and CRM Synchronization Service (Pattern A)
 *
 * Automatically detects TimeRex booking confirmations, reschedules, cancellations,
 * and reminders from:
 * 1. Notification emails (Resend inbound / domain Google account / forwarded from Gmail)
 * 2. Google Calendar iCal events (IntegratedCalendarWorkspace / icalParser)
 * 3. Direct Webhooks (if configured)
 *
 * And synchronizes them safely into:
 * - leads (リード管理): advances pre-booking leads to '面談予約済', handles reschedules/cancellations without downgrading progressed stages
 * - deals (商談パイプライン): creates or updates deal card safely without overwriting later stages or erasing memos
 * - contact_tags: tags with '個別相談予約済み' (or removes it on cancel)
 * - tasks (タスク): creates deduplicated high-priority prep/cancel-followup tasks
 */
import { cancelSupersededQueuedJobs } from './funnelOrchestration.js';

export type TimeRexBookingAction = 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder';

export interface TimeRexBookingInfo {
  guestName: string;
  guestEmail: string;
  meetingDate: string; // YYYY-MM-DD
  meetingStartTime?: string; // HH:mm
  meetingEndTime?: string; // HH:mm
  companyName?: string;
  phone?: string;
  meetUrl?: string;
  eventName?: string;
  memo?: string;
  bookingAction?: TimeRexBookingAction;
  sourceType: 'email' | 'calendar' | 'webhook';
  rawId?: string;
}

export interface TimeRexSyncResult {
  success: boolean;
  leadId?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  bookingAction?: TimeRexBookingAction;
  action:
    | 'created_both'
    | 'updated_lead_and_created_deal'
    | 'updated_both'
    | 'rescheduled'
    | 'cancelled'
    | 'reminder_acknowledged'
    | 'skipped_no_change';
  details?: string;
  error?: string;
}

const HOST_DOMAIN_SUFFIXES = ['@mstcorp.info'];
const KNOWN_HOST_EMAILS = new Set([
  'mst.shikumikaizen@gmail.com',
  'contact@mstcorp.info',
  'masato.la21@gmail.com',
]);

export function isHostOrSystemEmail(email: string, extraHostEmails: string[] = []): boolean {
  const lower = String(email || '').trim().toLowerCase();
  if (!lower || !lower.includes('@')) return true;
  if (lower.includes('timerex')) return true;
  if (lower.includes('no-reply') || lower.includes('noreply') || lower.includes('calendar-notification@google.com')) {
    return true;
  }
  if (KNOWN_HOST_EMAILS.has(lower)) return true;
  if (HOST_DOMAIN_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  return extraHostEmails.some((h) => h && h.trim().toLowerCase() === lower);
}

export function extractGuestEmailFromText(content: string, extraHostEmails: string[] = []): string | null {
  const labeledMatch = content.match(
    /(?:ゲストメールアドレス|ゲストメール|予約者メールアドレス|メールアドレス|メール|E-?mail)[:：]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (labeledMatch && !isHostOrSystemEmail(labeledMatch[1], extraHostEmails)) {
    return labeledMatch[1].trim().toLowerCase();
  }

  const guestSectionMatch = content.match(
    /(?:ゲスト|予約者|相手方|お申し込み者)[\s\S]{0,200}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (guestSectionMatch && !isHostOrSystemEmail(guestSectionMatch[1], extraHostEmails)) {
    return guestSectionMatch[1].trim().toLowerCase();
  }

  const allEmails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
  for (const candidate of allEmails) {
    if (!isHostOrSystemEmail(candidate, extraHostEmails)) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
}

/**
 * Classifies whether a TimeRex email represents confirmation, reschedule, cancellation, or reminder.
 */
export function classifyTimeRexEmailAction(subject: string, bodyText: string): TimeRexBookingAction {
  const combined = `${String(subject || '')}\n${String(bodyText || '')}`.toLowerCase();

  if (
    combined.includes('キャンセルされました') ||
    combined.includes('予定がキャンセル') ||
    combined.includes('予約がキャンセル') ||
    combined.includes('予約が取り消されました') ||
    combined.includes('取消されました') ||
    /【\s*timerex\s*】[^\n]*(?:キャンセル|取消)/.test(combined)
  ) {
    return 'cancelled';
  }

  if (
    combined.includes('日程が変更されました') ||
    combined.includes('予定が変更されました') ||
    combined.includes('日時が変更') ||
    combined.includes('スケジュールが変更') ||
    combined.includes('日程変更が完了') ||
    combined.includes('rescheduled')
  ) {
    return 'rescheduled';
  }

  if (
    combined.includes('リマインド') ||
    combined.includes('まもなく開始') ||
    combined.includes('間もなく開始') ||
    combined.includes('間もなく予定') ||
    combined.includes('まもなく予定') ||
    combined.includes('開催のご案内') ||
    combined.includes('前日のお知らせ') ||
    combined.includes('本日の予定') ||
    combined.includes('明日の予定') ||
    /reminder/i.test(combined)
  ) {
    return 'reminder';
  }

  return 'confirmed';
}

/**
 * Checks whether an incoming email is a TimeRex notification (booking, reschedule, cancel, or reminder).
 */
export function isTimeRexEmail(from: string, subject: string, bodyText: string): boolean {
  const cleanFrom = String(from || '').toLowerCase();
  const cleanSubj = String(subject || '').toLowerCase();
  const cleanBody = String(bodyText || '').toLowerCase();

  const isFromTimeRex = cleanFrom.includes('timerex.net') || cleanFrom.includes('timerex');
  const isTimeRexSubject =
    cleanSubj.includes('timerex') ||
    cleanSubj.includes('日程調整が完了') ||
    cleanSubj.includes('予約が完了') ||
    cleanSubj.includes('予定がキャンセル') ||
    cleanSubj.includes('日程が変更');
  const isTimeRexBody =
    cleanBody.includes('timerex') &&
    (cleanBody.includes('予定が確定') ||
      cleanBody.includes('日程調整') ||
      cleanBody.includes('面談') ||
      cleanBody.includes('キャンセル') ||
      cleanBody.includes('リマインド') ||
      cleanBody.includes('変更'));

  return isFromTimeRex || isTimeRexSubject || isTimeRexBody;
}

/**
 * Parses a TimeRex notification email body into structured booking data.
 */
export function parseTimeRexEmail(
  subject: string,
  textBody: string,
  htmlBody?: string,
  extraHostEmails: string[] = []
): TimeRexBookingInfo | null {
  const content = (textBody || htmlBody || '').replace(/<[^>]+>/g, ' ');
  const bookingAction = classifyTimeRexEmailAction(subject, content);

  const guestEmail = extractGuestEmailFromText(content, extraHostEmails);
  if (!guestEmail) {
    return null; // Email is required to match with CRM
  }

  // Extract Guest Name
  let guestName = '';
  const nameMatch =
    content.match(/(?:ゲスト氏名|ゲスト名|お名前|氏名|予約者名|予約者)[:：]\s*([^\n\r(（<]+)/) ||
    subject.match(/【TimeRex】\s*(?:\[[^\]]+\])?\s*([^\s(（]+)\s*様/);

  if (nameMatch) {
    guestName = nameMatch[1].replace(/様.*$/, '').trim();
  }

  // Extract Company Name
  let companyName = '';
  const compMatch = content.match(/(?:会社名|御社名|会社|所属)[:：]\s*([^\n\r]+)/);
  if (compMatch) {
    companyName = compMatch[1].trim();
  }

  // Extract Phone Number
  let phone = '';
  const phoneMatch = content.match(/(?:電話番号|TEL|連絡先)[:：]\s*([0-9\-+()]{9,15})/i);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }

  // Extract Date and Time
  let meetingDate = '';
  let meetingStartTime = '';
  let meetingEndTime = '';

  const dateTimeMatch =
    content.match(/(?:変更後の日時|新しい日時|日時|予定日時)[:：]\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*\([^\)]+\))?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/) ||
    content.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*\([^\)]+\))?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/);

  if (dateTimeMatch) {
    const y = dateTimeMatch[1];
    const m = String(dateTimeMatch[2]).padStart(2, '0');
    const d = String(dateTimeMatch[3]).padStart(2, '0');
    meetingDate = `${y}-${m}-${d}`;
    meetingStartTime = dateTimeMatch[4].padStart(5, '0');
    meetingEndTime = dateTimeMatch[5] ? dateTimeMatch[5].padStart(5, '0') : '';
  }

  // Extract Meet / Zoom URL
  let meetUrl = '';
  const meetMatch = content.match(
    /https:\/\/(?:meet\.google\.com\/[a-z-]+|us\d+web\.zoom\.us\/j\/[0-9?a-z=_-]+|zoom\.us\/j\/[0-9?a-z=_-]+|teams\.microsoft\.com\/[^\s]+)/i
  );
  if (meetMatch) {
    meetUrl = meetMatch[0].trim();
  }

  // Extract Event Name
  let eventName = '';
  const eventMatch =
    content.match(/■\s*(?:予定|イベント名|メニュー)[:：]?\s*(?:[\n\r]+\s*)?([^\n\r]+)/) ||
    content.match(/(?:イベント名|メニュー)[:：]\s*([^\n\r]+)/) ||
    subject.match(/【TimeRex】(?:\[([^\]]+)\])/);
  if (eventMatch) {
    const rawEvt = eventMatch[1].trim();
    if (rawEvt && !rawEvt.startsWith('■') && rawEvt !== '日時' && rawEvt !== 'ゲスト') {
      eventName = rawEvt;
    }
  }

  // Extract Comments / Notes
  let memo = '';
  const memoMatch =
    content.match(/■\s*(?:コメント|ご質問・ご要望|自由記入|備考)[:：]?\s*(?:[\n\r]+\s*)?([^\n\r]+)/) ||
    content.match(/(?:コメント|ご質問・ご要望|自由記入|備考)[:：]\s*([^\n\r]+(?:\n[^\n\r]+)?)/);
  if (memoMatch) {
    memo = memoMatch[1].trim();
  }

  if (!meetingDate && bookingAction !== 'cancelled') {
    return null;
  }

  return {
    guestName: guestName || '予約ゲスト',
    guestEmail,
    meetingDate,
    meetingStartTime,
    meetingEndTime,
    companyName: companyName || undefined,
    phone: phone || undefined,
    meetUrl: meetUrl || undefined,
    eventName: eventName || 'TimeRex個別面談',
    memo: memo || undefined,
    bookingAction,
    sourceType: 'email',
  };
}

/**
 * Checks whether an iCal calendar event originates from TimeRex and extracts booking details.
 */
export function parseTimeRexCalendarEvent(
  event: {
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    meetUrl?: string;
    notes?: string;
    status?: string;
  },
  extraHostEmails: string[] = []
): TimeRexBookingInfo | null {
  const title = event.title || '';
  const notes = event.notes || '';

  const isTimeRex =
    title.includes('TimeRex') ||
    title.includes('timerex') ||
    notes.includes('timerex.net') ||
    notes.includes('TimeRex');

  if (!isTimeRex) return null;

  const guestEmail = extractGuestEmailFromText(notes, extraHostEmails);
  if (!guestEmail) return null;

  const isCancelled =
    String(event.status || '').toUpperCase() === 'CANCELLED' ||
    title.startsWith('キャンセル') ||
    title.includes('【キャンセル】');

  // Extract Guest Name from title: e.g. "【TimeRex】山田太郎 様" or "山田太郎様 (TimeRex)"
  let guestName = '';
  const nameInTitle =
    title.match(/【TimeRex】\s*(?:\[[^\]]+\])?\s*([^\s(（]+)\s*様?/) ||
    title.match(/([^\s(（]+)\s*様?\s*(?:\(TimeRex\)|（TimeRex）)/);
  if (nameInTitle) {
    guestName = nameInTitle[1].replace(/様.*$/, '').trim();
  }

  return {
    guestName: guestName || 'カレンダー予約者',
    guestEmail,
    meetingDate: event.date,
    meetingStartTime: event.startTime,
    meetingEndTime: event.endTime,
    meetUrl: event.meetUrl,
    eventName: title.replace(/【TimeRex】/g, '').trim(),
    memo: notes,
    bookingAction: isCancelled ? 'cancelled' : 'confirmed',
    sourceType: 'calendar',
  };
}

const LEAD_PROGRESSED_PAST_BOOKING = new Set([
  '面談実施済',
  'ヒアリング済',
  '商談化',
  '成約',
  '受注',
  '失注',
  '見送り',
  '失注・対象外',
]);

const DEAL_PROGRESSED_PAST_BOOKING = new Set([
  '初回面談',
  '面談完了',
  '要件提案',
  '提案中',
  '見積提示',
  '見積提出',
  '最終交渉',
  '成約',
  '受注',
  '失注',
  '見送り',
  'won',
  'closed_won',
  'lost',
]);

const DEAL_CLOSED_STATUSES = new Set(['成約', '受注', '失注', '見送り', 'won', 'closed_won', 'lost']);

async function ensureTaskDeduplicated(
  db: any,
  params: { title: string; dedupNeedle: string; description: string; dueDate?: string | null; ownerId?: string | null }
) {
  try {
    const { data: existingTasks } = await db
      .from('tasks')
      .select('id, title, status')
      .ilike('title', `%${params.dedupNeedle}%`)
      .limit(5);

    const alreadyExists = (existingTasks || []).some(
      (t: any) => t.title === params.title || (t.status !== 'done' && String(t.title || '').includes(params.dedupNeedle))
    );
    if (alreadyExists) return false;

    const taskPayload: any = {
      title: params.title,
      description: params.description,
      status: 'todo',
      priority: 'high',
      ...(params.dueDate ? { due_date: params.dueDate } : {}),
      created_at: new Date().toISOString(),
    };
    if (params.ownerId) taskPayload.owner_id = params.ownerId;
    await db.from('tasks').insert(taskPayload);
    return true;
  } catch (taskErr) {
    console.warn('[TimeRexSync] Task dedup/insert warning:', taskErr);
    return false;
  }
}

/**
 * Synchronizes parsed TimeRex booking data into Leads, Deals, Contact Tags, and Tasks.
 */
export async function syncTimeRexBookingToCrm(
  booking: TimeRexBookingInfo,
  db: any,
  ownerId?: string | null
): Promise<TimeRexSyncResult> {
  const actionKind: TimeRexBookingAction = booking.bookingAction || 'confirmed';
  if (!db || !booking.guestEmail || (!booking.meetingDate && actionKind !== 'cancelled')) {
    return {
      success: false,
      bookingAction: actionKind,
      error: 'DBクライアントまたはメール・面談日時が不足しています。',
      action: 'skipped_no_change',
    };
  }

  try {
    const cleanEmail = booking.guestEmail.trim().toLowerCase();
    const resolvedOwnerId = ownerId || null;

    // 1. Find or create Contact
    let contactId = '';
    let companyId: string | null = null;
    let contactName = booking.guestName;

    const { data: existingContacts } = await db
      .from('contacts')
      .select('id, full_name, company_id, owner_id')
      .ilike('email', cleanEmail)
      .limit(1);

    if (existingContacts && existingContacts.length > 0) {
      contactId = existingContacts[0].id;
      companyId = existingContacts[0].company_id || null;
      if (existingContacts[0].full_name && existingContacts[0].full_name !== '予約ゲスト') {
        contactName = existingContacts[0].full_name;
      }
    } else {
      if (actionKind === 'cancelled' || actionKind === 'reminder') {
        return {
          success: true,
          bookingAction: actionKind,
          action: 'skipped_no_change',
          details: '該当する連絡先が未登録のためスキップしました。',
        };
      }

      const newContactPayload: any = {
        full_name: contactName,
        email: cleanEmail,
        phone: booking.phone || null,
        created_at: new Date().toISOString(),
      };
      if (resolvedOwnerId) newContactPayload.owner_id = resolvedOwnerId;

      const { data: createdContact, error: contactErr } = await db
        .from('contacts')
        .insert(newContactPayload)
        .select('id')
        .single();

      if (!contactErr && createdContact) {
        contactId = createdContact.id;
      }
    }

    // Reminder emails: do NOT modify progressed CRM stages or create duplicate tasks
    if (actionKind === 'reminder') {
      return {
        success: true,
        contactId: contactId || undefined,
        companyId: companyId || undefined,
        bookingAction: 'reminder',
        action: 'reminder_acknowledged',
        details: `${contactName}様（${booking.meetingDate}）のリマインド通知を受信しました（既存商談ステータスとタスクは維持）。`,
      };
    }

    // If company exists or can be matched / created
    if (!companyId && booking.companyName) {
      const { data: existingComp } = await db
        .from('companies')
        .select('id')
        .ilike('company_name', booking.companyName.trim())
        .limit(1);

      if (existingComp && existingComp.length > 0) {
        companyId = existingComp[0].id;
      } else if (actionKind !== 'cancelled') {
        const compPayload: any = {
          company_name: booking.companyName.trim(),
          created_at: new Date().toISOString(),
        };
        if (resolvedOwnerId) compPayload.owner_id = resolvedOwnerId;
        const { data: newComp } = await db.from('companies').insert(compPayload).select('id').single();
        if (newComp) companyId = newComp.id;
      }

      if (companyId && contactId) {
        await db.from('contacts').update({ company_id: companyId }).eq('id', contactId);
      }
    }

    // Load existing Lead & Deal
    let leadId = '';
    const { data: existingLeads } = await db
      .from('leads')
      .select('id, notes, status, company_id, meeting_date, meeting_start_time')
      .or(`contact_id.eq.${contactId || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingLead = existingLeads?.[0] || null;
    if (existingLead) leadId = existingLead.id;

    let dealId = '';
    let existingDeal: any = null;
    if (leadId || companyId) {
      const dealQuery = db.from('deals').select('id, proposal_status, meeting_date, memo');
      if (leadId) dealQuery.eq('lead_id', leadId);
      else if (companyId) dealQuery.eq('company_id', companyId);
      const { data: existingDeals } = await dealQuery.limit(1);
      if (existingDeals && existingDeals.length > 0) {
        existingDeal = existingDeals[0];
        dealId = existingDeal.id;
      }
    }

    // Handle Cancellation cleanly
    if (actionKind === 'cancelled') {
      const cancelNote = `[TimeRex予約キャンセル] 元予定: ${booking.meetingDate || '不明'} ${booking.meetingStartTime || ''}`.trim();
      if (existingLead) {
        const priorNotes = existingLead.notes || '';
        const updatedNotes = priorNotes.includes(cancelNote)
          ? priorNotes
          : `${priorNotes}\n\n${cancelNote}`.trim().slice(-12_000);
        const leadPatch: any = {
          notes: updatedNotes,
          last_contacted_at: new Date().toISOString(),
        };
        if (existingLead.status === '面談予約済') {
          leadPatch.status = '再調整待ち';
          leadPatch.meeting_date = null;
          leadPatch.meeting_start_time = null;
        }
        await db.from('leads').update(leadPatch).eq('id', existingLead.id);
      }

      if (existingDeal && !DEAL_CLOSED_STATUSES.has(String(existingDeal.proposal_status || '').trim())) {
        const priorMemo = String(existingDeal.memo || '');
        const updatedMemo = priorMemo.includes(cancelNote)
          ? priorMemo
          : `${priorMemo}\n${cancelNote}`.trim().slice(-12_000);
        const dealPatch: any = {
          memo: updatedMemo,
          updated_at: new Date().toISOString(),
        };
        if (['日程確定', '初回面談'].includes(String(existingDeal.proposal_status || '').trim())) {
          dealPatch.proposal_status = '日程再調整';
          dealPatch.meeting_date = null;
        }
        await db.from('deals').update(dealPatch).eq('id', existingDeal.id);
      }

      if (contactId) {
        try {
          await db.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', '個別相談予約済み');
        } catch (tagDelErr) {
          console.warn('[TimeRexSync] Tag delete on cancel warning:', tagDelErr);
        }
      }

      await ensureTaskDeduplicated(db, {
        title: `【TimeRexキャンセル対応】${contactName} 様（${booking.meetingDate || '日程未定'}）`,
        dedupNeedle: `【TimeRexキャンセル対応】${contactName} 様（${booking.meetingDate || ''}`,
        description: `TimeRexの面談予約がキャンセルされました。\nゲスト: ${contactName} 様（${cleanEmail}）\n元予定日: ${booking.meetingDate || '不明'} ${booking.meetingStartTime || ''}\n必要に応じて別日程の再調整案内を行ってください。`,
        dueDate: booking.meetingDate || null,
        ownerId: resolvedOwnerId,
      });

      return {
        success: true,
        leadId: leadId || undefined,
        dealId: dealId || undefined,
        companyId: companyId || undefined,
        contactId: contactId || undefined,
        bookingAction: 'cancelled',
        action: 'cancelled',
        details: `${contactName}様のTimeRex予約キャンセルを反映し、再調整タスクを登録しました。`,
      };
    }

    // Confirmed or Rescheduled
    const noteLabel = actionKind === 'rescheduled' ? 'TimeRex日程変更' : 'TimeRex予約確定';
    const timerexNote = `[${noteLabel}] 日程: ${booking.meetingDate} ${booking.meetingStartTime || ''}${booking.meetUrl ? `\nMeet URL: ${booking.meetUrl}` : ''}${booking.memo ? `\n備考: ${booking.memo}` : ''}`;

    let changedSomething = false;

    // 2. Find or create Lead (non-downgrade safe)
    if (existingLead) {
      const currentLeadStatus = String(existingLead.status || '').trim();
      const isDateChanged =
        existingLead.meeting_date !== booking.meetingDate ||
        (booking.meetingStartTime && existingLead.meeting_start_time !== booking.meetingStartTime);
      const isProgressedLead = LEAD_PROGRESSED_PAST_BOOKING.has(currentLeadStatus);
      const shouldUpdateLeadStatus =
        (!isProgressedLead && currentLeadStatus !== '面談予約済') ||
        (actionKind === 'rescheduled' && isDateChanged && !['成約', '受注', '失注', '見送り', '失注・対象外'].includes(currentLeadStatus));

      const priorNotes = existingLead.notes || '';
      const hasNoteForDate = priorNotes.includes(`[${noteLabel}] 日程: ${booking.meetingDate}`) || priorNotes.includes(booking.meetingDate);
      const updatedNotes = hasNoteForDate
        ? priorNotes
        : `${priorNotes}\n\n${timerexNote}`.trim().slice(-12_000);

      if (shouldUpdateLeadStatus || isDateChanged || !hasNoteForDate || (companyId && !existingLead.company_id)) {
        const leadPatch: any = {
          notes: updatedNotes,
          last_contacted_at: new Date().toISOString(),
          ...(companyId && !existingLead.company_id ? { company_id: companyId } : {}),
        };
        if (shouldUpdateLeadStatus) {
          leadPatch.status = '面談予約済';
        }
        if (isDateChanged || !existingLead.meeting_date) {
          leadPatch.meeting_date = booking.meetingDate;
          leadPatch.meeting_start_time = booking.meetingStartTime || null;
        }
        await db.from('leads').update(leadPatch).eq('id', leadId);
        changedSomething = true;
      }
    } else {
      const newLeadPayload: any = {
        contact_id: contactId || null,
        company_id: companyId || null,
        source: 'TimeRex：日程予約',
        status: '面談予約済',
        meeting_date: booking.meetingDate,
        meeting_start_time: booking.meetingStartTime || null,
        notes: timerexNote,
        priority_channel: 'メール',
        first_registered_at: new Date().toISOString(),
        last_contacted_at: new Date().toISOString(),
      };
      if (resolvedOwnerId) newLeadPayload.owner_id = resolvedOwnerId;

      const { data: createdLead } = await db
        .from('leads')
        .insert(newLeadPayload)
        .select('id')
        .single();

      if (createdLead) {
        leadId = createdLead.id;
        changedSomething = true;
      }
    }

    // 3. Find or create Deal (non-downgrade safe & memo-preserving)
    let createdDealNow = false;
    if (existingDeal) {
      const currentDealStatus = String(existingDeal.proposal_status || '').trim();
      const isDealProgressed = DEAL_PROGRESSED_PAST_BOOKING.has(currentDealStatus);
      const isDealClosed = DEAL_CLOSED_STATUSES.has(currentDealStatus);
      const isDateChanged = existingDeal.meeting_date !== booking.meetingDate;
      const dealUpdateLine = `${noteLabel}: ${booking.meetingDate} ${booking.meetingStartTime || ''}${booking.meetUrl ? ` | Meet: ${booking.meetUrl}` : ''}`.trim();
      const priorMemo = String(existingDeal.memo || '');
      const hasSameMemo =
        priorMemo.includes(dealUpdateLine) ||
        (!isDateChanged && actionKind === 'confirmed' && priorMemo.includes(`面談日: ${booking.meetingDate}`));

      const shouldUpdateDealStatus =
        (!isDealProgressed && currentDealStatus !== '日程確定') ||
        (actionKind === 'rescheduled' && isDateChanged && !isDealClosed);

      if (!isDealClosed && (shouldUpdateDealStatus || isDateChanged || !hasSameMemo)) {
        const nextMemo = hasSameMemo ? priorMemo : `${priorMemo}\n${dealUpdateLine}`.trim().slice(-12_000);
        const dealPatch: any = {
          memo: nextMemo,
          updated_at: new Date().toISOString(),
        };
        if (shouldUpdateDealStatus) {
          dealPatch.proposal_status = '日程確定';
        }
        if (isDateChanged || !existingDeal.meeting_date) {
          dealPatch.meeting_date = booking.meetingDate;
        }
        await db.from('deals').update(dealPatch).eq('id', dealId);
        changedSomething = true;
      }
    } else {
      const dealTitle = `【面談予約】${contactName || booking.companyName || '新規個別面談'} 様`;
      const newDealPayload: any = {
        company_id: companyId || null,
        lead_id: leadId || null,
        proposal_plan_name: dealTitle,
        proposal_type: '新規導入',
        proposal_status: '日程確定',
        meeting_date: booking.meetingDate,
        memo: `TimeRex予約自動連携\n面談日: ${booking.meetingDate} ${booking.meetingStartTime || ''}\nMeet: ${booking.meetUrl || ''}\n備考: ${booking.memo || ''}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (resolvedOwnerId) newDealPayload.owner_id = resolvedOwnerId;

      const { data: createdDeal } = await db
        .from('deals')
        .insert(newDealPayload)
        .select('id')
        .single();

      if (createdDeal) {
        dealId = createdDeal.id;
        createdDealNow = true;
        changedSomething = true;
      }
    }

    // 4. Attach Contact Tag "個別相談予約済み" (stops reminder sequences)
    if (contactId) {
      try {
        const { data: existingTag } = await db
          .from('contact_tags')
          .select('id')
          .eq('contact_id', contactId)
          .eq('tag_id', '個別相談予約済み')
          .maybeSingle();

        if (!existingTag) {
          const tagPayload: any = {
            contact_id: contactId,
            tag_id: '個別相談予約済み',
            created_at: new Date().toISOString(),
          };
          if (resolvedOwnerId) tagPayload.owner_id = resolvedOwnerId;
          await db.from('contact_tags').insert(tagPayload);
        }
      } catch (tagErr) {
        console.warn('[TimeRexSync] Tag insert warning:', tagErr);
      }

      try {
        await cancelSupersededQueuedJobs(db, {
          contactId,
          trigger: 'booking_created',
        });
      } catch (cancelErr) {
        console.warn('[TimeRexSync] Queue cancellation warning:', cancelErr);
      }
    }

    // 5. Create Deduplicated Staff Task for Meeting Preparation
    const taskPrefix = actionKind === 'rescheduled' ? '【TimeRex日程変更】' : '【TimeRex面談予約】';
    const taskTitle = `${taskPrefix}${contactName} 様（${booking.meetingDate} ${booking.meetingStartTime || ''}）`;
    const taskDedupNeedle = `${contactName} 様（${booking.meetingDate}`;
    const taskDesc = `TimeRexより面談日程が${actionKind === 'rescheduled' ? '変更' : '確定'}しました。\nゲスト: ${contactName} 様（${cleanEmail}）\n日時: ${booking.meetingDate} ${booking.meetingStartTime || ''} 〜 ${booking.meetingEndTime || ''}\nWeb会議: ${booking.meetUrl || 'カレンダー参照'}\n備考: ${booking.memo || 'なし'}`;

    const taskInserted = await ensureTaskDeduplicated(db, {
      title: taskTitle,
      dedupNeedle: taskDedupNeedle,
      description: taskDesc,
      dueDate: booking.meetingDate,
      ownerId: resolvedOwnerId,
    });
    if (taskInserted) changedSomething = true;

    const resultAction: TimeRexSyncResult['action'] = !changedSomething
      ? 'skipped_no_change'
      : actionKind === 'rescheduled'
      ? 'rescheduled'
      : createdDealNow
      ? 'updated_lead_and_created_deal'
      : 'updated_both';

    return {
      success: true,
      leadId,
      dealId,
      companyId: companyId || undefined,
      contactId,
      bookingAction: actionKind,
      action: resultAction,
      details: `リード(${leadId})・商談(${dealId})へ面談日(${booking.meetingDate})を自動同期しました。`,
    };
  } catch (err: any) {
    console.error('[TimeRexSync] Exception syncing to CRM:', err);
    return {
      success: false,
      bookingAction: actionKind,
      error: err?.message || 'TimeRexデータのCRM同期に失敗しました。',
      action: 'skipped_no_change',
    };
  }
}
