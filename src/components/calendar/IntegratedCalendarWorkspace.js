import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search, ExternalLink, Clock, Building2, CheckCircle2, AlertCircle, CalendarDays, ListFilter, X, Share2, Trash2, Edit3, Video, MapPin, ArrowRight, RefreshCw, Coins, Globe, Upload, HelpCircle, Info } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { loadCustomCalendarEvents, saveCustomCalendarEvents, buildGoogleCalendarUrl, buildAggregatedCalendarItems, getStoredGoogleIcalUrl, getStoredGoogleEvents, setStoredGoogleEvents, getGoogleCalendarSyncInfo, clearGoogleCalendarSync, fetchGoogleCalendarFromIcal, parseIcalStringClient } from '../../services/calendarService';
import { todayJst } from '../../utils/date';
const CATEGORY_CONFIG = {
    deal: {
        label: '商談・リード面談',
        badgeBg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-600'
    },
    support: {
        label: '顧客支援・定期面談',
        badgeBg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
    },
    task: {
        label: '業務タスク期限',
        badgeBg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        dot: 'bg-purple-600'
    },
    finance: {
        label: '請求・契約期日',
        badgeBg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-600'
    },
    custom: {
        label: '登録予定・MTG',
        badgeBg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        dot: 'bg-indigo-600'
    },
    google: {
        label: 'Googleカレンダー（事業用）',
        badgeBg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: 'bg-sky-500'
    },
};
export const IntegratedCalendarWorkspace = ({ invoices = [], contracts = [], tasks = [], onNavigateTab, onOpenCustomerWorkspace, }) => {
    const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
    const [viewMode, setViewMode] = useState('month');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    // Database data
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [deals, setDeals] = useState([]);
    const [leads, setLeads] = useState([]);
    const [engagements, setEngagements] = useState([]);
    const [supportMeetings, setSupportMeetings] = useState([]);
    const [customEvents, setCustomEvents] = useState(() => loadCustomCalendarEvents());
    // Google Calendar Sync States
    const [googleEvents, setGoogleEvents] = useState(() => getStoredGoogleEvents());
    const [googleIcalUrl, setGoogleIcalUrl] = useState(() => getStoredGoogleIcalUrl());
    const [googleSyncInfo, setGoogleSyncInfo] = useState(() => getGoogleCalendarSyncInfo());
    const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
    const [syncUrlInput, setSyncUrlInput] = useState(() => getStoredGoogleIcalUrl());
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncStatusMsg, setSyncStatusMsg] = useState(null);
    // Modals
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
    const [newEventDate, setNewEventDate] = useState(todayJst());
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventCategory, setNewEventCategory] = useState('custom');
    const [newEventStartTime, setNewEventStartTime] = useState('10:00');
    const [newEventEndTime, setNewEventEndTime] = useState('11:00');
    const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);
    const [newEventCompanyId, setNewEventCompanyId] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('Google Meet');
    const [newEventMeetUrl, setNewEventMeetUrl] = useState('');
    const [newEventNotes, setNewEventNotes] = useState('');
    const [editingCustomEventId, setEditingCustomEventId] = useState(null);
    // Load all external events from Supabase
    const fetchData = async () => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        setLoading(true);
        try {
            const [compRes, dealRes, leadRes, engRes, meetingRes] = await Promise.all([
                supabase.from('companies').select('id,company_name').order('company_name'),
                supabase.from('deals').select('*,company:companies(company_name)').order('created_at', { ascending: false }),
                supabase.from('leads').select('*,company:companies(company_name)').order('created_at', { ascending: false }),
                supabase.from('customer_service_engagements').select('*').order('created_at', { ascending: false }),
                supabase.from('customer_service_meetings').select('*').order('occurred_at', { ascending: false }),
            ]);
            if (compRes.data)
                setCompanies(compRes.data);
            if (dealRes.data)
                setDeals(dealRes.data);
            if (leadRes.data)
                setLeads(leadRes.data);
            if (engRes.data)
                setEngagements(engRes.data);
            if (meetingRes.data)
                setSupportMeetings(meetingRes.data);
        }
        catch (err) {
            console.warn('Failed to fetch calendar sources from Supabase:', err);
        }
        finally {
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
            }
            else {
                setSyncStatusMsg({
                    type: 'error',
                    text: res.error || '同期に失敗しました。URLをお確かめください。',
                });
            }
        }
        catch (err) {
            setSyncStatusMsg({
                type: 'error',
                text: err.message || '同期処理中にエラーが発生しました。',
            });
        }
        finally {
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
    const handleImportIcsFile = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
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
            }
            catch (err) {
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
                if (!matchTitle && !matchComp && !matchNotes)
                    return false;
            }
            return true;
        });
    }, [allCalendarItems, selectedCategory, searchQuery]);
    // Group events by date for fast calendar lookup
    const eventsByDate = useMemo(() => {
        const map = new Map();
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
        const days = [];
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
        const days = [];
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
        const overdue = [];
        const todayItems = [];
        const tomorrowItems = [];
        const thisWeekItems = [];
        const upcomingItems = [];
        const pastItems = [];
        filteredItems.forEach((item) => {
            if (item.date < today) {
                if (item.category === 'task' || (item.category === 'finance' && item.status !== 'paid')) {
                    overdue.push(item);
                }
                else {
                    pastItems.push(item);
                }
            }
            else if (item.date === today) {
                todayItems.push(item);
            }
            else if (item.date === tomorrow) {
                tomorrowItems.push(item);
            }
            else if (item.date <= nextWeekDate) {
                thisWeekItems.push(item);
            }
            else {
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
        }
        else {
            setCurrentMonth((m) => m - 1);
        }
    };
    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        }
        else {
            setCurrentMonth((m) => m + 1);
        }
    };
    const handleGoToday = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth());
    };
    // Open Add Event modal for a specific day
    const handleOpenAddModal = (dateStr) => {
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
        if (!newEventTitle.trim())
            return;
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
        }
        else {
            const newEvt = {
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
    const handleDeleteCustomEvent = (id) => {
        const rawId = id.replace('custom-event-', '');
        const updated = customEvents.filter((e) => e.id !== rawId && e.id !== id);
        setCustomEvents(updated);
        saveCustomCalendarEvents(updated);
        setSelectedEvent(null);
    };
    // Open Edit for custom event
    const handleEditCustomEvent = (event) => {
        const rawId = event.id.replace('custom-event-', '');
        const found = customEvents.find((e) => e.id === rawId || e.id === event.id);
        if (!found)
            return;
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
    const handleJumpToEvent = (item) => {
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u4E88\u5B9A\u30AB\u30EC\u30F3\u30C0\u30FC" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { onClick: () => {
                                    setSyncStatusMsg(null);
                                    setSyncUrlInput(googleIcalUrl);
                                    setIsGoogleSyncModalOpen(true);
                                }, className: "px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs transition flex items-center gap-1.5 cursor-pointer", title: "\u4E8B\u696D\u7528Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u4E88\u5B9A\u3092\u975E\u516C\u958BURL\u3067\u5B89\u5168\u306B\u540C\u671F", children: [_jsx(Globe, { className: "w-3.5 h-3.5 text-sky-600" }), _jsx("span", { children: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u540C\u671F" }), googleIcalUrl ? (_jsxs("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono", children: [googleEvents.length, "\u4EF6"] })) : (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200", children: "\u672A\u8A2D\u5B9A" }))] }), _jsxs("button", { onClick: () => handleOpenAddModal(), className: "px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition flex items-center gap-1.5 cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u4E88\u5B9A\u30FB\u9762\u8AC7\u3092\u767B\u9332" })] }), _jsx("button", { onClick: fetchData, disabled: loading, className: "p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition cursor-pointer", title: "\u30C7\u30FC\u30BF\u3092\u518D\u8AAD\u307F\u8FBC\u307F", children: _jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}` }) })] })] }), _jsxs("div", { className: "bg-white border border-slate-200 rounded-xl p-4 shadow-xs", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: handlePrevMonth, className: "p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition", title: "\u524D\u6708", children: _jsx(ChevronLeft, { className: "w-4 h-4" }) }), _jsxs("div", { className: "text-base font-bold text-slate-900 px-2 tracking-tight min-w-[120px] text-center", children: [currentYear, "\u5E74 ", currentMonth + 1, "\u6708"] }), _jsx("button", { onClick: handleNextMonth, className: "p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition", title: "\u7FCC\u6708", children: _jsx(ChevronRight, { className: "w-4 h-4" }) }), _jsx("button", { onClick: handleGoToday, className: "px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition ml-1", children: "\u4ECA\u6708 (\u4ECA\u65E5)" })] }), _jsxs("div", { className: "flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs self-start md:self-auto", children: [_jsxs("button", { onClick: () => setViewMode('month'), className: `px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${viewMode === 'month'
                                            ? 'bg-purple-600 text-white font-bold shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(CalendarDays, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u6708\u8868\u793A" })] }), _jsxs("button", { onClick: () => setViewMode('week'), className: `px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${viewMode === 'week'
                                            ? 'bg-purple-600 text-white font-bold shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(Clock, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9031\u8868\u793A" })] }), _jsxs("button", { onClick: () => setViewMode('agenda'), className: `px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${viewMode === 'agenda'
                                            ? 'bg-purple-600 text-white font-bold shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(ListFilter, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30A2\u30B8\u30A7\u30F3\u30C0\u4E00\u89A7" })] })] })] }), _jsxs("div", { className: "mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [_jsxs("button", { onClick: () => setSelectedCategory('all'), className: `px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${selectedCategory === 'all'
                                            ? 'bg-purple-600 text-white font-bold shadow-2xs'
                                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`, children: ["\u3059\u3079\u3066 (", allCalendarItems.length, ")"] }), Object.keys(CATEGORY_CONFIG).map((cat) => {
                                        const conf = CATEGORY_CONFIG[cat];
                                        const count = allCalendarItems.filter((i) => i.category === cat).length;
                                        const isSelected = selectedCategory === cat;
                                        return (_jsxs("button", { onClick: () => setSelectedCategory(cat), className: `px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${isSelected
                                                ? `${conf.badgeBg} ${conf.text} ${conf.border} font-bold ring-1 ring-purple-500`
                                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'}`, children: [_jsx("span", { className: `w-2 h-2 rounded-full ${conf.dot}` }), _jsx("span", { children: conf.label }), _jsxs("span", { className: "text-[10px] opacity-75", children: ["(", count, ")"] })] }, cat));
                                    })] }), _jsxs("div", { className: "relative min-w-[200px] max-w-xs", children: [_jsx(Search, { className: "w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "\u4F01\u696D\u540D\u30FB\u6848\u4EF6\u540D\u30FB\u30E1\u30E2\u691C\u7D22...", className: "w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" }), searchQuery && (_jsx("button", { onClick: () => setSearchQuery(''), className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600", children: _jsx(X, { className: "w-3.5 h-3.5" }) }))] })] })] }), viewMode === 'month' && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold py-2.5", children: [_jsx("span", { className: "text-rose-600", children: "\u65E5" }), _jsx("span", { className: "text-slate-700", children: "\u6708" }), _jsx("span", { className: "text-slate-700", children: "\u706B" }), _jsx("span", { className: "text-slate-700", children: "\u6C34" }), _jsx("span", { className: "text-slate-700", children: "\u6728" }), _jsx("span", { className: "text-slate-700", children: "\u91D1" }), _jsx("span", { className: "text-sky-600", children: "\u571F" })] }), _jsx("div", { className: "grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 bg-slate-50/50", children: monthDays.map((day) => {
                            const dayEvents = eventsByDate.get(day.dateStr) || [];
                            const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                            return (_jsxs("div", { className: `min-h-[115px] p-1.5 sm:p-2 flex flex-col justify-between transition group relative ${!day.isCurrentMonth
                                    ? 'bg-slate-100/60 text-slate-400'
                                    : isWeekend
                                        ? 'bg-slate-50/80'
                                        : 'bg-white hover:bg-slate-50'} ${day.isToday ? 'ring-2 ring-purple-500 bg-purple-50/30' : ''}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: `text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${day.isToday
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : day.dayOfWeek === 0
                                                        ? 'text-rose-600'
                                                        : day.dayOfWeek === 6
                                                            ? 'text-sky-600'
                                                            : day.isCurrentMonth
                                                                ? 'text-slate-800'
                                                                : 'text-slate-400'}`, children: day.dayNumber }), _jsx("button", { onClick: () => handleOpenAddModal(day.dateStr), className: "opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition text-[10px]", title: "\u3053\u306E\u65E5\u306B\u4E88\u5B9A\u3092\u8FFD\u52A0", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "mt-1 space-y-1 flex-1 overflow-hidden", children: [dayEvents.slice(0, 3).map((event) => {
                                                const conf = CATEGORY_CONFIG[event.category];
                                                return (_jsxs("div", { onClick: () => setSelectedEvent(event), className: `px-1.5 py-0.5 rounded text-[10px] font-medium border truncate cursor-pointer transition flex items-center gap-1 shadow-2xs ${conf.badgeBg} ${conf.text} ${conf.border} hover:opacity-90`, title: `${event.startTime ? event.startTime + ' ' : ''}${event.title}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${conf.dot}` }), event.startTime && (_jsx("span", { className: "opacity-80 shrink-0 font-mono", children: event.startTime })), _jsx("span", { className: "truncate", children: event.title })] }, event.id));
                                            }), dayEvents.length > 3 && (_jsxs("button", { onClick: () => {
                                                    setSearchQuery(day.dateStr);
                                                    setViewMode('agenda');
                                                }, className: "text-[10px] text-purple-600 hover:text-purple-800 font-semibold px-1 block text-left", children: ["\u4ED6 ", dayEvents.length - 3, " \u4EF6\u306E\u4E88\u5B9A..."] }))] })] }, day.dateStr));
                        }) })] })), viewMode === 'week' && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-7 gap-3", children: weekDays.map((day) => {
                    const dayEvents = eventsByDate.get(day.dateStr) || [];
                    return (_jsxs("div", { className: `bg-white border rounded-2xl p-3 flex flex-col min-h-[360px] shadow-sm ${day.isToday
                            ? 'border-purple-500 bg-purple-50/20 ring-1 ring-purple-500'
                            : 'border-slate-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between pb-2 mb-2 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: `text-xs font-bold px-2 py-0.5 rounded-lg ${day.isToday
                                                    ? 'bg-purple-600 text-white'
                                                    : day.dayOfWeek === 0
                                                        ? 'bg-rose-50 text-rose-700'
                                                        : day.dayOfWeek === 6
                                                            ? 'bg-sky-50 text-sky-700'
                                                            : 'bg-slate-100 text-slate-700'}`, children: day.dayName }), _jsxs("span", { className: "text-sm font-bold text-slate-900", children: [day.dayNumber, "\u65E5"] })] }), _jsx("button", { onClick: () => handleOpenAddModal(day.dateStr), className: "p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition", title: "\u3053\u306E\u65E5\u306B\u4E88\u5B9A\u3092\u8FFD\u52A0", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) })] }), _jsx("div", { className: "space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-1", children: dayEvents.length === 0 ? (_jsx("div", { className: "text-[11px] text-slate-400 text-center py-8", children: "\u4E88\u5B9A\u306A\u3057" })) : (dayEvents.map((event) => {
                                    const conf = CATEGORY_CONFIG[event.category];
                                    return (_jsxs("div", { onClick: () => setSelectedEvent(event), className: `p-2 rounded-xl border text-xs cursor-pointer transition hover:scale-[1.01] ${conf.badgeBg} ${conf.border} shadow-2xs`, children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] opacity-80 mb-1", children: [_jsxs("span", { className: "flex items-center gap-1 font-semibold", children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${conf.dot}` }), conf.label] }), event.startTime && _jsx("span", { className: "font-mono", children: event.startTime })] }), _jsx("div", { className: `font-semibold ${conf.text} line-clamp-2`, children: event.title }), event.companyName && (_jsxs("div", { className: "mt-1 text-[11px] text-slate-600 flex items-center gap-1 truncate", children: [_jsx(Building2, { className: "w-3 h-3 shrink-0 text-slate-400" }), _jsx("span", { className: "truncate", children: event.companyName })] })), event.amount !== undefined && (_jsxs("div", { className: "mt-1 text-[10px] text-emerald-700 font-mono font-semibold", children: ["\u7A0E\u629C \u00A5", event.amount.toLocaleString(), " + \u7A0E10% = \u7A0E\u8FBC \u00A5", (event.totalAmount || event.amount * 1.1).toLocaleString()] }))] }, event.id));
                                })) })] }, day.dateStr));
                }) })), viewMode === 'agenda' && (_jsxs("div", { className: "space-y-5", children: [agendaGroups.overdue.length > 0 && (_jsxs("div", { className: "bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-rose-700 font-bold text-sm mb-3", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-rose-600" }), _jsxs("span", { children: ["\u671F\u9650\u8D85\u904E / \u8981\u5BFE\u5FDC (", agendaGroups.overdue.length, "\u4EF6)"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: agendaGroups.overdue.map((item) => (_jsx(AgendaEventCard, { item: item, onSelect: () => setSelectedEvent(item), onJump: () => handleJumpToEvent(item) }, item.id))) })] })), _jsxs("div", { className: "bg-white border border-purple-200 rounded-2xl p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3 pb-2 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" }), _jsxs("h2", { className: "text-sm font-bold text-slate-900", children: ["\u672C\u65E5\u306E\u4E88\u5B9A (", agendaGroups.today.length, "\u4EF6)"] }), _jsx("span", { className: "text-xs text-slate-400 font-mono", children: todayJst() })] }), _jsxs("button", { onClick: () => handleOpenAddModal(todayJst()), className: "text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-semibold", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u4ECA\u65E5\u306B\u8FFD\u52A0" })] })] }), agendaGroups.today.length === 0 ? (_jsx("div", { className: "text-xs text-slate-400 py-4 text-center", children: "\u672C\u65E5\u306E\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093\u3002" })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: agendaGroups.today.map((item) => (_jsx(AgendaEventCard, { item: item, onSelect: () => setSelectedEvent(item), onJump: () => handleJumpToEvent(item) }, item.id))) }))] }), agendaGroups.tomorrow.length > 0 && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm", children: [_jsxs("div", { className: "text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2", children: [_jsx(Clock, { className: "w-4 h-4 text-sky-600" }), _jsxs("span", { children: ["\u660E\u65E5\u306E\u4E88\u5B9A (", agendaGroups.tomorrow.length, "\u4EF6)"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: agendaGroups.tomorrow.map((item) => (_jsx(AgendaEventCard, { item: item, onSelect: () => setSelectedEvent(item), onJump: () => handleJumpToEvent(item) }, item.id))) })] })), agendaGroups.thisWeek.length > 0 && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm", children: [_jsxs("div", { className: "text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2", children: [_jsx(CalendarIcon, { className: "w-4 h-4 text-purple-600" }), _jsxs("span", { children: ["\u4ECA\u9031\u306E\u4E88\u5B9A (", agendaGroups.thisWeek.length, "\u4EF6)"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: agendaGroups.thisWeek.map((item) => (_jsx(AgendaEventCard, { item: item, onSelect: () => setSelectedEvent(item), onJump: () => handleJumpToEvent(item) }, item.id))) })] })), agendaGroups.upcoming.length > 0 && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm", children: [_jsxs("div", { className: "text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2", children: [_jsx(ArrowRight, { className: "w-4 h-4 text-slate-500" }), _jsxs("span", { children: ["\u6765\u9031\u4EE5\u964D\u306E\u4E88\u5B9A (", agendaGroups.upcoming.length, "\u4EF6)"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: agendaGroups.upcoming.map((item) => (_jsx(AgendaEventCard, { item: item, onSelect: () => setSelectedEvent(item), onJump: () => handleJumpToEvent(item) }, item.id))) })] }))] })), selectedEvent && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto", children: _jsxs("div", { className: "relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800", children: [_jsx("button", { onClick: () => setSelectedEvent(null), className: "absolute top-4 right-4 p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition", children: _jsx(X, { className: "w-4 h-4" }) }), _jsxs("div", { className: "flex items-center gap-2 mb-3", children: [(() => {
                                    const conf = CATEGORY_CONFIG[selectedEvent.category];
                                    return (_jsx("span", { className: `px-2.5 py-0.5 rounded-full text-xs font-semibold border ${conf.badgeBg} ${conf.text} ${conf.border}`, children: conf.label }));
                                })(), selectedEvent.statusLabel && (_jsx("span", { className: "px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 font-medium border border-slate-200", children: selectedEvent.statusLabel }))] }), _jsx("h3", { className: "text-lg font-bold text-slate-900 mb-4 pr-6", children: selectedEvent.title }), _jsxs("div", { className: "space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-700", children: [_jsx(Clock, { className: "w-4 h-4 text-purple-600 shrink-0" }), _jsx("span", { className: "font-semibold text-slate-900", children: "\u65E5\u6642:" }), _jsx("span", { children: selectedEvent.date }), selectedEvent.startTime && (_jsxs("span", { className: "text-purple-700 font-mono font-bold", children: [selectedEvent.startTime, selectedEvent.endTime ? ` 〜 ${selectedEvent.endTime}` : ''] })), selectedEvent.isAllDay && _jsx("span", { className: "text-slate-400", children: "(\u7D42\u65E5)" })] }), selectedEvent.companyName && (_jsxs("div", { className: "flex items-center gap-2 text-slate-700", children: [_jsx(Building2, { className: "w-4 h-4 text-indigo-600 shrink-0" }), _jsx("span", { className: "font-semibold text-slate-900", children: "\u5BFE\u8C61\u4F01\u696D:" }), _jsx("span", { className: "text-indigo-900 font-medium", children: selectedEvent.companyName })] })), selectedEvent.amount !== undefined && (_jsxs("div", { className: "flex items-start gap-2 text-slate-700", children: [_jsx(Coins, { className: "w-4 h-4 text-emerald-600 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold text-slate-900", children: "\u91D1\u984D: " }), _jsxs("span", { className: "text-emerald-700 font-bold", children: ["\u7A0E\u629C \u00A5", selectedEvent.amount.toLocaleString()] }), _jsxs("span", { className: "text-slate-500 ml-2", children: ["\uFF08\u6D88\u8CBB\u7A0E10% \u00A5", (selectedEvent.taxAmount ?? Math.round(selectedEvent.amount * 0.1)).toLocaleString(), " / \u7A0E\u8FBC \u00A5", (selectedEvent.totalAmount ?? Math.round(selectedEvent.amount * 1.1)).toLocaleString(), "\uFF09"] })] })] })), (selectedEvent.location || selectedEvent.meetUrl) && (_jsxs("div", { className: "p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-700 text-xs", children: [selectedEvent.meetUrl?.includes('zoom.us') || selectedEvent.location?.toLowerCase().includes('zoom') ? (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1", children: [_jsx(Video, { className: "w-3 h-3 text-blue-600" }), _jsx("span", { children: "Zoom\u9762\u8AC7" })] })) : selectedEvent.meetUrl?.includes('meet.google.com') || selectedEvent.location?.toLowerCase().includes('google meet') ? (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1", children: [_jsx(Video, { className: "w-3 h-3 text-emerald-600" }), _jsx("span", { children: "Google Meet" })] })) : (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3 h-3 text-amber-500" }), _jsx("span", { children: "\u5834\u6240 / \u5F62\u5F0F" })] })), _jsx("span", { className: "font-semibold text-slate-900", children: selectedEvent.location || (selectedEvent.meetUrl?.includes('zoom.us') ? 'Zoom' : 'オンライン面談') })] }), selectedEvent.meetUrl && (_jsxs("a", { href: selectedEvent.meetUrl, target: "_blank", rel: "noopener noreferrer", className: `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${selectedEvent.meetUrl.includes('zoom.us') || selectedEvent.location?.toLowerCase().includes('zoom')
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`, children: [_jsx(Video, { className: "w-3.5 h-3.5" }), _jsx("span", { children: selectedEvent.meetUrl.includes('zoom.us') ? 'Zoomに参加' : 'Meetに参加' }), _jsx(ExternalLink, { className: "w-3 h-3 opacity-80" })] }))] })), selectedEvent.notes && (_jsxs("div", { className: "pt-2 border-t border-slate-200", children: [_jsx("div", { className: "font-semibold text-slate-600 mb-1", children: "\u30A2\u30B8\u30A7\u30F3\u30C0\u30FB\u8A73\u7D30\u30E1\u30E2:" }), _jsx("p", { className: "text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200", children: selectedEvent.notes })] }))] }), _jsxs("div", { className: "mt-5 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("a", { href: buildGoogleCalendarUrl({
                                                title: selectedEvent.title,
                                                date: selectedEvent.date,
                                                startTime: selectedEvent.startTime,
                                                endTime: selectedEvent.endTime,
                                                isAllDay: selectedEvent.isAllDay,
                                                companyName: selectedEvent.companyName,
                                                location: selectedEvent.location,
                                                meetUrl: selectedEvent.meetUrl,
                                                notes: selectedEvent.notes,
                                            }), target: "_blank", rel: "noopener noreferrer", className: "px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2", children: [_jsx(Share2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u8FFD\u52A0" })] }), (selectedEvent.linkTab || selectedEvent.companyId) && (_jsxs("button", { onClick: () => {
                                                handleJumpToEvent(selectedEvent);
                                                setSelectedEvent(null);
                                            }, className: "px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5", children: [_jsx("span", { children: "\u8A72\u5F53\u53F0\u5E33\u3092\u958B\u304F" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-purple-600" })] }))] }), selectedEvent.source === 'custom' && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleEditCustomEvent(selectedEvent), className: "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200", title: "\u7DE8\u96C6", children: _jsx(Edit3, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => handleDeleteCustomEvent(selectedEvent.id), className: "p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition", title: "\u524A\u9664", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }))] })] }) })), isNewEventModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto", children: _jsxs("div", { className: "relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-slate-800", children: [_jsx("button", { onClick: () => setIsNewEventModalOpen(false), className: "absolute top-4 right-4 p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition", children: _jsx(X, { className: "w-4 h-4" }) }), _jsxs("h3", { className: "text-lg font-bold text-slate-900 mb-4 flex items-center gap-2", children: [_jsx(CalendarIcon, { className: "w-5 h-5 text-purple-600" }), _jsx("span", { children: editingCustomEventId ? '予定・面談を編集' : '新規予定・面談を登録' })] }), _jsxs("div", { className: "space-y-4 text-xs", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-slate-700 font-semibold mb-1", children: ["\u4E88\u5B9A\u30FB\u9762\u8AC7\u30BF\u30A4\u30C8\u30EB ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "text", value: newEventTitle, onChange: (e) => setNewEventTitle(e.target.value), placeholder: "\u4F8B: \u682A\u5F0F\u4F1A\u793E\u25CB\u25CB\u69D8 DX\u4F34\u8D70\u6708\u6B21\u30DF\u30FC\u30C6\u30A3\u30F3\u30B0", className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-700 font-semibold mb-1", children: "\u533A\u5206\u30FB\u5206\u985E" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: Object.keys(CATEGORY_CONFIG)
                                                .filter((c) => c !== 'google')
                                                .map((cat) => {
                                                const conf = CATEGORY_CONFIG[cat];
                                                const active = newEventCategory === cat;
                                                return (_jsxs("button", { type: "button", onClick: () => setNewEventCategory(cat), className: `p-2 rounded-xl border text-center font-semibold transition flex items-center justify-center gap-1.5 ${active
                                                        ? `${conf.badgeBg} ${conf.text} ${conf.border} ring-1 ring-purple-500`
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx("span", { className: `w-2 h-2 rounded-full ${conf.dot}` }), _jsx("span", { children: conf.label })] }, cat));
                                            }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-slate-700 font-semibold mb-1", children: "\u65E5\u4ED8" }), _jsx("input", { type: "date", value: newEventDate, onChange: (e) => setNewEventDate(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-slate-700 font-semibold", children: "\u6642\u9593\u5E2F" }), _jsxs("label", { className: "flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: newEventIsAllDay, onChange: (e) => setNewEventIsAllDay(e.target.checked), className: "rounded border-slate-300 text-purple-600 focus:ring-purple-500" }), _jsx("span", { children: "\u7D42\u65E5" })] })] }), !newEventIsAllDay ? (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "time", value: newEventStartTime, onChange: (e) => setNewEventStartTime(e.target.value), className: "w-full px-2 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-center focus:outline-none focus:border-purple-500 font-mono" }), _jsx("span", { className: "text-slate-400", children: "\u301C" }), _jsx("input", { type: "time", value: newEventEndTime, onChange: (e) => setNewEventEndTime(e.target.value), className: "w-full px-2 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-center focus:outline-none focus:border-purple-500 font-mono" })] })) : (_jsx("div", { className: "px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-center font-medium", children: "\u7D42\u65E5\u30A4\u30D9\u30F3\u30C8" }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-700 font-semibold mb-1", children: "\u5BFE\u8C61\u4F01\u696D\uFF08\u4EFB\u610F\uFF09" }), _jsxs("select", { value: newEventCompanyId, onChange: (e) => setNewEventCompanyId(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs", children: [_jsx("option", { value: "", children: "\u4F01\u696D\u3092\u9078\u629E\u3057\u306A\u3044\uFF08\u793E\u5185\u30FB\u4E00\u822C\uFF09" }), companies.map((c) => (_jsxs("option", { value: c.id, children: [c.company_name, " (", c.id, ")"] }, c.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-700 font-semibold mb-1.5", children: "\u958B\u50AC\u5834\u6240 / \u5B9F\u65BD\u5F62\u5F0F" }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2", children: [_jsxs("button", { type: "button", onClick: () => {
                                                        setNewEventLocation('Zoom');
                                                        if (!newEventMeetUrl || newEventMeetUrl.includes('meet.google.com')) {
                                                            const savedZoom = localStorage.getItem('mst_default_zoom_url') || '';
                                                            setNewEventMeetUrl(savedZoom || 'https://zoom.us/j/');
                                                        }
                                                    }, className: `px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${newEventLocation.toLowerCase().includes('zoom')
                                                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-400'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx(Video, { className: "w-3.5 h-3.5 text-blue-600" }), _jsx("span", { children: "Zoom" })] }), _jsxs("button", { type: "button", onClick: () => {
                                                        setNewEventLocation('Google Meet');
                                                        if (!newEventMeetUrl || newEventMeetUrl.includes('zoom.us')) {
                                                            setNewEventMeetUrl('https://meet.google.com/');
                                                        }
                                                    }, className: `px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${newEventLocation.toLowerCase().includes('google meet')
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-400'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx(Video, { className: "w-3.5 h-3.5 text-emerald-600" }), _jsx("span", { children: "Google Meet" })] }), _jsxs("button", { type: "button", onClick: () => {
                                                        setNewEventLocation('現地訪問（顧客先）');
                                                        setNewEventMeetUrl('');
                                                    }, className: `px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${newEventLocation.includes('訪問')
                                                        ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-400'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-amber-500" }), _jsx("span", { children: "\u73FE\u5730\u8A2A\u554F" })] }), _jsxs("button", { type: "button", onClick: () => {
                                                        setNewEventLocation('来社面談（自社オフィス）');
                                                        setNewEventMeetUrl('');
                                                    }, className: `px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${newEventLocation.includes('来社')
                                                        ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-400'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u6765\u793E\u30FB\u81EA\u793E" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-slate-500 text-[11px] mb-1", children: "\u5834\u6240 / \u5F62\u5F0F\u306E\u540D\u79F0\uFF08\u8ABF\u6574\u53EF\u80FD\uFF09" }), _jsx("input", { type: "text", value: newEventLocation, onChange: (e) => setNewEventLocation(e.target.value), placeholder: "\u4F8B: Zoom, Google Meet, \u8A2A\u554F\u5148", className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 text-xs shadow-2xs" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-slate-500 text-[11px]", children: "\u9762\u8AC7URL\uFF08Zoom / Meet\u7B49\uFF09" }), newEventLocation.toLowerCase().includes('zoom') && newEventMeetUrl && (_jsx("button", { type: "button", onClick: () => {
                                                                        localStorage.setItem('mst_default_zoom_url', newEventMeetUrl);
                                                                        alert('このZoom URLをデフォルトURLとして記憶しました');
                                                                    }, className: "text-[10px] text-purple-600 hover:underline cursor-pointer", children: "\u6B21\u56DE\u3082\u3053\u306EURL\u3092\u4F7F\u3046" }))] }), _jsx("input", { type: "url", value: newEventMeetUrl, onChange: (e) => setNewEventMeetUrl(e.target.value), placeholder: newEventLocation.toLowerCase().includes('zoom') ? 'https://zoom.us/j/...' : 'https://meet.google.com/...', className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-mono text-xs shadow-2xs" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-700 font-semibold mb-1", children: "\u30A2\u30B8\u30A7\u30F3\u30C0\u30FB\u30E1\u30E2" }), _jsx("textarea", { rows: 3, value: newEventNotes, onChange: (e) => setNewEventNotes(e.target.value), placeholder: "\u30A2\u30B8\u30A7\u30F3\u30C0\u3001\u6301\u3061\u7269\u3001\u691C\u8A0E\u4E8B\u9805\u306A\u3069...", className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-2xs" })] })] }), _jsxs("div", { className: "mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100", children: [_jsx("button", { type: "button", onClick: () => setIsNewEventModalOpen(false), className: "px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: handleSaveCustomEvent, disabled: !newEventTitle.trim(), className: "px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs transition shadow-sm", children: editingCustomEventId ? '変更を保存' : '予定を登録' })] })] }) })), isGoogleSyncModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto", children: _jsxs("div", { className: "relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-xl p-6 text-slate-800", children: [_jsx("button", { onClick: () => setIsGoogleSyncModalOpen(false), className: "absolute top-5 right-5 p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition", children: _jsx(X, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("div", { className: "w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center shadow-md shadow-sky-600/20 text-white", children: _jsx(Globe, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-bold text-slate-900 flex items-center gap-2", children: [_jsx("span", { children: "\u4E8B\u696D\u7528Google\u30AB\u30EC\u30F3\u30C0\u30FC\u540C\u671F\u8A2D\u5B9A" }), _jsx("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-semibold", children: "\u30D7\u30E9\u30A4\u30D9\u30FC\u30C8\u5206\u96E2\u578B" })] }), _jsx("p", { className: "text-xs text-slate-500", children: "\u500B\u4EBA\u30A2\u30AB\u30A6\u30F3\u30C8\uFF08masato.la21@gmail.com\u7B49\uFF09\u3068\u6DF7\u540C\u305B\u305A\u3001\u4E8B\u696D\u7528\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u4E88\u5B9A\u306E\u307F\u3092\u5B89\u5168\u306B\u672C\u30A2\u30D7\u30EA\u3078\u53D6\u308A\u8FBC\u307F\u307E\u3059\u3002" })] })] }), _jsxs("div", { className: "mb-5 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 text-xs text-sky-900 flex items-start gap-3", children: [_jsx(Info, { className: "w-5 h-5 text-sky-600 shrink-0 mt-0.5" }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "font-semibold text-sky-950", children: "\u5B89\u5FC3\u306E\u72EC\u7ACB\u540C\u671F\uFF08\u30D6\u30E9\u30A6\u30B6\u8A8D\u8A3C\u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u4E0D\u8981\uFF09" }), _jsx("p", { className: "text-[11px] text-sky-800 leading-relaxed", children: "\u73FE\u5728AI Studio\u3092\u3054\u5229\u7528\u4E2D\u306E\u500B\u4EBAGoogle\u30A2\u30AB\u30A6\u30F3\u30C8\u3068\u306F\u4E00\u5207\u9023\u52D5\u3057\u307E\u305B\u3093\u3002\u4E8B\u696D\u7528Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u300CiCal\u5F62\u5F0F\u306E\u79D8\u5BC6\u306E\u30A2\u30C9\u30EC\u30B9\u300D\u3092\u4F7F\u7528\u3059\u308B\u305F\u3081\u3001\u500B\u4EBA\u60C5\u5831\u304C\u6F0F\u6D29\u3057\u305F\u308A\u6DF7\u540C\u3055\u308C\u305F\u308A\u3059\u308B\u5FC3\u914D\u306A\u304F\u3001\u4E8B\u696D\u306E\u4E88\u5B9A\u306E\u307F\u3092\u7D71\u5408\u30AB\u30EC\u30F3\u30C0\u30FC\u3078\u91CD\u306D\u3066\u8868\u793A\u3067\u304D\u307E\u3059\u3002" })] })] }), _jsxs("div", { className: "mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs", children: [_jsxs("h4", { className: "font-bold text-slate-900 mb-2.5 flex items-center gap-1.5 text-xs", children: [_jsx(HelpCircle, { className: "w-4 h-4 text-amber-500" }), _jsx("span", { children: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u3067\u306E\u300C\u79D8\u5BC6\u306E\u30A2\u30C9\u30EC\u30B9\uFF08iCal URL\uFF09\u300D\u306E\u53D6\u5F97\u624B\u9806" })] }), _jsxs("ol", { className: "space-y-2 text-slate-600 pl-4 list-decimal text-[11px] leading-relaxed", children: [_jsxs("li", { children: ["\u30D6\u30E9\u30A6\u30B6\u3067\u4E8B\u696D\u7528\u30A2\u30AB\u30A6\u30F3\u30C8\u306E ", _jsx("span", { className: "font-mono text-purple-700 underline", children: "calendar.google.com" }), " \u3092\u958B\u304F"] }), _jsxs("li", { children: ["\u5DE6\u5074\u306E\u300C\u30DE\u30A4\u30AB\u30EC\u30F3\u30C0\u30FC\u300D\u304B\u3089\u540C\u671F\u3057\u305F\u3044\u4E8B\u696D\u7528\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u898B\u3064\u3051\u3001\u53F3\u5074\u306E ", _jsx("strong", { className: "text-slate-900", children: "\u300C\uFE19\uFF08\u30AA\u30D7\u30B7\u30E7\u30F3\uFF09\u300D\u2192\u300C\u8A2D\u5B9A\u3068\u5171\u6709\u300D" }), " \u3092\u9078\u629E"] }), _jsxs("li", { children: ["\u5DE6\u30E1\u30CB\u30E5\u30FC\u306E ", _jsx("strong", { className: "text-slate-900", children: "\u300C\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u7D71\u5408\u300D" }), " \u3092\u30AF\u30EA\u30C3\u30AF"] }), _jsxs("li", { children: [_jsx("strong", { className: "text-slate-900", children: "\u300CiCal \u5F62\u5F0F\u306E\u975E\u516C\u958B URL\u300D" }), "\uFF08\u307E\u305F\u306F\u300C\u79D8\u5BC6\u306E\u30A2\u30C9\u30EC\u30B9\u300D\uFF09\u6B04\u306B\u8868\u793A\u3055\u308C\u3066\u3044\u308BURL\u3092\u30B3\u30D4\u30FC"] }), _jsxs("li", { children: ["\u4E0B\u8A18\u306E\u5165\u529B\u67A0\u306B\u8CBC\u308A\u4ED8\u3051\u3066\u3001", _jsx("strong", { className: "text-purple-700", children: "\u300C\u4ECA\u3059\u3050\u540C\u671F\u3059\u308B\u300D" }), " \u30DC\u30BF\u30F3\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044"] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u4E8B\u696D\u7528Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306E iCal URL\uFF08\u975E\u516C\u958B\u30A2\u30C9\u30EC\u30B9\uFF09" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "url", value: syncUrlInput, onChange: (e) => setSyncUrlInput(e.target.value), placeholder: "https://calendar.google.com/calendar/ical/.../basic.ics", className: "flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-mono shadow-2xs" }), _jsxs("button", { onClick: handlePerformGoogleSync, disabled: syncLoading || !syncUrlInput.trim(), className: "px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer shrink-0", children: [_jsx(RefreshCw, { className: `w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}` }), _jsx("span", { children: syncLoading ? '同期中...' : '今すぐ同期する' })] })] })] }), syncStatusMsg && (_jsxs("div", { className: `p-3 rounded-xl text-xs flex items-center gap-2 border ${syncStatusMsg.type === 'success'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : syncStatusMsg.type === 'error'
                                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                                            : 'bg-purple-50 border-purple-200 text-purple-800'}`, children: [syncStatusMsg.type === 'success' ? (_jsx(CheckCircle2, { className: "w-4 h-4 shrink-0 text-emerald-600" })) : syncStatusMsg.type === 'error' ? (_jsx(AlertCircle, { className: "w-4 h-4 shrink-0 text-rose-600" })) : (_jsx(RefreshCw, { className: "w-4 h-4 shrink-0 animate-spin text-purple-600" })), _jsx("span", { children: syncStatusMsg.text })] })), googleIcalUrl && (_jsxs("div", { className: "p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" }), _jsx("span", { className: "font-semibold text-slate-900", children: googleSyncInfo.calendarName || '事業用Googleカレンダー' }), _jsxs("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-semibold", children: [googleEvents.length, " \u4EF6\u306E\u4E88\u5B9A\u3092\u540C\u671F\u4E2D"] })] }), googleSyncInfo.lastSync && (_jsxs("p", { className: "text-[10px] text-slate-500 mt-1", children: ["\u6700\u7D42\u540C\u671F\u65E5\u6642: ", new Date(googleSyncInfo.lastSync).toLocaleString('ja-JP')] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: handlePerformGoogleSync, disabled: syncLoading, className: "px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition text-xs flex items-center gap-1.5 shadow-2xs", title: "\u6700\u65B0\u306E\u4E88\u5B9A\u3092\u518D\u53D6\u5F97", children: [_jsx(RefreshCw, { className: `w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}` }), _jsx("span", { children: "\u518D\u53D6\u5F97" })] }), _jsxs("button", { onClick: handleClearGoogleSync, className: "px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition text-xs flex items-center gap-1.5", title: "\u9023\u643A\u3092\u89E3\u9664\u3057\u3066\u53D6\u308A\u8FBC\u3093\u3060\u4E88\u5B9A\u3092\u6D88\u53BB", children: [_jsx(Trash2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u540C\u671F\u89E3\u9664" })] })] })] })), _jsxs("div", { className: "pt-3 border-t border-slate-200 flex items-center justify-between text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-slate-600", children: "\u307E\u305F\u306F\u30D5\u30A1\u30A4\u30EB\u3067\u76F4\u63A5\u53D6\u308A\u8FBC\u3080:" }), _jsx("p", { className: "text-[11px] text-slate-400", children: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u3067\u66F8\u304D\u51FA\u3057\u305F .ics \u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u3059" })] }), _jsxs("label", { className: "px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium cursor-pointer transition flex items-center gap-1.5", children: [_jsx(Upload, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: ".ics \u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E" }), _jsx("input", { type: "file", accept: ".ics,text/calendar", onChange: handleImportIcsFile, className: "hidden" })] })] })] }), _jsx("div", { className: "mt-6 flex items-center justify-end pt-3 border-t border-slate-100", children: _jsx("button", { type: "button", onClick: () => setIsGoogleSyncModalOpen(false), className: "px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition", children: "\u9589\u3058\u308B" }) })] }) }))] }));
};
const AgendaEventCard = ({ item, onSelect, onJump }) => {
    const conf = CATEGORY_CONFIG[item.category];
    return (_jsxs("div", { onClick: onSelect, className: `p-3.5 rounded-2xl border text-xs cursor-pointer transition hover:scale-[1.01] flex flex-col justify-between ${conf.badgeBg} ${conf.border} shadow-2xs group`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80 mb-1.5", children: [_jsxs("span", { className: "flex items-center gap-1.5 font-semibold", children: [_jsx("span", { className: `w-2 h-2 rounded-full ${conf.dot}` }), _jsx("span", { className: conf.text, children: conf.label })] }), _jsxs("span", { className: "font-mono text-slate-500", children: [item.date, " ", item.startTime ? item.startTime : '(終日)'] })] }), _jsx("h4", { className: "font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-purple-700 transition", children: item.title }), item.companyName && (_jsxs("div", { className: "mt-1.5 flex items-center gap-1 text-[11px] text-slate-600", children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-slate-400 shrink-0" }), _jsx("span", { className: "font-medium truncate", children: item.companyName })] })), item.amount !== undefined && (_jsxs("div", { className: "mt-1 text-[11px] text-emerald-700 font-mono font-semibold", children: ["\u7A0E\u629C \u00A5", item.amount.toLocaleString(), " + \u7A0E10% = \u7A0E\u8FBC \u00A5", (item.totalAmount || item.amount * 1.1).toLocaleString()] })), (item.location || item.meetUrl) && (_jsxs("div", { className: "mt-2 flex items-center gap-1.5 flex-wrap", children: [item.meetUrl?.includes('zoom.us') || item.location?.toLowerCase().includes('zoom') ? (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1", children: [_jsx(Video, { className: "w-3 h-3 text-blue-600" }), _jsx("span", { children: "Zoom" })] })) : item.meetUrl?.includes('meet.google.com') || item.location?.toLowerCase().includes('google meet') ? (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1", children: [_jsx(Video, { className: "w-3 h-3 text-emerald-600" }), _jsx("span", { children: "Google Meet" })] })) : (_jsxs("span", { className: "px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3 h-3 text-amber-500" }), _jsx("span", { className: "truncate max-w-[140px]", children: item.location })] })), item.meetUrl && (_jsxs("a", { href: item.meetUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: `px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${item.meetUrl.includes('zoom.us') || item.location?.toLowerCase().includes('zoom')
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`, children: [_jsx("span", { children: "\u53C2\u52A0" }), _jsx(ExternalLink, { className: "w-2.5 h-2.5" })] }))] }))] }), _jsxs("div", { className: "mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u8A73\u7D30\u8868\u793A" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("a", { href: buildGoogleCalendarUrl({
                                    title: item.title,
                                    date: item.date,
                                    startTime: item.startTime,
                                    endTime: item.endTime,
                                    isAllDay: item.isAllDay,
                                    companyName: item.companyName,
                                    location: item.location,
                                    meetUrl: item.meetUrl,
                                    notes: item.notes,
                                }), target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "p-1 rounded bg-white hover:bg-slate-100 text-purple-700 border border-purple-200 transition text-[10px] flex items-center gap-1 px-1.5 shadow-2xs", title: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u8FFD\u52A0", children: [_jsx(Share2, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "G\u30AB\u30EC\u30F3\u30C0\u30FC" })] }), (item.linkTab || item.companyId) && (_jsxs("button", { onClick: (e) => {
                                    e.stopPropagation();
                                    onJump();
                                }, className: "p-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition text-[10px] flex items-center gap-1 px-1.5 shadow-2xs", title: "\u8A72\u5F53\u53F0\u5E33\u3092\u958B\u304F", children: [_jsx("span", { children: "\u53F0\u5E33" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-slate-500" })] }))] })] })] }));
};
