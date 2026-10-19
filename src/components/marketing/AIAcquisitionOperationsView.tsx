import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { ArrowRight, BarChart3, Megaphone, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { OwnMediaWorkspace } from './OwnMediaWorkspace';

type RecordType = 'strategy' | 'content' | 'social' | 'video' | 'ad' | 'funnel' | 'result' | 'proposal';
type ViewTab = 'dashboard' | RecordType | 'analysis' | 'media';
type Field = { key: string; label: string; kind?: 'textarea' | 'number' | 'date' | 'select'; options?: string[]; placeholder?: string };
type AcquisitionRecord = { id: string; record_type: RecordType; title: string; product_id: string | null; status: string | null; payload: Record<string, string>; created_at: string; updated_at: string };
type Product = { id: string; product_name: string };
type AudienceSegment = { id: string; name: string; entity_type: string; conditions: { field?: string } | null };

const tabs: Array<{ id: ViewTab; label: string }> = [
  { id: 'dashboard', label: '集客ダッシュボード' }, { id: 'strategy', label: '集客戦略' },
  { id: 'content', label: 'コンテンツ企画' }, { id: 'social', label: 'SNS・note運用' },
  { id: 'video', label: '動画運用' }, { id: 'ad', label: '広告運用' },
  { id: 'media', label: '自社メディア運用' }, { id: 'funnel', label: 'LP・集客導線' }, { id: 'analysis', label: '成果分析・改善提案' },
];
const typeLabels: Record<RecordType, string> = { strategy: '集客戦略', content: 'コンテンツ企画', social: 'SNS・note投稿', video: '動画企画', ad: '広告施策', funnel: '集客導線', result: '成果記録', proposal: '改善提案' };
const fields: Record<RecordType, Field[]> = {
  strategy: [
    { key: 'target', label: 'ターゲット顧客', kind: 'textarea' }, { key: 'needs', label: '顧客の課題・ニーズ', kind: 'textarea' },
    { key: 'strengths', label: '強み・訴求ポイント', kind: 'textarea' }, { key: 'goal', label: '集客目標', kind: 'textarea' },
    { key: 'channels', label: '集客チャネル', placeholder: '例：note、X、紹介' }, { key: 'contentPolicy', label: 'コンテンツ方針', kind: 'textarea' },
    { key: 'destination', label: '誘導先（LP・診断・相談など）' }, { key: 'audienceSegmentId', label: '連携する配信対象リスト' }, { key: 'kpi', label: 'KPI' },
    { key: 'budget', label: '予算（円）', kind: 'number' }, { key: 'period', label: '実施期間', placeholder: '例：2026-10〜2026-12' },
    { key: 'status', label: '戦略の状態', kind: 'select', options: ['下書き', '確認待ち', '承認済み', '実施中', '完了'] },
  ],
  content: [
    { key: 'target', label: 'ターゲット' }, { key: 'pain', label: '顧客の課題', kind: 'textarea' }, { key: 'theme', label: '発信テーマ' },
    { key: 'message', label: '伝える内容', kind: 'textarea' }, { key: 'appeal', label: '訴求ポイント', kind: 'textarea' },
    { key: 'cta', label: 'CTA' }, { key: 'destination', label: '誘導先' }, { key: 'channels', label: '使用媒体', placeholder: 'note、X、Instagram など' },
    { key: 'status', label: '制作状況', kind: 'select', options: ['企画', '制作中', '確認待ち', '承認済み', '公開済み'] },
    { key: 'publishDate', label: '公開予定日', kind: 'date' }, { key: 'campaign', label: '関連キャンペーン' },
  ],
  social: [
    { key: 'platform', label: '媒体', kind: 'select', options: ['note', 'Facebook', 'Threads', 'X', 'Instagram', 'LinkedIn'] },
    { key: 'content', label: '投稿文・制作指示', kind: 'textarea' }, { key: 'assetUrl', label: '画像・動画などの素材URL' },
    { key: 'publishDate', label: '公開予定日', kind: 'date' }, { key: 'publishedUrl', label: '公開URL' },
    { key: 'status', label: '公開状態', kind: 'select', options: ['企画', '制作中', '確認待ち', '承認済み', '予約済み', '公開済み'] },
    { key: 'approval', label: '確認・承認状態', kind: 'select', options: ['未確認', '確認中', '承認済み', '修正依頼'] },
    { key: 'impressions', label: '表示・閲覧数', kind: 'number' }, { key: 'clicks', label: 'クリック数', kind: 'number' },
    { key: 'leads', label: 'リード数', kind: 'number' }, { key: 'campaign', label: '関連キャンペーン' },
  ],
  video: [
    { key: 'theme', label: '動画テーマ' }, { key: 'target', label: 'ターゲット' },
    { key: 'platform', label: '配信媒体', placeholder: '例：YouTube、Instagram' }, { key: 'format', label: '動画形式' },
    { key: 'script', label: '台本', kind: 'textarea' }, { key: 'instruction', label: '制作指示', kind: 'textarea' },
    { key: 'assetUrl', label: '素材・完成動画URL' }, { key: 'status', label: '制作状況', kind: 'select', options: ['企画', '制作中', '確認待ち', '承認済み', '公開済み'] },
    { key: 'publishDate', label: '公開予定日', kind: 'date' }, { key: 'publishedUrl', label: '公開URL' },
    { key: 'views', label: '再生数', kind: 'number' }, { key: 'campaign', label: '関連キャンペーン' },
  ],
  ad: [
    { key: 'platform', label: '広告媒体', placeholder: '例：Google、Meta' }, { key: 'campaign', label: 'キャンペーン名' },
    { key: 'purpose', label: '広告の目的' }, { key: 'target', label: 'ターゲット' }, { key: 'creative', label: '広告クリエイティブ', kind: 'textarea' },
    { key: 'destination', label: 'LP・誘導先' }, { key: 'budget', label: '予算（円）', kind: 'number' }, { key: 'spend', label: '実際の広告費（円）', kind: 'number' },
    { key: 'impressions', label: '表示回数', kind: 'number' }, { key: 'clicks', label: 'クリック数', kind: 'number' }, { key: 'conversions', label: 'CV数', kind: 'number' },
    { key: 'leads', label: 'リード数', kind: 'number' }, { key: 'meetings', label: '商談数', kind: 'number' }, { key: 'contracts', label: '契約数', kind: 'number' },
    { key: 'revenue', label: '売上（円）', kind: 'number' }, { key: 'status', label: '運用状態', kind: 'select', options: ['計画', '確認待ち', '承認済み', '運用中', '停止', '完了'] },
  ],
  funnel: [
    { key: 'channel', label: '集客媒体' }, { key: 'entry', label: '入口（広告・投稿など）' }, { key: 'landing', label: 'LP URL' },
    { key: 'diagnosis', label: '無料診断URL' }, { key: 'form', label: '問い合わせフォームURL' }, { key: 'booking', label: '相談予約URL' },
    { key: 'line', label: 'LINE登録URL' }, { key: 'email', label: 'メール登録URL' }, { key: 'targetProduct', label: '対象商品' },
    { key: 'goal', label: '導線の目的', kind: 'textarea' }, { key: 'status', label: '状態', kind: 'select', options: ['設計中', '確認待ち', '運用中', '停止', '完了'] },
  ],
  result: [
    { key: 'channel', label: '媒体・チャネル' }, { key: 'campaign', label: 'キャンペーン' }, { key: 'content', label: 'コンテンツ・施策' },
    { key: 'adSpend', label: '広告費（円）', kind: 'number' }, { key: 'impressions', label: '表示回数', kind: 'number' }, { key: 'clicks', label: 'クリック数', kind: 'number' },
    { key: 'conversions', label: 'CV数', kind: 'number' }, { key: 'leads', label: 'リード数', kind: 'number' }, { key: 'meetings', label: '商談数', kind: 'number' }, { key: 'contracts', label: '契約数', kind: 'number' },
    { key: 'revenue', label: '売上（円）', kind: 'number' }, { key: 'profit', label: '利益（円）', kind: 'number' }, { key: 'period', label: '対象期間' },
    { key: 'source', label: 'データ出典・メモ', kind: 'textarea' },
  ],
  proposal: [
    { key: 'issue', label: '課題', kind: 'textarea' }, { key: 'evidence', label: '根拠となるデータ', kind: 'textarea' },
    { key: 'recommendation', label: '改善案', kind: 'textarea' }, { key: 'expectedEffect', label: '期待する効果', kind: 'textarea' },
    { key: 'priority', label: '実施優先度', kind: 'select', options: ['高', '中', '低'] }, { key: 'tasks', label: '必要な作業', kind: 'textarea' },
    { key: 'status', label: '実施状況', kind: 'select', options: ['未着手', '確認待ち', '承認済み', '実施中', '完了', '見送り'] },
  ],
};

const emptyPayload = (): Record<string, string> => ({});
const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
const num = (payload: Record<string, string>, key: string) => Math.max(0, Number(payload[key] || 0) || 0);

export const AIAcquisitionOperationsView: React.FC<{ onSendPresidentSummary?: (summary: string) => void }> = ({ onSendPresidentSummary }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [records, setRecords] = useState<AcquisitionRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<AcquisitionRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [type, setType] = useState<RecordType>('strategy');
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [payload, setPayload] = useState<Record<string, string>>(emptyPayload());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const db = getSupabase();
    if (!db) { setError('Supabaseに接続してください。集客運用の保存にはDB接続が必要です。'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) { setError('ログイン状態を確認できません。'); setLoading(false); return; }
    setUserId(auth.user.id);
    const [savedRecords, savedProducts, savedSegments] = await Promise.all([
      db.from('mst_ai_acquisition_records').select('*').eq('user_id', auth.user.id).order('updated_at', { ascending: false }),
      db.from('products').select('id,product_name').order('product_name'),
      db.from('crm_segments').select('id,name,entity_type,conditions').order('name'),
    ]);
    if (savedRecords.error) {
      setError(savedRecords.error.message.includes('mst_ai_acquisition_records') ? '集客運用テーブルが未適用です。supabase/migrations/20261020100000_ai_acquisition_operations.sql を適用してください。' : `集客データを読み込めませんでした: ${savedRecords.error.message}`);
      setLoading(false); return;
    }
    setRecords(((savedRecords.data || []) as AcquisitionRecord[]).filter((record) => !(['media', 'article', 'seo', 'rewrite', 'attribution'] as string[]).includes(record.record_type)));
    if (!savedProducts.error) setProducts((savedProducts.data || []) as Product[]);
    if (!savedSegments.error) setSegments(((savedSegments.data || []) as AudienceSegment[]).filter((segment) => Boolean(segment.conditions?.field?.trim())));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const resetForm = (nextType: RecordType) => { setEditing(null); setIsFormOpen(true); setType(nextType); setTitle(''); setProductId(''); setPayload(emptyPayload()); setNotice(''); };
  const startEdit = (record: AcquisitionRecord) => { setEditing(record); setIsFormOpen(true); setType(record.record_type); setTitle(record.title); setProductId(record.product_id || ''); setPayload(record.payload || {}); setActiveTab(record.record_type === 'result' || record.record_type === 'proposal' ? 'analysis' : record.record_type); setNotice(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError('名称を入力してください。'); return; }
    const db = getSupabase(); if (!db || !userId) { setError('Supabaseに接続してログインしてください。'); return; }
    setSaving(true); setError(''); setNotice('');
    const id = editing?.id || `acq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = { user_id: userId, id, record_type: type, title: title.trim(), product_id: productId || null, status: payload.status || null, payload, updated_at: new Date().toISOString() };
    const { error: saveError } = await db.from('mst_ai_acquisition_records').upsert(row, { onConflict: 'user_id,id' });
    setSaving(false);
    if (saveError) { setError(`保存できませんでした: ${saveError.message}`); return; }
    setRecords((previous) => [{ ...row, created_at: editing?.created_at || new Date().toISOString() } as AcquisitionRecord, ...previous.filter((item) => item.id !== id)]);
    setNotice(`${typeLabels[type]}を保存しました。`); setEditing(null); setIsFormOpen(false); setTitle(''); setProductId(''); setPayload(emptyPayload());
  };
  const remove = async (record: AcquisitionRecord) => {
    setError(''); setNotice('');
    const db = getSupabase(); if (!db) return;
    const { data: deleted, error: deleteError } = await db.from('mst_ai_acquisition_records').delete().eq('user_id', userId).eq('id', record.id).select('id').maybeSingle();
    if (deleteError) { setError(`削除できませんでした: ${deleteError.message}`); return; }
    if (!deleted) { setError('削除対象が見つからないか、削除権限がありません。'); return; }
    setRecords((previous) => previous.filter((item) => item.id !== record.id)); setNotice('削除しました。');
  };

  const metrics = useMemo(() => {
    const results = records.filter((record) => record.record_type === 'result');
    const ads = records.filter((record) => record.record_type === 'ad');
    const sourceFor = (...keys: string[]) => results.some((record) => keys.some((key) => String(record.payload?.[key] ?? '').trim() !== '')) ? results : ads;
    const total = (...keys: string[]) => sourceFor(...keys).reduce((sum, record) => sum + keys.reduce((subtotal, key) => subtotal + num(record.payload || {}, key), 0), 0);
    const has = (...keys: string[]) => sourceFor(...keys).some((record) => keys.some((key) => String(record.payload?.[key] ?? '').trim() !== ''));
    const known = { spend: has('adSpend', 'spend'), impressions: has('impressions'), clicks: has('clicks'), conversions: has('conversions'), leads: has('leads'), meetings: has('meetings'), contracts: has('contracts'), revenue: has('revenue'), profit: has('profit') };
    return {
      active: records.filter((record) => ['実施中', '運用中', '公開済み', '予約済み'].includes(record.status || '')).length,
      content: records.filter((record) => ['content', 'social', 'video'].includes(record.record_type)).length,
      spend: total('adSpend', 'spend'), impressions: total('impressions'), clicks: total('clicks'), conversions: total('conversions'), leads: total('leads'), meetings: total('meetings'), contracts: total('contracts'), revenue: total('revenue'), profit: total('profit'),
      known,
      hasActuals: Object.values(known).some(Boolean),
    };
  }, [records]);
  const latestSuggestions = useMemo(() => {
    const result = records.filter((record) => record.record_type === 'result');
    const suggestions: string[] = [];
    if (!result.length) suggestions.push('成果記録がありません。媒体別のリード・商談・契約・売上を登録すると分析できます。');
    const campaigns = records.filter((record) => record.record_type === 'ad');
    if (campaigns.some((record) => num(record.payload || {}, 'spend') > 0 && num(record.payload || {}, 'leads') === 0)) suggestions.push('広告費を入力済みでリード数が未入力または0の施策があります。成果値と対象期間を確認してください。');
    if (records.some((record) => record.record_type === 'content' && record.status === '企画')) suggestions.push('企画段階のコンテンツがあります。制作担当・公開予定日・CTAを決めて進行状況を更新してください。');
    if (records.some((record) => record.record_type === 'funnel' && !record.payload?.landing && !record.payload?.diagnosis && !record.payload?.form && !record.payload?.booking)) suggestions.push('誘導先URLが未入力の導線があります。公開前にLP・診断・フォームなどのリンク先を設定してください。');
    return suggestions;
  }, [records]);
  const summary = `MST集客運用の経営向け要約を作成してください。登録データと未入力項目を区別し、数値を推測しないでください。\n`+
    `運用中施策: ${metrics.active}件 / コンテンツ・投稿・動画: ${metrics.content}件\n`+
    `登録実績: 広告費 ${metrics.known.spend ? yen(metrics.spend) : '未入力'}、表示 ${metrics.known.impressions ? metrics.impressions : '未入力'}、クリック ${metrics.known.clicks ? metrics.clicks : '未入力'}、CV ${metrics.known.conversions ? metrics.conversions : '未入力'}、リード ${metrics.known.leads ? metrics.leads : '未入力'}、商談 ${metrics.known.meetings ? metrics.meetings : '未入力'}、契約 ${metrics.known.contracts ? metrics.contracts : '未入力'}、売上 ${metrics.known.revenue ? yen(metrics.revenue) : '未入力'}、利益 ${metrics.known.profit ? yen(metrics.profit) : '未入力'}\n`+
    `登録済み成果データ: ${records.filter((record) => record.record_type === 'result').map((record) => `${record.title}: ${JSON.stringify({ period: record.payload.period, channel: record.payload.channel, campaign: record.payload.campaign, adSpend: record.payload.adSpend, impressions: record.payload.impressions, clicks: record.payload.clicks, conversions: record.payload.conversions, leads: record.payload.leads, meetings: record.payload.meetings, contracts: record.payload.contracts, revenue: record.payload.revenue, profit: record.payload.profit })}`).join(' / ') || 'なし'}\n`+
    `確認事項: ${latestSuggestions.join(' / ') || '登録済みデータから改善余地を検討してください。'}\n`+
    '返答は、根拠、課題、優先度付きの改善案、必要作業に分け、確認できない成果は未入力と明記してください。';

  const visibleRecords = activeTab === 'analysis' ? records.filter((record) => ['result', 'proposal'].includes(record.record_type)) : records.filter((record) => record.record_type === activeTab);
  const createRecord = (next: RecordType) => { resetForm(next); setActiveTab(next === 'result' || next === 'proposal' ? 'analysis' : next); };
  const formVisible = isFormOpen;

  return <main className="space-y-5 text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/70 to-slate-900 p-5">
      <div><div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-300"/><h1 className="text-xl font-bold">AI集客運用</h1></div><p className="mt-1 text-sm text-slate-300">戦略・コンテンツ・媒体運用・成果をまとめ、データに基づく改善を進めます。投稿や広告の外部実行は行いません。</p></div>
      <button onClick={() => void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">更新</button>
    </header>
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1" aria-label="AI集客運用メニュー">{tabs.map((tab) => <button key={tab.id} onClick={() => { setActiveTab(tab.id); setNotice(''); setError(''); }} aria-current={activeTab === tab.id ? 'page' : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm ${activeTab === tab.id ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{tab.label}</button>)}</nav>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${error ? 'bg-rose-950/50 text-rose-200' : 'bg-emerald-950/40 text-emerald-200'}`}>{error || notice}</p>}
    {loading ? <p className="rounded-xl border border-slate-800 p-5 text-sm text-slate-400">集客データを読み込み中…</p> : <>
      {activeTab === 'media' && <OwnMediaWorkspace products={products} onAskAI={onSendPresidentSummary} />}
      {activeTab === 'dashboard' && <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          ['運用中の施策', `${metrics.active}件`], ['コンテンツ・投稿・動画', `${metrics.content}件`], ['広告費', metrics.known.spend ? yen(metrics.spend) : '未入力'], ['リード / 商談 / 契約', `${metrics.known.leads ? metrics.leads : '未入力'} / ${metrics.known.meetings ? metrics.meetings : '未入力'} / ${metrics.known.contracts ? metrics.contracts : '未入力'}`],
          ['売上', metrics.known.revenue ? yen(metrics.revenue) : '未入力'], ['利益', metrics.known.profit ? yen(metrics.profit) : '未入力'],
        ].map(([label, value]) => <article key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></article>)}</div>
        {!metrics.hasActuals && <p className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">実績データは未入力・未連携です。実績値を推測して表示していません。</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-semibold">最近の施策</h2>{records.length ? <ul className="mt-3 divide-y divide-slate-800">{records.slice(0, 6).map((record) => <li key={record.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-sm font-medium">{record.title}</p><p className="text-xs text-slate-500">{typeLabels[record.record_type]} · {record.status || '状態未設定'}</p></div><button onClick={() => startEdit(record)} className="rounded border border-slate-700 px-2 py-1 text-xs">開く</button></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">まだ施策は登録されていません。</p>}</section>
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300"/><h2 className="font-semibold">改善の確認ポイント</h2></div><ul className="mt-3 space-y-2">{latestSuggestions.map((suggestion) => <li key={suggestion} className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">{suggestion}</li>)}</ul><button onClick={() => onSendPresidentSummary?.(summary)} disabled={!onSendPresidentSummary} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-sm disabled:opacity-50"><Sparkles className="h-4 w-4"/>AI社長に要約を共有</button><p className="mt-2 text-xs text-slate-500">共有するのは施策概要・集計値・確認事項です。個人顧客の情報や投稿全文は含めません。</p></section>
        </div>
        <div className="flex flex-wrap gap-2">{(['strategy','content','social','video','ad','funnel','result','proposal'] as RecordType[]).map((recordType) => <button key={recordType} onClick={() => createRecord(recordType)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"><Plus className="h-4 w-4"/>{typeLabels[recordType]}を追加</button>)}</div>
      </section>}

      {activeTab === 'analysis' && <section className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300"/><h2 className="font-semibold">登録済み実績の集計</h2></div>{metrics.hasActuals ? <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{[['広告費',metrics.spend,metrics.known.spend],['表示回数',metrics.impressions,metrics.known.impressions],['クリック数',metrics.clicks,metrics.known.clicks],['CV数',metrics.conversions,metrics.known.conversions],['リード',metrics.leads,metrics.known.leads],['商談',metrics.meetings,metrics.known.meetings],['契約',metrics.contracts,metrics.known.contracts],['売上',metrics.revenue,metrics.known.revenue],['利益',metrics.profit,metrics.known.profit]].map(([label,value,isKnown])=><div key={String(label)}><dt className="text-slate-400">{label}</dt><dd className="font-semibold">{!isKnown ? '未入力' : typeof value === 'number' && ['広告費','売上','利益'].includes(String(label)) ? yen(value) : `${value}件`}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-400">成果データ未入力・未連携のため分析できません。</p>}
            <div className="mt-4 grid gap-2 border-t border-slate-800 pt-3 text-sm sm:grid-cols-3"><p><span className="text-slate-400">CPA</span><br/>{metrics.known.spend && metrics.known.leads && metrics.leads > 0 ? yen(Math.round(metrics.spend / metrics.leads)) : '算出に必要な広告費・リード数が不足'}</p><p><span className="text-slate-400">CVR</span><br/>{metrics.known.clicks && metrics.known.conversions && metrics.clicks > 0 ? `${(metrics.conversions / metrics.clicks * 100).toFixed(2)}%` : '算出に必要なクリック・CV数が不足'}</p><p><span className="text-slate-400">ROAS</span><br/>{metrics.known.revenue && metrics.known.spend && metrics.spend > 0 ? `${(metrics.revenue / metrics.spend * 100).toFixed(1)}%` : '算出に必要な売上・広告費が不足'}</p></div>
            <p className="mt-3 text-xs text-slate-500">項目ごとに成果記録を優先し、未入力時は広告記録を集計します。同じ数値の二重計上を防ぎ、空欄を実績として補完しません。</p></article>
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-semibold">AI社長との連携</h2><p className="mt-2 text-sm text-slate-400">AI社長には経営判断向けの要約だけを共有できます。投稿全文や個人情報は共有しません。</p><button onClick={() => onSendPresidentSummary?.(summary)} disabled={!onSendPresidentSummary} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-sm disabled:opacity-50"><ArrowRight className="h-4 w-4"/>集客状況を共有して分析を依頼</button></article>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">成果記録・改善提案</h2><div className="flex gap-2"><button onClick={() => createRecord('result')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">成果を記録</button><button onClick={() => createRecord('proposal')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm">改善提案を登録</button></div></div>
        <RecordList records={visibleRecords} products={products} segments={segments} onEdit={startEdit} onDelete={remove}/>
      </section>}

      {formVisible && <form onSubmit={(event) => void save(event)} className="space-y-4 rounded-xl border border-indigo-500/30 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{editing ? '編集' : '新規登録'} · {typeLabels[type]}</h2><button type="button" onClick={() => resetForm(type)} className="text-xs text-slate-400">入力をクリア</button></div>
        <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">名称<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" placeholder={`${typeLabels[type]}の名称`}/></label>
          <label className="text-sm">対象商品<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">商品を選択（任意）</option>{products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select>{!products.length && <span className="text-xs text-slate-500">商品マスターの情報は未連携、または未登録です。</span>}</label>
          {fields[type].map((field) => <label key={field.key} className={`text-sm ${field.kind === 'textarea' ? 'md:col-span-2' : ''}`}>{field.label}{field.key === 'audienceSegmentId' ? <><select value={payload[field.key] || ''} onChange={(event) => setPayload((previous) => ({ ...previous, [field.key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">配信対象リストを選択（任意）</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select>{!segments.length && <span className="text-xs text-slate-500">利用できる配信対象リストがありません。教育・フォロー側で作成できます。</span>}</> : field.kind === 'select' ? <select value={payload[field.key] || ''} onChange={(event) => setPayload((previous) => ({ ...previous, [field.key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">選択してください</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.kind === 'textarea' ? <textarea value={payload[field.key] || ''} onChange={(event) => setPayload((previous) => ({ ...previous, [field.key]: event.target.value }))} rows={3} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/> : <input type={field.kind || 'text'} min={field.kind === 'number' ? 0 : undefined} value={payload[field.key] || ''} placeholder={field.placeholder} onChange={(event) => setPayload((previous) => ({ ...previous, [field.key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"/>}</label>)}
        </div>
        {['social','video'].includes(type) && <p className="rounded-lg bg-amber-950/30 p-3 text-xs text-amber-200">各媒体への自動投稿・実績自動取得は未連携です。ここでは手動投稿の予定・公開URL・入力済み実績を管理します。</p>}
        {type === 'ad' && <p className="rounded-lg bg-amber-950/30 p-3 text-xs text-amber-200">広告の出稿・停止・予算変更は実行しません。費用と成果を記録し、配信判断は人が確認してください。</p>}
        <div className="flex gap-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? '保存中…' : '保存'}</button><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setTitle(''); setProductId(''); setPayload(emptyPayload()); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">キャンセル</button></div>
      </form>}

      {activeTab !== 'dashboard' && activeTab !== 'analysis' && !formVisible && <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{tabs.find((tab) => tab.id === activeTab)?.label}</h2><p className="mt-1 text-xs text-slate-500">商品マスターの商品と関連付けて登録できます。実行・公開は外部サービスで行ってください。</p></div><button onClick={() => createRecord(activeTab as RecordType)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm"><Plus className="h-4 w-4"/>新規登録</button></div><RecordList records={visibleRecords} products={products} segments={segments} onEdit={startEdit} onDelete={remove}/></section>}
    </>}
  </main>;
};

const RecordList: React.FC<{ records: AcquisitionRecord[]; products: Product[]; segments: AudienceSegment[]; onEdit: (record: AcquisitionRecord) => void; onDelete: (record: AcquisitionRecord) => void }> = ({ records, products, segments, onEdit, onDelete }) => !records.length
  ? <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">登録データはありません。</p>
  : <ul className="space-y-2">{records.map((record) => <li key={record.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{record.title}</p><p className="mt-1 text-xs text-slate-500">{typeLabels[record.record_type]}{record.product_id ? ` · ${products.find((product) => product.id === record.product_id)?.product_name || '商品'}` : ''}{record.status ? ` · ${record.status}` : ''} · 更新 {new Date(record.updated_at).toLocaleDateString('ja-JP')}</p></div><div className="flex gap-2"><button onClick={() => onEdit(record)} className="rounded border border-slate-700 px-2 py-1 text-xs">編集</button><InlineDeleteButton onConfirm={()=>void onDelete(record)} warning={`「${record.title}」を削除しますか？`} ariaLabel={`${record.title}を削除`}><Trash2 className="h-3.5 w-3.5"/></InlineDeleteButton></div></div><dl className="mt-3 grid gap-2 sm:grid-cols-2">{(fields[record.record_type] || []).filter((field) => Boolean(record.payload?.[field.key])).slice(0, 8).map((field) => <div key={field.key} className="min-w-0"><dt className="text-[11px] text-slate-500">{field.label}</dt><dd className="whitespace-pre-wrap break-words text-xs text-slate-300">{field.key === 'audienceSegmentId' ? segments.find((segment) => segment.id === record.payload[field.key])?.name || '配信対象リスト（未選択）' : record.payload[field.key]}</dd></div>)}</dl></li>)}</ul>;

