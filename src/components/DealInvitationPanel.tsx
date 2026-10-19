import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { CalendarDays, CheckCircle2, Copy, Loader2, Mail, MessageCircle, Save } from 'lucide-react';

type Deal = {
  id: string;
  proposal_plan_name: string;
  proposal_status?: string;
  company_id?: string | null;
  lead_id?: string | null;
  meeting_date?: string | null;
  company?: { company_name?: string } | null;
  lead?: { contact_id?: string | null } | null;
};
type Contact = { id: string; full_name: string; email?: string | null; line_user_id?: string | null; company_id?: string | null };
type Channel = 'email' | 'line' | 'both';
type OutboxRow = { id: string; deal_id: string; channel: string; recipient_address: string; subject?: string | null; status: string; created_at: string };

const defaultBookingUrl = '';

export const DealInvitationPanel: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<OutboxRow[]>([]);
  const [dealId, setDealId] = useState('');
  const [contactId, setContactId] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
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
    if (!supabase) { setError('Supabaseに接続してください。'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [dealResult, contactResult, historyResult, settingResult] = await Promise.all([
        supabase.from('deals').select('id,proposal_plan_name,proposal_status,company_id,lead_id,meeting_date,company:companies(company_name),lead:leads(contact_id)').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name'),
        supabase.from('communication_outbox').select('id,deal_id,channel,recipient_address,subject,status,created_at').eq('source_type', 'deal_invitation').order('created_at', { ascending: false }).limit(30),
        supabase.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
      ]);
      if (dealResult.error) throw dealResult.error;
      if (contactResult.error) throw contactResult.error;
      if (historyResult.error) throw historyResult.error;
      if (settingResult.error) throw settingResult.error;
      const nextDeals = (dealResult.data || []) as unknown as Deal[];
      setDeals(nextDeals);
      setContacts((contactResult.data || []) as Contact[]);
      setHistory((historyResult.data || []) as OutboxRow[]);
      setBookingUrl(settingResult.data?.booking_page_url || '');
      setDealId((current) => current || nextDeals[0]?.id || '');
    } catch (e: any) {
      setError(e?.message || '商談案内のデータを読み込めませんでした。');
    } finally {
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
    if (!contactId && suggestedContact) setContactId(suggestedContact.id);
  }, [suggestedContact, contactId]);

  const saveBookingUrl = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (bookingUrl && !/^https:\/\/.+/i.test(bookingUrl.trim())) {
      setError('予約ページURLは https:// から始まるURLを入力してください。');
      return;
    }
    setSavingUrl(true); setError(''); setNotice('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('ログイン状態を確認できません。');
      const { error: saveError } = await supabase.from('sales_workspace_settings').upsert({
        owner_id: authData.user.id,
        booking_page_url: bookingUrl.trim() || null,
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
    if (!supabase || !selectedDeal || !selectedDeal.company_id || !selectedContact) { setError('会社に紐づく商談と送信先連絡先を選択してください。'); return; }
    if (selectedContact.company_id !== selectedDeal.company_id) { setError('送信先の連絡先が商談の会社と一致しません。'); return; }
    if (!bookingUrl.trim() || !/^https:\/\/.+/i.test(bookingUrl.trim())) { setError('有効なGoogle予約ページURLを設定してください。'); return; }
    if (!confirmed) { setError('送信先と案内文を確認してください。'); return; }

    const channels = channel === 'both' ? ['email', 'line'] as const : [channel] as const;
    const messages: { channel: string; address: string; body: string }[] = [];
    for (const item of channels) {
      if (item === 'email') {
        if (!selectedContact.email) { setError('メールアドレスがないため、メール送信を含む依頼は作成できません。'); return; }
        messages.push({ channel: 'email', address: selectedContact.email, body: emailBody });
      } else {
        if (!selectedContact.line_user_id) { setError('LINE連携がないため、LINE送信を含む依頼は作成できません。'); return; }
        const { data: friend, error: friendError } = await supabase.from('line_friends').select('status,consent_status').eq('line_user_id', selectedContact.line_user_id).maybeSingle();
        if (friendError) { setError(friendError.message); return; }
        if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in') {
          setError('LINEの友だち状態と配信同意を確認できないため、LINE送信依頼は作成できません。');
          return;
        }
        messages.push({ channel: 'line', address: selectedContact.line_user_id, body: lineBody });
      }
    }

    setSubmitting(true); setError(''); setNotice('');
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
    if (insertError) { setError(insertError.message); setSubmitting(false); return; }
    setConfirmed(false);
    setNotice('商談案内を送信承認待ちに登録しました。実際のメール・LINE送信は、送信サービス接続後に有効になります。');
    setSubmitting(false);
    await load();
  };

  const copyPreview = async () => {
    await navigator.clipboard.writeText(channel === 'line' ? lineBody : emailBody);
    setNotice('案内文をコピーしました。');
  };

  return <section className='rounded-xl border border-slate-800 bg-slate-900 p-4'>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div><h2 className='flex items-center gap-2 font-semibold text-white'><CalendarDays className='h-4 w-4 text-indigo-300'/>商談案内</h2><p className='mt-1 text-xs text-slate-400'>予約ページを案内し、予約日時とMeetはGoogleカレンダーで管理します。</p></div>
      <span className='rounded-full border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200'>送信サービス未接続</span>
    </div>
    {error && <div role='alert' className='mt-3 rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-xs text-rose-200'>{error}</div>}
    {notice && <div role='status' className='mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs text-emerald-200'>{notice}</div>}
    {loading ? <div className='flex items-center gap-2 py-8 text-sm text-slate-400'><Loader2 className='h-4 w-4 animate-spin'/>読み込み中…</div> : <div className='mt-4 grid gap-4 xl:grid-cols-2'>
      <div className='space-y-3'>
        <label className='block text-xs text-slate-300'>Google予約ページURL<div className='mt-1 flex gap-2'><input type='url' value={bookingUrl} onChange={(e)=>setBookingUrl(e.target.value)} placeholder='https://calendar.google.com/calendar/appointments/…' className='min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white'/><button type='button' onClick={()=>void saveBookingUrl()} disabled={savingUrl} className='flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50'><Save className='h-3.5 w-3.5'/>{savingUrl?'保存中':'保存'}</button></div></label>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='block text-xs text-slate-300'>商談<select value={dealId} onChange={(e)=>{setDealId(e.target.value);setContactId('');setConfirmed(false);}} className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white'><option value=''>商談を選択</option>{deals.map((deal)=><option key={deal.id} value={deal.id}>{deal.proposal_plan_name}（{deal.company?.company_name || deal.company_id || '会社未設定'}）</option>)}</select></label>
          <label className='block text-xs text-slate-300'>送信先<select value={contactId} onChange={(e)=>{setContactId(e.target.value);setConfirmed(false);}} className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white'><option value=''>連絡先を選択</option>{dealContacts.map((contact)=><option key={contact.id} value={contact.id}>{contact.full_name}{contact.email?' · '+contact.email:''}</option>)}</select></label>
        </div>
        {suggestedContact && <p className='text-[11px] text-slate-500'>リードに紐づく連絡先を初期選択しています。必要なら変更できます。</p>}
        <label className='block text-xs text-slate-300'>送信チャネル<select value={channel} onChange={(e)=>{setChannel(e.target.value as Channel);setConfirmed(false);}} className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white'><option value='email'>メールのみ</option><option value='line'>LINEのみ</option><option value='both'>メールとLINE両方</option></select></label>
        <label className='block text-xs text-slate-300'>追加メッセージ（任意）<textarea rows={3} value={customMessage} onChange={(e)=>setCustomMessage(e.target.value)} placeholder='商談で話したい内容など' className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white'/></label>
        <label className='flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300'><input type='checkbox' checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)} className='mt-0.5'/><span>宛先・チャネル・案内文を確認しました。選択した全チャネルを承認待ちとして登録します。</span></label>
        <button type='button' onClick={()=>void requestSend()} disabled={submitting || deals.length===0 || contacts.length===0} className='flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'>{submitting?<Loader2 className='h-4 w-4 animate-spin'/>:channel==='line'?<MessageCircle className='h-4 w-4'/>:<Mail className='h-4 w-4'/>}送信承認を申請</button>
        {deals.length===0 && <p className='text-xs text-slate-500'>商談がありません。リードを商談化するとここから案内できます。</p>}
      </div>
      <div className='space-y-3'>
        <div className='rounded-lg border border-slate-800 bg-slate-950 p-3'>
          <div className='flex items-center justify-between gap-2'><div className='text-xs font-semibold text-slate-300'>送信前プレビュー · {channel==='both'?'メール・LINE':channel==='line'?'LINE':'メール'}</div><button type='button' onClick={()=>void copyPreview()} className='flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300'><Copy className='h-3 w-3'/>コピー</button></div>
          {channel!=='line' && <><div className='mt-3 text-xs text-slate-500'>件名：{subject}</div><pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs leading-5 text-slate-200'>{emailBody}</pre></>}
          {channel!=='email' && <pre className='mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-xs leading-5 text-slate-200'>{lineBody}</pre>}
          {selectedContact && <div className='mt-2 space-y-1 text-[11px] text-slate-500'><div>メール：{selectedContact.email || '未登録'}</div><div>LINE：{selectedContact.line_user_id ? '連携済み（友だち状態・同意を送信前に確認）' : '未連携'}</div></div>}
        </div>
        <div className='rounded-lg border border-slate-800 bg-slate-950 p-3'><h3 className='text-xs font-semibold text-slate-300'>最近の商談案内依頼</h3>{history.length===0?<p className='mt-2 text-xs text-slate-500'>まだありません。</p>:<ul className='mt-2 divide-y divide-slate-800'>{history.slice(0,8).map((item)=><li key={item.id} className='flex flex-wrap justify-between gap-2 py-2 text-[11px]'><span className='text-slate-300'>{deals.find((deal)=>deal.id===item.deal_id)?.proposal_plan_name || item.deal_id} · {item.channel} · {item.recipient_address}</span><span className='text-slate-500'>{item.status} · {new Date(item.created_at).toLocaleString('ja-JP')}</span></li>)}</ul>}</div>
      </div>
    </div>}
    <p className='mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-amber-200/80'><CheckCircle2 className='mt-0.5 h-3.5 w-3.5 shrink-0'/>予約日時とMeetの生成はGoogle予約ページが行います。この画面は承認待ち依頼を記録し、メール・LINEの実配信はサーバー接続後に有効になります。</p>
  </section>;
};
