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

function htmlBodyToPlainTextPreservingLinks(html: string): string {
  if (!html) return '';
  let work = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');

  work = work.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_full, rawHref, innerHtml) => {
    const href = String(rawHref || '')
      .replace(/&amp;/gi, '&')
      .trim();
    const innerText = String(innerHtml || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!/^https?:\/\//i.test(href)) return innerText;
    if (!innerText) return href;
    if (innerText.includes(href)) return innerText;
    return `${innerText} (${href})`;
  });

  work = work
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|section|article|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  return work;
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
  const cleanText = (textBody || '').trim();
  const cleanHtmlText = htmlBody ? htmlBodyToPlainTextPreservingLinks(htmlBody) : '';
  const content = cleanText || cleanHtmlText;
  const combinedForLinks = `${content}\n${cleanHtmlText}`;
  const bookingAction = classifyTimeRexEmailAction(subject, content);

  const guestEmail =
    extractGuestEmailFromText(content, extraHostEmails) ||
    (cleanHtmlText && cleanHtmlText !== content ? extractGuestEmailFromText(cleanHtmlText, extraHostEmails) : null);
  if (!guestEmail) {
    return null; // Email is required to match with CRM
  }

  // Extract Guest Name
  let guestName = '';
  const nameMatch =
    content.match(/(?:お客様名|ゲスト氏名|ゲスト名|お名前|氏名|予約者名|予約者)[ \t]*[:：][ \t]*([^\n\r(（<]+)/) ||
    content.match(/(?:^|\n)[ \t]*(?:ゲスト|相手方)[ \t]*[:：][ \t]*([^\n\r@<]+)/) ||
    subject.match(/【TimeRex】\s*(?:\[[^\]]+\])?\s*([^\n\r(（]+?)\s*様/);

  if (nameMatch) {
    guestName = nameMatch[1].replace(/様.*$/, '').trim();
  }

  // Extract Company Name (use horizontal whitespace only so empty "会社名:\n..." does not bleed into the next line)
  let companyName = '';
  const compMatch = content.match(/(?:会社名|御社名|会社|所属)[ \t]*[:：][ \t]*([^\n\r]+)/);
  if (compMatch) {
    companyName = compMatch[1].trim();
  }

  // Extract Phone Number
  let phone = '';
  const phoneMatch = content.match(/(?:電話番号|TEL|連絡先)[ \t]*[:：][ \t]*([0-9\-+()]{9,15})/i);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }

  // Extract Date and Time (supports both half-width (金) and full-width （金） day-of-week parens)
  let meetingDate = '';
  let meetingStartTime = '';
  let meetingEndTime = '';

  const dateTimeMatch =
    content.match(/(?:変更後の日時|新しい日時|日時|予定日時)[ \t]*[:：]\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*[\(（][^)）]+[\)）])?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/) ||
    content.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*[\(（][^)）]+[\)）])?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/);

  if (dateTimeMatch) {
    const y = dateTimeMatch[1];
    const m = String(dateTimeMatch[2]).padStart(2, '0');
    const d = String(dateTimeMatch[3]).padStart(2, '0');
    meetingDate = `${y}-${m}-${d}`;
    meetingStartTime = dateTimeMatch[4].padStart(5, '0');
    meetingEndTime = dateTimeMatch[5] ? dateTimeMatch[5].padStart(5, '0') : '';
  } else {
    const monthDayMatch = content.match(/(?:日時|予定日時)[ \t]*[:：]\s*(\d{1,2})月(\d{1,2})日(?:\s*[\(（][^)）]+[\)）])?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/);
    if (monthDayMatch) {
      const y = new Date().getFullYear();
      const m = String(monthDayMatch[1]).padStart(2, '0');
      const d = String(monthDayMatch[2]).padStart(2, '0');
      meetingDate = `${y}-${m}-${d}`;
      meetingStartTime = monthDayMatch[3].padStart(5, '0');
      meetingEndTime = monthDayMatch[4] ? monthDayMatch[4].padStart(5, '0') : '';
    }
  }

  // Extract Meet / Zoom URL (search both plain text and preserved HTML hrefs)
  let meetUrl = '';
  const meetMatch = combinedForLinks.match(
    /https:\/\/(?:meet\.google\.com\/[a-z-]+|us\d+web\.zoom\.us\/j\/[0-9?a-z=_-]+|zoom\.us\/j\/[0-9?a-z=_-]+|teams\.microsoft\.com\/[^\s)<>]+)/i
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

  // Extract Guest Name from title: e.g. "【TimeRex】山田 太郎 様" or "山田太郎様 (TimeRex)"
  let guestName = '';
  const nameInTitle =
    title.match(/【TimeRex】\s*(?:\[[^\]]+\])?\s*([^\n\r(（]+?)\s*様(?:\s|$|[（(])/) ||
    title.match(/【TimeRex】\s*(?:\[[^\]]+\])?\s*([^\s(（]+)/) ||
    title.match(/([^\n\r(（]+?)\s*様?\s*(?:\(TimeRex\)|（TimeRex）)/);
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
  params: {
    title: string;
    dedupNeedle: string;
    description: string;
    dueDate?: string | null;
    ownerId?: string | null;
    skipIfDoneExists?: boolean;
  }
) {
  try {
    const { data: existingTasks } = await db
      .from('tasks')
      .select('id, title, status')
      .ilike('title', `%${params.dedupNeedle}%`)
      .limit(5);

    const alreadyExists = (existingTasks || []).some((t: any) => {
      const title = String(t.title || '');
      if (params.skipIfDoneExists && title.includes(params.dedupNeedle)) return true;
      return title === params.title || (t.status !== 'done' && title.includes(params.dedupNeedle));
    });
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
    let insertRes: any = await db.from('tasks').insert(taskPayload);
    if (insertRes?.error && taskPayload.owner_id && /owner_id/i.test(String(insertRes.error.message || ''))) {
      const { owner_id: _ignored, ...withoutOwner } = taskPayload;
      insertRes = await db.from('tasks').insert(withoutOwner);
    }
    if (insertRes?.error) {
      console.warn('[TimeRexSync] Task insert error:', insertRes.error.message || insertRes.error);
      return false;
    }
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

    const { data: existingContacts, error: contactSelectErr } = await db
      .from('contacts')
      .select('id, full_name, company_id')
      .ilike('email', cleanEmail)
      .limit(1);

    if (contactSelectErr) {
      console.warn('[TimeRexSync] Contact lookup warning:', contactSelectErr);
    }

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
        source: 'timerex',
        created_at: new Date().toISOString(),
      };

      const { data: createdContact, error: contactErr } = await db
        .from('contacts')
        .insert(newContactPayload)
        .select('id')
        .single();

      if (contactErr) {
        console.warn('[TimeRexSync] Contact insert warning:', contactErr);
      }
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

    // If company exists or can be matched / created (flexible handling for sole proprietors / no company name)
    if (!companyId && actionKind !== 'cancelled') {
      const rawCompany = (booking.companyName || '').trim();
      const lowerCompany = rawCompany.toLowerCase();
      const isNoCompanyPlaceholder =
        !rawCompany ||
        ['なし', '無し', '無', '-', 'ー', '―', '－', 'n/a', 'none', '個人', '個人名義'].includes(lowerCompany);
      const isSoleProprietorKeyword = ['個人事業主', 'フリーランス', '自営業', '屋号なし'].includes(rawCompany);

      const targetCompanyName = isNoCompanyPlaceholder
        ? `${contactName || '予約ゲスト'}様（個人）`
        : isSoleProprietorKeyword
          ? `${contactName || '予約ゲスト'}様（${rawCompany}）`
          : rawCompany;

      const { data: existingComp } = await db
        .from('companies')
        .select('id')
        .ilike('company_name', targetCompanyName)
        .limit(1);

      if (existingComp && existingComp.length > 0) {
        companyId = existingComp[0].id;
      } else {
        const compPayload: any = {
          company_name: targetCompanyName,
          contact_name: contactName || null,
          email: cleanEmail || null,
          phone: booking.phone || null,
          created_at: new Date().toISOString(),
        };
        const firstCompTry = await db.from('companies').insert(compPayload).select('id').single();
        if (!firstCompTry.error && firstCompTry.data?.id) {
          companyId = firstCompTry.data.id;
        } else {
          const fallbackCompanyId = `CID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const retryComp = await db
            .from('companies')
            .insert({ id: fallbackCompanyId, ...compPayload })
            .select('id')
            .single();
          if (retryComp.error) {
            console.warn('[TimeRexSync] Company insert warning:', retryComp.error);
          } else if (retryComp.data?.id) {
            companyId = retryComp.data.id;
          }
        }
      }

      if (companyId && contactId) {
        await db.from('contacts').update({ company_id: companyId }).eq('id', contactId);
      }
    }

    // Load existing Lead & Deal
    let leadId = '';
    let existingLeads: any[] | null = null;
    if (contactId) {
      const { data } = await db
        .from('leads')
        .select('id, notes, status, company_id, meeting_date, meeting_start_time')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1);
      existingLeads = data;
    } else if (companyId) {
      const { data } = await db
        .from('leads')
        .select('id, notes, status, company_id, meeting_date, meeting_start_time')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1);
      existingLeads = data;
    }

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
    let leadErrorMsg = '';
    let dealErrorMsg = '';

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
        const { error: leadUpdErr } = await db.from('leads').update(leadPatch).eq('id', leadId);
        if (leadUpdErr) {
          leadErrorMsg = leadUpdErr.message || String(leadUpdErr);
          console.warn('[TimeRexSync] Lead update warning:', leadUpdErr);
        } else {
          changedSomething = true;
        }
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

      const { data: createdLead, error: leadInsErr } = await db
        .from('leads')
        .insert(newLeadPayload)
        .select('id')
        .single();

      if (leadInsErr) {
        leadErrorMsg = leadInsErr.message || String(leadInsErr);
        console.warn('[TimeRexSync] Lead insert warning:', leadInsErr);
      } else if (createdLead) {
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
        const { error: dealUpdErr } = await db.from('deals').update(dealPatch).eq('id', dealId);
        if (dealUpdErr) {
          dealErrorMsg = dealUpdErr.message || String(dealUpdErr);
          console.warn('[TimeRexSync] Deal update warning:', dealUpdErr);
        } else {
          changedSomething = true;
        }
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

      let dealInsertRes = await db
        .from('deals')
        .insert(newDealPayload)
        .select('id')
        .single();

      if (dealInsertRes.error) {
        const fallbackDealId = `DEAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const retryDealRes = await db
          .from('deals')
          .insert({ id: fallbackDealId, ...newDealPayload })
          .select('id')
          .single();
        if (!retryDealRes.error) {
          dealInsertRes = retryDealRes;
        }
      }

      if (dealInsertRes.error) {
        dealErrorMsg = dealInsertRes.error.message || String(dealInsertRes.error);
        console.warn('[TimeRexSync] Deal insert error:', dealInsertRes.error);
      } else if (dealInsertRes.data) {
        dealId = dealInsertRes.data.id;
        createdDealNow = true;
        changedSomething = true;
      }
    }

    if (!existingDeal && !dealId && dealErrorMsg) {
      return {
        success: false,
        leadId: leadId || undefined,
        companyId: companyId || undefined,
        contactId: contactId || undefined,
        bookingAction: actionKind,
        action: 'skipped_no_change',
        error: `商談パイプライン登録エラー: ${dealErrorMsg}${leadErrorMsg ? ` / リード登録エラー: ${leadErrorMsg}` : ''}`,
      };
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
    const timeSuffix = booking.meetingStartTime ? ` ${booking.meetingStartTime}` : '';
    const taskDedupNeedle =
      actionKind === 'rescheduled'
        ? `${taskPrefix}${contactName} 様（${booking.meetingDate}${timeSuffix}`
        : `${contactName} 様（${booking.meetingDate}${timeSuffix}`;
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

/**
 * Checks in JST (UTC+9) whether a scheduled meeting has passed its start time + grace window
 * and falls within the active lookback window (default: 14 days).
 */
export function isMeetingOverdueForCompletionCheck(
  meetingDate: string | null | undefined,
  meetingStartTime?: string | null,
  nowDate: Date = new Date(),
  graceMinutes: number = 60,
  maxAgeDays: number = 14
): boolean {
  const cleanDate = String(meetingDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return false;

  const cleanTime = /^\d{1,2}:\d{2}/.test(String(meetingStartTime || '').trim())
    ? String(meetingStartTime).trim().slice(0, 5).padStart(5, '0')
    : '18:00';

  const meetingUtcMs = Date.parse(`${cleanDate}T${cleanTime}:00+09:00`);
  if (Number.isNaN(meetingUtcMs)) return false;

  const nowMs = nowDate.getTime();
  const elapsedMs = nowMs - meetingUtcMs;
  if (elapsedMs < graceMinutes * 60_000) return false;
  if (elapsedMs > maxAgeDays * 86_400_000) return false;
  return true;
}

/**
 * Scans booked leads ('面談予約済') and open scheduled deals ('日程確定', '初回面談')
 * whose meeting datetime has passed, and raises ONE deduplicated staff reminder task
 * ('【面談完了確認】...') so no post-meeting follow-up is forgotten while preventing false sends.
 */
export async function checkOverdueMeetingCompletionReminders(
  db: any,
  nowDate: Date = new Date(),
  fallbackOwnerId: string | null = null
): Promise<{ checked: number; created: number }> {
  if (!db) return { checked: 0, created: 0 };

  let checked = 0;
  let created = 0;

  try {
    const [{ data: bookedLeads }, { data: scheduledDeals }] = await Promise.all([
      db
        .from('leads')
        .select('id, contact_id, company_id, status, meeting_date, meeting_start_time, company:companies(company_name), contact:contacts(full_name)')
        .eq('status', '面談予約済')
        .limit(100),
      db
        .from('deals')
        .select('id, lead_id, company_id, proposal_status, proposal_plan_name, meeting_date, company:companies(company_name)')
        .in('proposal_status', ['日程確定', '初回面談'])
        .limit(100),
    ]);

    const processedLeadIds = new Set<string>();
    const processedCompanyDates = new Set<string>();

    for (const lead of bookedLeads || []) {
      if (!lead.meeting_date) continue;
      checked++;
      if (!isMeetingOverdueForCompletionCheck(lead.meeting_date, lead.meeting_start_time, nowDate)) {
        continue;
      }
      processedLeadIds.add(String(lead.id));
      if (lead.company_id) {
        processedCompanyDates.add(`${lead.company_id}::${lead.meeting_date}`);
      }

      const contactName = lead.contact?.full_name || lead.company?.company_name || 'お客様';
      const timeLabel = lead.meeting_start_time ? ` ${String(lead.meeting_start_time).slice(0, 5)}` : '';
      const inserted = await ensureTaskDeduplicated(db, {
        title: `【面談完了確認】${contactName} 様（${lead.meeting_date}${timeLabel}）`,
        dedupNeedle: `【面談完了確認】${contactName} 様（${lead.meeting_date}`,
        description:
          `予約していた面談日時（${lead.meeting_date}${timeLabel}）が経過しました。\n` +
          `■ 面談が実施・完了した場合：リード／商談詳細またはカレンダーの「商談完了・お礼フォロー起動」を押してください（ステータスが「面談実施済／面談完了」になり、お礼フォローメールが自動予約されます）。\n` +
          `■ 日程再調整・キャンセルとなった場合：ステータスを「再調整待ち」または「日程再調整」に変更してください。`,
        dueDate: lead.meeting_date,
        ownerId: fallbackOwnerId,
        skipIfDoneExists: true,
      });
      if (inserted) created++;
    }

    for (const deal of scheduledDeals || []) {
      if (!deal.meeting_date) continue;
      if (deal.lead_id && processedLeadIds.has(String(deal.lead_id))) continue;
      if (deal.company_id && processedCompanyDates.has(`${deal.company_id}::${deal.meeting_date}`)) continue;

      checked++;
      if (!isMeetingOverdueForCompletionCheck(deal.meeting_date, null, nowDate)) {
        continue;
      }

      const targetName = deal.company?.company_name || deal.proposal_plan_name || '商談案件';
      const inserted = await ensureTaskDeduplicated(db, {
        title: `【面談完了確認】${targetName} 様（${deal.meeting_date}）`,
        dedupNeedle: `【面談完了確認】${targetName} 様（${deal.meeting_date}`,
        description:
          `商談予定日（${deal.meeting_date}）が経過しました。\n` +
          `■ 面談が実施・完了した場合：商談詳細またはカレンダーの「商談完了・お礼フォロー起動」を押して「面談完了」＆お礼フォローを起動してください。\n` +
          `■ 未実施・変更の場合：ステータスを「日程再調整」または「保留」等へ更新してください。`,
        dueDate: deal.meeting_date,
        ownerId: fallbackOwnerId,
        skipIfDoneExists: true,
      });
      if (inserted) created++;
    }
  } catch (err) {
    console.warn('[TimeRexSync] checkOverdueMeetingCompletionReminders warning:', err);
  }

  return { checked, created };
}
