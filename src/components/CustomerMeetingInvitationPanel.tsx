import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { CalendarDays, CheckCircle2, Loader2, Mail, Save } from 'lucide-react';

type Customer = {
  id: string;
  company_id: string;
  company?: { company_name?: string } | null;
};
type Contact = { id: string; full_name: string; email?: string | null; company_id?: string | null };
type HistoryRow = { id: string; recipient_address: string; subject?: string | null; status: string; created_at: string };

export const CustomerMeetingInvitationPanel: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
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
    if (!supabase) { setError('Supabaseに接続してください。'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [customerResult, contactResult, historyResult, settingResult] = await Promise.all([
        supabase.from('customers').select('id,company_id,company:companies(company_name)').order('last_updated_at', { ascending: false }),
        supabase.from('contacts').select('id,full_name,email,company_id').order('full_name'),
        supabase.from('communication_outbox').select('id,recipient_address,subject,status,created_at').eq('source_type', 'customer_meeting_invitation').order('created_at', { ascending: false }).limit(30),
        supabase.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (contactResult.error) throw contactResult.error;
      if (historyResult.error) throw historyResult.error;
      if (settingResult.error) throw settingResult.error;
      const nextCustomers = (customerResult.data || []) as unknown as Customer[];
      setCustomers(nextCustomers);
      setContacts((contactResult.data || []) as Contact[]);
      setHistory((historyResult.data || []) as HistoryRow[]);
      setBookingUrl(settingResult.data?.booking_page_url || '');
      setCustomerId((current) => current || nextCustomers[0]?.id || '');
    } catch (e: any) {
      setError(e?.message || '顧客向け面談案内を読み込めませんでした。');
    } finally {
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
    if (!supabase) return;
    if (bookingUrl && !/^https:\/\/.+/i.test(bookingUrl.trim())) {
      setError('予約ページURLは https:// から始まるURLを入力してください。'); return;
    }
    setSavingUrl(true); setError(''); setNotice('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('ログイン状態を確認できません。');
      const { error: saveError } = await supabase.from('sales_workspace_settings').upsert({
        owner_id: authData.user.id, booking_page_url: bookingUrl.trim() || null,
      }, { onConflict: 'owner_id' });
      if (saveError) throw saveError;
      setNotice('Google予約ページURLを保存しました。');
    } catch (e: any) {
      setError(e?.message || '予約ページURLを保存できませんでした。');
    } finally {
      setSavingUrl(false);
    }
  };

  const requestSend = async () => {
    const supabase = getSupabase();
    if (!supabase || !selectedCustomer || !selectedContact?.email) {
      setError('顧客とメールアドレスが登録された送信先を選択してください。'); return;
    }
    if (!bookingUrl.trim() || !/^https:\/\/.+/i.test(bookingUrl.trim())) {
      setError('有効なGoogle予約ページURLを設定してください。'); return;
    }
    if (!confirmed) { setError('送信先と案内文を確認してください。'); return; }
    setSubmitting(true); setError(''); setNotice('');
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
    if (insertError) { setError(insertError.message); setSubmitting(false); return; }
    setConfirmed(false);
    setNotice('顧客向け面談案内をメール送信承認待ちに登録しました。実送信はメールサービス接続後に有効になります。');
    setSubmitting(false);
    await load();
  };

  return <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-semibold text-white"><CalendarDays className="h-4 w-4 text-indigo-300"/>顧客面談案内</h2><p className="mt-1 text-xs text-slate-400">顧客に予約ページをメールで案内します。商談案内と同じ予約設定を使い、メール本文の案内文だけ編集できます。</p></div>
      <span className="rounded-full border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200">メール送信サービス未接続</span>
    </div>
    {error && <div role="alert" className="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</div>}
    {notice && <div role="status" className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs text-emerald-200">{notice}</div>}
    {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin"/>読み込み中…</div> : <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-xs text-slate-300">Google予約ページURL<div className="mt-1 flex gap-2"><input type="url" value={bookingUrl} onChange={(e)=>setBookingUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/appointments/…" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/><button type="button" onClick={()=>void saveBookingUrl()} disabled={savingUrl} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{savingUrl?'保存中':'保存'}</button></div></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-300">顧客<select value={customerId} onChange={(e)=>{setCustomerId(e.target.value);setContactId('');setConfirmed(false);}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">顧客を選択</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.company?.company_name || customer.company_id}</option>)}</select></label>
          <label className="block text-xs text-slate-300">送信先<select value={contactId} onChange={(e)=>{setContactId(e.target.value);setConfirmed(false);}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">連絡先を選択</option>{customerContacts.map((contact)=><option key={contact.id} value={contact.id}>{contact.full_name} · {contact.email || 'メール未登録'}</option>)}</select></label>
        </div>
        <label className="block text-xs text-slate-300">メール案内文（この文章だけカスタマイズ）<textarea rows={5} value={customEmailText} onChange={(e)=>{setCustomEmailText(e.target.value);setConfirmed(false);}} placeholder="例：来月の定例打ち合わせの日程調整をお願いいたします。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
        <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300"><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)} className="mt-0.5"/><span>送信先と面談案内文を確認しました。このメールを送信承認待ちに登録します。</span></label>
        <button type="button" onClick={()=>void requestSend()} disabled={submitting || !selectedCustomer || !selectedContact?.email} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting?<Loader2 className="h-4 w-4 animate-spin"/>:<Mail className="h-4 w-4"/>}送信承認を申請</button>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-xs font-semibold text-slate-300">メール文プレビュー</div><div className="mt-2 text-xs text-slate-400">件名：{subject}</div><pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-slate-200">{emailBody}</pre></div>
        <section className="rounded-lg border border-slate-800 bg-slate-950 p-3"><h3 className="mb-2 text-xs font-semibold text-slate-300">案内履歴</h3>{history.length===0?<p className="text-xs text-slate-500">まだ案内履歴はありません。</p>:<ul className="divide-y divide-slate-800">{history.map((row)=><li key={row.id} className="py-2 text-xs"><div className="flex justify-between gap-2"><span className="text-slate-200">{row.subject || row.recipient_address}</span><span className="text-slate-400">{row.status}</span></div><div className="mt-1 text-slate-500">{new Date(row.created_at).toLocaleString('ja-JP')} · {row.recipient_address}</div></li>)}</ul>}</section>
      </div>
    </div>}
  </section>;
};
