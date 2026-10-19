import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';

type Contact = { id:string; full_name:string|null; email:string|null; line_user_id:string|null; company_id:string|null };
type CrmRecord = Record<string, unknown> & { id?: string; company_id?: string | null; contact_id?: string | null; lead_id?: string | null };
type Segment = { id:string; name:string; entity_type:string; conditions:Record<string,unknown> };
const segmentEntityLabels:Record<string,string>={contacts:'連絡先',companies:'会社',prospects:'見込み企業',leads:'リード',deals:'商談',customers:'顧客'};
type Friend = { line_user_id:string; status:string; consent_status:string };
type Run = { id:string; name:string; channel:string; status:string; total_count:number; sent_count:number; failed_count:number; created_at:string };
type OutboxHistoryRow = { source_id:string|null; channel:string; status:string; subject:string|null; body_text:string; created_at:string };
type Channel = 'email'|'line';
function summarizeBroadcastHistory(rows:OutboxHistoryRow[]):Run[]{
  const grouped=new Map<string,{id:string;name:string;channel:string;created_at:string;total_count:number;sent_count:number;failed_count:number;pending_count:number}>();
  rows.forEach(row=>{if(!row.source_id)return;const current=grouped.get(row.source_id)||{id:row.source_id,name:row.subject||row.body_text.slice(0,40)||'一斉配信',channel:row.channel,created_at:row.created_at,total_count:0,sent_count:0,failed_count:0,pending_count:0};current.total_count+=1;if(row.status==='sent')current.sent_count+=1;else if(row.status==='failed')current.failed_count+=1;else current.pending_count+=1;if(Date.parse(row.created_at)<Date.parse(current.created_at))current.created_at=row.created_at;grouped.set(row.source_id,current)});
  return [...grouped.values()].map(run=>({...run,status:run.pending_count?'sending':run.failed_count===0?'sent':run.sent_count===0?'failed':'partial'})).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,30)
}

