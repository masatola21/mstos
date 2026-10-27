import { getSupabase } from '../lib/supabaseClient';
import type { CalendarItem, CustomCalendarEvent, CalendarEventCategory, GoogleSyncedEvent } from '../types/calendar';
import type { ManagedInvoice, ManagedContract } from '../types/matrix';
import type { TaskItem } from '../types';

const STORAGE_KEY_CUSTOM_EVENTS = 'mst_calendar_custom_events_v1';
const STORAGE_KEY_GOOGLE_ICAL_URL = 'mst_calendar_google_ical_url_v1';
const STORAGE_KEY_GOOGLE_EVENTS_CACHE = 'mst_calendar_google_events_cache_v1';
const STORAGE_KEY_GOOGLE_LAST_SYNC = 'mst_calendar_google_last_sync_v1';
const STORAGE_KEY_GOOGLE_CALENDAR_NAME = 'mst_calendar_google_cal_name_v1';

export function loadCustomCalendarEvents(): CustomCalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_EVENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load custom calendar events from localStorage:', err);
    return [];
  }
}

export function saveCustomCalendarEvents(events: CustomCalendarEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_EVENTS, JSON.stringify(events));
  } catch (err) {
    console.warn('Failed to save custom calendar events to localStorage:', err);
  }
}

export function getStoredGoogleIcalUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GOOGLE_ICAL_URL) || '';
  } catch {
    return '';
  }
}

export function setStoredGoogleIcalUrl(url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(STORAGE_KEY_GOOGLE_ICAL_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_GOOGLE_ICAL_URL);
    }
  } catch (err) {
    console.warn('Failed to save iCal URL to localStorage:', err);
  }
}

export function getStoredGoogleEvents(): GoogleSyncedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOOGLE_EVENTS_CACHE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load Google events cache:', err);
    return [];
  }
}

export function setStoredGoogleEvents(events: GoogleSyncedEvent[], calendarName?: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GOOGLE_EVENTS_CACHE, JSON.stringify(events));
    localStorage.setItem(STORAGE_KEY_GOOGLE_LAST_SYNC, new Date().toISOString());
    if (calendarName) {
      localStorage.setItem(STORAGE_KEY_GOOGLE_CALENDAR_NAME, calendarName);
    }
  } catch (err) {
    console.warn('Failed to cache Google events:', err);
  }
}

export function getGoogleCalendarSyncInfo(): { lastSync: string | null; calendarName: string } {
  try {
    const lastSync = localStorage.getItem(STORAGE_KEY_GOOGLE_LAST_SYNC);
    const calendarName = localStorage.getItem(STORAGE_KEY_GOOGLE_CALENDAR_NAME) || '事業用Googleカレンダー';
    return { lastSync, calendarName };
  } catch {
    return { lastSync: null, calendarName: '事業用Googleカレンダー' };
  }
}

export function clearGoogleCalendarSync(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_GOOGLE_ICAL_URL);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_EVENTS_CACHE);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_LAST_SYNC);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_CALENDAR_NAME);
  } catch (err) {
    console.warn('Failed to clear Google calendar sync:', err);
  }
}

/**
 * サーバー経由で事業用GoogleカレンダーのiCal feedを取得・パース
 */
export async function fetchGoogleCalendarFromIcal(icalUrl: string): Promise<{
  success: boolean;
  calendarName: string;
  events: GoogleSyncedEvent[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/calendar/fetch-ical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icalUrl }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        calendarName: '',
        events: [],
        error: data.error || `HTTP ${res.status} エラーが発生しました。`,
      };
    }

    const events: GoogleSyncedEvent[] = Array.isArray(data.events) ? data.events : [];
    const calendarName = data.calendarName || '事業用Googleカレンダー';

    setStoredGoogleEvents(events, calendarName);
    setStoredGoogleIcalUrl(icalUrl);

    return {
      success: true,
      calendarName,
      events,
    };
  } catch (err: any) {
    return {
      success: false,
      calendarName: '',
      events: [],
      error: err.message || '通信エラーによりカレンダーを取得できませんでした。',
    };
  }
}

/**
 * Google カレンダー 1-Click 追加用 URL を生成
 * ユーザーの Google カレンダー Web 画面が開き、タイトル・日時・対象企業・アジェンダが自動入力されます。
 */
