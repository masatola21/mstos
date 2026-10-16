import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { ManagedContract, ManagedInvoice } from '../types/matrix';
import { FileText, Plus, RefreshCw, Receipt, Wrench } from 'lucide-react';
import { DealInvitationPanel } from './DealInvitationPanel';

type WorkspaceTab = 'segments' | 'documents' | 'operations' | 'invitations';
type Segment = { id: string; name: string; entity_type: string; conditions: { field?: string; value?: string }; created_at: string };
type RecordRow = Record<string, any>;

const entityOptions = [
  ['companies', '会社'], ['contacts', '連絡先'], ['prospects', '見込み企業'],
  ['leads', 'リード'], ['deals', '商談'], ['customers', '顧客'],
] as const;
const opsTabs = [
  { key: 'contracts', label: '契約', table: 'customer_contracts', icon: FileText },
  { key: 'invoices', label: '請求', table: 'customer_invoices', icon: Receipt },
  { key: 'services', label: '顧問・構築支援', table: 'customer_service_engagements', icon: Wrench },
] as const;

interface Props { tab: WorkspaceTab; companyId?: string; leadId?: string; dealId?: string; onClearCompanyFilter?: () => void; onOperationalRecordsChange?: (contracts: ManagedContract[], invoices: ManagedInvoice[]) => void; }

