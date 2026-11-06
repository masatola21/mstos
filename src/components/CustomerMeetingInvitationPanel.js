import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { CalendarDays, Loader2, Mail, Save } from 'lucide-react';
export const CustomerMeetingInvitationPanel = () => {
    const [customers, setCustomers] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [history, setHistory] = useState([]);
    const [customerId, setCustomerId] = useState('');
    const [contactId, setContactId] = useState('');
    const [bookingUrl, setBookingUrl] = useState('');
    const [customEmailText, setCustomEmailText] = useState('');
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
            const [customerResult, contactResult, historyResult, settingResult] = await Promise.all([
                supabase.from('customers').select('id,company_id,company:companies(company_name)').order('last_updated_at', { ascending: false }),
                supabase.from('contacts').select('id,full_name,email,company_id').order('full_name'),
                supabase.from('communication_outbox').select('id,recipient_address,subject,status,created_at').eq('source_type', 'customer_meeting_invitation').order('created_at', { ascending: false }).limit(30),
                supabase.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
            ]);
            if (customerResult.error)
                throw customerResult.error;
            if (contactResult.error)
                throw contactResult.error;
            if (historyResult.error)
                throw historyResult.error;
            if (settingResult.error)
                throw settingResult.error;
            const nextCustomers = (customerResult.data || []);
            setCustomers(nextCustomers);
            setContacts((contactResult.data || []));
            setHistory((historyResult.data || []));
            setBookingUrl(settingResult.data?.booking_page_url || '');
            setCustomerId((current) => current || nextCustomers[0]?.id || '');
        }
        catch (e) {
            setError(e?.message || '顧客向け面談案内を読み込めませんでした。');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    const selectedCustomer = customers.find((item) => item.id === customerId);
    const customerContacts = contacts.filter((item) => item.company_id === selectedCustomer?.company_id);
    const selectedContact = customerContacts.find((item) => item.id === contactId);
    const companyName = selectedCustomer?.company?.company_name || '貴社';
    const recipientName = selectedContact?.full_name || 'ご担当者';
    const subject = '【面談のご案内】' + companyName + ' 様';
    const emailBody = useMemo(() => [
        recipientName + ' 様',
        '',
        'お世話になっております。有限会社MSTの大橋真人です。',
        '',
        customEmailText.trim() || 'お打ち合わせのお時間をいただきたく、ご案内いたします。下記ページからご都合のよい日時をお選びください。',
        '',
        '■ 面談日時の予約',
        bookingUrl || '（予約ページURLを設定してください）',
        '',
        'ご予約が確定すると、Googleカレンダーに予定が登録され、Meetの情報が案内されます。',
        'ご不明な点がございましたら、このメールにご返信ください。',
        '',
        '有限会社MST',
        '大橋真人',
    ].join('\n'), [recipientName, customEmailText, bookingUrl]);
    useEffect(() => {
        if (!customerContacts.some((item) => item.id === contactId)) {
            setContactId(customerContacts.find((item) => item.email)?.id || '');
            setConfirmed(false);
        }
    }, [customerId, contacts]);
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
                owner_id: authData.user.id, booking_page_url: bookingUrl.trim() || null,
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
        if (!supabase || !selectedCustomer || !selectedContact?.email) {
            setError('顧客とメールアドレスが登録された送信先を選択してください。');
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
        setSubmitting(true);
        setError('');
        setNotice('');
        const { error: insertError } = await supabase.from('communication_outbox').insert({
            channel: 'email',
            recipient_contact_id: selectedContact.id,
            recipient_address: selectedContact.email,
            subject,
            body_text: emailBody,
            source_type: 'customer_meeting_invitation',
            company_id: selectedCustomer.company_id,
            status: 'awaiting_approval',
        });
        if (insertError) {
            setError(insertError.message);
            setSubmitting(false);
            return;
        }
        setConfirmed(false);
        setNotice('顧客向け面談案内をメール送信承認待ちに登録しました。実送信はメールサービス接続後に有効になります。');
        setSubmitting(false);
        await load();
    };
    return _jsxs("section", { className: "rounded-xl border border-slate-800 bg-slate-900 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h2", { className: "flex items-center gap-2 font-semibold text-white", children: [_jsx(CalendarDays, { className: "h-4 w-4 text-indigo-300" }), "\u9867\u5BA2\u9762\u8AC7\u6848\u5185"] }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "\u9867\u5BA2\u306B\u4E88\u7D04\u30DA\u30FC\u30B8\u3092\u30E1\u30FC\u30EB\u3067\u6848\u5185\u3057\u307E\u3059\u3002\u5546\u8AC7\u6848\u5185\u3068\u540C\u3058\u4E88\u7D04\u8A2D\u5B9A\u3092\u4F7F\u3044\u3001\u30E1\u30FC\u30EB\u672C\u6587\u306E\u6848\u5185\u6587\u3060\u3051\u7DE8\u96C6\u3067\u304D\u307E\u3059\u3002" })] }), _jsx("span", { className: "rounded-full border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200", children: "\u30E1\u30FC\u30EB\u9001\u4FE1\u30B5\u30FC\u30D3\u30B9\u672A\u63A5\u7D9A" })] }), error && _jsx("div", { role: "alert", className: "mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-xs text-rose-200", children: error }), notice && _jsx("div", { role: "status", className: "mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs text-emerald-200", children: notice }), loading ? _jsxs("div", { className: "flex items-center gap-2 py-8 text-sm text-slate-400", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026"] }) : _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-2", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-xs text-slate-300", children: ["Google\u4E88\u7D04\u30DA\u30FC\u30B8URL", _jsxs("div", { className: "mt-1 flex gap-2", children: [_jsx("input", { type: "url", value: bookingUrl, onChange: (e) => setBookingUrl(e.target.value), placeholder: "https://calendar.google.com/calendar/appointments/\u2026", className: "min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" }), _jsxs("button", { type: "button", onClick: () => void saveBookingUrl(), disabled: savingUrl, className: "flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50", children: [_jsx(Save, { className: "h-3.5 w-3.5" }), savingUrl ? '保存中' : '保存'] })] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "block text-xs text-slate-300", children: ["\u9867\u5BA2", _jsxs("select", { value: customerId, onChange: (e) => { setCustomerId(e.target.value); setContactId(''); setConfirmed(false); }, className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white", children: [_jsx("option", { value: "", children: "\u9867\u5BA2\u3092\u9078\u629E" }), customers.map((customer) => _jsx("option", { value: customer.id, children: customer.company?.company_name || customer.company_id }, customer.id))] })] }), _jsxs("label", { className: "block text-xs text-slate-300", children: ["\u9001\u4FE1\u5148", _jsxs("select", { value: contactId, onChange: (e) => { setContactId(e.target.value); setConfirmed(false); }, className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white", children: [_jsx("option", { value: "", children: "\u9023\u7D61\u5148\u3092\u9078\u629E" }), customerContacts.map((contact) => _jsxs("option", { value: contact.id, children: [contact.full_name, " \u00B7 ", contact.email || 'メール未登録'] }, contact.id))] })] })] }), _jsxs("label", { className: "block text-xs text-slate-300", children: ["\u30E1\u30FC\u30EB\u6848\u5185\u6587\uFF08\u3053\u306E\u6587\u7AE0\u3060\u3051\u30AB\u30B9\u30BF\u30DE\u30A4\u30BA\uFF09", _jsx("textarea", { rows: 5, value: customEmailText, onChange: (e) => { setCustomEmailText(e.target.value); setConfirmed(false); }, placeholder: "\u4F8B\uFF1A\u6765\u6708\u306E\u5B9A\u4F8B\u6253\u3061\u5408\u308F\u305B\u306E\u65E5\u7A0B\u8ABF\u6574\u3092\u304A\u9858\u3044\u3044\u305F\u3057\u307E\u3059\u3002", className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" })] }), _jsxs("label", { className: "flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300", children: [_jsx("input", { type: "checkbox", checked: confirmed, onChange: (e) => setConfirmed(e.target.checked), className: "mt-0.5" }), _jsx("span", { children: "\u9001\u4FE1\u5148\u3068\u9762\u8AC7\u6848\u5185\u6587\u3092\u78BA\u8A8D\u3057\u307E\u3057\u305F\u3002\u3053\u306E\u30E1\u30FC\u30EB\u3092\u9001\u4FE1\u627F\u8A8D\u5F85\u3061\u306B\u767B\u9332\u3057\u307E\u3059\u3002" })] }), _jsxs("button", { type: "button", onClick: () => void requestSend(), disabled: submitting || !selectedCustomer || !selectedContact?.email, className: "flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50", children: [submitting ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(Mail, { className: "h-4 w-4" }), "\u9001\u4FE1\u627F\u8A8D\u3092\u7533\u8ACB"] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-950 p-3", children: [_jsx("div", { className: "text-xs font-semibold text-slate-300", children: "\u30E1\u30FC\u30EB\u6587\u30D7\u30EC\u30D3\u30E5\u30FC" }), _jsxs("div", { className: "mt-2 text-xs text-slate-400", children: ["\u4EF6\u540D\uFF1A", subject] }), _jsx("pre", { className: "mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-slate-200", children: emailBody })] }), _jsxs("section", { className: "rounded-lg border border-slate-800 bg-slate-950 p-3", children: [_jsx("h3", { className: "mb-2 text-xs font-semibold text-slate-300", children: "\u6848\u5185\u5C65\u6B74" }), history.length === 0 ? _jsx("p", { className: "text-xs text-slate-500", children: "\u307E\u3060\u6848\u5185\u5C65\u6B74\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) : _jsx("ul", { className: "divide-y divide-slate-800", children: history.map((row) => _jsxs("li", { className: "py-2 text-xs", children: [_jsxs("div", { className: "flex justify-between gap-2", children: [_jsx("span", { className: "text-slate-200", children: row.subject || row.recipient_address }), _jsx("span", { className: "text-slate-400", children: row.status })] }), _jsxs("div", { className: "mt-1 text-slate-500", children: [new Date(row.created_at).toLocaleString('ja-JP'), " \u00B7 ", row.recipient_address] })] }, row.id)) })] })] })] })] });
};
