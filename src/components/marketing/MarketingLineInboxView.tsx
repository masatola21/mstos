import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';

type InboxMessage={id:string;line_event_id:string;direction:'inbound'|'outbound';contact_id:string|null;line_user_id:string;body:string;status:string;received_at:string};
type ReplyRule={id:string;name:string;match_mode:'exact'|'contains';match_text:string;reply_text:string;reply_type?:'text'|'image'|'flex';reply_payload?:Record<string,unknown>;tag_id:string|null;priority:number;enabled:boolean};
type Tag={id:string;name:string};
type ReplyTemplate={id:string;name:string;reply_type:'text'|'image'|'flex';payload:Record<string,unknown>};
type ChannelIntegration={owner_id:string;bot_user_id:string;auto_reply_enabled:boolean};

export const MarketingLineInboxView:React.FC=()=>{
  const db=getSupabase();
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [rules,setRules]=useState<ReplyRule[]>([]);
  const [templates,setTemplates]=useState<ReplyTemplate[]>([]);
  const [templateName,setTemplateName]=useState('');
  const [showTemplatePicker,setShowTemplatePicker]=useState(false);
  const [tags,setTags]=useState<Tag[]>([]);
  const [integration,setIntegration]=useState<ChannelIntegration|null>(null);
  const [ownerId,setOwnerId]=useState('');
  const [botUserId,setBotUserId]=useState('');
  const [matchText,setMatchText]=useState('');
  const [replyText,setReplyText]=useState('');
  const [replyType,setReplyType]=useState<'text'|'image'|'flex'>('text');
  const [imageOriginalUrl,setImageOriginalUrl]=useState('');
  const [imagePreviewUrl,setImagePreviewUrl]=useState('');
  const [flexAltText,setFlexAltText]=useState('');
  const [flexContentsJson,setFlexContentsJson]=useState('');
  const [ruleName,setRuleName]=useState('');
  const [matchMode,setMatchMode]=useState<'exact'|'contains'>('exact');
  const [tagId,setTagId]=useState('');
  const [selectedLineUserId,setSelectedLineUserId]=useState('');
  const [replyDraft,setReplyDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=async()=>{
    if(!db)return;
    setError('');
    const {data:auth}=await db.auth.getUser();
    if(!auth.user){setError('ログインしてください。');return}
    setOwnerId(auth.user.id);
    const [m,r,t,i,templateResult]=await Promise.all([
      db.from('line_inbox_messages').select('*').order('received_at',{ascending:false}).limit(500),
      db.from('line_auto_reply_rules').select('*').order('priority',{ascending:true}),
      db.from('contact_tags').select('id,name').order('name'),
      db.from('line_channel_integrations').select('owner_id,bot_user_id,auto_reply_enabled').maybeSingle(),
      db.from('line_auto_reply_templates').select('*').order('created_at',{ascending:false}),
    ]);
    const missing=[m,r,i,templateResult].find(x=>x.error&&x.error.code==='PGRST205');
    if(missing){setError('受信箱・自動返信用のDBマイグレーションが未適用です。supabase/migrations/20261019130000_line_inbox_autoreply.sql と 20261020150000_line_auto_reply_templates.sql を適用してください。');return}
    const failed=[m,r,t,i,templateResult].find(x=>x.error)?.error;
    if(failed){setError(failed.message);return}
    setMessages((m.data||[]) as InboxMessage[]);
    setRules((r.data||[]) as ReplyRule[]);
    setTemplates((templateResult.data||[]) as ReplyTemplate[]);
    setTags((t.data||[]) as Tag[]);
    setIntegration((i.data||null) as ChannelIntegration|null);
  };
  useEffect(()=>{void load()},[]);

  const conversations=useMemo(()=>{
    const grouped=new Map<string,InboxMessage[]>();
    messages.forEach(message=>grouped.set(message.line_user_id,[...(grouped.get(message.line_user_id)||[]),message]));
    return [...grouped.entries()].map(([lineUserId,items])=>({lineUserId,items:items.sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at))}))
      .sort((a,b)=>Date.parse(b.items[b.items.length-1]?.received_at||'')-Date.parse(a.items[a.items.length-1]?.received_at||''));
  },[messages]);

  const connect=async()=>{
    if(!db)return;
    setBusy(true);setError('');setNotice('');
    try{
      const {data}=await db.auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error('ログインしてください。');
      const response=await fetch('/api/line/account',{headers:{Authorization:'Bearer '+token}});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload.userId)throw new Error(payload.error||'LINE公式アカウントを確認できません。');
      setBotUserId(payload.userId);
      const {error:e}=await db.from('line_channel_integrations').upsert({owner_id:ownerId,bot_user_id:payload.userId,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
      if(e)throw e;
      setNotice('LINEアカウントをこのワークスペースに関連付けました。Webhookの送信先IDとも一致する場合に受信を記録します。');
      await load();
    }catch(e:any){setError(e.message||'LINE連携を確認できませんでした。')}
    finally{setBusy(false)}
  };

  const toggleAutoReply=async()=>{
    if(!db||!integration)return;
    const enabled=!integration.auto_reply_enabled;
    const {error:e}=await db.from('line_channel_integrations').update({auto_reply_enabled:enabled,updated_at:new Date().toISOString()}).eq('owner_id',ownerId);
    if(e)setError(e.message);else{setIntegration({...integration,auto_reply_enabled:enabled});setNotice(enabled?'自動返信を有効にしました。':'自動返信を停止しました。')}
  };

  const buildReplyPayload=():Record<string,unknown>=>{
    if(replyType==='text'){
      if(!replyText.trim())throw new Error('自動返信文を入力してください。');
      return {text:replyText.trim()};
    }
    if(replyType==='image'){
      try{
        const original=new URL(imageOriginalUrl.trim());
        const preview=new URL(imagePreviewUrl.trim());
        if(original.protocol!=='https:'||preview.protocol!=='https:')throw new Error();
        return {originalContentUrl:original.toString(),previewImageUrl:preview.toString()};
      }catch{throw new Error('画像URLにはHTTPSで公開された画像URLを2つ入力してください。');}
    }
    if(!flexAltText.trim())throw new Error('Flexメッセージの代替テキストを入力してください。');
    try{
      const contents=JSON.parse(flexContentsJson);
      if(!contents||typeof contents!=='object'||!['bubble','carousel'].includes(contents.type))throw new Error();
      return {altText:flexAltText.trim(),contents};
    }catch{throw new Error('Flex本文はbubbleまたはcarousel形式の正しいJSONで入力してください。');}
  };
  const applyTemplate=(template:ReplyTemplate)=>{
    const payload=template.payload||{};
    setReplyType(template.reply_type);
    setReplyText(String(payload.text||''));
    setImageOriginalUrl(String(payload.originalContentUrl||''));
    setImagePreviewUrl(String(payload.previewImageUrl||''));
    setFlexAltText(String(payload.altText||''));
    setFlexContentsJson(payload.contents?JSON.stringify(payload.contents,null,2):'');
    setShowTemplatePicker(false);
    setNotice('テンプレートを読み込みました。必要に応じて編集して保存してください。');
  };
  const saveTemplate=async()=>{
    if(!db||!templateName.trim())return;
    setError('');setNotice('');
    let payload:Record<string,unknown>;
    try{payload=buildReplyPayload()}catch(e:any){setError(e.message);return}
    setBusy(true);
    const {error:e}=await db.from('line_auto_reply_templates').insert({owner_id:ownerId,name:templateName.trim(),reply_type:replyType,payload});
    if(e)setError(e.message);else{setTemplateName('');setNotice('テンプレートを保存しました。');await load()}
    setBusy(false);
  };
  const deleteTemplate=async(template:ReplyTemplate)=>{
    if(!db)return;
    const {error:e}=await db.from('line_auto_reply_templates').delete().eq('id',template.id);
    if(e)setError(e.message);else{setNotice('テンプレートを削除しました。');await load()}
  };
  const saveRule=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!db||!ruleName.trim()||!matchText.trim())return;
    setError('');setNotice('');
    let replyPayload:Record<string,unknown>;
    try{replyPayload=buildReplyPayload()}catch(e:any){setError(e.message);return}
    setBusy(true);
    const {error:e}=await db.from('line_auto_reply_rules').insert({owner_id:ownerId,name:ruleName.trim(),match_mode:matchMode,match_text:matchText.trim(),reply_text:replyType==='text'?replyText.trim():'',reply_type:replyType,reply_payload:replyPayload,tag_id:tagId||null,priority:rules.length*10+100,enabled:true});
    if(e)setError(e.message);else{setRuleName('');setMatchText('');setReplyText('');setImageOriginalUrl('');setImagePreviewUrl('');setFlexAltText('');setFlexContentsJson('');setReplyType('text');setTagId('');setNotice('自動返信ルールを保存しました。');await load()}
    setBusy(false);
  };

  const toggleRule=async(rule:ReplyRule)=>{
    if(!db)return;
    const {error:e}=await db.from('line_auto_reply_rules').update({enabled:!rule.enabled,updated_at:new Date().toISOString()}).eq('id',rule.id);
    if(e)setError(e.message);else await load();
  };
  const deleteRule=async(rule:ReplyRule)=>{
    if(!db)return;
    const {data:deleted,error:e}=await db.from('line_auto_reply_rules').delete().eq('id',rule.id).select('id').maybeSingle();
    if(e)setError(e.message);else if(!deleted)setError('削除対象が見つからないか、削除権限がありません。');else await load();
  };

  const sendReply=async()=>{
    if(!db||!selectedLineUserId||!replyDraft.trim())return;
    const latest=messages.filter(x=>x.line_user_id===selectedLineUserId).find(x=>x.direction==='inbound');
    const contactId=latest?.contact_id;
    if(!contactId){setError('CRM連絡先に紐づかないLINEユーザーには返信できません。');return}
    setBusy(true);setError('');setNotice('');
    try{
      const {data:session}=await db.auth.getSession();
      const token=session.session?.access_token;
      if(!token)throw new Error('ログイン状態を確認できません。');
      const {data:friend,error:friendError}=await db.from('line_friends').select('status,consent_status').eq('line_user_id',selectedLineUserId).maybeSingle();
      if(friendError)throw friendError;
      if(!friend||friend.status!=='active'||friend.consent_status!=='opted_in')throw new Error('LINE友だち状態と配信同意を確認できないため返信できません。');
      const {data:outbox,error:outboxError}=await db.from('communication_outbox').insert({
        channel:'line',recipient_contact_id:contactId,recipient_address:selectedLineUserId,body_text:replyDraft.trim(),
        source_type:'line_reply',status:'queued',consent_confirmed_at:new Date().toISOString(),
        consent_basis:'ユーザーから届いたメッセージへの返信',
      }).select('id').single();
      if(outboxError||!outbox)throw outboxError||new Error('送信記録を作成できませんでした。');
      const response=await fetch('/api/communications/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({outboxId:outbox.id})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.status!=='sent')throw new Error(result.error||'返信を送信できませんでした。');
      const {error:saveError}=await db.from('line_inbox_messages').insert({
        owner_id:ownerId,line_event_id:'manual-'+outbox.id,direction:'outbound',contact_id:contactId,
        line_user_id:selectedLineUserId,message_type:'text',body:replyDraft.trim(),status:'sent',received_at:new Date().toISOString(),
      });
      if(saveError)throw saveError;
      setReplyDraft('');setNotice('返信を送信しました。');await load();
    }catch(e:any){setError(e.message||'返信に失敗しました。')}
    finally{setBusy(false)}
  };

  const activeConversation=conversations.find(x=>x.lineUserId===selectedLineUserId);
  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">LINE受信箱・自動返信</h2><p className="mt-1 text-sm text-slate-400">受信したメッセージと回答タグを確認し、キーワードに応じた返信ルールを管理します。</p></div><button onClick={()=>void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">更新</button></div>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
      {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <span className="text-sm text-slate-300">{integration?'LINE連携済み':'LINEアカウント未関連付け'}</span>
        {integration&&<span className="text-xs text-slate-500">Bot ID: {integration.bot_user_id}</span>}
        <button disabled={busy} onClick={()=>void connect()} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200">{integration?'接続を更新':'LINEアカウントを接続'}</button>
        {integration&&<button onClick={()=>void toggleAutoReply()} className={'rounded px-3 py-1.5 text-xs font-semibold '+(integration.auto_reply_enabled?'bg-emerald-700 text-white':'bg-slate-800 text-slate-300')}>自動返信：{integration.auto_reply_enabled?'有効':'停止中'}</button>}
      </div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-bold text-white">受信した相手</h3>
        <div className="mt-3 max-h-[560px] space-y-1 overflow-auto">{conversations.length===0?<p className="text-sm text-slate-500">Webhookで受信したメッセージはここに表示されます。</p>:conversations.map(conversation=><button key={conversation.lineUserId} onClick={()=>setSelectedLineUserId(conversation.lineUserId)} className={'w-full rounded-lg p-3 text-left '+(selectedLineUserId===conversation.lineUserId?'bg-indigo-950/70':'hover:bg-slate-800')}><div className="truncate text-xs text-slate-400">{conversation.lineUserId}</div><div className="truncate text-sm text-white">{conversation.items[conversation.items.length-1]?.body||'（本文なし）'}</div><div className="text-[10px] text-slate-500">{new Date(conversation.items[conversation.items.length-1]?.received_at||'').toLocaleString()}</div></button>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-bold text-white">会話</h3>
        {!activeConversation?<p className="mt-4 text-sm text-slate-500">左から相手を選択してください。</p>:<><div className="mt-3 max-h-[420px] space-y-2 overflow-auto rounded-xl bg-slate-950/50 p-3">{activeConversation.items.map(message=><div key={message.id} className={'max-w-[85%] rounded-xl px-3 py-2 text-sm '+(message.direction==='outbound'?'ml-auto bg-indigo-700 text-white':'bg-slate-800 text-slate-100')}><div className="whitespace-pre-wrap">{message.body}</div><div className="mt-1 text-[10px] opacity-60">{new Date(message.received_at).toLocaleString()}</div></div>)}</div><div className="mt-3 flex gap-2"><textarea value={replyDraft} onChange={e=>setReplyDraft(e.target.value)} rows={2} maxLength={5000} placeholder="LINE返信を入力" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /><button disabled={busy||!replyDraft.trim()} onClick={()=>void sendReply()} className="rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-40">返信</button></div></>}
      </section>
    </div>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="font-bold text-white">回答に応じたタグ付け・自動返信</h3>
      <p className="mt-1 text-xs text-slate-400">Flex Messageのボタンをメッセージアクションにすると、押された選択文字を条件にできます。最初に一致したルールの返信とタグを適用します。</p>
      <form onSubmit={saveRule} className="mt-4 grid gap-3 md:grid-cols-2">
        <input value={ruleName} onChange={e=>setRuleName(e.target.value)} placeholder="ルール名（例：経営改善の相談）" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
        <select value={matchMode} onChange={e=>setMatchMode(e.target.value as 'exact'|'contains')} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"><option value="exact">完全一致</option><option value="contains">含む</option></select>
        <input value={matchText} onChange={e=>setMatchText(e.target.value)} placeholder="ボタンから届く選択文字" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
        <select value={tagId} onChange={e=>setTagId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"><option value="">タグを付けない</option>{tags.map(tag=><option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button type="button" onClick={()=>setShowTemplatePicker(!showTemplatePicker)} className="rounded-lg border border-indigo-500/40 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-950/40">テンプレートから選ぶ（{templates.filter(item=>item.reply_type===replyType).length}件）</button>
          <input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="テンプレート名" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
          <button type="button" disabled={busy||!templateName.trim()} onClick={()=>void saveTemplate()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">現在の内容をテンプレート保存</button>
        </div>
        {showTemplatePicker&&<div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3 md:col-span-2">
          {templates.filter(item=>item.reply_type===replyType).length===0?<p className="text-xs text-slate-500">この形式のテンプレートはありません。</p>:templates.filter(item=>item.reply_type===replyType).map(template=><div key={template.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 p-2"><button type="button" onClick={()=>applyTemplate(template)} className="min-w-0 flex-1 truncate text-left text-sm text-slate-200 hover:text-white">{template.name}</button><InlineDeleteButton onConfirm={()=>deleteTemplate(template)} warning={`テンプレート「${template.name}」を削除しますか？`} ariaLabel={`テンプレート「${template.name}」を削除`}>削除</InlineDeleteButton></div>)}
        </div>}
        <select value={replyType} onChange={e=>{const type=e.target.value as 'text'|'image'|'flex';setReplyType(type);if(type==='flex'&&!flexContentsJson)setFlexContentsJson(JSON.stringify({type:'bubble',body:{type:'box',layout:'vertical',contents:[{type:'text',text:'ご相談内容を選んでください',weight:'bold',size:'md'},{type:'button',action:{type:'message',label:'経営改善',text:'経営改善'}},{type:'button',action:{type:'message',label:'業務改善',text:'業務改善'}}]}},null,2));if(type==='flex'&&!flexAltText)setFlexAltText('ご相談内容を選択してください');}} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white md:col-span-2"><option value="text">テキスト</option><option value="image">画像</option><option value="flex">Flexメッセージ</option></select>
        {replyType==='text'&&<textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3} placeholder="自動返信文" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white md:col-span-2" />}
        {replyType==='image'&&<div className="grid gap-2 md:col-span-2 md:grid-cols-2"><input type="url" value={imageOriginalUrl} onChange={e=>setImageOriginalUrl(e.target.value)} placeholder="画像URL（HTTPS）" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /><input type="url" value={imagePreviewUrl} onChange={e=>setImagePreviewUrl(e.target.value)} placeholder="プレビュー画像URL（HTTPS）" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /><p className="text-xs text-slate-500 md:col-span-2">画像はHTTPSで公開されている必要があります。</p></div>}
        {replyType==='flex'&&<div className="grid gap-2 md:col-span-2"><input value={flexAltText} onChange={e=>setFlexAltText(e.target.value)} maxLength={1500} placeholder="通知や一覧に表示する代替テキスト" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /><textarea value={flexContentsJson} onChange={e=>setFlexContentsJson(e.target.value)} rows={10} placeholder='Flex本文 JSON（bubble / carousel）' className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /><p className="text-xs text-slate-500">ボタンで自動返信ルールにつなぐ場合は、action.type を message にしてください。</p></div>}
        <button disabled={busy||!integration} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 md:col-span-2">{busy?'保存中…':'自動返信ルールを保存'}</button>
      </form>
      <div className="mt-4 divide-y divide-slate-800">{rules.map(rule=><div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium text-white">{rule.name}</div><div className="text-xs text-slate-400">{rule.match_mode==='exact'?'完全一致':'含む'}：「{rule.match_text}」 ・ {tags.find(tag=>tag.id===rule.tag_id)?.name||'タグなし'}</div><div className="whitespace-pre-wrap text-xs text-slate-500">{rule.reply_type==='image'?'画像メッセージ':rule.reply_type==='flex'?'Flexメッセージ':rule.reply_text}</div></div><div className="flex gap-2"><button onClick={()=>void toggleRule(rule)} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{rule.enabled?'停止':'有効化'}</button><InlineDeleteButton onConfirm={()=>void deleteRule(rule)} warning={`「${rule.name}」を削除しますか？`}>削除</InlineDeleteButton></div></div>)}</div>
    </section>
  </div>;
};