export function buildGoogleCalendarUrl(event: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  location?: string;
  meetUrl?: string;
  notes?: string;
  companyName?: string;
}): string {
  const cleanDate = event.date.replace(/-/g, '');
  let datesParam = '';

  if (event.startTime && !event.isAllDay) {
    const startHour = event.startTime.replace(':', '');
    let endHour = '';
    if (event.endTime) {
      endHour = event.endTime.replace(':', '');
    } else {
      const [h, m] = event.startTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      endHour = `${String(endH).padStart(2, '0')}${String(m || 0).padStart(2, '0')}`;
    }
    datesParam = `${cleanDate}T${startHour.padEnd(4, '0')}00/${cleanDate}T${endHour.padEnd(4, '0')}00`;
  } else {
    // 終日イベント: 翌日日付を終了とする
    try {
      const parts = event.date.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + 1);
      const nextY = d.getFullYear();
      const nextM = String(d.getMonth() + 1).padStart(2, '0');
      const nextD = String(d.getDate()).padStart(2, '0');
      datesParam = `${cleanDate}/${nextY}${nextM}${nextD}`;
    } catch {
      datesParam = `${cleanDate}/${cleanDate}`;
    }
  }

  const detailsParts: string[] = [];
  if (event.companyName) detailsParts.push(`【対象企業】: ${event.companyName}`);
  if (event.meetUrl) detailsParts.push(`【面談/MTG URL】: ${event.meetUrl}`);
  if (event.notes) detailsParts.push(`【アジェンダ・詳細】:\n${event.notes}`);
  detailsParts.push('------------------------\nMST AI経営OS 統合カレンダー連携');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: datesParam,
    details: detailsParts.join('\n\n'),
    location: event.location || (event.meetUrl ? 'オンライン面談' : ''),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export interface CalendarDataPayload {
  companies: Array<{ id: string; company_name: string }>;
  deals: Array<any>;
  leads: Array<any>;
  engagements: Array<any>;
  supportMeetings: Array<any>;
  invoices: ManagedInvoice[];
  contracts: ManagedContract[];
  tasks: TaskItem[];
  customEvents: CustomCalendarEvent[];
  googleEvents?: GoogleSyncedEvent[];
}

/**
 * データベースおよびメモリ上の各エンティティから統合カレンダーアイテムリストを生成
 */
