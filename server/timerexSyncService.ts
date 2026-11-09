/**
 * TimeRex Booking Parser and CRM Synchronization Service (Pattern A)
 * 
 * Automatically detects TimeRex booking confirmations from:
 * 1. Notification emails (Resend inbound / forwarded from Gmail)
 * 2. Google Calendar iCal events (IntegratedCalendarWorkspace / icalParser)
 * 3. Direct Webhooks (if configured)
 * 
 * And synchronizes them directly into:
 * - leads (リード管理): updates status to '面談予約済', sets meeting_date
 * - deals (商談パイプライン): creates or updates deal card with '日程確定' stage
 * - contact_tags: tags with '個別相談予約済み' (auto-pauses nurture reminders)
 * - tasks (タスク): creates a high-priority task for staff
 */

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
  sourceType: 'email' | 'calendar' | 'webhook';
  rawId?: string;
}

export interface TimeRexSyncResult {
  success: boolean;
  leadId?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  action: 'created_both' | 'updated_lead_and_created_deal' | 'updated_both' | 'skipped_no_change';
  details?: string;
  error?: string;
}

/**
 * Checks whether an incoming email is a TimeRex booking notification.
 */
export function isTimeRexEmail(from: string, subject: string, bodyText: string): boolean {
  const cleanFrom = String(from || '').toLowerCase();
  const cleanSubj = String(subject || '').toLowerCase();
  const cleanBody = String(bodyText || '').toLowerCase();

  const isFromTimeRex = cleanFrom.includes('timerex.net') || cleanFrom.includes('timerex');
  const isTimeRexSubject = cleanSubj.includes('timerex') || cleanSubj.includes('日程調整が完了') || cleanSubj.includes('予約が完了');
  const isTimeRexBody = cleanBody.includes('timerex') && (cleanBody.includes('予定が確定') || cleanBody.includes('日程調整') || cleanBody.includes('面談'));

  return isFromTimeRex || isTimeRexSubject || isTimeRexBody;
}

/**
 * Parses a TimeRex confirmation email body into structured booking data.
 */
export function parseTimeRexEmail(subject: string, textBody: string, htmlBody?: string): TimeRexBookingInfo | null {
  const content = (textBody || htmlBody || '').replace(/<[^>]+>/g, ' ');

  // Extract Email
  const emailMatch =
    content.match(/(?:ゲストメールアドレス|メールアドレス|メール|E-?mail)[:：]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) ||
    content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

  if (!emailMatch) {
    return null; // Email is required to match with CRM
  }
  const guestEmail = emailMatch[1].trim().toLowerCase();

  // Exclude TimeRex system email or host email from being the guest
  if (guestEmail.includes('timerex') || guestEmail.includes('mst.shikumikaizen@gmail.com') || guestEmail.includes('contact@mstcorp.info')) {
    // Search again for guest email specifically
    const secondaryEmailMatch = content.match(/(?:ゲスト|予約者|相手方)[^@\n]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (!secondaryEmailMatch) return null;
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
  // Examples:
  // 2026年11月15日(金) 14:00 - 14:30
  // 2026/11/15 14:00〜14:30
  // 2026-11-15 14:00
  let meetingDate = '';
  let meetingStartTime = '';
  let meetingEndTime = '';

  const dateTimeMatch =
    content.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*\([^\)]+\))?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/) ||
    content.match(/(?:日時|予定日時)[:：]\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})(?:日)?(?:\s*\([^\)]+\))?\s+(\d{1,2}:\d{2})(?:\s*[-〜~]\s*(\d{1,2}:\d{2}))?/);

  if (dateTimeMatch) {
    const y = dateTimeMatch[1];
    const m = String(dateTimeMatch[2]).padStart(2, '0');
    const d = String(dateTimeMatch[3]).padStart(2, '0');
    meetingDate = `${y}-${m}-${d}`;
    meetingStartTime = dateTimeMatch[4];
    meetingEndTime = dateTimeMatch[5] || '';
  }

  // Extract Meet / Zoom URL
  let meetUrl = '';
  const meetMatch = content.match(/https:\/\/(?:meet\.google\.com\/[a-z-]+|us02web\.zoom\.us\/j\/[0-9?a-z=_-]+|teams\.microsoft\.com\/[^\s]+)/i);
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

  if (!meetingDate) {
    // If no date could be parsed, we cannot set the meeting
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
    sourceType: 'email',
  };
}

/**
 * Checks whether an iCal calendar event originates from TimeRex and extracts booking details.
 */
export function parseTimeRexCalendarEvent(event: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  meetUrl?: string;
  notes?: string;
}): TimeRexBookingInfo | null {
  const title = event.title || '';
  const notes = event.notes || '';
  const combined = `${title}\n${notes}`;

  const isTimeRex =
    title.includes('TimeRex') ||
    title.includes('timerex') ||
    notes.includes('timerex.net') ||
    notes.includes('TimeRex');

  if (!isTimeRex) return null;

  // Extract Guest Email from notes or attendees
  const emailMatch = notes.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!emailMatch) return null;

  const guestEmail = emailMatch[1].trim().toLowerCase();
  if (guestEmail.includes('timerex') || guestEmail.includes('mst.shikumikaizen@gmail.com') || guestEmail.includes('contact@mstcorp.info')) {
    return null;
  }

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
    sourceType: 'calendar',
  };
}

