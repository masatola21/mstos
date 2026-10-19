import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';

type InboxMessage = { id:string; from_email:string; to_emails:string[]; subject:string; text_body:string; html_body:string; received_at:string };
export const MarketingEmailInboxView:React.FC=()=>{
  const db=getSupabase();
  const [ownerId,setOwnerId]=useState('');
  const [address,setAddress]=useState('');
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [selected,setSelected]=useState<InboxMessage|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=async()=>{
    if(!db)return;
    const {data:auth}=await db.auth.getUser();
    if(!auth.user){setError('ログインしてください。');return}
    setOwnerId(auth.user.id);
    const [settings,inbox]=await Promise.all([
      db.from('email_channel_integrations').select('inbound_address').eq('owner_id',auth.user.id).maybeSingle(),
      db.from('email_inbox_messages').select('id,from_email,to_emails,subject,text_body,html_body,received_at').eq('owner_id',auth.user.id).order('received_at',{ascending:false}).limit(500),
    ]);
    const failed=settings.error||inbox.error;
    if(failed){setError(failed.code==='PGRST205'?'メール受信箱のDBマイグレーションが未適用です。':'メール受信箱を読み込めません: '+failed.message);return}
    setAddress(settings.data?.inbound_address||'');
    setMessages((inbox.data||[]) as InboxMessage[]);
  };
  useEffect(()=>{void load()},[]);
  const save=async()=>{
    if(!db||!ownerId)return;
    const value=address.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){setError('受信用メールアドレスを正しく入力してください。');return}
    setBusy(true);setError('');setNotice('');
    const {error:e}=await db.from('email_channel_integrations').upsert({owner_id:ownerId,inbound_address:value,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
    if(e)setError(e.message);else setNotice('受信先を保存しました。ResendのWebhookで email.received を /api/email/webhook に送る設定も必要です。');
    setBusy(false);
  };
  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-bold text-white">メール受信箱</h2>
      <p className="mt-1 text-sm text-slate-400">受信にはResendの受信ドメインとWebhook設定が必要です。受信先を登録し、Webhook URLに <code>/api/email/webhook</code>、イベントに <code>email.received</code> を指定します。</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="email" value={address} onChange={e=>setAddress(e.target.value)} placeholder="inbox@example.com" maxLength={254} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/><button disabled={busy} onClick={()=>void save()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'保存中…':'受信先を保存'}</button><button onClick={()=>void load()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">更新</button></div>
      {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    </section>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">受信メッセージ（{messages.length}）</div>
        <div className="max-h-[65vh] overflow-auto">{messages.map(m=><button key={m.id} onClick={()=>setSelected(m)} className={`block w-full border-b border-slate-800 px-4 py-3 text-left hover:bg-slate-800 ${selected?.id===m.id?'bg-slate-800':''}`}><div className="truncate text-sm font-semibold text-white">{m.subject||'(件名なし)'}</div><div className="mt-1 truncate text-xs text-slate-400">{m.from_email}</div><div className="mt-1 text-[11px] text-slate-500">{new Date(m.received_at).toLocaleString()}</div></button>)}{messages.length===0&&<p className="p-6 text-sm text-slate-500">受信メールはまだありません。</p>}</div>
      </div>
      <article className="min-h-64 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        {selected?<><div className="border-b border-slate-800 pb-3"><h3 className="font-bold text-white">{selected.subject||'(件名なし)'}</h3><p className="mt-1 text-xs text-slate-400">From: {selected.from_email}</p><p className="mt-1 text-xs text-slate-500">{selected.to_emails.join(', ')} · {new Date(selected.received_at).toLocaleString()}</p></div><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-200">{selected.text_body||selected.html_body.replace(/<[^>]*>/g,' ')||'(本文なし)'}</pre></>:<p className="text-sm text-slate-500">左のメールを選択すると本文を表示します。</p>}
      </article>
    </section>
  </div>
};