export function buildAggregatedCalendarItems(payload: CalendarDataPayload): CalendarItem[] {
  const items: CalendarItem[] = [];
  const companyMap = new Map<string, string>();
  payload.companies.forEach((c) => companyMap.set(c.id, c.company_name));

  // 1. Deals (商談面談・フォロー期日)
  payload.deals.forEach((deal) => {
    const compName = deal.company?.company_name || companyMap.get(deal.company_id) || '企業未設定';
    const baseAmt = typeof deal.total_amount === 'number' ? deal.total_amount : undefined;
    const taxAmt = baseAmt !== undefined ? Math.round(baseAmt * 0.1) : undefined;
    const totalAmt = baseAmt !== undefined ? baseAmt + (taxAmt || 0) : undefined;

    if (deal.meeting_date) {
      const datePart = deal.meeting_date.slice(0, 10);
      const timePart = deal.meeting_date.includes('T') ? deal.meeting_date.slice(11, 16) : undefined;
      items.push({
        id: `deal-meeting-${deal.id}`,
        source: 'deal',
        category: 'deal',
        title: `【商談面談】${compName} - ${deal.proposal_plan_name || '提案面談'}`,
        date: datePart,
        startTime: timePart,
        isAllDay: !timePart,
        companyId: deal.company_id,
        companyName: compName,
        status: deal.proposal_status,
        statusLabel: deal.proposal_status || '進行中',
        amount: baseAmt,
        taxAmount: taxAmt,
        totalAmount: totalAmt,
        isTaxExclusive: true,
        notes: deal.memo || undefined,
        linkTab: 'deals',
        linkContext: { companyId: deal.company_id, dealId: deal.id },
        meta: { deal },
      });
    }

    if (deal.next_followup_at) {
      const datePart = deal.next_followup_at.slice(0, 10);
      items.push({
        id: `deal-followup-${deal.id}`,
        source: 'deal',
        category: 'deal',
        title: `【フォロー期日】${compName} - ${deal.proposal_plan_name || '商談検討'}`,
        date: datePart,
        isAllDay: true,
        companyId: deal.company_id,
        companyName: compName,
        status: deal.proposal_status,
        statusLabel: 'フォローアップ',
        amount: baseAmt,
        taxAmount: taxAmt,
        totalAmount: totalAmt,
        isTaxExclusive: true,
        notes: deal.memo || undefined,
        linkTab: 'deals',
        linkContext: { companyId: deal.company_id, dealId: deal.id },
      });
    }
  });

  // 2. Leads (リード面談・初回ヒアリング)
  payload.leads.forEach((lead) => {
    const compName = lead.company?.company_name || (lead.company_id ? companyMap.get(lead.company_id) : undefined) || 'リード企業';
    if (lead.meeting_date) {
      const datePart = lead.meeting_date.slice(0, 10);
      const timePart = lead.meeting_start_time || (lead.meeting_date.includes('T') ? lead.meeting_date.slice(11, 16) : undefined);
      items.push({
        id: `lead-meeting-${lead.id}`,
        source: 'lead',
        category: 'deal',
        title: `【初回面談】${compName} - 反響リードヒアリング`,
        date: datePart,
        startTime: timePart,
        isAllDay: !timePart,
        companyId: lead.company_id || undefined,
        companyName: compName,
        status: lead.status,
        statusLabel: lead.status || '新規リード',
        notes: lead.notes || undefined,
        linkTab: 'leads',
        linkContext: { leadId: lead.id, companyId: lead.company_id || undefined },
      });
    }

    if (lead.next_action_at) {
      const datePart = lead.next_action_at.slice(0, 10);
      items.push({
        id: `lead-nextaction-${lead.id}`,
        source: 'lead',
        category: 'deal',
        title: `【次回対応】${compName} - リードアクション`,
        date: datePart,
        isAllDay: true,
        companyId: lead.company_id || undefined,
        companyName: compName,
        status: lead.status,
        statusLabel: 'リード対応',
        notes: lead.notes || undefined,
        linkTab: 'leads',
        linkContext: { leadId: lead.id, companyId: lead.company_id || undefined },
      });
    }
  });

  // 3. Customer Support Engagements (支援案件次回面談)
  payload.engagements.forEach((eng) => {
    const compName = companyMap.get(eng.company_id) || '支援先企業';
    if (eng.next_meeting_at) {
      const datePart = eng.next_meeting_at.slice(0, 10);
      const timePart = eng.next_meeting_at.includes('T') ? eng.next_meeting_at.slice(11, 16) : undefined;
      const details = eng.support_details && typeof eng.support_details === 'object' ? eng.support_details : {};
      items.push({
        id: `support-nextmtg-${eng.id}`,
        source: 'support_engagement',
        category: 'support',
        title: `【定期面談】${compName} - ${eng.title || '顧客支援ミーティング'}`,
        date: datePart,
        startTime: timePart,
        isAllDay: !timePart,
        companyId: eng.company_id,
        companyName: compName,
        status: eng.status,
        statusLabel: details.phase || '支援中',
        notes: [
          details.nextTheme ? `次回テーマ: ${details.nextTheme}` : '',
          details.currentTheme ? `現行テーマ: ${details.currentTheme}` : '',
          details.keyIssue ? `課題: ${details.keyIssue}` : '',
        ].filter(Boolean).join('\n'),
        linkTab: 'customer_operations',
        linkContext: { companyId: eng.company_id, engagementId: eng.id },
      });
    }
  });

  // 4. Customer Support Meetings (個別ミーティング履歴・予定)
  payload.supportMeetings.forEach((meeting) => {
    const eng = payload.engagements.find((e) => e.id === meeting.engagement_id);
    const compName = eng ? companyMap.get(eng.company_id) || '支援先企業' : '支援先企業';

    if (meeting.next_meeting_at) {
      const datePart = meeting.next_meeting_at.slice(0, 10);
      const timePart = meeting.next_meeting_at.includes('T') ? meeting.next_meeting_at.slice(11, 16) : undefined;
      items.push({
        id: `support-meeting-next-${meeting.id}`,
        source: 'support_meeting',
        category: 'support',
        title: `【次回支援面談】${compName} - ${meeting.next_topic || meeting.topic || 'フォローアップ'}`,
        date: datePart,
        startTime: timePart,
        isAllDay: !timePart,
        companyId: eng?.company_id,
        companyName: compName,
        status: 'scheduled',
        statusLabel: '支援面談予定',
        notes: [
          meeting.next_topic ? `次回テーマ: ${meeting.next_topic}` : '',
          meeting.client_homework ? `先方宿題: ${meeting.client_homework}` : '',
          meeting.mst_homework ? `MST宿題: ${meeting.mst_homework}` : '',
        ].filter(Boolean).join('\n'),
        linkTab: 'customer_operations',
        linkContext: { companyId: eng?.company_id, engagementId: meeting.engagement_id },
      });
    }
  });

  // 5. Invoices (請求・入金期日)
  payload.invoices.forEach((inv) => {
    if (inv.dueDate) {
      const compName = inv.recipientName || (inv.companyId ? companyMap.get(inv.companyId) : undefined) || '請求先';
      const baseAmt = inv.amount;
      const taxAmt = inv.taxAmount ?? Math.round(baseAmt * 0.1);
      const totalAmt = baseAmt + taxAmt;

      const statusMap: Record<string, string> = {
        draft: '下書き',
        issued: '請求済（入金待ち）',
        paid: '入金完了',
        overdue: '期限超過・督促',
        canceled: '取消',
      };

      items.push({
        id: `invoice-due-${inv.id}`,
        source: 'invoice',
        category: 'finance',
        title: `【請求期日】${compName} - ${inv.title || inv.invoiceNumber}`,
        date: inv.dueDate.slice(0, 10),
        isAllDay: true,
        companyId: inv.companyId,
        companyName: compName,
        status: inv.status,
        statusLabel: statusMap[inv.status] || inv.status,
        amount: baseAmt,
        taxAmount: taxAmt,
        totalAmount: totalAmt,
        isTaxExclusive: true,
        notes: inv.notes || undefined,
        linkTab: 'document_templates',
        linkContext: { companyId: inv.companyId, documentId: inv.id },
      });
    }
  });

  // 6. Contracts (契約開始日・満了日)
  payload.contracts.forEach((contract) => {
    const compName = contract.counterpartyName || (contract.companyId ? companyMap.get(contract.companyId) : undefined) || '契約先';
    if (contract.startDate) {
      items.push({
        id: `contract-start-${contract.id}`,
        source: 'contract',
        category: 'finance',
        title: `【契約開始】${compName} - ${contract.title}`,
        date: contract.startDate.slice(0, 10),
        isAllDay: true,
        companyId: contract.companyId,
        companyName: compName,
        status: contract.status,
        statusLabel: '契約開始',
        amount: contract.amount,
        notes: contract.notes || undefined,
        linkTab: 'customer_operations',
        linkContext: { companyId: contract.companyId },
      });
    }
    if (contract.endDate) {
      items.push({
        id: `contract-end-${contract.id}`,
        source: 'contract',
        category: 'finance',
        title: `【契約満了/更新】${compName} - ${contract.title}`,
        date: contract.endDate.slice(0, 10),
        isAllDay: true,
        companyId: contract.companyId,
        companyName: compName,
        status: contract.status,
        statusLabel: '契約更新期日',
        amount: contract.amount,
        notes: contract.notes || undefined,
        linkTab: 'customer_operations',
        linkContext: { companyId: contract.companyId },
      });
    }
  });

  // 7. Tasks (業務タスク期限)
  payload.tasks.forEach((task) => {
    if (task.dueDate && task.status !== 'completed') {
      const priorityLabel = task.priority === 'high' ? '【重要】' : '';
      items.push({
        id: `task-due-${task.id}`,
        source: 'task',
        category: 'task',
        title: `【タスク期限】${priorityLabel}${task.title}`,
        date: task.dueDate.slice(0, 10),
        isAllDay: true,
        priority: task.priority,
        status: task.status,
        statusLabel: task.status === 'in_progress' ? '進行中' : '未着手',
        assignee: task.assignee?.name || undefined,
        notes: task.description || undefined,
        linkTab: 'ai_tasks',
        linkContext: { taskId: task.id },
      });
    }
  });

  // 8. Custom Calendar Events (直接登録した予定)
  payload.customEvents.forEach((evt) => {
    items.push({
      id: `custom-event-${evt.id}`,
      source: 'custom',
      category: evt.category || 'custom',
      title: evt.title,
      date: evt.date,
      startTime: evt.startTime,
      endTime: evt.endTime,
      isAllDay: evt.isAllDay,
      companyId: evt.companyId,
      companyName: evt.companyName,
      location: evt.location,
      meetUrl: evt.meetUrl,
      notes: evt.notes,
      assignee: evt.attendees,
      statusLabel: '登録予定',
      meta: { customEvent: evt },
    });
  });

  // 9. Google Calendar Synced Events (事業用Googleカレンダーから同期された予定)
  (payload.googleEvents || []).forEach((gEvt) => {
    items.push({
      id: gEvt.id,
      source: 'google',
      category: 'google',
      title: `【Google】${gEvt.title}`,
      date: gEvt.date,
      startTime: gEvt.startTime,
      endTime: gEvt.endTime,
      isAllDay: gEvt.isAllDay,
      location: gEvt.location,
      meetUrl: gEvt.meetUrl,
      notes: gEvt.notes,
      statusLabel: gEvt.calendarName || 'Googleカレンダー',
      meta: { googleEvent: gEvt },
    });
  });

  // 日付・時間順でソート
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const timeA = a.startTime || '99:99';
    const timeB = b.startTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  return items;
}