/**
 * Synchronizes parsed TimeRex booking data into Leads, Deals, Contact Tags, and Tasks.
 */
export async function syncTimeRexBookingToCrm(
  booking: TimeRexBookingInfo,
  db: any,
  ownerId?: string | null
): Promise<TimeRexSyncResult> {
  if (!db || !booking.guestEmail || !booking.meetingDate) {
    return { success: false, error: 'DBクライアントまたはメール・面談日時が不足しています。', action: 'skipped_no_change' };
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
      // Create new contact
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

    // If company exists or can be matched / created
    if (!companyId && booking.companyName) {
      const { data: existingComp } = await db
        .from('companies')
        .select('id')
        .ilike('company_name', booking.companyName.trim())
        .limit(1);

      if (existingComp && existingComp.length > 0) {
        companyId = existingComp[0].id;
      } else {
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

    // 2. Find or create Lead
    let leadId = '';
    const { data: existingLeads } = await db
      .from('leads')
      .select('id, notes, status, company_id, meeting_date')
      .or(`contact_id.eq.${contactId || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })
      .limit(1);

    const timerexNote = `[TimeRex予約確定] 日程: ${booking.meetingDate} ${booking.meetingStartTime || ''}${booking.meetUrl ? `\nMeet URL: ${booking.meetUrl}` : ''}${booking.memo ? `\n備考: ${booking.memo}` : ''}`;

    if (existingLeads && existingLeads.length > 0) {
      leadId = existingLeads[0].id;
      const priorNotes = existingLeads[0].notes || '';
      const updatedNotes = priorNotes.includes(booking.meetingDate)
        ? priorNotes
        : `${priorNotes}\n\n${timerexNote}`.trim().slice(-12_000);

      await db.from('leads').update({
        status: '面談予約済',
        meeting_date: booking.meetingDate,
        meeting_start_time: booking.meetingStartTime || null,
        notes: updatedNotes,
        last_contacted_at: new Date().toISOString(),
        ...(companyId && !existingLeads[0].company_id ? { company_id: companyId } : {}),
      }).eq('id', leadId);
    } else {
      // Create new lead
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

      if (createdLead) leadId = createdLead.id;
    }

    // 3. Find or create Deal (商談パイプライン)
    let dealId = '';
    const dealQuery = db.from('deals').select('id, proposal_status, meeting_date');
    if (leadId) {
      dealQuery.eq('lead_id', leadId);
    } else if (companyId) {
      dealQuery.eq('company_id', companyId);
    }

    const { data: existingDeals } = await dealQuery.limit(1);

    if (existingDeals && existingDeals.length > 0) {
      dealId = existingDeals[0].id;
      await db.from('deals').update({
        proposal_status: '日程確定',
        meeting_date: booking.meetingDate,
        memo: `TimeRex日程更新: ${booking.meetingDate} ${booking.meetingStartTime || ''}${booking.meetUrl ? ` | Meet: ${booking.meetUrl}` : ''}`,
        updated_at: new Date().toISOString(),
      }).eq('id', dealId);
    } else {
      // Create new deal card for pipeline
      const dealTitle = `【面談予約】${contactName || booking.companyName || '新規個別面談'} 様`;
      const newDealPayload: any = {
        company_id: companyId || null,
        lead_id: leadId || null,
        proposal_plan_name: dealTitle,
        proposal_type: '月額サブスク',
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

      if (createdDeal) dealId = createdDeal.id;
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
    }

    // 5. Create Staff Task for Meeting Preparation
    try {
      const taskTitle = `【TimeRex面談予約】${contactName} 様（${booking.meetingDate} ${booking.meetingStartTime || ''}）`;
      const taskDesc = `TimeRexより面談日程が確定しました。\nゲスト: ${contactName} 様（${cleanEmail}）\n日時: ${booking.meetingDate} ${booking.meetingStartTime || ''} 〜 ${booking.meetingEndTime || ''}\nWeb会議: ${booking.meetUrl || 'カレンダー参照'}\n備考: ${booking.memo || 'なし'}`;

      const taskPayload: any = {
        title: taskTitle,
        description: taskDesc,
        status: 'todo',
        priority: 'high',
        due_date: booking.meetingDate,
        created_at: new Date().toISOString(),
      };
      if (resolvedOwnerId) taskPayload.owner_id = resolvedOwnerId;
      await db.from('tasks').insert(taskPayload);
    } catch (taskErr) {
      console.warn('[TimeRexSync] Task insert warning:', taskErr);
    }

    return {
      success: true,
      leadId,
      dealId,
      companyId: companyId || undefined,
      contactId,
      action: existingDeals && existingDeals.length > 0 ? 'updated_both' : 'updated_lead_and_created_deal',
      details: `リード(${leadId})・商談(${dealId})へ面談日(${booking.meetingDate})を自動同期しました。`,
    };
  } catch (err: any) {
    console.error('[TimeRexSync] Exception syncing to CRM:', err);
    return {
      success: false,
      error: err?.message || 'TimeRexデータのCRM同期に失敗しました。',
      action: 'skipped_no_change',
    };
  }
}
