import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { CalendarDays, CheckCircle2, Copy, Loader2, Mail, MessageCircle, Save } from 'lucide-react';
const defaultBookingUrl = '';
export const DealInvitationPanel = () => {
    const [deals, setDeals] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [history, setHistory] = useState([]);
    const [dealId, setDealId] = useState('');
    const [contactId, setContactId] = useState('');
    const [channel, setChannel] = useState('email');
    const [bookingUrl, setBookingUrl] = useState(defaultBookingUrl);
    const [customMessage, setCustomMessage] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingUrl, setSavingUrl] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const load = async () => {
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [dealResult, contactResult, historyResult, settingResult] = await Promise.all([
                supabase.from('deals').select('id,proposal_plan_name,proposal_status,company_id,lead_id,meeting_date,company:companies(company_name),lead:leads(contact_id)').order('created_at', { ascending: false }),
                supabase.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name'),
                supabase.from('communication_outbox').select('id,deal_id,channel,recipient_address,subject,status,created_at').eq('source_type', 'deal_invitation').order('created_at', { ascending: false }).limit(30),
                supabase.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
            ]);
            if (dealResult.error)
                throw dealResult.error;
            if (contactResult.error)
                throw contactResult.error;
            if (historyResult.error)
                throw historyResult.error;
            if (settingResult.error)
                throw settingResult.error;
            const nextDeals = (dealResult.data || []);
            setDeals(nextDeals);
            setContacts((contactResult.data || []));
            setHistory((historyResult.data || []));
            setBookingUrl(settingResult.data?.booking_page_url || '');
            setDealId((current) => current || nextDeals[0]?.id || '');
        }
        catch (e) {
            setError(e?.message || '商談案内のデータを読み込めませんでした。');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    const selectedDeal = deals.find((item) => item.id === dealId);
    const dealContacts = selectedDeal?.company_id
        ? contacts.filter((contact) => contact.company_id === selectedDeal.company_id)
        : [];
    const suggestedContactId = selectedDeal?.lead?.contact_id || '';
    const selectedContact = dealContacts.find((item) => item.id === contactId);
    const suggestedContact = dealContacts.find((item) => item.id === suggestedContactId);
    const recipientName = selectedContact?.full_name || 'ご担当者';
    const companyName = selectedDeal?.company?.company_name || '貴社';
    const emailBody = useMemo(() => [
        recipientName + ' 様',
        '',
        'お世話になっております。有限会社MSTの大橋真人です。',
        '',
        customMessage.trim() || '商談のお時間をいただきたく、ご案内いたします。下記ページからご都合のよい日時をお選びください。',
        '',
        '■ 商談日時の予約（Googleカレンダー・Google Meet）',
        bookingUrl || '（予約ページURLを設定してください）',
        '',
        'ご予約が確定すると、Googleカレンダーに予定が登録され、Meetの情報が案内されます。',
        'ご不明な点がございましたら、このメールにご返信ください。',
        '',
        '有限会社MST',
        '大橋真人',
    ].join('\n'), [recipientName, customMessage, bookingUrl]);
    const lineBody = useMemo(() => [
        recipientName + ' 様',
        '',
        '商談のお時間をいただきたく、ご案内いたします。',
        customMessage.trim(),
        '',
        '下記ページからご都合のよい日時をお選びください。',
        bookingUrl || '（予約ページURLを設定してください）',
        '',
        'ご予約が確定すると、Googleカレンダーに予定が登録され、Meetの情報が案内されます。',
    ].filter(Boolean).join('\n'), [recipientName, customMessage, bookingUrl]);
    const subject = '【商談のご案内】' + companyName + ' 様';
    useEffect(() => {
        if (!contactId && suggestedContact)
            setContactId(suggestedContact.id);
    }, [suggestedContact, contactId]);
    const saveBookingUrl = async () => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        if (bookingUrl && !/^https:\/\/.+/i.test(bookingUrl.trim())) {
            setError('予約ページURLは https:// から始まるURLを入力してください。');
            return;
        }
        setSavingUrl(true);
        setError('');
        setNotice('');
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError)
                throw authError;
            if (!authData.user)
                throw new Error('ログイン状態を確認できません。');
            const { error: saveError } = await supabase.from('sales_workspace_settings').upsert({
                owner_id: authData.user.id,
                booking_page_url: bookingUrl.trim() || null,
            }, { onConflict: 'owner_id' });
            if (saveError)
                throw saveError;
            setNotice('Google予約ページURLを保存しました。');
        }
        catch (e) {
            setError(e?.message || '予約ページURLを保存できませんでした。');
        }
        finally {
            setSavingUrl(false);
        }
    };
    const requestSend = async () => {
        const supabase = getSupabase();
        if (!supabase || !selectedDeal || !selectedDeal.company_id || !selectedContact) {
            setError('会社に紐づく商談と送信先連絡先を選択してください。');
            return;
        }
        if (selectedContact.company_id !== selectedDeal.company_id) {
            setError('送信先の連絡先が商談の会社と一致しません。');
            return;
        }
        if (!bookingUrl.trim() || !/^https:\/\/.+/i.test(bookingUrl.trim())) {
            setError('有効なGoogle予約ページURLを設定してください。');
            return;
        }
        if (!confirmed) {
            setError('送信先と案内文を確認してください。');
            return;
        }
        const channels = channel === 'both' ? ['email', 'line'] : [channel];
        const messages = [];
        for (const item of channels) {
            if (item === 'email') {
                if (!selectedContact.email) {
                    setError('メールアドレスがないため、メール送信を含む依頼は作成できません。');
                    return;
                }
                messages.push({ channel: 'email', address: selectedContact.email, body: emailBody });
            }
            else {
                if (!selectedContact.line_user_id) {
                    setError('LINE連携がないため、LINE送信を含む依頼は作成できません。');
                    return;
                }
                const { data: friend, error: friendError } = await supabase.from('line_friends').select('status,consent_status').eq('line_user_id', selectedContact.line_user_id).maybeSingle();
                if (friendError) {
                    setError(friendError.message);
                    return;
                }
                if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in') {
                    setError('LINEの友だち状態と配信同意を確認できないため、LINE送信依頼は作成できません。');
                    return;
                }
                messages.push({ channel: 'line', address: selectedContact.line_user_id, body: lineBody });
            }
        }
        setSubmitting(true);
        setError('');
        setNotice('');
        const { error: insertError } = await supabase.from('communication_outbox').insert(messages.map((message) => ({
            channel: message.channel,
            recipient_contact_id: selectedContact.id,
            recipient_address: message.address,
            subject: message.channel === 'email' ? subject : null,
            body_text: message.body,
            source_type: 'deal_invitation',
            deal_id: selectedDeal.id,
            status: 'awaiting_approval',
        })));
        if (insertError) {
            setError(insertError.message);
            setSubmitting(false);
            return;
        }
        setConfirmed(false);
        setNotice('商談案内を送信承認待ちに登録しました。実際のメール・LINE送信は、送信サービス接続後に有効になります。');
        setSubmitting(false);
        await load();
    };
    const copyPreview = async () => {
        await navigator.clipboard.writeText(channel === 'line' ? lineBody : emailBody);
        setNotice('案内文をコピーしました。');
    };
    return _jsxs("section", { className: 'rounded-xl border border-slate-800 bg-slate-900 p-4', children: [_jsxs("div", { className: 'flex flex-wrap items-start justify-between gap-3', children: [_jsxs("div", { children: [_jsxs("h2", { className: 'flex items-center gap-2 font-semibold text-white', children: [_jsx(CalendarDays, { className: 'h-4 w-4 text-indigo-300' }), "\u5546\u8AC7\u6848\u5185"] }), _jsx("p", { className: 'mt-1 text-xs text-slate-400', children: "\u4E88\u7D04\u30DA\u30FC\u30B8\u3092\u6848\u5185\u3057\u3001\u4E88\u7D04\u65E5\u6642\u3068Meet\u306FGoogle\u30AB\u30EC\u30F3\u30C0\u30FC\u3067\u7BA1\u7406\u3057\u307E\u3059\u3002" })] }), _jsx("span", { className: 'rounded-full border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200', children: "\u9001\u4FE1\u30B5\u30FC\u30D3\u30B9\u672A\u63A5\u7D9A" })] }), error && _jsx("div", { role: 'alert', className: 'mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-xs text-rose-200', children: error }), notice && _jsx("div", { role: 'status', className: 'mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs text-emerald-200', children: notice }), loading ? _jsxs("div", { className: 'flex items-center gap-2 py-8 text-sm text-slate-400', children: [_jsx(Loader2, { className: 'h-4 w-4 animate-spin' }), "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026"] }) : _jsxs("div", { className: 'mt-4 grid gap-4 xl:grid-cols-2', children: [_jsxs("div", { className: 'space-y-3', children: [_jsxs("label", { className: 'block text-xs text-slate-300', children: ["Google\u4E88\u7D04\u30DA\u30FC\u30B8URL", _jsxs("div", { className: 'mt-1 flex gap-2', children: [_jsx("input", { type: 'url', value: bookingUrl, onChange: (e) => setBookingUrl(e.target.value), placeholder: 'https://calendar.google.com/calendar/appointments/\u2026', className: 'min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white' }), _jsxs("button", { type: 'button', onClick: () => void saveBookingUrl(), disabled: savingUrl, className: 'flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50', children: [_jsx(Save, { className: 'h-3.5 w-3.5' }), savingUrl ? '保存中' : '保存'] })] })] }), _jsxs("div", { className: 'grid gap-3 sm:grid-cols-2', children: [_jsxs("label", { className: 'block text-xs text-slate-300', children: ["\u5546\u8AC7", _jsxs("select", { value: dealId, onChange: (e) => { setDealId(e.target.value); setContactId(''); setConfirmed(false); }, className: 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white', children: [_jsx("option", { value: '', children: "\u5546\u8AC7\u3092\u9078\u629E" }), deals.map((deal) => _jsxs("option", { value: deal.id, children: [deal.proposal_plan_name, "\uFF08", deal.company?.company_name || deal.company_id || '会社未設定', "\uFF09"] }, deal.id))] })] }), _jsxs("label", { className: 'block text-xs text-slate-300', children: ["\u9001\u4FE1\u5148", _jsxs("select", { value: contactId, onChange: (e) => { setContactId(e.target.value); setConfirmed(false); }, className: 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white', children: [_jsx("option", { value: '', children: "\u9023\u7D61\u5148\u3092\u9078\u629E" }), dealContacts.map((contact) => _jsxs("option", { value: contact.id, children: [contact.full_name, contact.email ? ' · ' + contact.email : ''] }, contact.id))] })] })] }), suggestedContact && _jsx("p", { className: 'text-[11px] text-slate-500', children: "\u30EA\u30FC\u30C9\u306B\u7D10\u3065\u304F\u9023\u7D61\u5148\u3092\u521D\u671F\u9078\u629E\u3057\u3066\u3044\u307E\u3059\u3002\u5FC5\u8981\u306A\u3089\u5909\u66F4\u3067\u304D\u307E\u3059\u3002" }), _jsxs("label", { className: 'block text-xs text-slate-300', children: ["\u9001\u4FE1\u30C1\u30E3\u30CD\u30EB", _jsxs("select", { value: channel, onChange: (e) => { setChannel(e.target.value); setConfirmed(false); }, className: 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white', children: [_jsx("option", { value: 'email', children: "\u30E1\u30FC\u30EB\u306E\u307F" }), _jsx("option", { value: 'line', children: "LINE\u306E\u307F" }), _jsx("option", { value: 'both', children: "\u30E1\u30FC\u30EB\u3068LINE\u4E21\u65B9" })] })] }), _jsxs("label", { className: 'block text-xs text-slate-300', children: ["\u8FFD\u52A0\u30E1\u30C3\u30BB\u30FC\u30B8\uFF08\u4EFB\u610F\uFF09", _jsx("textarea", { rows: 3, value: customMessage, onChange: (e) => setCustomMessage(e.target.value), placeholder: '\u5546\u8AC7\u3067\u8A71\u3057\u305F\u3044\u5185\u5BB9\u306A\u3069', className: 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white' })] }), _jsxs("label", { className: 'flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300', children: [_jsx("input", { type: 'checkbox', checked: confirmed, onChange: (e) => setConfirmed(e.target.checked), className: 'mt-0.5' }), _jsx("span", { children: "\u5B9B\u5148\u30FB\u30C1\u30E3\u30CD\u30EB\u30FB\u6848\u5185\u6587\u3092\u78BA\u8A8D\u3057\u307E\u3057\u305F\u3002\u9078\u629E\u3057\u305F\u5168\u30C1\u30E3\u30CD\u30EB\u3092\u627F\u8A8D\u5F85\u3061\u3068\u3057\u3066\u767B\u9332\u3057\u307E\u3059\u3002" })] }), _jsxs("button", { type: 'button', onClick: () => void requestSend(), disabled: submitting || !selectedDeal?.company_id || dealContacts.length === 0, className: 'flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50', children: [submitting ? _jsx(Loader2, { className: 'h-4 w-4 animate-spin' }) : channel === 'line' ? _jsx(MessageCircle, { className: 'h-4 w-4' }) : _jsx(Mail, { className: 'h-4 w-4' }), "\u9001\u4FE1\u627F\u8A8D\u3092\u7533\u8ACB"] }), deals.length === 0 && _jsx("p", { className: 'text-xs text-slate-500', children: "\u5546\u8AC7\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u30EA\u30FC\u30C9\u3092\u5546\u8AC7\u5316\u3059\u308B\u3068\u3053\u3053\u304B\u3089\u6848\u5185\u3067\u304D\u307E\u3059\u3002" }), selectedDeal && !selectedDeal.company_id && _jsx("p", { className: 'text-xs text-amber-300', children: "\u5546\u8AC7\u306B\u4F1A\u793E\u304C\u7D10\u3065\u3044\u3066\u3044\u306A\u3044\u305F\u3081\u3001\u9001\u4FE1\u5148\u3092\u9078\u3079\u307E\u305B\u3093\u3002" }), selectedDeal?.company_id && dealContacts.length === 0 && _jsx("p", { className: 'text-xs text-amber-300', children: "\u3053\u306E\u4F1A\u793E\u306B\u7D10\u3065\u304F\u9023\u7D61\u5148\u304C\u3042\u308A\u307E\u305B\u3093\u3002CRM\u306E\u9023\u7D61\u5148\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] }), _jsxs("div", { className: 'space-y-3', children: [_jsxs("div", { className: 'rounded-lg border border-slate-800 bg-slate-950 p-3', children: [_jsxs("div", { className: 'flex items-center justify-between gap-2', children: [_jsxs("div", { className: 'text-xs font-semibold text-slate-300', children: ["\u9001\u4FE1\u524D\u30D7\u30EC\u30D3\u30E5\u30FC \u00B7 ", channel === 'both' ? 'メール・LINE' : channel === 'line' ? 'LINE' : 'メール'] }), _jsxs("button", { type: 'button', onClick: () => void copyPreview(), className: 'flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300', children: [_jsx(Copy, { className: 'h-3 w-3' }), "\u30B3\u30D4\u30FC"] })] }), channel !== 'line' && _jsxs(_Fragment, { children: [_jsxs("div", { className: 'mt-3 text-xs text-slate-500', children: ["\u4EF6\u540D\uFF1A", subject] }), _jsx("pre", { className: 'mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs leading-5 text-slate-200', children: emailBody })] }), channel !== 'email' && _jsx("pre", { className: 'mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs leading-5 text-slate-200', children: lineBody }), selectedContact && _jsxs("div", { className: 'mt-2 space-y-1 text-[11px] text-slate-500', children: [_jsxs("div", { children: ["\u30E1\u30FC\u30EB\uFF1A", selectedContact.email || '未登録'] }), _jsxs("div", { children: ["LINE\uFF1A", selectedContact.line_user_id ? '連携済み（友だち状態・同意を送信前に確認）' : '未連携'] })] })] }), _jsxs("div", { className: 'rounded-lg border border-slate-800 bg-slate-950 p-3', children: [_jsx("h3", { className: 'text-xs font-semibold text-slate-300', children: "\u6700\u8FD1\u306E\u5546\u8AC7\u6848\u5185\u4F9D\u983C" }), history.length === 0 ? _jsx("p", { className: 'mt-2 text-xs text-slate-500', children: "\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" }) : _jsx("ul", { className: 'mt-2 divide-y divide-slate-800', children: history.slice(0, 8).map((item) => _jsxs("li", { className: 'flex flex-wrap justify-between gap-2 py-2 text-[11px]', children: [_jsxs("span", { className: 'text-slate-300', children: [deals.find((deal) => deal.id === item.deal_id)?.proposal_plan_name || item.deal_id, " \u00B7 ", item.channel, " \u00B7 ", item.recipient_address] }), _jsxs("span", { className: 'text-slate-500', children: [item.status, " \u00B7 ", new Date(item.created_at).toLocaleString('ja-JP')] })] }, item.id)) })] })] })] }), _jsxs("p", { className: 'mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-amber-200/80', children: [_jsx(CheckCircle2, { className: 'mt-0.5 h-3.5 w-3.5 shrink-0' }), "\u4E88\u7D04\u65E5\u6642\u3068Meet\u306E\u751F\u6210\u306FGoogle\u4E88\u7D04\u30DA\u30FC\u30B8\u304C\u884C\u3044\u307E\u3059\u3002\u3053\u306E\u753B\u9762\u306F\u627F\u8A8D\u5F85\u3061\u4F9D\u983C\u3092\u8A18\u9332\u3057\u3001\u30E1\u30FC\u30EB\u30FBLINE\u306E\u5B9F\u914D\u4FE1\u306F\u30B5\u30FC\u30D0\u30FC\u63A5\u7D9A\u5F8C\u306B\u6709\u52B9\u306B\u306A\u308A\u307E\u3059\u3002"] })] });
};