export const MarketingBroadcastView: React.FC<{initialChannel?:Channel}> = ({initialChannel}) => {
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [segments,setSegments]=useState<Segment[]>([]);
  const [friends,setFriends]=useState<Record<string,Friend>>({});
  const [runs,setRuns]=useState<Run[]>([]);
  const [companies,setCompanies]=useState<Record<string,Record<string,unknown>>>({});
  const [prospects,setProspects]=useState<CrmRecord[]>([]);
  const [leads,setLeads]=useState<CrmRecord[]>([]);
  const [deals,setDeals]=useState<CrmRecord[]>([]);
  const [customers,setCustomers]=useState<CrmRecord[]>([]);
  const [channel,setChannel]=useState<Channel>(initialChannel||'email');
  const [segmentId,setSegmentId]=useState('all');
  const [selected,setSelected]=useState<string[]>([]);
  const [audienceMode,setAudienceMode]=useState<'crm'|'prospect_outreach'>('crm');
  const [selectedProspectIds,setSelectedProspectIds]=useState<string[]>([]);
  const [subject,setSubject]=useState('');
  const [body,setBody]=useState('');
  const [lineContentType,setLineContentType]=useState<'text'|'video'>('text');
  const [videoUrl,setVideoUrl]=useState('');
  const [videoPreviewUrl,setVideoPreviewUrl]=useState('');
  const [consentBasis,setConsentBasis]=useState('');
  const [preview,setPreview]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const db=getSupabase();
  useEffect(()=>{
    let active=true;
    if(!db)return;
    void Promise.all([
      db.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name').limit(5000),
      db.from('crm_segments').select('id,name,entity_type,conditions').order('name'),
      db.from('line_friends').select('line_user_id,status,consent_status'),
      db.from('companies').select('*'),
      db.from('prospects').select('*'),
      db.from('leads').select('*'),
      db.from('deals').select('*'),
      db.from('customers').select('*'),
      db.from('communication_outbox').select('source_id,channel,status,subject,body_text,created_at').in('source_type',['marketing_broadcast','marketing_outreach','marketing_automation']).order('created_at',{ascending:false}).limit(1000),
    ]).then(([c,s,f,co,p,l,d,cu,h])=>{
      if(!active)return;
      const failed=[c,s,f,co,p,l,d,cu,h].find(x=>x.error)?.error;
      if(failed){setError(failed.message);return}
      setContacts((c.data||[]) as Contact[]);
      setSegments((s.data||[]) as Segment[]);
      setFriends(Object.fromEntries((f.data||[]).map((x:any)=>[x.line_user_id,x])));
      setCompanies(Object.fromEntries((co.data||[]).map((x:any)=>[x.id,x])));
      setProspects((p.data||[]) as CrmRecord[]);
      setLeads((l.data||[]) as CrmRecord[]);
      setDeals((d.data||[]) as CrmRecord[]);
      setCustomers((cu.data||[]) as CrmRecord[]);
      setRuns(summarizeBroadcastHistory((h.data||[]) as OutboxHistoryRow[]));
    }).catch(e=>active&&setError(e.message||'一斉配信の読み込みに失敗しました。'));
    return()=>{active=false}
  },[]);

  const selectedSegment = segments.find(x=>x.id===segmentId);
  const outreachProspects = prospects.filter(row=>Boolean(row.company_id&&companies[String(row.company_id)]&&String(row.source||'').includes('外部AI調査')));
  const selectedOutreachCompanies = new Set(outreachProspects.filter(row=>selectedProspectIds.includes(String(row.id||''))).map(row=>String(row.company_id||'')));
  const eligible = useMemo(()=>{
    let rows=contacts;
    if(audienceMode==='prospect_outreach'){
      if(channel!=='email')return [];
      rows=contacts.filter(row=>Boolean(row.company_id&&selectedOutreachCompanies.has(row.company_id)));
    }
    const segment=audienceMode==='crm'?selectedSegment:undefined;
    if(segment){
      const field=typeof segment.conditions?.field==='string'?segment.conditions.field:'';
      const value=String(segment.conditions?.value||'').trim().toLowerCase();
      const matches=(row:Record<string,unknown>)=>!field||String(row[field]??'').toLowerCase().includes(value);
      if(segment.entity_type==='contacts'){
        rows=contacts.filter(row=>matches(row as unknown as Record<string,unknown>));
      }else if(segment.entity_type==='companies'){
        const companyIds=new Set(Object.values(companies).filter(matches).map(x=>String(x.id||'')));
        rows=contacts.filter(row=>Boolean(row.company_id&&companyIds.has(row.company_id)));
      }else if(segment.entity_type==='prospects'){
        const companyIds=new Set(prospects.filter(row=>matches(row)).map(row=>String(row.company_id||'')));
        rows=contacts.filter(row=>Boolean(row.company_id&&companyIds.has(row.company_id)));
      }else if(segment.entity_type==='customers'){
        const companyIds=new Set(customers.filter(row=>matches(row)).map(row=>String(row.company_id||'')));
        rows=contacts.filter(row=>Boolean(row.company_id&&companyIds.has(row.company_id)));
      }else if(segment.entity_type==='leads'){
        const contactIds=new Set(leads.filter(row=>matches(row)).map(row=>String(row.contact_id||'')).filter(Boolean));
        rows=contacts.filter(row=>contactIds.has(row.id));
      }else if(segment.entity_type==='deals'){
        const leadIds=new Set(deals.filter(row=>matches(row)).map(row=>String(row.lead_id||'')).filter(Boolean));
        const contactIds=new Set(leads.filter(row=>leadIds.has(String(row.id||''))).map(row=>String(row.contact_id||'')).filter(Boolean));
        rows=contacts.filter(row=>contactIds.has(row.id));
      }else{
        rows=[];
      }
    }
    return rows.filter(row=>channel==='email'
      ? Boolean(row.email)
      : Boolean(row.line_user_id&&friends[row.line_user_id]?.status==='active'&&friends[row.line_user_id]?.consent_status==='opted_in'));
  },[contacts,selectedSegment,companies,prospects,leads,deals,customers,channel,friends,audienceMode,selectedProspectIds]);

  const refreshRuns=async()=>{
    if(!db)return;
    const {data,error:e}=await db.from('communication_outbox').select('source_id,channel,status,subject,body_text,created_at').in('source_type',['marketing_broadcast','marketing_outreach']).order('created_at',{ascending:false}).limit(1000);if(e)setError(e.message);else setRuns(summarizeBroadcastHistory((data||[]) as OutboxHistoryRow[]));
  };
  const selectAll=()=>setSelected(eligible.map(x=>x.id));
  const clearSelected=()=>setSelected([]);
  const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const selectedContacts=eligible.filter(x=>selected.includes(x.id));

  const send=async()=>{
    if(!db||busy)return;
    setError('');setNotice('');
    const recipients=selectedContacts;
    if(!recipients.length){setError('送信対象がありません。対象を確認してください。');return}
    if(recipients.length>250){setError('一度に送信できる上限は250件です。対象を絞ってください。');return}
    if(!consentBasis.trim()){setError('配信同意・送信根拠を入力してください。');return}
    if(channel==='email'&&!subject.trim()){setError('メール件名を入力してください。');return}
    if(channel==='line'&&lineContentType==='video'){
      const isHttps=(value:string)=>{try{return new URL(value).protocol==='https:'}catch{return false}};
      if(!isHttps(videoUrl)||!isHttps(videoPreviewUrl)){setError('動画とプレビュー画像は公開HTTPS URLを指定してください。');return}
      if(videoUrl.length>2000||videoPreviewUrl.length>2000){setError('動画URLとプレビュー画像URLは2000文字以内にしてください。');return}
    }else if(!body.trim()){setError('配信本文を入力してください。');return}
    setBusy(true);
    try{
      const {data:sessionResult}=await db.auth.getSession();
      const session=sessionResult.session;
      if(!session?.access_token||!session.user){throw new Error('ログイン状態を確認できません。')}
      const broadcastId=crypto.randomUUID();
      const rows=recipients.map(contact=>({
        channel,recipient_contact_id:contact.id,recipient_address:channel==='email'?contact.email:contact.line_user_id,
        subject:channel==='email'?subject.trim():null,
        body_text:channel==='line'&&lineContentType==='video'?'動画を送信: '+videoUrl.trim():body.trim(),
        line_message_payload:channel==='line'&&lineContentType==='video'?{type:'video',originalContentUrl:videoUrl.trim(),previewImageUrl:videoPreviewUrl.trim()}:null,
        company_id:contact.company_id||null,source_type:audienceMode==='prospect_outreach'?'marketing_outreach':'marketing_broadcast',source_id:broadcastId,status:'queued',
        consent_confirmed_at:new Date().toISOString(),consent_basis:consentBasis.trim(),
      }));
      const {data:outbox,error:insertError}=await db.from('communication_outbox').insert(rows).select('id,recipient_contact_id');
      if(insertError||!outbox)throw insertError||new Error('送信待ち記録を作成できませんでした。');
      let sent=0,failed=0;
      for(let offset=0;offset<outbox.length;offset+=4){
        const batch=outbox.slice(offset,offset+4);
        const results=await Promise.all(batch.map(async(row:any)=>{
          try{
            const response=await fetch('/api/communications/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({outboxId:row.id})});
            const result=await response.json().catch(()=>({}));
            return response.ok&&result.status==='sent';
          }catch{return false}
        }));
        sent+=results.filter(Boolean).length;failed+=results.length-results.filter(Boolean).length;
      }
      setNotice('配信を完了しました。送信済み '+sent+'件、失敗 '+failed+'件。個別結果と配信履歴は既存の送信記録に保存されています。');
      setSelected([]);setPreview(false);await refreshRuns();
    }catch(e:any){setError(e?.message||'一斉配信に失敗しました。')}
    finally{setBusy(false)}
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
      <h2 className="text-xl font-bold text-white">{channel==='email'?'メール送信・営業':'LINE一斉配信'}</h2>
      <p className="mt-1 text-sm text-slate-400">CRM条件から対象を抽出したフォロー配信と、外部AI調査からCRMへ登録した見込み企業への営業メールを管理します。宛先選択・プレビュー後に既存の送信処理を使い、結果を履歴に記録します。</p>
      {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
      {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-300">配信対象の種類
          <select value={audienceMode} onChange={e=>{setAudienceMode(e.target.value as 'crm'|'prospect_outreach');setSelected([]);setSelectedProspectIds([]);setPreview(false);if(e.target.value==='prospect_outreach')setChannel('email')}} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white">
            <option value="crm">CRM条件によるフォロー</option><option value="prospect_outreach" disabled={initialChannel==='line'}>見込み企業への営業メール</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">配信方法
          <select value={channel} disabled={Boolean(initialChannel)} onChange={e=>{setChannel(e.target.value as Channel);setSelected([]);setPreview(false)}} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white">
            <option value="email">メール</option><option value="line" disabled={audienceMode==='prospect_outreach'}>LINE（配信同意済みのみ）</option>
          </select>
        </label>
        {audienceMode==='crm'&&<label className="text-sm text-slate-300">CRM対象
          <select value={segmentId} onChange={e=>{setSegmentId(e.target.value);setSelected([]);setPreview(false)}} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white">
            <option value="all">全連絡先から抽出</option>
            {segments.map(x=><option key={x.id} value={x.id}>{x.name}（{segmentEntityLabels[x.entity_type]||x.entity_type}）</option>)}
          </select>
        </label>}
      </div>
      {audienceMode==='prospect_outreach'&&<section className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
        <div className="font-semibold text-white">営業対象の見込み企業を選択</div>
        <p className="mt-1 text-xs text-slate-400">外部AI調査からCRMへ登録した見込み企業だけを表示します。AIは送信せず、選択企業に紐づく連絡先のメールアドレスだけを宛先候補にします。見込み企業に連絡先が紐づいていない場合は送信対象になりません。</p>
        <div className="mt-3 max-h-48 space-y-1 overflow-auto">{outreachProspects.length===0?<p className="text-sm text-slate-500">会社情報と関連付いた見込み企業がありません。</p>:outreachProspects.map(row=>{const company=companies[String(row.company_id||'')]||{};const id=String(row.id||'');return <label key={id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900"><input type="checkbox" checked={selectedProspectIds.includes(id)} onChange={()=>{setSelectedProspectIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);setSelected([]);setPreview(false)}}/><span className="min-w-0 flex-1 truncate">{String(company.company_name||company.name||'会社名未設定')}</span><span className="text-xs text-slate-500">{String(row.status||'未設定')}</span></label>})}</div>
        <p className="mt-2 text-xs text-amber-200">営業メールの送信根拠と、宛先情報を営業目的で利用できることを確認してください。</p>
      </section>}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="font-semibold text-white">送信対象</div><div className="text-xs text-slate-400">{audienceMode==='crm'&&selectedSegment?`「${selectedSegment.name}」の条件から抽出：`:'条件に合う宛先：'}{eligible.length}件・選択中 {selectedContacts.length}件</div></div>
          <div className="flex gap-2"><button type="button" onClick={selectAll} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200">対象をすべて選択</button><button type="button" onClick={clearSelected} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300">解除</button></div>
        </div>
        <div className="mt-3 max-h-52 space-y-1 overflow-auto">
          {eligible.length===0?<p className="text-sm text-slate-500">{audienceMode==='prospect_outreach'?'選択した企業にメールアドレス付きの連絡先が登録されていません。連絡先を登録して会社に紐づけてください。':'対象となる連絡先がありません。LINEは有効な友だちかつ配信同意済みの連絡先だけ表示されます。'}</p>:eligible.map(contact=><label key={contact.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900">
            <input type="checkbox" checked={selected.includes(contact.id)} onChange={()=>toggle(contact.id)} />
            <span className="min-w-0 flex-1 truncate">{contact.full_name||'名前未設定'}</span>
            <span className="max-w-56 truncate text-xs text-slate-500">{channel==='email'?contact.email:contact.line_user_id}</span>
          </label>)}
        </div>
      </div>
      {channel==='email'&&<label className="block text-sm text-slate-300">メール件名<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={200} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>}
      {channel==='line'&&<label className="block text-sm text-slate-300">LINEメッセージ形式<select value={lineContentType} onChange={e=>setLineContentType(e.target.value as 'text'|'video')} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="text">テキスト</option><option value="video">動画（MP4）</option></select></label>}
      {(channel==='email'||lineContentType==='text')&&<label className="block text-sm text-slate-300">配信本文<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={channel==='line'?5000:10000} rows={6} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" />{channel==='email'&&<span className="mt-1 block text-xs text-slate-500">動画は公開リンクを本文に貼り付けて送信できます。</span>}</label>}
      {channel==='line'&&lineContentType==='video'&&<div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-slate-300">動画URL（公開HTTPS・MP4）<input type="url" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label><label className="text-sm text-slate-300">プレビュー画像URL（JPEG/PNG）<input type="url" value={videoPreviewUrl} onChange={e=>setVideoPreviewUrl(e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label><p className="text-xs text-slate-500 md:col-span-2">LINEの動画メッセージはMP4（200MB以下）とプレビュー画像（JPEG/PNG、1MB以下）が必要です。URLはLINEから取得できる公開HTTPS URLを指定してください。</p></div>}
      <label className="block text-sm text-slate-300">{audienceMode==='prospect_outreach'?'送信根拠・連絡先の取得元':'配信同意・送信根拠'}<input value={consentBasis} onChange={e=>setConsentBasis(e.target.value)} placeholder="例：配信登録フォームで同意取得済み" className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
      {!preview?<button type="button" disabled={!selectedContacts.length} onClick={()=>setPreview(true)} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-40">プレビュー</button>:<div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
        <h3 className="font-bold text-amber-100">配信プレビュー</h3>
        <p className="text-sm text-slate-300">{channel==='email'?'メール':'LINE'}・選択中 {selectedContacts.length}件。LINEでは友だち状態と配信同意を送信時にも再確認します。</p>
        <p className="text-xs text-slate-400">送信先例：{selectedContacts.slice(0,5).map(x=>x.full_name||x.email||x.line_user_id).join('、')}{selectedContacts.length>5?' ほか':''}</p>
        {channel==='email'&&<p className="font-semibold text-white">{subject}</p>}
        {channel==='line'&&lineContentType==='video'?<div className="rounded bg-slate-950 p-3 text-sm text-slate-200"><video src={videoUrl} poster={videoPreviewUrl} controls className="max-h-80 max-w-full rounded"/><p className="mt-2 text-xs text-slate-400">LINE動画メッセージのプレビュー</p></div>:<div className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-slate-200">{body}</div>}
        <div className="flex gap-2"><button type="button" onClick={()=>setPreview(false)} className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200">戻って修正</button><button type="button" disabled={busy} onClick={()=>void send()} className="rounded bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'配信中…':'この内容で配信'}</button></div>
      </div>}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between"><h3 className="font-bold text-white">一斉配信履歴</h3><button onClick={()=>void refreshRuns()} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300">更新</button></div>
      <div className="mt-3 divide-y divide-slate-800">{runs.length===0?<p className="py-4 text-sm text-slate-500">配信履歴はありません。</p>:runs.map(run=><div key={run.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><div className="font-medium text-white">{run.name}</div><div className="text-xs text-slate-500">{new Date(run.created_at).toLocaleString()} ・ {run.channel==='email'?'メール':'LINE'}</div></div><div className="text-right text-xs text-slate-300"><div>{run.status==='sent'?'完了':run.status==='partial'?'一部失敗':run.status==='failed'?'失敗':'配信中'}</div><div className="text-slate-500">{run.sent_count}/{run.total_count}件 成功・失敗 {run.failed_count}件</div></div></div>)}</div>
      <p className="mt-2 text-xs text-slate-500">個々の宛先・送信エラーは既存の送信センター履歴から確認できます。</p>
    </section>
  </div>;
};
