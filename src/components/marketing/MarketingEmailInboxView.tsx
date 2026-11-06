import React, { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';

type InboxMessage = { id:string; from_email:string; to_emails:string[]; subject:string; text_body:string; html_body:string; received_at:string };
export interface MarketingEmailInboxViewProps {
  onNavigateSendCenter?: () => void;
}

export const MarketingEmailInboxView: React.FC<MarketingEmailInboxViewProps> = ({ onNavigateSendCenter }) => {
  const db=getSupabase();
  const [ownerId,setOwnerId]=useState('');
  const [address,setAddress]=useState('');
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [selected,setSelected]=useState<InboxMessage|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showConfig,setShowConfig]=useState(false);
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
    if(e)setError(e.message);else setNotice('受信先アドレスを保存しました。');
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      {/* すっきりとした単一のツールバー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${address ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>受信アドレス:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="inbox@example.com"
              maxLength={254}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 w-44 sm:w-56"
            />
            <button
              disabled={busy}
              onClick={() => void save()}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {busy ? '保存中' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
              title="Webhook設定の詳細を表示/非表示"
            >
              {showConfig ? '設定ヘルプを閉じる' : '設定情報'}
            </button>
          </div>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 font-medium">
            受信数 <span className="font-semibold text-slate-800">{messages.length}件</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
            title="最新メールを再読み込み"
          >
            更新
          </button>
          {onNavigateSendCenter && (
            <button
              type="button"
              onClick={onNavigateSendCenter}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <span>送信センター（返信作成）</span>
            </button>
          )}
        </div>
      </div>

      {showConfig && (
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Resend Inbound Webhook 連携手順:</p>
          <p>
            Webhook URLに <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-purple-700">/api/email/webhook</code>、イベントに <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-purple-700">email.received</code> を指定してください。
          </p>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{notice}</p>}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 bg-slate-50/50">
            受信メッセージ（{messages.length}）
          </div>
          <div className="max-h-[65vh] overflow-auto divide-y divide-slate-100">
            {messages.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={`block w-full px-4 py-3 text-left transition cursor-pointer ${
                  selected?.id === m.id ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-300' : 'hover:bg-slate-50'
                }`}
              >
                <div className="truncate text-sm font-semibold text-slate-900">{m.subject || '(件名なし)'}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{m.from_email}</div>
                <div className="mt-1 text-[11px] text-slate-400">{new Date(m.received_at).toLocaleString()}</div>
              </button>
            ))}
            {messages.length === 0 && <p className="p-8 text-center text-sm text-slate-400">受信メールはまだありません。</p>}
          </div>
        </div>

        <article className="min-h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col">
          {selected ? (
            <>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-bold text-lg text-slate-900">{selected.subject || '(件名なし)'}</h3>
                <p className="mt-1.5 text-xs text-slate-600">From: <span className="font-medium text-slate-800">{selected.from_email}</span></p>
                <p className="mt-1 text-xs text-slate-400">宛先: {selected.to_emails.join(', ')} · {new Date(selected.received_at).toLocaleString()}</p>
              </div>
              <pre className="mt-4 flex-1 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {selected.text_body || selected.html_body.replace(/<[^>]*>/g, ' ') || '(本文なし)'}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-slate-400">
              左のメールを選択すると本文を表示します。
            </div>
          )}
        </article>
      </section>
    </div>
  );
};