/**
 * クライアント側で.icsファイルテキストをパース（ファイル直接ドロップ対応）
 */
export function parseIcalStringClient(icsString: string): { calendarName: string; events: GoogleSyncedEvent[] } {
  const unfolded = icsString.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let calendarName = '事業用Googleカレンダー';
  const events: GoogleSyncedEvent[] = [];
  let inEvent = false;
  let current: Partial<GoogleSyncedEvent> = {};

  const unescapeText = (t: string) => t.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('X-WR-CALNAME:')) {
      calendarName = unescapeText(trimmed.slice('X-WR-CALNAME:'.length)) || calendarName;
      continue;
    }

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && current.date && current.title) {
        events.push({
          id: current.id || `google-file-${events.length + 1}-${Date.now()}`,
          title: current.title,
          date: current.date,
          startTime: current.startTime,
          endTime: current.endTime,
          isAllDay: current.isAllDay ?? false,
          location: current.location,
          meetUrl: current.meetUrl,
          notes: current.notes,
          calendarName,
          rawUid: current.rawUid,
        });
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).split(';')[0].toUpperCase();
    const val = trimmed.slice(colonIdx + 1);

    if (key === 'UID') {
      current.rawUid = val;
      current.id = `google-${val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`;
    } else if (key === 'SUMMARY') {
      current.title = unescapeText(val);
    } else if (key === 'DESCRIPTION') {
      const desc = unescapeText(val);
      current.notes = desc;
      const meet = desc.match(/https:\/\/(meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/[0-9]+[^\s]*)/i);
      if (meet && !current.meetUrl) current.meetUrl = meet[0];
    } else if (key === 'LOCATION') {
      const loc = unescapeText(val);
      current.location = loc;
      if (loc.includes('meet.google.com') || loc.includes('zoom.us')) current.meetUrl = loc;
    } else if (key === 'DTSTART') {
      if (/^\d{8}$/.test(val)) {
        current.date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
        current.isAllDay = true;
      } else if (/^\d{8}T\d{6}Z$/.test(val)) {
        const d = new Date(Date.UTC(+val.slice(0, 4), +val.slice(4, 6) - 1, +val.slice(6, 8), +val.slice(9, 11), +val.slice(11, 13)));
        const jst = new Date(d.getTime() + 9 * 3600 * 1000);
        current.date = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
        current.startTime = `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
        current.isAllDay = false;
      } else if (/^\d{8}T\d{6}/.test(val)) {
        current.date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
        current.startTime = `${val.slice(9, 11)}:${val.slice(11, 13)}`;
        current.isAllDay = false;
      }
    } else if (key === 'DTEND') {
      if (/^\d{8}T\d{6}Z$/.test(val)) {
        const d = new Date(Date.UTC(+val.slice(0, 4), +val.slice(4, 6) - 1, +val.slice(6, 8), +val.slice(9, 11), +val.slice(11, 13)));
        const jst = new Date(d.getTime() + 9 * 3600 * 1000);
        current.endTime = `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
      } else if (/^\d{8}T\d{6}/.test(val)) {
        current.endTime = `${val.slice(9, 11)}:${val.slice(11, 13)}`;
      }
    }
  }

  return { calendarName, events };
}

