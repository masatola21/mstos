import React, { useEffect, useMemo, useState, useRef } from 'react';
import { FileText } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { LineMessagePreview } from '../LineMessagePreview';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useSendDrawer } from '../../context/SendDrawerContext';
import {
  newestReceivedAt,
  removeMessages,
  replaceMessagesIfChanged,
  sortByReceivedAtDesc,
  upsertMessages,
} from '../../utils/inboxSync';
import {
  countUnreadLineByUser,
  countUnreadLineMessages,
  isLineMessageUnread,
} from '../../utils/inboxReadState';

type InboxMessage={id:string;line_event_id:string;direction:'inbound'|'outbound';contact_id:string|null;line_user_id:string;body:string;status:string;received_at:string};
// 画面表示に影響しうる項目。これらが変わらなければ一覧を再描画しない。
const LINE_LIST_KEYS = ['body', 'status', 'direction', 'line_user_id'] as const satisfies readonly (keyof InboxMessage)[];
type ReplyRule={id:string;name:string;match_mode:'exact'|'contains';match_text:string;reply_text:string;reply_type?:'text'|'image'|'flex'|'video';reply_payload?:Record<string,unknown>;tag_id:string|null;priority:number;enabled:boolean};
type Tag={id:string;name:string};
type ReplyTemplate={id:string;name:string;reply_type:'text'|'image'|'flex'|'video';payload:Record<string,unknown>};
const LINE_TEMPLATE_BUCKET='mst-line-message-assets';
const MAX_LINE_TEMPLATE_FILE_BYTES=20*1024*1024;
type LineFriend = { line_user_id: string; display_name: string | null; picture_url: string | null };
type ChannelIntegration={owner_id:string;bot_user_id:string;auto_reply_enabled:boolean};

export interface MarketingLineInboxViewProps {
  initialLineUserId?: string;
  chatOnly?: boolean;
  onNavigateSettings?: () => void;
  onNavigateContacts?: () => void;
  onUnreadCountChange?: (unreadCount: number) => void;
}

