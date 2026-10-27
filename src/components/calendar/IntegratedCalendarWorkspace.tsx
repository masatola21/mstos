import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  ExternalLink, 
  Clock, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays, 
  ListFilter, 
  X, 
  Share2, 
  Trash2, 
  Edit3, 
  Video, 
  MapPin, 
  ArrowRight,
  RefreshCw,
  Coins,
  Globe,
  Upload,
  Download,
  HelpCircle,
  Info
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import type { CalendarItem, CustomCalendarEvent, CalendarEventCategory } from '../../types/calendar';
import type { ManagedInvoice, ManagedContract } from '../../types/matrix';
import type { TaskItem } from '../../types';
import type { UnifiedNavTab } from '../UnifiedNavbar';
import { 
  loadCustomCalendarEvents, 
  saveCustomCalendarEvents, 
  buildGoogleCalendarUrl, 
  buildAggregatedCalendarItems,
  getStoredGoogleIcalUrl,
  setStoredGoogleIcalUrl,
  getStoredGoogleEvents,
  setStoredGoogleEvents,
  getGoogleCalendarSyncInfo,
  clearGoogleCalendarSync,
  fetchGoogleCalendarFromIcal,
  parseIcalStringClient
} from '../../services/calendarService';
import type { GoogleSyncedEvent } from '../../types/calendar';
import { todayJst } from '../../utils/date';

interface Props {
  invoices?: ManagedInvoice[];
  contracts?: ManagedContract[];
  tasks?: TaskItem[];
  onNavigateTab: (tab: UnifiedNavTab) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination?: string, recordContext?: any) => void;
}

const CATEGORY_CONFIG: Record<CalendarEventCategory, { label: string; badgeBg: string; text: string; border: string; dot: string }> = {
  deal: { 
    label: '商談・リード面談', 
    badgeBg: 'bg-blue-950/60', 
    text: 'text-blue-300', 
    border: 'border-blue-500/30', 
    dot: 'bg-blue-400' 
  },
  support: { 
    label: '顧客支援・定期面談', 
    badgeBg: 'bg-amber-950/60', 
    text: 'text-amber-300', 
    border: 'border-amber-500/30', 
    dot: 'bg-amber-400' 
  },
  task: { 
    label: '業務タスク期限', 
    badgeBg: 'bg-purple-950/60', 
    text: 'text-purple-300', 
    border: 'border-purple-500/30', 
    dot: 'bg-purple-400' 
  },
  finance: { 
    label: '請求・契約期日', 
    badgeBg: 'bg-emerald-950/60', 
    text: 'text-emerald-300', 
    border: 'border-emerald-500/30', 
    dot: 'bg-emerald-400' 
  },
  custom: { 
    label: '登録予定・MTG', 
    badgeBg: 'bg-cyan-950/60', 
    text: 'text-cyan-300', 
    border: 'border-cyan-500/30', 
    dot: 'bg-cyan-400' 
  },
  google: { 
    label: 'Googleカレンダー（事業用）', 
    badgeBg: 'bg-sky-950/70', 
    text: 'text-sky-300', 
    border: 'border-sky-500/40', 
    dot: 'bg-sky-400' 
  },
};

type ViewMode = 'month' | 'week' | 'agenda';

