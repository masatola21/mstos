import type { UnifiedNavTab } from '../components/UnifiedNavbar';

export type CalendarEventCategory = 
  | 'deal'     // 🤝 商談・リード面談
  | 'support'  // 🧑‍💼 顧客支援・定期面談
  | 'task'     // 📋 業務タスク
  | 'finance'  // 💰 請求・契約期日
  | 'custom'   // 📅 スケジュール予定
  | 'google';  // 🌐 Googleカレンダー（事業用）

export type CalendarEventSource = 
  | 'deal' 
  | 'lead' 
  | 'support_engagement' 
  | 'support_meeting' 
  | 'task' 
  | 'invoice' 
  | 'contract' 
  | 'custom'
  | 'google';

export interface GoogleSyncedEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  location?: string;
  meetUrl?: string;
  notes?: string;
  calendarName?: string;
  rawUid?: string;
}

export interface CalendarItem {
  id: string;
  source: CalendarEventSource;
  category: CalendarEventCategory;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  companyId?: string;
  companyName?: string;
  contactName?: string;
  status?: string;
  statusLabel?: string;
  // Financial info if applicable (tax-exclusive + tax)
  amount?: number;
  taxAmount?: number;
  totalAmount?: number;
  isTaxExclusive?: boolean;
  location?: string;
  meetUrl?: string;
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  linkTab?: UnifiedNavTab;
  linkContext?: {
    companyId?: string;
    dealId?: string;
    leadId?: string;
    engagementId?: string;
    taskId?: string;
    documentId?: string;
  };
  meta?: Record<string, unknown>;
}

export interface CustomCalendarEvent {
  id: string;
  title: string;
  category: CalendarEventCategory;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  companyId?: string;
  companyName?: string;
  location?: string;
  meetUrl?: string;
  notes?: string;
  attendees?: string;
  createdAt: number;
  updatedAt: number;
}