export const MarketingLineInboxView: React.FC<MarketingLineInboxViewProps> = ({
  initialLineUserId,
  chatOnly = false,
  onNavigateSettings,
  onNavigateContacts,
  onUnreadCountChange,
}) => {
  const db=getSupabase();
  const { openSendDrawer } = useSendDrawer();
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [friends,setFriends]=useState<Record<string,LineFriend>>({});
  const [contactsByLineUser,setContactsByLineUser]=useState<Record<string,string>>({});
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
  useEffect(()=>{if(initialLineUserId)setSelectedLineUserId(initialLineUserId)},[initialLineUserId]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=async()=>{
    if(!db)return;
    setError('');
    const {data:auth}=await db.auth.getUser();
    if(!auth.user){setError('ログインしてください。');return}
    setOwnerId(auth.user.id);
    const [m,r,t,i,templateResult,fResult,contactsRes]=await Promise.all([
      db.from('line_inbox_messages').select('*').order('received_at',{ascending:false}).limit(500),
      db.from('line_auto_reply_rules').select('*').order('priority',{ascending:true}),
      db.from('contact_tags').select('id,name').order('name'),
      db.from('line_channel_integrations').select('owner_id,bot_user_id,auto_reply_enabled').maybeSingle(),
      db.from('line_auto_reply_templates').select('*').order('created_at',{ascending:false}),
      db.from('line_friends').select('line_user_id,display_name,picture_url'),
      db.from('contacts').select('id,line_user_id').not('line_user_id','is',null),
    ]);
    const missing=[m,r,i,templateResult].find(x=>x.error&&x.error.code==='PGRST205');
    if(missing){setError('受信箱・自動返信用のDBマイグレーションが未適用です。supabase/migrations/20261019130000_line_inbox_autoreply.sql、20261020140000_line_auto_reply_rich_messages.sql、20261020150000_line_auto_reply_templates.sql を適用してください。');return}
    const failed=[m,r,t,i,templateResult].find(x=>x.error)?.error;
    if(failed){setError(failed.message);return}
    setMessages(prev=>replaceMessagesIfChanged(prev,(m.data||[]) as InboxMessage[],LINE_LIST_KEYS));
    hasLoadedRef.current = true;
    setRules((r.data||[]) as ReplyRule[]);
    setTemplates((templateResult.data||[]) as ReplyTemplate[]);
    setTags((t.data||[]) as Tag[]);
    setIntegration((i.data||null) as ChannelIntegration|null);
    if(fResult?.data){
      const map:Record<string,LineFriend>={};
      for(const item of fResult.data as LineFriend[]){
        if(item.line_user_id) map[item.line_user_id]=item;
      }
      setFriends(map);
    }
    if(contactsRes?.data){
      const cMap:Record<string,string>={};
      for(const c of contactsRes.data as {id:string;line_user_id:string}[]){
        if(c.line_user_id) cMap[c.line_user_id]=c.id;
      }
      setContactsByLineUser(cMap);
    }
  };

  // 差分取得の起点（最新の受信日時）を求めるため、最新の一覧を ref でも保持
  const messagesRef = useRef<InboxMessage[]>([]);
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // メッセージのみの同期。
  //   full=false: 最新の受信日時より新しいものだけ取得（差分）
  //   full=true : 最新500件を取得し直す（削除・ステータス変化も反映）
  // 内容が変わらなければ画面は再描画しない。
  const syncMessages = async (full: boolean) => {
    if (!db) return;
    try {
      const since = full ? null : newestReceivedAt(messagesRef.current);
      let query = db.from('line_inbox_messages').select('*');
      if (since) query = query.gte('received_at', since);
      const m = await query.order('received_at', { ascending: false }).limit(500);
      if (!m.data) return;
      const incoming = m.data as InboxMessage[];
      setMessages((prev) =>
        since
          ? upsertMessages(prev, incoming, LINE_LIST_KEYS)
          : replaceMessagesIfChanged(prev, sortByReceivedAtDesc(incoming), LINE_LIST_KEYS)
      );
    } catch {
      // quiet
    }
  };

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [db]);

  // 自動更新: Supabase Realtime を主役にし、接続できないときだけ30秒間隔の差分ポーリングに切り替える。
  // タブが非表示の間は止まり、表示に戻ったときに1回だけ同期する。
  useInboxRealtime({
    db,
    channelName: 'line_inbox_realtime_sync',
    table: 'line_inbox_messages',
    onInsert: (row) => {
      setMessages((prev) => upsertMessages(prev, [row as InboxMessage], LINE_LIST_KEYS));
    },
    onUpdate: (row) => {
      setMessages((prev) => upsertMessages(prev, [row as InboxMessage], LINE_LIST_KEYS));
    },
    onDelete: (row) => {
      const id = row?.id ? String(row.id) : '';
      if (!id) {
        void syncMessages(true);
        return;
      }
      setMessages((prev) => removeMessages(prev, [id]));
    },
    onSync: syncMessages,
  });

  // 新規メッセージまたは友だち選択時にチャット末尾へ自動スクロール
  useEffect(() => {
    if (selectedLineUserId && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedLineUserId, messages.length]);

  const friendsRef = useRef(friends);
  friendsRef.current = friends;
  const profileFetchedRef = useRef<Set<string>>(new Set());

  useEffect(()=>{
    if(!selectedLineUserId||!db)return;
    const current=friendsRef.current[selectedLineUserId];
    if(current&&current.display_name&&current.picture_url)return;
    if (profileFetchedRef.current.has(selectedLineUserId)) return;
    profileFetchedRef.current.add(selectedLineUserId);
    (async()=>{
      try{
        const {data:authSession}=await db.auth.getSession();
        const token=authSession.session?.access_token;
        if(!token)return;
        const res=await fetch(`/api/line/profile/${encodeURIComponent(selectedLineUserId)}`,{headers:{Authorization:'Bearer '+token}});
        if(res.ok){
          const p=await res.json();
          if(p.displayName||p.pictureUrl){
            setFriends(prev=>({
              ...prev,
              [selectedLineUserId]:{
                line_user_id:selectedLineUserId,
                display_name:p.displayName||prev[selectedLineUserId]?.display_name||null,
                picture_url:p.pictureUrl||prev[selectedLineUserId]?.picture_url||null,
              }
            }));
          }
        }
      }catch{
        // Non-blocking background fetch
      }
    })();
  },[selectedLineUserId,db]);

  const unreadByUser = useMemo(() => countUnreadLineByUser(messages), [messages]);
  const totalUnread = useMemo(() => countUnreadLineMessages(messages), [messages]);

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;
  useEffect(() => {
    if (hasLoadedRef.current) {
      onUnreadCountChangeRef.current?.(totalUnread);
    }
  }, [totalUnread]);

  const markConversationRead = async (lineUserId: string) => {
    if (!db || !lineUserId) return;
    const hasUnread = messagesRef.current.some(
      (m) => m.line_user_id === lineUserId && isLineMessageUnread(m),
    );
    if (!hasUnread) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.line_user_id === lineUserId && isLineMessageUnread(m)
          ? { ...m, status: 'read' }
          : m,
      ),
    );

    try {
      await db
        .from('line_inbox_messages')
        .update({ status: 'read' })
        .eq('line_user_id', lineUserId)
        .eq('direction', 'inbound')
        .neq('status', 'read');
    } catch {
      // non-blocking
    }
  };

  const markAllAsRead = async () => {
    if (!db || totalUnread === 0) return;
    setMessages((prev) =>
      prev.map((m) => (isLineMessageUnread(m) ? { ...m, status: 'read' } : m)),
    );
    try {
      await db
        .from('line_inbox_messages')
        .update({ status: 'read' })
        .eq('direction', 'inbound')
        .neq('status', 'read');
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (!selectedLineUserId || document.hidden) return;
    if ((unreadByUser.get(selectedLineUserId) || 0) > 0) {
      void markConversationRead(selectedLineUserId);
    }
  }, [selectedLineUserId, unreadByUser]);

  const conversations=useMemo(()=>{
    const grouped=new Map<string,InboxMessage[]>();
    messages.forEach(message=>{
      const list=grouped.get(message.line_user_id);
      if(list)list.push(message);else grouped.set(message.line_user_id,[message]);
    });
    return [...grouped.entries()].map(([lineUserId,items])=>({
      lineUserId,
      unreadCount: unreadByUser.get(lineUserId) || 0,
      items:items.sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at)),
    }))
      .sort((a,b)=>Date.parse(b.items[b.items.length-1]?.received_at||'')-Date.parse(a.items[a.items.length-1]?.received_at||''));
  },[messages, unreadByUser]);

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
    let {error:e}=await db.from('line_auto_reply_rules').insert({owner_id:ownerId,name:ruleName.trim(),match_mode:matchMode,match_text:matchText.trim(),reply_text:replyType==='text'?String(replyPayload.text||''):JSON.stringify(replyPayload),reply_type:replyType,reply_payload:replyPayload,tag_id:tagId||null,priority:rules.length*10+100,enabled:true});
    if(e && (e.message?.includes('reply_payload') || e.code === 'PGRST204' || e.message?.includes('schema cache'))){
      const fb = await db.from('line_auto_reply_rules').insert({owner_id:ownerId,name:ruleName.trim(),match_mode:matchMode,match_text:matchText.trim(),reply_text:replyType==='text'?String(replyPayload.text||''):JSON.stringify(replyPayload),tag_id:tagId||null,priority:rules.length*10+100,enabled:true});
      e = fb.error;
    }
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
  const conversationContactId =
    activeConversation?.items.find((m) => Boolean(m.contact_id))?.contact_id ||
    (selectedLineUserId ? contactsByLineUser[selectedLineUserId] : undefined) ||
    undefined;

  if (chatOnly) {
    return (
      <div className="space-y-4">
        {/* すっきりとした単一のツールバー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <span className={`inline-block w-2 h-2 rounded-full ${integration ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{integration ? 'LINE公式連携中' : 'LINE公式未連携'}</span>
              {integration && (
                <span className="text-slate-400 font-mono text-[11px] hidden md:inline">({integration.bot_user_id})</span>
              )}
            </div>
            {!integration && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void connect()}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                連携を再確認
              </button>
            )}
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-medium">
              チャット履歴 <span className="font-semibold text-slate-800">{conversations.length}名</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              totalUnread > 0
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              <span>未読 {totalUnread}件</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>リアルタイム受信中（自動更新）</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
              title="最新メッセージを再読み込み"
            >
              更新
            </button>
            {onNavigateContacts && (
              <button
                type="button"
                onClick={onNavigateContacts}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition cursor-pointer"
              >
                <span>友だち・タグ管理</span>
              </button>
            )}
            {onNavigateSettings && (
              <button
                type="button"
                onClick={onNavigateSettings}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <span>自動返信・設定</span>
              </button>
            )}
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{notice}</p>}

        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>受信した友だち ({conversations.length}名)</span>
                {totalUnread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                    未読 {totalUnread}
                  </span>
                )}
              </h3>
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer shrink-0"
                  title="すべての未読LINEメッセージを既読にします"
                >
                  すべて既読
                </button>
              )}
            </div>
            <div className="mt-3 max-h-[560px] space-y-1.5 overflow-auto">
              {conversations.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">メッセージ履歴はありません。</p>
              ) : (
                conversations.map((conversation) => {
                  const lastMsg = conversation.items[conversation.items.length - 1];
                  const isSelected = selectedLineUserId === conversation.lineUserId;
                  const friend = friends[conversation.lineUserId];
                  const displayName = friend?.display_name || conversation.lineUserId;
                  const hasCustomName = Boolean(friend?.display_name);
                  const unreadCount = conversation.unreadCount;

                  return (
                    <button
                      key={conversation.lineUserId}
                      type="button"
                      onClick={() => {
                        setSelectedLineUserId(conversation.lineUserId);
                        void markConversationRead(conversation.lineUserId);
                      }}
                      className={`w-full rounded-xl p-3 text-left transition cursor-pointer border flex items-start gap-3 ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-1 ring-emerald-300/40'
                          : unreadCount > 0
                            ? 'bg-white border-emerald-200 hover:bg-emerald-50/40 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {friend?.picture_url ? (
                          <img
                            src={friend.picture_url}
                            alt={displayName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200 shadow-2xs">
                            {(displayName[0] || 'L').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`truncate text-xs ${unreadCount > 0 ? 'font-bold text-slate-950' : 'font-bold text-slate-800'}`}>
                            {displayName}
                          </span>
                          <span className={`text-[10px] shrink-0 ${unreadCount > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                            {new Date(lastMsg?.received_at || '').toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {hasCustomName && (
                          <div className="truncate text-[10px] font-mono text-slate-400">
                            {conversation.lineUserId}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className={`truncate text-xs ${unreadCount > 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            {lastMsg?.body || '（本文なし）'}
                          </div>
                          {unreadCount > 0 && (
                            <span
                              aria-label={`未読 ${unreadCount}件`}
                              className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-2xs"
                            >
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col min-h-[460px] shadow-xs">
            <h3 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2.5 flex items-center justify-between">
              <span className="text-slate-600">チャット履歴</span>
              {selectedLineUserId && (() => {
                const activeFriend = friends[selectedLineUserId];
                const activeName = activeFriend?.display_name || selectedLineUserId;
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 max-w-[240px]">
                      {activeFriend?.picture_url ? (
                        <img
                          src={activeFriend.picture_url}
                          alt={activeName}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {(activeName[0] || 'L').toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {activeName}
                      </span>
                      {activeFriend?.display_name && (
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          ({selectedLineUserId.slice(0, 8)}...)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!conversationContactId}
                      title={!conversationContactId ? '連絡先に紐づいていないため送れません' : 'このLINE友だちにフォーム案内を送信します'}
                      onClick={() => {
                        if (conversationContactId) {
                          openSendDrawer({ channel: 'line', kind: 'form', contactId: conversationContactId });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      <span>フォームを送る</span>
                    </button>
                  </div>
                );
              })()}
            </h3>

            {!activeConversation ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                左の一覧から友だちを選択して会話を表示してください。
              </div>
            ) : (
              <>
                <div className="mt-3 flex-1 max-h-[460px] space-y-2.5 overflow-auto rounded-xl bg-slate-50 p-4 border border-slate-200">
                  {activeConversation.items.map((message) => {
                    const activeFriend = friends[selectedLineUserId];
                    const isOutbound = message.direction === 'outbound';
                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isOutbound && (
                          <div className="shrink-0 mt-0.5">
                            {activeFriend?.picture_url ? (
                              <img
                                src={activeFriend.picture_url}
                                alt="LINE Friend"
                                className="w-6 h-6 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">
                                L
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                            isOutbound
                              ? 'bg-emerald-600 text-white rounded-br-none'
                              : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'
                          }`}
                        >
                          <div className="whitespace-pre-wrap leading-relaxed">{message.body}</div>
                          <div className={`mt-1 text-[10px] text-right ${isOutbound ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {new Date(message.received_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                <div className="mt-3 flex items-end gap-2 pt-2 border-t border-slate-200">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={2}
                    maxLength={5000}
                    placeholder="LINE返信メッセージを入力…"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                  <button
                    disabled={busy || !replyDraft.trim()}
                    type="button"
                    onClick={() => void sendReply()}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? '送信中…' : '返信'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">LINE運用</h2>
            <p className="mt-1 text-sm text-slate-500">受信箱・自動返信と、テキスト・画像・Flex・動画テンプレートを管理します。</p>
          </div>
          <button onClick={() => void load()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer">
            更新
          </button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="text-sm font-medium text-slate-700">{integration ? 'LINE連携済み' : 'LINEアカウント未関連付け'}</span>
          {integration && <span className="text-xs text-slate-500">Bot ID: {integration.bot_user_id}</span>}
          <button disabled={busy} onClick={() => void connect()} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
            {integration ? '接続を更新' : 'LINEアカウントを接続'}
          </button>
          {integration && (
            <button onClick={() => void toggleAutoReply()} className={'rounded px-3 py-1.5 text-xs font-semibold cursor-pointer ' + (integration.auto_reply_enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700')}>
              自動返信：{integration.auto_reply_enabled ? '有効' : '停止中'}
            </button>
          )}
        </div>
      </section>

      <nav className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveView('inbox')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${activeView === 'inbox' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          受信箱・自動返信
        </button>
        <button
          type="button"
          onClick={() => setActiveView('templates')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${activeView === 'templates' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          テンプレート管理（{templates.length}）
        </button>
      </nav>

      {activeView === 'inbox' && (
        <>
          <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <span>受信した相手</span>
                  {totalUnread > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                      未読 {totalUnread}件
                    </span>
                  )}
                </h3>
                {totalUnread > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    すべて既読
                  </button>
                )}
              </div>
              <div className="mt-3 max-h-[560px] space-y-1 overflow-auto">
                {conversations.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Webhookで受信したメッセージはここに表示されます。</p>
                ) : (
                  conversations.map((conversation) => {
                    const friend = friends[conversation.lineUserId];
                    const displayName = friend?.display_name || conversation.lineUserId;
                    const unreadCount = conversation.unreadCount;
                    return (
                      <button
                        key={conversation.lineUserId}
                        onClick={() => {
                          setSelectedLineUserId(conversation.lineUserId);
                          void markConversationRead(conversation.lineUserId);
                        }}
                        className={'w-full rounded-lg p-3 text-left transition cursor-pointer border ' + (selectedLineUserId === conversation.lineUserId ? 'bg-purple-50 border-purple-200 shadow-xs' : 'border-transparent hover:bg-slate-50')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-xs font-semibold text-slate-600">{displayName}</div>
                          {unreadCount > 0 && (
                            <span
                              aria-label={`未読 ${unreadCount}件`}
                              className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold"
                            >
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <div className={`truncate text-sm mt-0.5 ${unreadCount > 0 ? 'font-bold text-slate-950' : 'font-medium text-slate-800'}`}>{conversation.items[conversation.items.length - 1]?.body || '（本文なし）'}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{new Date(conversation.items[conversation.items.length - 1]?.received_at || '').toLocaleString()}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="font-bold text-slate-900">会話</h3>
                {activeConversation && (
                  <button
                    type="button"
                    disabled={!conversationContactId}
                    title={!conversationContactId ? '連絡先に紐づいていないため送れません' : 'このLINE友だちにフォーム案内を送信します'}
                    onClick={() => {
                      if (conversationContactId) {
                        openSendDrawer({ channel: 'line', kind: 'form', contactId: conversationContactId });
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span>フォームを送る</span>
                  </button>
                )}
              </div>
              {!activeConversation ? (
                <p className="mt-4 text-sm text-slate-400">左から相手を選択してください。</p>
              ) : (
                <>
                  <div className="mt-3 max-h-[420px] space-y-2 overflow-auto rounded-xl bg-slate-50 p-4 border border-slate-200">
                    {activeConversation.items.map((message) => (
                      <div
                        key={message.id}
                        className={'max-w-[85%] rounded-xl px-4 py-2 text-sm ' + (message.direction === 'outbound' ? 'ml-auto bg-emerald-600 text-white' : 'bg-white text-slate-900 border border-slate-200 shadow-xs')}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{message.body}</div>
                        <div className={`mt-1 text-[10px] ${message.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {new Date(message.received_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={2}
                      maxLength={5000}
                      placeholder="LINE返信を入力"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-xs"
                    />
                    <button
                      disabled={busy || !replyDraft.trim()}
                      onClick={() => void sendReply()}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40 shadow-xs transition cursor-pointer"
                    >
                      返信
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="font-bold text-slate-900">回答に応じたタグ付け・自動返信</h3>
            <p className="mt-1 text-xs text-slate-500">Flex Messageのボタンをメッセージアクションにすると、押された選択文字を条件にできます。最初に一致したルールの返信とタグを適用します。</p>
            <form onSubmit={saveRule} className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="ルール名（例：経営改善の相談）" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none" />
              <select value={matchMode} onChange={(e) => setMatchMode(e.target.value as 'exact' | 'contains')} className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none">
                <option value="exact">完全一致</option>
                <option value="contains">含む</option>
              </select>
              <input value={matchText} onChange={(e) => setMatchText(e.target.value)} placeholder="ボタンから届く選択文字" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none" />
              <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none">
                <option value="">タグを付けない</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTemplateId(id);
                  const selected = templates.find((item) => item.id === id);
                  if (selected) {
                    setReplyType(selected.reply_type);
                    setReplyPayload(selected.payload || {});
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 md:col-span-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="">返信テンプレートを選択</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.reply_type === 'text' ? 'テキスト' : template.reply_type === 'image' ? '画像' : template.reply_type === 'video' ? '動画' : 'Flex'}：{template.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 md:col-span-2">テンプレートは「テンプレート管理」タブで作成・アップロードできます。</p>
              <div className="md:col-span-2">
                <LineMessagePreview type={replyType} title="返信ルールの送信内容" payload={replyPayload} text={replyText} />
              </div>
              <button disabled={busy || !integration} className="rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 md:col-span-2 shadow-xs transition cursor-pointer">
                {busy ? '保存中…' : '自動返信ルールを保存'}
              </button>
              {!integration && <p className="text-xs text-amber-700 md:col-span-2">LINEアカウントを接続すると保存できます。上部の「LINEアカウントを接続」を先に実行してください。</p>}
            </form>
            <div className="mt-4 divide-y divide-slate-100">
              {rules.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">{rule.name}</div>
                    <div className="text-xs text-slate-500">{rule.match_mode === 'exact' ? '完全一致' : '含む'}：「{rule.match_text}」 · {tags.find((tag) => tag.id === rule.tag_id)?.name || 'タグなし'}</div>
                    <div className="whitespace-pre-wrap text-xs text-slate-600 mt-1">{rule.reply_type === 'image' ? '画像メッセージ' : rule.reply_type === 'video' ? '動画メッセージ' : rule.reply_type === 'flex' ? 'Flexメッセージ' : rule.reply_text}</div>
                    <LineMessagePreview type={rule.reply_type || 'text'} title={rule.name} payload={rule.reply_payload || { text: rule.reply_text }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void toggleRule(rule)} className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
                      {rule.enabled ? '停止' : '有効化'}
                    </button>
                    <InlineDeleteButton onConfirm={() => void deleteRule(rule)} warning={`「${rule.name}」を削除しますか？`}>
                      削除
                    </InlineDeleteButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeView === 'templates' && (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h3 className="font-bold text-slate-900">返信テンプレートの管理</h3>
            <p className="mt-1 text-xs text-slate-500">テキスト・画像・Flex・動画のテンプレートを作成し、自動返信ルールから選択できます。画像・動画ファイルはここからアップロードします（各20MBまで）。</p>
          </div>
          <form onSubmit={saveTemplate} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input required value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="テンプレート名" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none" />
              <select value={templateType} onChange={(e) => setTemplateType(e.target.value as 'text' | 'image' | 'flex' | 'video')} className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none">
                <option value="text">テキスト</option>
                <option value="image">画像</option>
                <option value="flex">Flex</option>
                <option value="video">動画</option>
              </select>
              {templateType === 'text' && <textarea value={templateText} onChange={(e) => setTemplateText(e.target.value)} rows={4} placeholder="返信テキスト" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 md:col-span-2 focus:border-purple-500 focus:outline-none" />}
              {templateType === 'image' && (
                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <label className="space-y-1.5 text-xs text-slate-700 font-medium">画像本体（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async (e) => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; setBusy(true); setError(''); try { const asset = await uploadLineTemplateAsset(file, 'image'); setTemplateImageUrl(asset.url); setTemplateImagePath(asset.path); setNotice('画像をアップロードしました。'); } catch (err: any) { setError(err.message); } finally { setBusy(false); input.value = ''; } }} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>
                  <label className="space-y-1.5 text-xs text-slate-700 font-medium">プレビュー画像（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async (e) => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; setBusy(true); setError(''); try { const asset = await uploadLineTemplateAsset(file, 'image'); setTemplatePreviewUrl(asset.url); setTemplatePreviewPath(asset.path); setNotice('プレビュー画像をアップロードしました。'); } catch (err: any) { setError(err.message); } finally { setBusy(false); input.value = ''; } }} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>
                  {(templateImageUrl || templatePreviewUrl) && (
                    <div className="flex gap-3 md:col-span-2">
                      {templateImageUrl && <img src={templateImageUrl} alt="画像本体のプレビュー" className="h-24 rounded border border-slate-200 object-contain bg-white" />}
                      {templatePreviewUrl && <img src={templatePreviewUrl} alt="プレビュー画像" className="h-24 rounded border border-slate-200 object-contain bg-white" />}
                    </div>
                  )}
                </div>
              )}
              {templateType === 'video' && (
                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <label className="space-y-1.5 text-xs text-slate-700 font-medium">動画本体（MP4）<input type="file" accept="video/mp4" disabled={busy} onChange={async (e) => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; setBusy(true); setError(''); try { const asset = await uploadLineTemplateAsset(file, 'video'); setTemplateVideoUrl(asset.url); setTemplateVideoPath(asset.path); setNotice('動画をアップロードしました。'); } catch (err: any) { setError(err.message); } finally { setBusy(false); input.value = ''; } }} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>
                  <label className="space-y-1.5 text-xs text-slate-700 font-medium">動画プレビュー画像（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async (e) => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; setBusy(true); setError(''); try { const asset = await uploadLineTemplateAsset(file, 'image'); setTemplatePreviewUrl(asset.url); setTemplatePreviewPath(asset.path); setNotice('プレビュー画像をアップロードしました。'); } catch (err: any) { setError(err.message); } finally { setBusy(false); input.value = ''; } }} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>
                  {templateVideoUrl && <video src={templateVideoUrl} controls className="h-32 rounded border border-slate-200 md:col-span-2 bg-black" />}
                  <input value={templateAltText} onChange={(e) => setTemplateAltText(e.target.value)} maxLength={400} placeholder="通知に表示する動画の代替テキスト" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 md:col-span-2 focus:border-purple-500 focus:outline-none" />
                </div>
              )}
              {templateType === 'flex' && (
                <div className="grid gap-3 md:col-span-2">
                  <input value={templateAltText} onChange={(e) => setTemplateAltText(e.target.value)} maxLength={1500} placeholder="通知に表示する代替テキスト" className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none" />
                  <textarea value={templateFlexJson} onChange={(e) => setTemplateFlexJson(e.target.value)} rows={10} placeholder='Flex本文 JSON（bubble / carousel）' className="rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 focus:border-purple-500 focus:outline-none" />
                  <p className="text-xs text-slate-500">ボタンでルールにつなぐ場合は action.type を message にしてください。</p>
                </div>
              )}
            </div>
            <LineMessagePreview type={templateType} title={templateName || '自動返信テンプレート'} payload={templateType === 'text' ? { text: templateText } : templateType === 'image' ? { originalContentUrl: templateImageUrl, previewImageUrl: templatePreviewUrl } : templateType === 'video' ? { originalContentUrl: templateVideoUrl, previewImageUrl: templatePreviewUrl, altText: templateAltText } : { altText: templateAltText, contents: templateFlexJson }} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetTemplateEditor} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
                新規作成に戻す
              </button>
              <button type="submit" disabled={busy || !ownerId} className="rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 shadow-xs transition cursor-pointer">
                {busy ? '保存中…' : editingTemplateId ? 'テンプレートを更新' : 'テンプレートを保存'}
              </button>
            </div>
          </form>
          <div className="divide-y divide-slate-100">
            {templates.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">テンプレートはまだありません。</p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">{template.name}</div>
                    <div className="text-xs text-slate-500">{template.reply_type === 'text' ? 'テキスト' : template.reply_type === 'image' ? '画像' : template.reply_type === 'video' ? '動画' : 'Flex'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editTemplate(template)} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer">
                      編集
                    </button>
                    <InlineDeleteButton onConfirm={() => deleteTemplate(template)} warning={`テンプレート「${template.name}」を削除しますか？素材ファイルも削除されます。`}>
                      削除
                    </InlineDeleteButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