export const IntegratedCalendarWorkspace: React.FC<Props> = ({
  invoices = [],
  contracts = [],
  tasks = [],
  onNavigateTab,
  onOpenCustomerWorkspace,
}) => {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedCategory, setSelectedCategory] = useState<CalendarEventCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Database data
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Array<{ id: string; company_name: string }>>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [supportMeetings, setSupportMeetings] = useState<any[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>(() => loadCustomCalendarEvents());
  
  // Google Calendar Sync States
  const [googleEvents, setGoogleEvents] = useState<GoogleSyncedEvent[]>(() => getStoredGoogleEvents());
  const [googleIcalUrl, setGoogleIcalUrl] = useState<string>(() => getStoredGoogleIcalUrl());
  const [googleSyncInfo, setGoogleSyncInfo] = useState(() => getGoogleCalendarSyncInfo());
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [syncUrlInput, setSyncUrlInput] = useState(() => getStoredGoogleIcalUrl());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState(todayJst());
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<CalendarEventCategory>('custom');
  const [newEventStartTime, setNewEventStartTime] = useState('10:00');
  const [newEventEndTime, setNewEventEndTime] = useState('11:00');
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);
  const [newEventCompanyId, setNewEventCompanyId] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('Google Meet');
  const [newEventMeetUrl, setNewEventMeetUrl] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [editingCustomEventId, setEditingCustomEventId] = useState<string | null>(null);

  // Load all external events from Supabase
  const fetchData = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    try {
      const [compRes, dealRes, leadRes, engRes, meetingRes] = await Promise.all([
        supabase.from('companies').select('id,company_name').order('company_name'),
        supabase.from('deals').select('*,company:companies(company_name)').order('created_at', { ascending: false }),
        supabase.from('leads').select('*,company:companies(company_name)').order('created_at', { ascending: false }),
        supabase.from('customer_service_engagements').select('*').order('created_at', { ascending: false }),
        supabase.from('customer_service_meetings').select('*').order('occurred_at', { ascending: false }),
      ]);

      if (compRes.data) setCompanies(compRes.data);
      if (dealRes.data) setDeals(dealRes.data);
      if (leadRes.data) setLeads(leadRes.data);
      if (engRes.data) setEngagements(engRes.data);
      if (meetingRes.data) setSupportMeetings(meetingRes.data);
    } catch (err) {
      console.warn('Failed to fetch calendar sources from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Background auto-sync of Google Calendar if iCal URL is set
  useEffect(() => {
    const storedUrl = getStoredGoogleIcalUrl();
    if (storedUrl) {
      void (async () => {
        const res = await fetchGoogleCalendarFromIcal(storedUrl);
        if (res.success) {
          setGoogleEvents(res.events);
          setGoogleSyncInfo(getGoogleCalendarSyncInfo());
        }
      })();
    }
  }, []);

  // Google Calendar Sync Actions
  const handlePerformGoogleSync = async () => {
    const url = syncUrlInput.trim();
    if (!url) {
      setSyncStatusMsg({ type: 'error', text: 'iCal URL（秘密のアドレス）を入力してください。' });
      return;
    }
    setSyncLoading(true);
    setSyncStatusMsg({ type: 'info', text: 'Googleカレンダーから予定を取得しています...' });
    try {
      const res = await fetchGoogleCalendarFromIcal(url);
      if (res.success) {
        setGoogleEvents(res.events);
        setGoogleIcalUrl(url);
        setGoogleSyncInfo(getGoogleCalendarSyncInfo());
        setSyncStatusMsg({
          type: 'success',
          text: `同期成功: ${res.calendarName} から ${res.events.length} 件の予定を反映しました！`,
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: res.error || '同期に失敗しました。URLをお確かめください。',
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err.message || '同期処理中にエラーが発生しました。',
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleClearGoogleSync = () => {
    if (window.confirm('Googleカレンダーの同期設定を解除し、取り込んだ予定を削除しますか？')) {
      clearGoogleCalendarSync();
      setGoogleEvents([]);
      setGoogleIcalUrl('');
      setSyncUrlInput('');
      setGoogleSyncInfo({ lastSync: null, calendarName: '事業用Googleカレンダー' });
      setSyncStatusMsg({ type: 'info', text: 'Googleカレンダーの同期を解除しました。' });
    }
  };

  const handleImportIcsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        if (!text.includes('BEGIN:VCALENDAR')) {
          setSyncStatusMsg({ type: 'error', text: '有効なiCalendar (.ics) ファイルではありません。' });
          return;
        }
        const parsed = parseIcalStringClient(text);
        setStoredGoogleEvents(parsed.events, parsed.calendarName);
        setGoogleEvents(parsed.events);
        setGoogleSyncInfo(getGoogleCalendarSyncInfo());
        setSyncStatusMsg({
          type: 'success',
          text: `ファイル読み込み成功: ${parsed.calendarName} から ${parsed.events.length} 件の予定を取り込みました！`,
        });
      } catch (err: any) {
        setSyncStatusMsg({ type: 'error', text: 'ファイルの解析に失敗しました: ' + (err.message || '') });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Aggregated all items
  const allCalendarItems = useMemo(() => {
    return buildAggregatedCalendarItems({
      companies,
      deals,
      leads,
      engagements,
      supportMeetings,
      invoices,
      contracts,
      tasks,
      customEvents,
      googleEvents,
    });
  }, [companies, deals, leads, engagements, supportMeetings, invoices, contracts, tasks, customEvents, googleEvents]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return allCalendarItems.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchComp = (item.companyName || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchComp && !matchNotes) return false;
      }
      return true;
    });
  }, [allCalendarItems, selectedCategory, searchQuery]);

  // Group events by date for fast calendar lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    filteredItems.forEach((item) => {
      const existing = map.get(item.date) || [];
      existing.push(item);
      map.set(item.date, existing);
    });
    return map;
  }, [filteredItems]);

  // Calendar Month Matrix Generation
  const monthDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: number;
    }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, d);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dateStr = `${y}-${m}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayJst(),
        dayOfWeek: prevDate.getDay(),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(currentMonth + 1).padStart(2, '0');
      const dateStr = `${currentYear}-${m}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(currentYear, currentMonth, d);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayJst(),
        dayOfWeek: dayDate.getDay(),
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dateStr = `${y}-${m}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayJst(),
        dayOfWeek: nextDate.getDay(),
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Week View Days (surrounding selected or today)
  const weekDays = useMemo(() => {
    const today = new Date();
    // Use first day of current viewed month or today if current month is active
    const baseDate = (currentYear === today.getFullYear() && currentMonth === today.getMonth())
      ? today
      : new Date(currentYear, currentMonth, 1);
    
    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const days: Array<{ dateStr: string; dayNumber: number; isToday: boolean; dayName: string; dayOfWeek: number }> = [];
    const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = d.getDate();
      const dateStr = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isToday: dateStr === todayJst(),
        dayName: DAY_NAMES[i],
        dayOfWeek: i,
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Agenda Groups
  const agendaGroups = useMemo(() => {
    const today = todayJst();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const nextWeekDate = sevenDaysLater.toISOString().slice(0, 10);

    const overdue: CalendarItem[] = [];
    const todayItems: CalendarItem[] = [];
    const tomorrowItems: CalendarItem[] = [];
    const thisWeekItems: CalendarItem[] = [];
    const upcomingItems: CalendarItem[] = [];
    const pastItems: CalendarItem[] = [];

    filteredItems.forEach((item) => {
      if (item.date < today) {
        if (item.category === 'task' || (item.category === 'finance' && item.status !== 'paid')) {
          overdue.push(item);
        } else {
          pastItems.push(item);
        }
      } else if (item.date === today) {
        todayItems.push(item);
      } else if (item.date === tomorrow) {
        tomorrowItems.push(item);
      } else if (item.date <= nextWeekDate) {
        thisWeekItems.push(item);
      } else {
        upcomingItems.push(item);
      }
    });

    return {
      overdue,
      today: todayItems,
      tomorrow: tomorrowItems,
      thisWeek: thisWeekItems,
      upcoming: upcomingItems,
      past: pastItems.slice(0, 30), // limit past items
    };
  }, [filteredItems]);

  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Open Add Event modal for a specific day
  const handleOpenAddModal = (dateStr?: string) => {
    setEditingCustomEventId(null);
    setNewEventDate(dateStr || todayJst());
    setNewEventTitle('');
    setNewEventCategory('custom');
    setNewEventStartTime('10:00');
    setNewEventEndTime('11:00');
    setNewEventIsAllDay(false);
    setNewEventCompanyId('');
    setNewEventLocation('Google Meet');
    setNewEventMeetUrl('');
    setNewEventNotes('');
    setIsNewEventModalOpen(true);
  };

  // Save new or edited custom event
  const handleSaveCustomEvent = () => {
    if (!newEventTitle.trim()) return;

    const matchedComp = companies.find((c) => c.id === newEventCompanyId);

    if (editingCustomEventId) {
      const updated = customEvents.map((evt) => {
        if (evt.id === editingCustomEventId) {
          return {
            ...evt,
            title: newEventTitle.trim(),
            category: newEventCategory,
            date: newEventDate,
            startTime: newEventIsAllDay ? undefined : newEventStartTime,
            endTime: newEventIsAllDay ? undefined : newEventEndTime,
            isAllDay: newEventIsAllDay,
            companyId: newEventCompanyId || undefined,
            companyName: matchedComp?.company_name || undefined,
            location: newEventLocation,
            meetUrl: newEventMeetUrl,
            notes: newEventNotes,
            updatedAt: Date.now(),
          };
        }
        return evt;
      });
      setCustomEvents(updated);
      saveCustomCalendarEvents(updated);
    } else {
      const newEvt: CustomCalendarEvent = {
        id: `custom-${Date.now()}`,
        title: newEventTitle.trim(),
        category: newEventCategory,
        date: newEventDate,
        startTime: newEventIsAllDay ? undefined : newEventStartTime,
        endTime: newEventIsAllDay ? undefined : newEventEndTime,
        isAllDay: newEventIsAllDay,
        companyId: newEventCompanyId || undefined,
        companyName: matchedComp?.company_name || undefined,
        location: newEventLocation,
        meetUrl: newEventMeetUrl,
        notes: newEventNotes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updated = [newEvt, ...customEvents];
      setCustomEvents(updated);
      saveCustomCalendarEvents(updated);
    }

    setIsNewEventModalOpen(false);
  };

  // Delete custom event
  const handleDeleteCustomEvent = (id: string) => {
    const rawId = id.replace('custom-event-', '');
    const updated = customEvents.filter((e) => e.id !== rawId && e.id !== id);
    setCustomEvents(updated);
    saveCustomCalendarEvents(updated);
    setSelectedEvent(null);
  };

  // Open Edit for custom event
  const handleEditCustomEvent = (event: CalendarItem) => {
    const rawId = event.id.replace('custom-event-', '');
    const found = customEvents.find((e) => e.id === rawId || e.id === event.id);
    if (!found) return;

    setEditingCustomEventId(found.id);
    setNewEventTitle(found.title);
    setNewEventCategory(found.category);
    setNewEventDate(found.date);
    setNewEventStartTime(found.startTime || '10:00');
    setNewEventEndTime(found.endTime || '11:00');
    setNewEventIsAllDay(found.isAllDay);
    setNewEventCompanyId(found.companyId || '');
    setNewEventLocation(found.location || '');
    setNewEventMeetUrl(found.meetUrl || '');
    setNewEventNotes(found.notes || '');
    setSelectedEvent(null);
    setIsNewEventModalOpen(true);
  };

  // Jump to specific tab from event
  const handleJumpToEvent = (item: CalendarItem) => {
    if (item.companyId && onOpenCustomerWorkspace) {
      if (item.category === 'deal') {
        onOpenCustomerWorkspace(item.companyId, 'deals', { dealId: item.linkContext?.dealId, leadId: item.linkContext?.leadId });
        return;
      }
      if (item.category === 'support') {
        onOpenCustomerWorkspace(item.companyId, 'customer_operations');
        return;
      }
      if (item.category === 'finance') {
        onOpenCustomerWorkspace(item.companyId, 'documents');
        return;
      }
    }
    if (item.linkTab) {
      onNavigateTab(item.linkTab);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  統合予定カレンダー
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  商談 × 顧客支援 × タスク期日
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                商談面談・顧客支援ミーティング・請求期日・タスク納期を一元管理。Googleカレンダーへの即時1クリック追加に対応。
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSyncStatusMsg(null);
                setSyncUrlInput(googleIcalUrl);
                setIsGoogleSyncModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/70 font-semibold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer group"
              title="事業用Googleカレンダーの予定を非公開URLで安全に同期"
            >
              <Globe className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
              <span>事業用Googleカレンダー同期</span>
              {googleIcalUrl ? (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {googleEvents.length}件同期
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                  未設定
                </span>
              )}
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>予定・面談を登録</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition cursor-pointer"
              title="データを再読み込み"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Mode & Month Navigation Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Month Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
              title="前月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-base font-bold text-white px-2 tracking-tight min-w-[120px] text-center">
              {currentYear}年 {currentMonth + 1}月
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition"
              title="翌月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleGoToday}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/50 transition ml-1"
            >
              今月 (今日)
            </button>
          </div>

          {/* View Mode Toggles */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs self-start md:self-auto">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>月表示</span>
            </button>

            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>週表示</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'agenda'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>アジェンダ一覧</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-200 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              すべて ({allCalendarItems.length})
            </button>

            {(Object.keys(CATEGORY_CONFIG) as CalendarEventCategory[]).map((cat) => {
              const conf = CATEGORY_CONFIG[cat];
              const count = allCalendarItems.filter((i) => i.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? `${conf.badgeBg} ${conf.text} ${conf.border} font-bold ring-1 ring-blue-500/50`
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                  <span>{conf.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="企業名・案件名・メモ検索..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= VIEW 1: MONTH VIEW ================= */}
      {viewMode === 'month' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70 text-center text-xs font-semibold py-2.5">
            <span className="text-rose-400">日</span>
            <span className="text-slate-300">月</span>
            <span className="text-slate-300">火</span>
            <span className="text-slate-300">水</span>
            <span className="text-slate-300">木</span>
            <span className="text-slate-300">金</span>
            <span className="text-cyan-400">土</span>
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/70 bg-slate-950/20">
            {monthDays.map((day) => {
              const dayEvents = eventsByDate.get(day.dateStr) || [];
              const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[115px] p-1.5 sm:p-2 flex flex-col justify-between transition group relative ${
                    !day.isCurrentMonth
                      ? 'bg-slate-950/40 text-slate-600'
                      : isWeekend
                      ? 'bg-slate-900/30'
                      : 'bg-slate-900/60 hover:bg-slate-800/40'
                  } ${day.isToday ? 'ring-2 ring-blue-500/70 bg-blue-950/20' : ''}`}
                >
                  {/* Date number header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        day.isToday
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40'
                          : day.dayOfWeek === 0
                          ? 'text-rose-400'
                          : day.dayOfWeek === 6
                          ? 'text-cyan-400'
                          : day.isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Quick Add Button on Hover */}
                    <button
                      onClick={() => handleOpenAddModal(day.dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition text-[10px]"
                      title="この日に予定を追加"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Event Badges */}
                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => {
                      const conf = CATEGORY_CONFIG[event.category];
                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate cursor-pointer transition flex items-center gap-1 shadow-sm ${conf.badgeBg} ${conf.text} ${conf.border} hover:brightness-125`}
                          title={`${event.startTime ? event.startTime + ' ' : ''}${event.title}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dot}`} />
                          {event.startTime && (
                            <span className="opacity-80 shrink-0">{event.startTime}</span>
                          )}
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <button
                        onClick={() => {
                          // Filter view to this day or open details
                          setSearchQuery(day.dateStr);
                          setViewMode('agenda');
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold px-1 block text-left"
                      >
                        他 {dayEvents.length - 3} 件の予定...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW 2: WEEK VIEW ================= */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayEvents = eventsByDate.get(day.dateStr) || [];
            return (
              <div
                key={day.dateStr}
                className={`bg-slate-900/90 border rounded-2xl p-3 flex flex-col min-h-[360px] shadow-lg ${
                  day.isToday
                    ? 'border-blue-500/80 bg-blue-950/20 ring-1 ring-blue-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        day.isToday
                          ? 'bg-blue-600 text-white'
                          : day.dayOfWeek === 0
                          ? 'bg-rose-950/60 text-rose-400'
                          : day.dayOfWeek === 6
                          ? 'bg-cyan-950/60 text-cyan-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {day.dayName}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {day.dayNumber}日
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenAddModal(day.dateStr)}
                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="この日に予定を追加"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Day Events Stack */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-1">
                  {dayEvents.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-8">
                      予定なし
                    </div>
                  ) : (
                    dayEvents.map((event) => {
                      const conf = CATEGORY_CONFIG[event.category];
                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`p-2 rounded-xl border text-xs cursor-pointer transition hover:scale-[1.01] ${conf.badgeBg} ${conf.border} shadow-sm`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                            <span className="flex items-center gap-1 font-semibold">
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                              {conf.label}
                            </span>
                            {event.startTime && <span>{event.startTime}</span>}
                          </div>

                          <div className={`font-semibold ${conf.text} line-clamp-2`}>
                            {event.title}
                          </div>

                          {event.companyName && (
                            <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{event.companyName}</span>
                            </div>
                          )}

                          {event.amount !== undefined && (
                            <div className="mt-1 text-[10px] text-emerald-400 font-mono">
                              税抜 ¥{event.amount.toLocaleString()} + 税10% = 税込 ¥{(event.totalAmount || event.amount * 1.1).toLocaleString()}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= VIEW 3: AGENDA LIST VIEW ================= */}
      {viewMode === 'agenda' && (
        <div className="space-y-5">
          {/* Overdue Section */}
          {agendaGroups.overdue.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-sm mb-3">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>期限超過 / 要対応 ({agendaGroups.overdue.length}件)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaGroups.overdue.map((item) => (
                  <AgendaEventCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedEvent(item)}
                    onJump={() => handleJumpToEvent(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today Section */}
          <div className="bg-slate-900/90 border border-blue-500/40 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-sm font-bold text-white">
                  本日の予定 ({agendaGroups.today.length}件)
                </h2>
                <span className="text-xs text-slate-400 font-mono">{todayJst()}</span>
              </div>
              <button
                onClick={() => handleOpenAddModal(todayJst())}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>今日に追加</span>
              </button>
            </div>

            {agendaGroups.today.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                本日の予定はありません。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaGroups.today.map((item) => (
                  <AgendaEventCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedEvent(item)}
                    onJump={() => handleJumpToEvent(item)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tomorrow Section */}
          {agendaGroups.tomorrow.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-sm font-bold text-white mb-3 pb-2 border-b border-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>明日の予定 ({agendaGroups.tomorrow.length}件)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaGroups.tomorrow.map((item) => (
                  <AgendaEventCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedEvent(item)}
                    onJump={() => handleJumpToEvent(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* This Week Section */}
          {agendaGroups.thisWeek.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-sm font-bold text-white mb-3 pb-2 border-b border-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-purple-400" />
                <span>今週の予定 ({agendaGroups.thisWeek.length}件)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaGroups.thisWeek.map((item) => (
                  <AgendaEventCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedEvent(item)}
                    onJump={() => handleJumpToEvent(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {agendaGroups.upcoming.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-sm font-bold text-white mb-3 pb-2 border-b border-slate-800 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span>来週以降の予定 ({agendaGroups.upcoming.length}件)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {agendaGroups.upcoming.map((item) => (
                  <AgendaEventCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedEvent(item)}
                    onJump={() => handleJumpToEvent(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: EVENT DETAIL ================= */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            {/* Close button */}
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Category tag */}
            <div className="flex items-center gap-2 mb-3">
              {(() => {
                const conf = CATEGORY_CONFIG[selectedEvent.category];
                return (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${conf.badgeBg} ${conf.text} ${conf.border}`}>
                    {conf.label}
                  </span>
                );
              })()}
              {selectedEvent.statusLabel && (
                <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 font-medium">
                  {selectedEvent.statusLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-white mb-4 pr-6">
              {selectedEvent.title}
            </h3>

            {/* Event Details Grid */}
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs">
              {/* Date & Time */}
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-white">日時:</span>
                <span>{selectedEvent.date}</span>
                {selectedEvent.startTime && (
                  <span className="text-blue-300 font-mono font-bold">
                    {selectedEvent.startTime}
                    {selectedEvent.endTime ? ` 〜 ${selectedEvent.endTime}` : ''}
                  </span>
                )}
                {selectedEvent.isAllDay && <span className="text-slate-400">(終日)</span>}
              </div>

              {/* Company */}
              {selectedEvent.companyName && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-white">対象企業:</span>
                  <span className="text-indigo-200 font-medium">{selectedEvent.companyName}</span>
                </div>
              )}

              {/* Financial amounts (tax exclusive + 10% tax) */}
              {selectedEvent.amount !== undefined && (
                <div className="flex items-start gap-2 text-slate-300">
                  <Coins className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">金額: </span>
                    <span className="text-emerald-300 font-bold">
                      税抜 ¥{selectedEvent.amount.toLocaleString()}
                    </span>
                    <span className="text-slate-400 ml-2">
                      （消費税10% ¥{(selectedEvent.taxAmount ?? Math.round(selectedEvent.amount * 0.1)).toLocaleString()} / 税込 ¥{(selectedEvent.totalAmount ?? Math.round(selectedEvent.amount * 1.1)).toLocaleString()}）
                    </span>
                  </div>
                </div>
              )}

              {/* Location or Meet URL with Zoom/Meet detection */}
              {(selectedEvent.location || selectedEvent.meetUrl) && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-slate-300 text-xs">
                    {selectedEvent.meetUrl?.includes('zoom.us') || selectedEvent.location?.toLowerCase().includes('zoom') ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1">
                        <Video className="w-3 h-3 text-blue-400" />
                        <span>Zoom面談</span>
                      </span>
                    ) : selectedEvent.meetUrl?.includes('meet.google.com') || selectedEvent.location?.toLowerCase().includes('google meet') ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                        <Video className="w-3 h-3 text-emerald-400" />
                        <span>Google Meet</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>場所 / 形式</span>
                      </span>
                    )}

                    <span className="font-semibold text-white">
                      {selectedEvent.location || (selectedEvent.meetUrl?.includes('zoom.us') ? 'Zoom' : 'オンライン面談')}
                    </span>
                  </div>

                  {selectedEvent.meetUrl && (
                    <a
                      href={selectedEvent.meetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                        selectedEvent.meetUrl.includes('zoom.us') || selectedEvent.location?.toLowerCase().includes('zoom')
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{selectedEvent.meetUrl.includes('zoom.us') ? 'Zoomに参加' : 'Meetに参加'}</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedEvent.notes && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="font-semibold text-slate-400 mb-1">アジェンダ・詳細メモ:</div>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    {selectedEvent.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Google Calendar 1-Click Sync */}
                <a
                  href={buildGoogleCalendarUrl({
                    title: selectedEvent.title,
                    date: selectedEvent.date,
                    startTime: selectedEvent.startTime,
                    endTime: selectedEvent.endTime,
                    isAllDay: selectedEvent.isAllDay,
                    companyName: selectedEvent.companyName,
                    location: selectedEvent.location,
                    meetUrl: selectedEvent.meetUrl,
                    notes: selectedEvent.notes,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Googleカレンダーに追加</span>
                </a>

                {/* Jump to Table */}
                {(selectedEvent.linkTab || selectedEvent.companyId) && (
                  <button
                    onClick={() => {
                      handleJumpToEvent(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition flex items-center gap-1.5"
                  >
                    <span>該当台帳を開く</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                )}
              </div>

              {/* Custom Event Actions */}
              {selectedEvent.source === 'custom' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditCustomEvent(selectedEvent)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="編集"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomEvent(selectedEvent.id)}
                    className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 transition"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CUSTOM EVENT ================= */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <button
              onClick={() => setIsNewEventModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-400" />
              <span>{editingCustomEventId ? '予定・面談を編集' : '新規予定・面談を登録'}</span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* Title */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  予定・面談タイトル <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="例: 株式会社○○様 DX伴走月次ミーティング"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">区分・分類</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as CalendarEventCategory[])
                    .filter((c) => c !== 'google')
                    .map((cat) => {
                    const conf = CATEGORY_CONFIG[cat];
                    const active = newEventCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewEventCategory(cat)}
                        className={`p-2 rounded-xl border text-center font-semibold transition flex items-center justify-center gap-1.5 ${
                          active
                            ? `${conf.badgeBg} ${conf.text} ${conf.border} ring-1 ring-blue-500`
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">日付</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">時間帯</label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEventIsAllDay}
                        onChange={(e) => setNewEventIsAllDay(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                      />
                      <span>終日</span>
                    </label>
                  </div>
                  {!newEventIsAllDay ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={newEventStartTime}
                        onChange={(e) => setNewEventStartTime(e.target.value)}
                        className="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-center focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <span className="text-slate-400">〜</span>
                      <input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                        className="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-center focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-center font-medium">
                      終日イベント
                    </div>
                  )}
                </div>
              </div>

              {/* Related Company */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  対象企業（任意）
                </label>
                <select
                  value={newEventCompanyId}
                  onChange={(e) => setNewEventCompanyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">企業を選択しない（社内・一般）</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Meeting Format & Location Selection (Zoom, Google Meet, In-person, etc.) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  開催場所 / 実施形式
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewEventLocation('Zoom');
                      if (!newEventMeetUrl || newEventMeetUrl.includes('meet.google.com')) {
                        const savedZoom = localStorage.getItem('mst_default_zoom_url') || '';
                        setNewEventMeetUrl(savedZoom || 'https://zoom.us/j/');
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newEventLocation.toLowerCase().includes('zoom')
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 ring-1 ring-blue-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-blue-300" />
                    <span>Zoom</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventLocation('Google Meet');
                      if (!newEventMeetUrl || newEventMeetUrl.includes('zoom.us')) {
                        setNewEventMeetUrl('https://meet.google.com/');
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newEventLocation.toLowerCase().includes('google meet')
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30 ring-1 ring-emerald-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Google Meet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventLocation('現地訪問（顧客先）');
                      setNewEventMeetUrl('');
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newEventLocation.includes('訪問')
                        ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30 ring-1 ring-amber-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-300" />
                    <span>現地訪問</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventLocation('来社面談（自社オフィス）');
                      setNewEventMeetUrl('');
                    }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newEventLocation.includes('来社')
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 ring-1 ring-indigo-300'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                    <span>来社・自社</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">場所 / 形式の名称（調整可能）</label>
                    <input
                      type="text"
                      value={newEventLocation}
                      onChange={(e) => setNewEventLocation(e.target.value)}
                      placeholder="例: Zoom, Google Meet, 訪問先"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 text-[11px]">面談URL（Zoom / Meet等）</label>
                      {newEventLocation.toLowerCase().includes('zoom') && newEventMeetUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.setItem('mst_default_zoom_url', newEventMeetUrl);
                            alert('このZoom URLをデフォルトURLとして記憶しました');
                          }}
                          className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                        >
                          次回もこのURLを使う
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={newEventMeetUrl}
                      onChange={(e) => setNewEventMeetUrl(e.target.value)}
                      placeholder={newEventLocation.toLowerCase().includes('zoom') ? 'https://zoom.us/j/...' : 'https://meet.google.com/...'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Agenda */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">アジェンダ・メモ</label>
                <textarea
                  rows={3}
                  value={newEventNotes}
                  onChange={(e) => setNewEventNotes(e.target.value)}
                  placeholder="アジェンダ、持ち物、検討事項など..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewEventModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveCustomEvent}
                disabled={!newEventTitle.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-md shadow-blue-600/30"
              >
                {editingCustomEventId ? '変更を保存' : '予定を登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: GOOGLE CALENDAR SYNC CONFIG ================= */}
      {isGoogleSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-100">
            <button
              onClick={() => setIsGoogleSyncModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>事業用Googleカレンダー同期設定</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    プライベート分離型
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  個人アカウント（masato.la21@gmail.com等）と混同せず、事業用カレンダーの予定のみを安全に本アプリへ取り込みます。
                </p>
              </div>
            </div>

            {/* Privacy & Safety Note */}
            <div className="mb-5 p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sky-100">
                  安心の独立同期（ブラウザ認証ポップアップ不要）
                </p>
                <p className="text-[11px] text-sky-300/90 leading-relaxed">
                  現在AI Studioをご利用中の個人Googleアカウントとは一切連動しません。事業用Googleカレンダーの「iCal形式の秘密のアドレス」を使用するため、個人情報が漏洩したり混同されたりする心配なく、事業の予定のみを統合カレンダーへ重ねて表示できます。
                </p>
              </div>
            </div>

            {/* Instructions Guide */}
            <div className="mb-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-xs">
              <h4 className="font-bold text-white mb-2.5 flex items-center gap-1.5 text-xs">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Googleカレンダーでの「秘密のアドレス（iCal URL）」の取得手順</span>
              </h4>
              <ol className="space-y-2 text-slate-300 pl-4 list-decimal text-[11px] leading-relaxed">
                <li>
                  ブラウザで事業用アカウントの <span className="font-mono text-sky-400 underline">calendar.google.com</span> を開く
                </li>
                <li>
                  左側の「マイカレンダー」から同期したい事業用カレンダーを見つけ、右側の <strong className="text-white">「︙（オプション）」→「設定と共有」</strong> を選択
                </li>
                <li>
                  左メニューの <strong className="text-white">「カレンダーの統合」</strong> をクリック
                </li>
                <li>
                  <strong className="text-white">「iCal 形式の非公開 URL」</strong>（または「秘密のアドレス」）欄に表示されているURLをコピー
                </li>
                <li>
                  下記の入力枠に貼り付けて、<strong className="text-sky-300">「今すぐ同期する」</strong> ボタンを押してください
                </li>
              </ol>
            </div>

            {/* Sync URL Input Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  事業用Googleカレンダーの iCal URL（非公開アドレス）
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={syncUrlInput}
                    onChange={(e) => setSyncUrlInput(e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    onClick={handlePerformGoogleSync}
                    disabled={syncLoading || !syncUrlInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-md shadow-sky-600/30 flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                    <span>{syncLoading ? '同期中...' : '今すぐ同期する'}</span>
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {syncStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    syncStatusMsg.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : syncStatusMsg.type === 'error'
                      ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                      : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                  }`}
                >
                  {syncStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : syncStatusMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-blue-400" />
                  )}
                  <span>{syncStatusMsg.text}</span>
                </div>
              )}

              {/* Current Connection Status Box */}
              {googleIcalUrl && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-white">
                        {googleSyncInfo.calendarName || '事業用Googleカレンダー'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        {googleEvents.length} 件の予定を同期中
                      </span>
                    </div>
                    {googleSyncInfo.lastSync && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        最終同期日時: {new Date(googleSyncInfo.lastSync).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePerformGoogleSync}
                      disabled={syncLoading}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1.5"
                      title="最新の予定を再取得"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                      <span>再取得</span>
                    </button>
                    <button
                      onClick={handleClearGoogleSync}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 transition text-xs flex items-center gap-1.5"
                      title="連携を解除して取り込んだ予定を消去"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>同期解除</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Alternative: Direct ICS file upload */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">またはファイルで直接取り込む:</span>
                  <p className="text-[11px] text-slate-500">Googleカレンダーで書き出した .ics ファイルを読み込めます</p>
                </div>
                <label className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 font-medium cursor-pointer transition flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>.ics ファイルを選択</span>
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleImportIcsFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsGoogleSyncModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AgendaEventCardProps {
  item: CalendarItem;
  onSelect: () => void;
  onJump: () => void;
}

const AgendaEventCard: React.FC<AgendaEventCardProps> = ({ item, onSelect, onJump }) => {
  const conf = CATEGORY_CONFIG[item.category];

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition hover:scale-[1.01] flex flex-col justify-between ${conf.badgeBg} ${conf.border} shadow-sm group`}
    >
      <div>
        <div className="flex items-center justify-between text-[11px] opacity-80 mb-1.5">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
            <span className={conf.text}>{conf.label}</span>
          </span>
          <span className="font-mono text-slate-300">
            {item.date} {item.startTime ? item.startTime : '(終日)'}
          </span>
        </div>

        <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-blue-300 transition">
          {item.title}
        </h4>

        {item.companyName && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-medium truncate">{item.companyName}</span>
          </div>
        )}

        {item.amount !== undefined && (
          <div className="mt-1 text-[11px] text-emerald-300 font-mono">
            税抜 ¥{item.amount.toLocaleString()} + 税10% = 税込 ¥{(item.totalAmount || item.amount * 1.1).toLocaleString()}
          </div>
        )}

        {(item.location || item.meetUrl) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {item.meetUrl?.includes('zoom.us') || item.location?.toLowerCase().includes('zoom') ? (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1">
                <Video className="w-3 h-3 text-blue-400" />
                <span>Zoom</span>
              </span>
            ) : item.meetUrl?.includes('meet.google.com') || item.location?.toLowerCase().includes('google meet') ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                <Video className="w-3 h-3 text-emerald-400" />
                <span>Google Meet</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span className="truncate max-w-[140px]">{item.location}</span>
              </span>
            )}

            {item.meetUrl && (
              <a
                href={item.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                  item.meetUrl.includes('zoom.us') || item.location?.toLowerCase().includes('zoom')
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <span>参加</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">クリックして詳細表示</span>
        <div className="flex items-center gap-1">
          <a
            href={buildGoogleCalendarUrl({
              title: item.title,
              date: item.date,
              startTime: item.startTime,
              endTime: item.endTime,
              isAllDay: item.isAllDay,
              companyName: item.companyName,
              location: item.location,
              meetUrl: item.meetUrl,
              notes: item.notes,
            })}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 transition text-[10px] flex items-center gap-1 px-1.5"
            title="Googleカレンダーに追加"
          >
            <Share2 className="w-3 h-3" />
            <span>Gカレンダー</span>
          </a>

          {(item.linkTab || item.companyId) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[10px] flex items-center gap-1 px-1.5"
              title="該当台帳を開く"
            >
              <span>台帳</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
