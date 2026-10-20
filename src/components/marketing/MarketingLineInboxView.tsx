import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { LineMessagePreview } from '../LineMessagePreview';

type InboxMessage={id:string;line_event_id:string;direction:'inbound'|'outbound';contact_id:string|null;line_user_id:string;body:string;status:string;received_at:string};
type ReplyRule={id:string;name:string;match_mode:'exact'|'contains';match_text:string;reply_text:string;reply_type?:'text'|'image'|'flex'|'video';reply_payload?:Record<string,unknown>;tag_id:string|null;priority:number;enabled:boolean};
type Tag={id:string;name:string};
type ReplyTemplate={id:string;name:string;reply_type:'text'|'image'|'flex'|'video';payload:Record<string,unknown>};
const LINE_TEMPLATE_BUCKET='mst-line-message-assets';
const MAX_LINE_TEMPLATE_FILE_BYTES=20*1024*1024;
type ChannelIntegration={owner_id:string;bot_user_id:string;auto_reply_enabled:boolean};

export const MarketingLineInboxView:React.FC=()=>{
  const db=getSupabase();
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [rules,setRules]=useState<ReplyRule[]>([]);
  const [templates,setTemplates]=useState<ReplyTemplate[]>([]);
  const [activeView,setActiveView]=useState<'inbox'|'templates'>('inbox');
  const [templateName,setTemplateName]=useState('');
  const [editingTemplateId,setEditingTemplateId]=useState('');
  const [templateType,setTemplateType]=useState<'text'|'image'|'flex'|'video'>('text');
  const [templateText,setTemplateText]=useState('');
  const [templateImageUrl,setTemplateImageUrl]=useState('');
  const [templateImagePath,setTemplateImagePath]=useState('');
  const [templatePreviewUrl,setTemplatePreviewUrl]=useState('');
  const [templatePreviewPath,setTemplatePreviewPath]=useState('');
  const [templateVideoUrl,setTemplateVideoUrl]=useState('');
  const [templateVideoPath,setTemplateVideoPath]=useState('');
  const [templateAltText,setTemplateAltText]=useState('');
  const [templateFlexJson,setTemplateFlexJson]=useState('');
  const [selectedTemplateId,setSelectedTemplateId]=useState('');
  const [replyType,setReplyType]=useState<'text'|'image'|'flex'|'video'>('text');
  const [replyPayload,setReplyPayload]=useState<Record<string,unknown>>({});
  const [tags,setTags]=useState<Tag[]>([]);
  const [integration,setIntegration]=useState<ChannelIntegration|null>(null);
  const [ownerId,setOwnerId]=useState('');
  const [botUserId,setBotUserId]=useState('');
  const [matchText,setMatchText]=useState('');
  const [replyText,setReplyText]=useState('');
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
    if(missing){setError('受信箱・自動返信用のDBマイグレーションが未適用です。supabase/migrations/20261019130000_line_inbox_autoreply.sql、20261020140000_line_auto_reply_rich_messages.sql、20261020150000_line_auto_reply_templates.sql を適用してください。');return}
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

  const resetTemplateEditor=()=>{
    setTemplateName('');setEditingTemplateId('');setTemplateType('text');setTemplateText('');
    setTemplateImageUrl('');setTemplateImagePath('');setTemplatePreviewUrl('');setTemplatePreviewPath('');
    setTemplateVideoUrl('');setTemplateVideoPath('');setTemplateAltText('');setTemplateFlexJson('');
  };
  const uploadLineTemplateAsset=async(file:File,kind:'image'|'video')=>{
    if(!db||!ownerId)throw new Error('ログイン状態を確認してください。');
    if(file.size>MAX_LINE_TEMPLATE_FILE_BYTES)throw new Error('ファイルは20MB以下にしてください。');
    const allowed=kind==='video'?['video/mp4']:['image/jpeg','image/png'];
    if(!allowed.includes(file.type))throw new Error(kind==='video'?'動画はMP4形式を選択してください。':'画像はJPEGまたはPNG形式を選択してください。');
    const safeName=file.name.replace(/[\\/:*?"<>|]/g,'_').slice(0,120)||'asset';
    const path=`${ownerId}/${crypto.randomUUID()}-${safeName}`;
    const {error:e}=await db.storage.from(LINE_TEMPLATE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(e)throw new Error(`素材をアップロードできませんでした: ${e.message}`);
    const {data}=db.storage.from(LINE_TEMPLATE_BUCKET).getPublicUrl(path);
    return {path,url:data.publicUrl};
  };
  const templatePayload=():Record<string,unknown>=>{
    if(templateType==='text'){
      if(!templateText.trim())throw new Error('返信テキストを入力してください。');
      return {text:templateText.trim()};
    }
    if(templateType==='image'){
      if(!templateImageUrl||!templatePreviewUrl||!templateImagePath||!templatePreviewPath)throw new Error('画像本体とプレビュー画像をアップロードしてください。');
      return {originalContentUrl:templateImageUrl,previewImageUrl:templatePreviewUrl,storagePaths:[templateImagePath,templatePreviewPath]};
    }
    if(templateType==='video'){
      if(!templateVideoUrl||!templatePreviewUrl||!templateVideoPath||!templatePreviewPath)throw new Error('動画本体とプレビュー画像をアップロードしてください。');
      if(!templateAltText.trim())throw new Error('動画の代替テキストを入力してください。');
      return {originalContentUrl:templateVideoUrl,previewImageUrl:templatePreviewUrl,altText:templateAltText.trim(),storagePaths:[templateVideoPath,templatePreviewPath]};
    }
    if(!templateAltText.trim())throw new Error('Flexメッセージの代替テキストを入力してください。');
    try{
      const contents=JSON.parse(templateFlexJson);
      if(!contents||typeof contents!=='object'||!['bubble','carousel'].includes(contents.type))throw new Error();
      return {altText:templateAltText.trim(),contents};
    }catch{throw new Error('Flex本文はbubbleまたはcarousel形式の正しいJSONで入力してください。');}
  };
  const saveTemplate=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!db||!templateName.trim())return;
    setError('');setNotice('');
    let payload:Record<string,unknown>;
    try{payload=templatePayload()}catch(e:any){setError(e.message);return}
    setBusy(true);
    const existing=templates.find(item=>item.id===editingTemplateId);
    const saved=existing
      ? await db.from('line_auto_reply_templates').update({name:templateName.trim(),reply_type:templateType,payload,updated_at:new Date().toISOString()}).eq('id',editingTemplateId)
      : await db.from('line_auto_reply_templates').insert({owner_id:ownerId,name:templateName.trim(),reply_type:templateType,payload});
    if(saved.error)setError(saved.error.message);
    else{
      if(existing){
        const oldPaths=Array.isArray(existing.payload.storagePaths)?existing.payload.storagePaths.filter((p):p is string=>typeof p==='string'):[];
        const newPaths=Array.isArray(payload.storagePaths)?payload.storagePaths.filter((p):p is string=>typeof p==='string'):[];
        const removed=oldPaths.filter(p=>!newPaths.includes(p));
        if(removed.length){const {error:storageError}=await db.storage.from(LINE_TEMPLATE_BUCKET).remove(removed);if(storageError)setError('テンプレートは更新しましたが、古い素材を削除できませんでした: '+storageError.message);}
      }
      setNotice('テンプレートを保存しました。');resetTemplateEditor();await load();
    }
    setBusy(false);
  };
  const editTemplate=(template:ReplyTemplate)=>{
    const payload=template.payload||{};
    setEditingTemplateId(template.id);setTemplateName(template.name);setTemplateType(template.reply_type);
    setTemplateText(String(payload.text||''));
    setTemplateImageUrl(template.reply_type==='image'?String(payload.originalContentUrl||''):template.reply_type==='video'?'': '');
    setTemplateImagePath(template.reply_type==='image'?String((payload.storagePaths as string[]|undefined)?.[0]||''):'');
    setTemplatePreviewUrl(String(payload.previewImageUrl||''));
    setTemplatePreviewPath(String((payload.storagePaths as string[]|undefined)?.[template.reply_type==='video'?1:1]||''));
    setTemplateVideoUrl(String(template.reply_type==='video'?payload.originalContentUrl||'':''));
    setTemplateVideoPath(String(template.reply_type==='video'?((payload.storagePaths as string[]|undefined)?.[0]||''):''));
    setTemplateAltText(String(payload.altText||''));
    setTemplateFlexJson(payload.contents?JSON.stringify(payload.contents,null,2):'');
    setActiveView('templates');window.scrollTo({top:0,behavior:'smooth'});
  };
  const deleteTemplate=async(template:ReplyTemplate)=>{
    if(!db)return;
    const {error:e}=await db.from('line_auto_reply_templates').delete().eq('id',template.id);
    if(e){setError(e.message);return}
    const paths=Array.isArray(template.payload.storagePaths)?template.payload.storagePaths.filter((p):p is string=>typeof p==='string'):[];
    if(paths.length){const {error:storageError}=await db.storage.from(LINE_TEMPLATE_BUCKET).remove(paths);if(storageError){setError('テンプレートを削除しましたが、保存素材の削除に失敗しました: '+storageError.message);return}}
    setNotice('テンプレートを削除しました。');await load();
  };
  const applyTemplate=(template:ReplyTemplate)=>{
    setSelectedTemplateId(template.id);setReplyType(template.reply_type);setReplyPayload(template.payload||{});
    setNotice('テンプレートを返信ルールに設定しました。');
  };
  const saveRule=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!db||!ruleName.trim()||!matchText.trim())return;
    if(!selectedTemplateId){setError('返信テンプレートを選択してください。');return;}
    setBusy(true);setError('');setNotice('');
    const {error:e}=await db.from('line_auto_reply_rules').insert({owner_id:ownerId,name:ruleName.trim(),match_mode:matchMode,match_text:matchText.trim(),reply_text:replyType==='text'?String(replyPayload.text||''):'',reply_type:replyType,reply_payload:replyPayload,tag_id:tagId||null,priority:rules.length*10+100,enabled:true});
    if(e)setError(e.message);else{setRuleName('');setMatchText('');setTagId('');setSelectedTemplateId('');setReplyPayload({});setNotice('自動返信ルールを保存しました。');await load()}
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
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">LINE運用</h2><p className="mt-1 text-sm text-slate-400">受信箱・自動返信と、テキスト・画像・Flex・動画テンプレートを管理します。</p></div><button onClick={()=>void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">更新</button></div>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
      {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <span className="text-sm text-slate-300">{integration?'LINE連携済み':'LINEアカウント未関連付け'}</span>
        {integration&&<span className="text-xs text-slate-500">Bot ID: {integration.bot_user_id}</span>}
        <button disabled={busy} onClick={()=>void connect()} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200">{integration?'接続を更新':'LINEアカウントを接続'}</button>
        {integration&&<button onClick={()=>void toggleAutoReply()} className={'rounded px-3 py-1.5 text-xs font-semibold '+(integration.auto_reply_enabled?'bg-emerald-700 text-white':'bg-slate-800 text-slate-300')}>自動返信：{integration.auto_reply_enabled?'有効':'停止中'}</button>}
      </div>
    </section>
    <nav className="flex gap-2 border-b border-slate-800 pb-2">
      <button type="button" onClick={()=>setActiveView('inbox')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeView==='inbox'?'bg-indigo-600 text-white':'text-slate-400 hover:bg-slate-800'}`}>受信箱・自動返信</button>
      <button type="button" onClick={()=>setActiveView('templates')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeView==='templates'?'bg-indigo-600 text-white':'text-slate-400 hover:bg-slate-800'}`}>テンプレート管理（{templates.length}）</button>
    </nav>
    {activeView==='inbox'&&<>

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
        <select value={selectedTemplateId} onChange={e=>{const id=e.target.value;setSelectedTemplateId(id);const selected=templates.find(item=>item.id===id);if(selected){setReplyType(selected.reply_type);setReplyPayload(selected.payload||{});}}} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white md:col-span-2">
          <option value="">返信テンプレートを選択</option>
          {templates.map(template=><option key={template.id} value={template.id}>{template.reply_type==='text'?'テキスト':template.reply_type==='image'?'画像':template.reply_type==='video'?'動画':'Flex'}：{template.name}</option>)}
        </select>
        <p className="text-xs text-slate-500 md:col-span-2">テンプレートは「テンプレート管理」タブで作成・アップロードできます。</p><div className="md:col-span-2"><LineMessagePreview type={replyType} title="返信ルールの送信内容" payload={replyPayload} text={replyText} /></div>
        <button disabled={busy||!integration} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 md:col-span-2">{busy?'保存中…':'自動返信ルールを保存'}</button>
      </form>
      <div className="mt-4 divide-y divide-slate-800">{rules.map(rule=><div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium text-white">{rule.name}</div><div className="text-xs text-slate-400">{rule.match_mode==='exact'?'完全一致':'含む'}：「{rule.match_text}」 ・ {tags.find(tag=>tag.id===rule.tag_id)?.name||'タグなし'}</div><div className="whitespace-pre-wrap text-xs text-slate-500">{rule.reply_type==='image'?'画像メッセージ':rule.reply_type==='video'?'動画メッセージ':rule.reply_type==='flex'?'Flexメッセージ':rule.reply_text}</div><LineMessagePreview type={rule.reply_type || 'text'} title={rule.name} payload={rule.reply_payload || { text: rule.reply_text }} /></div><div className="flex gap-2"><button onClick={()=>void toggleRule(rule)} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{rule.enabled?'停止':'有効化'}</button><InlineDeleteButton onConfirm={()=>void deleteRule(rule)} warning={`「${rule.name}」を削除しますか？`}>削除</InlineDeleteButton></div></div>)}</div>

    </section>
    </>}
    {activeView==='templates'&&<section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div><h3 className="font-bold text-white">返信テンプレートの管理</h3><p className="mt-1 text-xs text-slate-400">テキスト・画像・Flex・動画のテンプレートを作成し、自動返信ルールから選択できます。画像・動画ファイルはここからアップロードします（各20MBまで）。</p></div>
      <form onSubmit={saveTemplate} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input required value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="テンプレート名" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
          <select value={templateType} onChange={e=>setTemplateType(e.target.value as 'text'|'image'|'flex'|'video')} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"><option value="text">テキスト</option><option value="image">画像</option><option value="flex">Flex</option><option value="video">動画</option></select>
          {templateType==='text'&&<textarea value={templateText} onChange={e=>setTemplateText(e.target.value)} rows={4} placeholder="返信テキスト" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white md:col-span-2" />}
          {templateType==='image'&&<div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="space-y-2 text-xs text-slate-300">画像本体（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setBusy(true);setError('');try{const asset=await uploadLineTemplateAsset(file,'image');setTemplateImageUrl(asset.url);setTemplateImagePath(asset.path);setNotice('画像をアップロードしました。')}catch(err:any){setError(err.message)}finally{setBusy(false);input.value=''}}} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
            <label className="space-y-2 text-xs text-slate-300">プレビュー画像（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setBusy(true);setError('');try{const asset=await uploadLineTemplateAsset(file,'image');setTemplatePreviewUrl(asset.url);setTemplatePreviewPath(asset.path);setNotice('プレビュー画像をアップロードしました。')}catch(err:any){setError(err.message)}finally{setBusy(false);input.value=''}}} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
            {(templateImageUrl||templatePreviewUrl)&&<div className="flex gap-3 md:col-span-2">{templateImageUrl&&<img src={templateImageUrl} alt="画像本体のプレビュー" className="h-24 rounded border border-slate-700 object-contain" />}{templatePreviewUrl&&<img src={templatePreviewUrl} alt="プレビュー画像" className="h-24 rounded border border-slate-700 object-contain" />}</div>}
          </div>}
          {templateType==='video'&&<div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="space-y-2 text-xs text-slate-300">動画本体（MP4）<input type="file" accept="video/mp4" disabled={busy} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setBusy(true);setError('');try{const asset=await uploadLineTemplateAsset(file,'video');setTemplateVideoUrl(asset.url);setTemplateVideoPath(asset.path);setNotice('動画をアップロードしました。')}catch(err:any){setError(err.message)}finally{setBusy(false);input.value=''}}} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
            <label className="space-y-2 text-xs text-slate-300">動画プレビュー画像（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setBusy(true);setError('');try{const asset=await uploadLineTemplateAsset(file,'image');setTemplatePreviewUrl(asset.url);setTemplatePreviewPath(asset.path);setNotice('プレビュー画像をアップロードしました。')}catch(err:any){setError(err.message)}finally{setBusy(false);input.value=''}}} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
            {templateVideoUrl&&<video src={templateVideoUrl} controls className="h-32 rounded border border-slate-700 md:col-span-2" />}
            <input value={templateAltText} onChange={e=>setTemplateAltText(e.target.value)} maxLength={400} placeholder="通知に表示する動画の代替テキスト" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white md:col-span-2" />
          </div>}
          {templateType==='flex'&&<div className="grid gap-3 md:col-span-2"><input value={templateAltText} onChange={e=>setTemplateAltText(e.target.value)} maxLength={1500} placeholder="通知に表示する代替テキスト" className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /><textarea value={templateFlexJson} onChange={e=>setTemplateFlexJson(e.target.value)} rows={10} placeholder='Flex本文 JSON（bubble / carousel）' className="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /><p className="text-xs text-slate-500">ボタンでルールにつなぐ場合は action.type を message にしてください。</p></div>}
        </div>
        <LineMessagePreview type={templateType} title={templateName || '自動返信テンプレート'} payload={templateType === 'text' ? { text: templateText } : templateType === 'image' ? { originalContentUrl: templateImageUrl, previewImageUrl: templatePreviewUrl } : templateType === 'video' ? { originalContentUrl: templateVideoUrl, previewImageUrl: templatePreviewUrl, altText: templateAltText } : { altText: templateAltText, contents: templateFlexJson }} />
        <div className="flex justify-end gap-2"><button type="button" onClick={resetTemplateEditor} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300">新規作成に戻す</button><button type="submit" disabled={busy||!ownerId} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy?'保存中…':editingTemplateId?'テンプレートを更新':'テンプレートを保存'}</button></div>
      </form>
      <div className="divide-y divide-slate-800">{templates.length===0?<p className="py-4 text-sm text-slate-500">テンプレートはまだありません。</p>:templates.map(template=><div key={template.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium text-white">{template.name}</div><div className="text-xs text-slate-400">{template.reply_type==='text'?'テキスト':template.reply_type==='image'?'画像':template.reply_type==='video'?'動画':'Flex'}</div></div><div className="flex gap-2"><button type="button" onClick={()=>editTemplate(template)} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200">編集</button><InlineDeleteButton onConfirm={()=>deleteTemplate(template)} warning={`テンプレート「${template.name}」を削除しますか？素材ファイルも削除されます。`}>削除</InlineDeleteButton></div></div>)}</div>
    </section>}
  </div>;
};