export const SalesOperationsWorkspace: React.FC<Props> = ({ tab, companyId, leadId, dealId, onClearCompanyFilter, onOperationalRecordsChange }) => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [documents, setDocuments] = useState<RecordRow[]>([]);
  const [outbox, setOutbox] = useState<RecordRow[]>([]);
  const [contacts, setContacts] = useState<RecordRow[]>([]);
  const [companies, setCompanies] = useState<RecordRow[]>([]);
  const [sendContactId, setSendContactId] = useState('');
  const [sendChannel, setSendChannel] = useState<'email'|'line'>('email');
  const [sendDocumentId, setSendDocumentId] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBodyText, setSendBodyText] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentBasis, setConsentBasis] = useState('');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [activeOpsTab, setActiveOpsTab] = useState<(typeof opsTabs)[number]['key']>('contracts');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [entityType, setEntityType] = useState<string>('contacts');
  const [filterField, setFilterField] = useState('source');
  const [filterValue, setFilterValue] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordCompany, setRecordCompany] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [serviceType, setServiceType] = useState<'retainer'|'implementation_support'>('retainer');
  const [previewSegmentId, setPreviewSegmentId] = useState('');
  const [previewRows, setPreviewRows] = useState<RecordRow[]>([]);

  const selectedOps = opsTabs.find((item) => item.key === activeOpsTab) || opsTabs[0];

  const load = async () => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    setLoading(true); setError('');
    try {
      if (tab === 'segments') {
        const { data, error: queryError } = await supabase.from('crm_segments').select('*').order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setSegments((data || []) as Segment[]);
      } else if (tab === 'documents') {
        let documentsQuery = supabase.from('customer_documents').select('*').order('created_at', { ascending: false }).limit(100);
        if (leadId) documentsQuery = documentsQuery.or(`lead_id.eq.${leadId},and(lead_id.is.null,deal_id.is.null,company_id.eq.${companyId})`);
        else if (dealId) documentsQuery = documentsQuery.or(`deal_id.eq.${dealId},and(deal_id.is.null,company_id.eq.${companyId})`);
        else if (companyId) documentsQuery = documentsQuery.eq('company_id', companyId);
        let contactsQuery = supabase.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name');
        if (companyId) contactsQuery = contactsQuery.eq('company_id', companyId);
        const [docs, messages, contactResult] = await Promise.all([
          documentsQuery,
          supabase.from('communication_outbox').select('*').order('created_at', { ascending: false }).limit(100),
          contactsQuery,
        ]);
        if (docs.error) throw docs.error;
        if (messages.error) throw messages.error;
        if (contactResult.error) throw contactResult.error;
        setDocuments(docs.data || []); setOutbox(companyId ? (messages.data || []).filter((message:any) => (docs.data || []).some((doc:any) => doc.id === message.document_id)) : messages.data || []); setContacts(contactResult.data || []);
      } else {
        let recordsQuery = supabase.from(selectedOps.table).select('*').order('created_at', { ascending: false });
        if (companyId) recordsQuery = recordsQuery.eq('company_id', companyId);
        const [recordsResult, companyResult, contractsResult, invoicesResult] = await Promise.all([
          recordsQuery,
          supabase.from('companies').select('id,company_name').order('company_name'),
          supabase.from('customer_contracts').select('*').order('created_at', { ascending: false }),
          supabase.from('customer_invoices').select('*').order('created_at', { ascending: false }),
        ]);
        if (recordsResult.error) throw recordsResult.error;
        if (companyResult.error) throw companyResult.error;
        if (contractsResult.error) throw contractsResult.error;
        if (invoicesResult.error) throw invoicesResult.error;
        setRecords(recordsResult.data || []); setCompanies(companyResult.data || []);
        const asTime = (value:string|null|undefined) => value ? (Date.parse(value)||Date.now()) : Date.now();
        onOperationalRecordsChange?.(
          (contractsResult.data||[]).map((row:any)=>({id:row.legacy_id||row.id,title:row.title,type:row.contract_type,productId:row.product_id||undefined,companyId:row.company_id||undefined,counterpartyName:row.counterparty_name||'',status:row.status,startDate:row.start_date||undefined,endDate:row.end_date||undefined,amount:Number(row.amount||0),notes:row.notes||undefined,createdAt:asTime(row.created_at),updatedAt:asTime(row.updated_at)})) as ManagedContract[],
          (invoicesResult.data||[]).map((row:any)=>({id:row.legacy_id||row.id,invoiceNumber:row.invoice_number,title:row.title,productId:row.product_id||undefined,companyId:row.company_id||undefined,recipientName:row.recipient_name||'',amount:Number(row.amount||0),taxAmount:row.tax_amount==null?undefined:Number(row.tax_amount),status:row.status,issueDate:row.issue_date||'',dueDate:row.due_date||'',paidDate:row.paid_at||undefined,notes:row.notes||undefined,createdAt:asTime(row.created_at),updatedAt:asTime(row.updated_at)})) as ManagedInvoice[]
        );
      }
    } catch (e: any) { setError(e?.message || 'データを読み込めませんでした。'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tab !== 'invitations') void load(); }, [tab, activeOpsTab, companyId, leadId, dealId]);

  const createSegment = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !segmentName.trim() || !filterValue.trim()) return;
    setError(''); setNotice('');
    const { error: insertError } = await supabase.from('crm_segments').insert({
      name: segmentName.trim(), entity_type: entityType,
      conditions: { field: filterField, operator: 'contains', value: filterValue.trim() },
    });
    if (insertError) { setError(insertError.message); return; }
    setSegmentName(''); setFilterValue(''); setNotice('保存条件を登録しました。対象CRMデータは複製していません。');
    await load();
  };

  const updateOutboxStatus = async (messageId: string, status: 'queued'|'canceled') => {
    const supabase=getSupabase();if(!supabase)return;
    const {error:updateError}=await supabase.from('communication_outbox').update({status}).eq('id',messageId);
    if(updateError)setError(updateError.message);else{setNotice(status==='queued'?'承認しました。送信待ちに登録しました（実送信は未接続）。':'送信依頼を取り消しました。');await load();}
  };

  const updateDocumentStatus = async (documentId: string, status: string) => {
    const supabase = getSupabase(); if (!supabase) return;
    const { error: updateError } = await supabase.from('customer_documents').update({ status }).eq('id', documentId);
    if (updateError) setError(updateError.message); else await load();
  };

  const requestDocumentSend = async (document: RecordRow) => {
    const supabase = getSupabase();
    const contact = contacts.find((item) => item.id === sendContactId);
    if (!supabase || !contact) { setError('送信先の連絡先を選択してください。'); return; }
    if (!sendSubject.trim() || !sendBodyText.trim()) { setError('顧客向け件名と本文を入力してください。'); return; }
    if (!consentConfirmed || !consentBasis.trim()) { setError('配信同意の確認と根拠メモを入力してください。'); return; }
    const address = sendChannel === 'email' ? contact.email : contact.line_user_id;
    if (!address) { setError(sendChannel === 'email' ? '選択した連絡先にメールアドレスがありません。' : '選択した連絡先にLINE user IDがありません。'); return; }
    if (sendChannel === 'line') {
      const { data: lineFriend, error: lineLookupError } = await supabase.from('line_friends').select('status,consent_status').eq('line_user_id', address).maybeSingle();
      if (lineLookupError) { setError(lineLookupError.message); return; }
      if (!lineFriend || lineFriend.status !== 'active' || lineFriend.consent_status !== 'opted_in') {
        setError('LINEの友だち状態が有効で、配信同意が確認できる連絡先のみ送信依頼を作成できます。');
        return;
      }
    }
    setError('');
    const { error: insertError } = await supabase.from('communication_outbox').insert({
      channel: sendChannel, recipient_contact_id: contact.id, recipient_address: address,
      subject: sendSubject.trim(), body_text: sendBodyText.trim(),
      document_id: document.id, source_type: 'customer_document',
      consent_confirmed_at: new Date().toISOString(), consent_basis: consentBasis.trim(),
      status: 'awaiting_approval',
    });
    if (insertError) { setError(insertError.message); return; }
    setConsentConfirmed(false); setConsentBasis(''); setSendDocumentId(''); setSendSubject(''); setSendBodyText('');
    setNotice('送信承認待ちに登録しました。書類を添付対象として紐付けています。外部サービスへはまだ送信していません。');
    await load();
  };

  const updateOperationStatus = async (record: RecordRow, status: string) => {
    const supabase=getSupabase(); if(!supabase)return;
    const {error:updateError}=await supabase.from(selectedOps.table).update({status}).eq('id',record.id);
    if(updateError)setError(updateError.message);else await load();
  };

  const previewSegment = async (segment: Segment) => {
    const supabase=getSupabase(); if(!supabase)return;
    setError('');setPreviewSegmentId(segment.id);
    const {data,error:queryError}=await supabase.from(segment.entity_type).select('*');
    if(queryError){setError(queryError.message);return;}
    const field=segment.conditions.field||'';
    const value=String(segment.conditions.value||'').toLowerCase();
    setPreviewRows((data||[]).filter((row:RecordRow)=>String(row[field]??'').toLowerCase().includes(value)));
  };

  const createOperation = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !recordTitle.trim()) return;
    const operationCompanyId = companyId || recordCompany;
    const payload: RecordRow = { title: recordTitle.trim(), company_id: operationCompanyId || null };
    if (activeOpsTab === 'contracts') {
      payload.amount = Number(recordAmount) || 0;
      payload.counterparty_name = companies.find((company)=>company.id===operationCompanyId)?.company_name || null;
      payload.start_date = recordDate || null;
      payload.status = 'draft';
      payload.contract_type = 'service_agreement';
    } else if (activeOpsTab === 'invoices') {
      payload.invoice_number = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      payload.amount = Number(recordAmount) || 0;
      payload.recipient_name = companies.find((company)=>company.id===operationCompanyId)?.company_name || null;
      payload.due_date = recordDate || null;
      payload.issue_date = new Date().toISOString().slice(0, 10);
      payload.status = 'draft';
    } else {
      payload.service_type = serviceType;
      payload.status = 'planned';
      payload.next_meeting_at = recordDate ? new Date(recordDate).toISOString() : null;
    }
    const { error: insertError } = await supabase.from(selectedOps.table).insert(payload);
    if (insertError) { setError(insertError.message); return; }
    setRecordTitle(''); setRecordCompany(''); setRecordAmount(''); setRecordDate('');
    setFormOpen(false); setNotice('記録を追加しました。送信・外部連携は承認と接続設定後に行います。');
    await load();
  };

  const title = tab === 'segments' ? 'リスト・顧客区分' : tab === 'documents' ? '顧客書類・送付履歴' : tab === 'invitations' ? '商談案内' : '契約後の顧客運営';
  const description = tab === 'segments'
    ? 'CRMレコードを条件で抽出する保存ビューです。会社・連絡先の複製は作りません。'
    : tab === 'documents'
      ? '生成済み書類と送信履歴を同じ顧客・商談に紐付けて追跡します。'
      : tab === 'invitations'
        ? 'Google予約ページを案内し、面談予約を受け付けます。'
        : '契約・請求・顧問・構築支援の状態を管理します。顧客への連絡は配信機能へ渡します。';

  return <div className="space-y-5">
    <header className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-white">{title}</h1><p className="mt-1 text-sm text-slate-400">{description}</p></div>
        <button onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><RefreshCw className="h-4 w-4" />更新</button>
      </div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</div>}

    {tab === 'segments' && <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <form onSubmit={createSegment} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-white">保存ビューを作成</h2>
        <label className="block text-xs text-slate-400">表示名<input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="例：診断済みのリード" /></label>
        <label className="block text-xs text-slate-400">対象<select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{entityOptions.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block text-xs text-slate-400">条件に使う項目<input value={filterField} onChange={(e) => setFilterField(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="例：source、status" /></label>
        <label className="block text-xs text-slate-400">含む値<input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />条件を保存</button>
      </form>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 font-semibold text-white">保存した区分</h2>
        {loading ? <p className="text-sm text-slate-400">読み込み中…</p> : segments.length === 0 ? <p className="text-sm text-slate-400">まだ保存ビューはありません。</p> :
          <ul className="divide-y divide-slate-800">{segments.map((segment) => <li key={segment.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><div className="font-medium text-white">{segment.name}</div><div className="text-xs text-slate-400">{entityOptions.find(([key]) => key === segment.entity_type)?.[1] || segment.entity_type} · {segment.conditions.field} に「{segment.conditions.value}」を含む</div></div><div className="flex gap-2"><button onClick={()=>void previewSegment(segment)} className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-200 hover:bg-blue-950/40">対象を確認</button><button onClick={async () => { const { error: deleteError } = await getSupabase()!.from('crm_segments').delete().eq('id', segment.id); if (deleteError) setError(deleteError.message); else { if(previewSegmentId===segment.id){setPreviewSegmentId('');setPreviewRows([]);} await load(); } }} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">削除</button></div></li>)}</ul>}
        {previewSegmentId&&<div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="font-medium text-white">対象レコード {previewRows.length}件</div><ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-300">{previewRows.slice(0,50).map((row,index)=><li key={String(row.id||index)}>{row.full_name||row.company_name||row.proposal_plan_name||row.id||'レコード'}</li>)}</ul></div>}
        <p className="mt-3 text-xs text-amber-300">配信直前に条件から対象を抽出します。送信時点の宛先スナップショットと同意状態の確認は、配信実行機能の接続時に記録します。</p>
      </section>
    </div>}

    {tab === 'documents' && <div className="space-y-4">
      {companyId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-900/70 bg-cyan-950/30 px-3 py-2 text-xs">
        <span className="text-cyan-100">{leadId ? `リードに関連する書類を表示中（ID: ${leadId}）` : dealId ? `商談に関連する書類を表示中（ID: ${dealId}）` : `この顧客に関連する書類を表示中（会社ID: ${companyId}）`}</span>
        {onClearCompanyFilter && <button type="button" onClick={onClearCompanyFilter} className="rounded border border-cyan-800 px-2 py-1 text-cyan-100 hover:bg-cyan-900/50">全顧客を表示</button>}
      </div>}
      <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h2 className="mb-3 font-semibold text-white">生成済み書類</h2><p className="mb-3 text-xs text-slate-400">承認済み書類の「送付内容を設定」から宛先・本文・配信同意をまとめて入力します。選択した書類は送信依頼に添付対象として紐付きます。</p>{loading ? <p className="text-sm text-slate-400">読み込み中…</p> : documents.length === 0 ? <p className="text-sm text-slate-400">書類ひな形から保存した書類がここに表示されます。</p> : <ul className="divide-y divide-slate-800">{documents.map((doc) => <li key={doc.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-white">{doc.title}</span><select aria-label={`${doc.title}の状態`} value={doc.status} onChange={(e)=>void updateDocumentStatus(doc.id,e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"><option value="draft">下書き</option><option value="awaiting_approval">確認待ち</option><option value="approved">承認済み</option><option value="archived">保管</option></select></div><div className="mt-1 text-xs text-slate-500">{doc.document_type} · {new Date(doc.created_at).toLocaleString('ja-JP')}</div>{doc.status==='approved'&&<div className="mt-2"><button type="button" onClick={()=>{setSendDocumentId(doc.id);setSendSubject(doc.title);setSendBodyText(`お世話になっております。\n\n「${doc.title}」をお送りします。\n内容をご確認いただき、ご不明点がございましたらご連絡ください。\n\nよろしくお願いいたします。`);setError('');}} className="rounded bg-indigo-700 px-3 py-2 text-xs font-semibold text-white">送付内容を設定</button>{sendDocumentId===doc.id&&<div className="mt-3 grid gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3"><div className="text-xs text-cyan-200">添付対象：{doc.title}</div><div className="grid gap-3 md:grid-cols-2"><label className="text-xs text-slate-300">送信先<select value={sendContactId} onChange={(e)=>setSendContactId(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">送信先を選択</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.full_name} · {sendChannel==='email'?contact.email||'メール未登録':contact.line_user_id||'LINE未連携'}</option>)}</select></label><label className="text-xs text-slate-300">配信方法<select value={sendChannel} onChange={(e)=>setSendChannel(e.target.value as 'email'|'line')} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="email">メール</option><option value="line">LINE</option></select></label></div>{sendChannel==='email'&&<label className="text-xs text-slate-300">件名<input value={sendSubject} onChange={(e)=>setSendSubject(e.target.value)} maxLength={200} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/></label>}<label className="text-xs text-slate-300">顧客向け本文<textarea value={sendBodyText} onChange={(e)=>setSendBodyText(e.target.value)} required maxLength={10000} rows={6} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-white"/></label><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={consentConfirmed} onChange={(e)=>setConsentConfirmed(e.target.checked)}/>配信同意を確認</label><input value={consentBasis} onChange={(e)=>setConsentBasis(e.target.value)} placeholder="同意の根拠" className="min-w-48 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"/></div><div className="flex gap-2"><button type="button" onClick={()=>void requestDocumentSend(doc)} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">内容を保存して送信承認を申請</button><button type="button" onClick={()=>setSendDocumentId('')} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">閉じる</button></div></div>}</div>}</li>)}</ul>}</section>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h2 className="mb-3 font-semibold text-white">送信履歴・送信待ち</h2>{loading ? <p className="text-sm text-slate-400">読み込み中…</p> : outbox.length === 0 ? <p className="text-sm text-slate-400">個別送信・一斉配信・書類送付は、同じ送信台帳に集約します。</p> : <ul className="divide-y divide-slate-800">{outbox.map((msg) => <li key={msg.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-white">{msg.subject || msg.recipient_address}</span><span className="text-xs text-slate-400">{msg.channel} · {msg.status}</span></div><div className="mt-1 text-xs text-slate-500">{new Date(msg.created_at).toLocaleString('ja-JP')} · 同意根拠: {msg.consent_basis || '記録なし'}</div>{msg.status==='awaiting_approval'&&<div className="mt-2 flex gap-2"><button onClick={()=>void updateOutboxStatus(msg.id,'queued')} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white">承認して送信待ちへ</button><button onClick={()=>void updateOutboxStatus(msg.id,'canceled')} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">取り消す</button></div>}</li>)}</ul>}<p className="mt-3 text-xs text-amber-300">実送信はサーバー側のLINE・メール接続が必要です。この一覧への登録だけで配信完了にはなりません。</p></section>
      </div>
    </div>}

    {tab === 'invitations' && <DealInvitationPanel />}

    {tab === 'operations' && <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
      {companyId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-900/70 bg-cyan-950/30 px-3 py-2 text-xs">
        <span className="text-cyan-100">顧客に関連する契約・請求・支援を表示中：{companies.find((company)=>company.id===companyId)?.company_name || companyId}</span>
        {onClearCompanyFilter && <button type="button" onClick={onClearCompanyFilter} className="rounded border border-cyan-800 px-2 py-1 text-cyan-100 hover:bg-cyan-900/50">全顧客を表示</button>}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{opsTabs.map(({key,label,icon:Icon}) => <button key={key} onClick={() => setActiveOpsTab(key)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${activeOpsTab===key?'bg-blue-600 text-white':'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}</div><button onClick={() => setFormOpen((value) => !value)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />新規登録</button></div>
      {formOpen && <form onSubmit={createOperation} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4 md:grid-cols-2">
        <label className="text-xs text-slate-400">名称<input required value={recordTitle} onChange={(e)=>setRecordTitle(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">会社<select value={companyId || recordCompany} disabled={Boolean(companyId)} onChange={(e)=>setRecordCompany(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-70"><option value="">会社を選択</option>{companies.map(company=><option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
        {activeOpsTab === 'services' && <label className="text-xs text-slate-400">支援種別<select value={serviceType} onChange={(e)=>setServiceType(e.target.value as 'retainer'|'implementation_support')} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="retainer">顧問</option><option value="implementation_support">構築支援</option></select></label>}
        {activeOpsTab !== 'services' && <label className="text-xs text-slate-400">金額<input type="number" min="0" value={recordAmount} onChange={(e)=>setRecordAmount(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>}
        <label className="text-xs text-slate-400">{activeOpsTab==='contracts'?'開始日':activeOpsTab==='invoices'?'支払期限':'次回面談'}<input type={activeOpsTab==='services'?'datetime-local':'date'} value={recordDate} onChange={(e)=>setRecordDate(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">保存</button></div>
      </form>}
      {loading ? <p className="text-sm text-slate-400">読み込み中…</p> : records.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">登録データはありません。</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs text-slate-400"><th className="p-2">名称</th><th className="p-2">会社</th><th className="p-2">状態</th><th className="p-2">金額</th><th className="p-2">日付</th></tr></thead><tbody>{records.map((record)=><tr key={record.id} className="border-b border-slate-800/70 text-slate-200"><td className="p-2">{record.title || record.invoice_number}</td><td className="p-2">{record.company_id || '—'}</td><td className="p-2"><select aria-label={`${record.title||record.invoice_number}の状態`} value={record.status} onChange={(e)=>void updateOperationStatus(record,e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white">{(activeOpsTab==='contracts'?['draft','under_review','sent','signed','expired','canceled']:activeOpsTab==='invoices'?['draft','awaiting_approval','issued','paid','overdue','canceled']:['planned','active','paused','completed','canceled']).map(status=><option key={status} value={status}>{status}</option>)}</select></td><td className="p-2">{record.amount == null?'—':Number(record.amount).toLocaleString('ja-JP')+'円'}</td><td className="p-2">{record.due_date || record.start_date || (record.next_meeting_at ? new Date(record.next_meeting_at).toLocaleString('ja-JP') : '—')}</td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
};
