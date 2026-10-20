import React, { useEffect, useMemo, useState } from 'react';
import { Library, Plus, Save, Trash2, X } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';

type Channel = 'email' | 'line';
type LineType = 'text' | 'image' | 'flex' | 'video';
type EmailTemplate = { id: string; name?: string; category: string; channel: Channel; template_key: string; subject: string; body_text: string; updated_at?: string };
type LineTemplate = { id: string; name: string; reply_type: LineType; payload: Record<string, any>; updated_at?: string };
type TemplateRow =
  | { source: 'communication'; id: string; name: string; channel: Channel; type: 'text'; category: string; updatedAt?: string; subject: string; body: string }
  | { source: 'line'; id: string; name: string; channel: 'line'; type: LineType; category: string; updatedAt?: string; payload: Record<string, any> };

const BUCKET = 'mst-line-message-assets';
const typeLabel: Record<LineType, string> = { text: 'テキスト', image: '画像', flex: 'Flex', video: '動画' };

export const CommunicationTemplateLibraryView: React.FC = () => {
  const db = getSupabase();
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [lineTemplates, setLineTemplates] = useState<LineTemplate[]>([]);
  const [filter, setFilter] = useState<'all' | 'email' | LineType>('all');
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [lineType, setLineType] = useState<LineType>('text');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [altText, setAltText] = useState('');
  const [flexJson, setFlexJson] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetPath, setAssetPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewPath, setPreviewPath] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!db) { setError('Supabaseに接続してください。'); setLoading(false); return; }
    setLoading(true);
    const [{ data: userData }, emailResult, lineResult] = await Promise.all([
      db.auth.getUser(),
      db.from('communication_templates').select('*').order('updated_at', { ascending: false }),
      db.from('line_auto_reply_templates').select('*').order('updated_at', { ascending: false }),
    ]);
    setOwnerId(userData.user?.id || '');
    if (emailResult.error) setError('メールテンプレートを読み込めません。supabase/migrations/20261019120000_communication_templates.sql と 20261020170000_communication_template_names.sql を適用してください。');
    else setEmailTemplates((emailResult.data || []) as EmailTemplate[]);
    if (lineResult.error) setError((current) => current || 'LINEテンプレートを読み込めません。supabase/migrations/20261020150000_line_auto_reply_templates.sql を適用してください。');
    else setLineTemplates((lineResult.data || []) as LineTemplate[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const rows = useMemo<TemplateRow[]>(() => [
    ...emailTemplates.map((item) => ({
      source: 'communication' as const, id: item.id,
      name: item.name?.trim() || `${item.category} · ${item.template_key}`,
      channel: item.channel, type: 'text' as const, category: item.category,
      updatedAt: item.updated_at, subject: item.subject || '', body: item.body_text || '',
    })),
    ...lineTemplates.map((item) => ({
      source: 'line' as const, id: item.id, name: item.name,
      channel: 'line' as const, type: item.reply_type, category: '共通',
      updatedAt: item.updated_at, payload: item.payload || {},
    })),
  ], [emailTemplates, lineTemplates]);

  const visibleRows = rows.filter((item) => filter === 'all' || (filter === 'email' ? item.channel === 'email' : item.type === filter));

  const resetEditor = () => {
    setEditing(null); setName(''); setChannel('email'); setLineType('text');
    setSubject(''); setBody(''); setAltText(''); setFlexJson('');
    setAssetUrl(''); setAssetPath(''); setPreviewUrl(''); setPreviewPath('');
    setEditorOpen(false);
  };

  const startCreate = () => {
    resetEditor(); setError(''); setNotice(''); setEditorOpen(true);
  };

  const startEdit = (item: TemplateRow) => {
    setEditing(item); setName(item.name);
    setChannel(item.channel);
    if (item.source === 'communication') {
      setLineType('text'); setSubject(item.subject); setBody(item.body);
      setAssetUrl(''); setPreviewUrl(''); setAssetPath(''); setPreviewPath(''); setAltText(''); setFlexJson('');
    } else {
      const payload = item.payload || {};
      setLineType(item.type); setSubject('');
      setBody(String(payload.text || '')); setAltText(String(payload.altText || ''));
      setFlexJson(payload.contents ? JSON.stringify(payload.contents, null, 2) : '');
      const paths = Array.isArray(payload.storagePaths) ? payload.storagePaths : [];
      const isVideo = item.type === 'video';
      setAssetUrl(isVideo ? String(payload.originalContentUrl || '') : item.type === 'image' ? String(payload.originalContentUrl || '') : '');
      setPreviewUrl(String(payload.previewImageUrl || ''));
      setAssetPath(typeof paths[0] === 'string' ? paths[0] : '');
      setPreviewPath(typeof paths[1] === 'string' ? paths[1] : '');
    }
    setError(''); setNotice(''); setEditorOpen(true);
  };

  const uploadAsset = async (file: File, kind: 'image' | 'video') => {
    if (!db || !ownerId) throw new Error('ログイン状態を確認してください。');
    if (file.size > 20 * 1024 * 1024) throw new Error('ファイルは20MB以下にしてください。');
    const allowed = kind === 'video' ? ['video/mp4'] : ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) throw new Error(kind === 'video' ? '動画はMP4形式を選択してください。' : '画像はJPEGまたはPNG形式を選択してください。');
    const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'asset';
    const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`素材をアップロードできませんでした: ${uploadError.message}`);
    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  };

  const onUpload = async (file: File | undefined, slot: 'asset' | 'preview') => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const uploaded = await uploadAsset(file, slot === 'asset' && lineType === 'video' ? 'video' : 'image');
      if (slot === 'asset') { setAssetPath(uploaded.path); setAssetUrl(uploaded.url); }
      else { setPreviewPath(uploaded.path); setPreviewUrl(uploaded.url); }
    } catch (e: any) { setError(e.message || '素材をアップロードできませんでした。'); }
    finally { setBusy(false); }
  };

  const removeStoredAssets = async (paths: string[]) => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (!db || uniquePaths.length === 0) return;
    const { error: storageError } = await db.storage.from(BUCKET).remove(uniquePaths);
    if (storageError) setError((current) => current || `テンプレートは保存しましたが、古い素材を削除できませんでした: ${storageError.message}`);
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!db) { setError('Supabaseに接続してください。'); return; }
    if (!ownerId) { setError('ログインしてください。'); return; }
    if (!name.trim()) { setError('テンプレート名を入力してください。'); return; }
    setError(''); setNotice('');
    let linePayload: Record<string, any> | null = null;
    if (channel === 'line') {
      if (lineType === 'text' && !body.trim()) { setError('本文を入力してください。'); return; }
      if ((lineType === 'image' || lineType === 'video') && (!assetUrl || !previewUrl || !assetPath || !previewPath)) { setError('素材本体とプレビュー画像をアップロードしてください。'); return; }
      if ((lineType === 'image' || lineType === 'video') && !altText.trim() && lineType === 'video') { setError('動画の代替テキストを入力してください。'); return; }
      if (lineType === 'flex') {
        if (!altText.trim()) { setError('Flexメッセージの代替テキストを入力してください。'); return; }
        try {
          const contents = JSON.parse(flexJson);
          if (!contents || typeof contents !== 'object' || !['bubble', 'carousel'].includes(contents.type)) throw new Error();
          linePayload = { altText: altText.trim(), contents };
        } catch { setError('Flex本文はbubbleまたはcarousel形式の正しいJSONで入力してください。'); return; }
      } else if (lineType === 'text') linePayload = { text: body.trim() };
      else linePayload = { originalContentUrl: assetUrl, previewImageUrl: previewUrl, ...(lineType === 'video' ? { altText: altText.trim() } : {}), storagePaths: [assetPath, previewPath] };
    }
    setBusy(true);
    let saveError: any = null;
    let oldPaths: string[] = [];
    if (editing?.source === 'communication' || (!editing && channel === 'email')) {
      const previous = editing?.source === 'communication' ? emailTemplates.find((item) => item.id === editing.id) : null;
      if (previous?.channel !== 'email' && previous?.channel !== 'line') { setBusy(false); setError('編集対象のテンプレートを読み込めません。'); return; }
      if (editing?.source === 'communication' && previous) {
        const { error: updateError } = await db.from('communication_templates').update({
          name: name.trim(), subject: channel === 'email' ? subject : '', body_text: body, updated_at: new Date().toISOString(),
        }).eq('id', editing.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await db.from('communication_templates').insert({
          owner_id: ownerId, template_key: `library_${crypto.randomUUID()}`, category: 'announcement',
          channel: 'email', name: name.trim(), subject, body_text: body,
        });
        saveError = insertError;
      }
    } else {
      const previous = editing?.source === 'line' ? lineTemplates.find((item) => item.id === editing.id) : null;
      const oldPayload = previous?.payload || {};
      oldPaths = Array.isArray(oldPayload.storagePaths) ? oldPayload.storagePaths.filter((path: unknown): path is string => typeof path === 'string') : [];
      const payload = linePayload || { text: body.trim() };
      const result = editing?.source === 'line'
        ? await db.from('line_auto_reply_templates').update({ name: name.trim(), reply_type: lineType, payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
        : await db.from('line_auto_reply_templates').insert({ owner_id: ownerId, name: name.trim(), reply_type: lineType, payload });
      saveError = result.error;
      if (saveError) oldPaths = [];
    }
    if (saveError) setError(saveError.message);
    else {
      if (editing?.source === 'line') {
        const savedPayload = linePayload || { text: body.trim() };
        const retainedPaths = Array.isArray(savedPayload.storagePaths) ? savedPayload.storagePaths : [];
        await removeStoredAssets(oldPaths.filter((path) => !retainedPaths.includes(path)));
      }
      setNotice('テンプレートを保存しました。各送信画面で選択できます。'); resetEditor(); await load();
    }
    setBusy(false);
  };

  const deleteTemplate = async (item: TemplateRow) => {
    if (!db) return;
    setError(''); setNotice('');
    const result = item.source === 'communication'
      ? await db.from('communication_templates').delete().eq('id', item.id)
      : await db.from('line_auto_reply_templates').delete().eq('id', item.id);
    if (result.error) { setError(result.error.message); return; }
    if (item.source === 'line') {
      const paths = Array.isArray(item.payload.storagePaths) ? item.payload.storagePaths.filter((path: unknown): path is string => typeof path === 'string') : [];
      await removeStoredAssets(paths);
    }
    setNotice('テンプレートを削除しました。'); await load();
  };

  const typeOf = (item: TemplateRow) => item.source === 'communication' ? (item.channel === 'email' ? 'メール文面' : 'テキスト') : typeLabel[item.type];
  const filterItems: Array<{ id: 'all' | 'email' | LineType; label: string }> = [
    { id: 'all', label: 'すべて' }, { id: 'email', label: 'メール' },
    { id: 'text', label: 'テキスト' }, { id: 'flex', label: 'Flex' },
    { id: 'image', label: '画像' }, { id: 'video', label: '動画' },
  ];

  return <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300"><Library className="h-4 w-4" />Communication templates <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-white">LINE / EMAIL</span></div><h2 className="mt-2 text-xl font-bold text-white">テンプレート保管庫</h2><p className="mt-1 text-sm text-slate-400">メールとLINEの文面・素材をまとめて管理します。保存したテンプレートは送信センター、一斉配信、シナリオ設定から選べます。</p></div>
      <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" />新規テンプレート</button>
    </div>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={error ? 'rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200' : 'rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200'}>{error || notice}</p>}
    <div className="flex flex-wrap gap-2">{filterItems.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === item.id ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{item.label}</button>)}</div>
    {editorOpen && <form onSubmit={(event) => void saveTemplate(event)} className="space-y-4 rounded-xl border border-indigo-700/60 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-white">{editing ? 'テンプレートを編集' : '新規テンプレート'}</h3><button type="button" onClick={resetEditor} className="rounded p-1 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-300">名前<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-300">チャネル<select disabled={!!editing} value={channel} onChange={(event) => { const value = event.target.value as Channel; setChannel(value); if (value === 'email') setLineType('text'); }} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white"><option value="email">メール</option><option value="line">LINE</option></select></label>
        {channel === 'line' && <label className="text-xs text-slate-300">種類<select disabled={editing?.source === 'communication'} value={lineType} onChange={(event) => { setLineType(event.target.value as LineType); setBody(''); setAltText(''); setFlexJson(''); setAssetUrl(''); setAssetPath(''); setPreviewUrl(''); setPreviewPath(''); }} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white">{Object.entries(typeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        {channel === 'email' && <label className="text-xs text-slate-300">件名<input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white" /></label>}
        {(channel === 'email' || lineType === 'text') && <label className="text-xs text-slate-300 md:col-span-2">本文<textarea required rows={7} maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-3 text-sm text-white" /><span className="text-slate-500">差し込み例: {'{recipient_name}'}、{'{company_name}'}、{'{document_url}'}</span></label>}
        {channel === 'line' && (lineType === 'image' || lineType === 'video') && <div className="space-y-3 md:col-span-2">
          <label className="block text-xs text-slate-300">{lineType === 'video' ? '動画ファイル（MP4）' : '画像ファイル（JPEG / PNG）'}<input type="file" accept={lineType === 'video' ? 'video/mp4' : 'image/jpeg,image/png'} onChange={(event) => void onUpload(event.target.files?.[0], 'asset')} className="mt-1 block w-full text-xs text-slate-300" />{assetUrl && <span className="mt-1 block break-all text-[11px] text-emerald-300">アップロード済み: {assetUrl}</span>}</label>
          <label className="block text-xs text-slate-300">プレビュー画像（JPEG / PNG）<input type="file" accept="image/jpeg,image/png" onChange={(event) => void onUpload(event.target.files?.[0], 'preview')} className="mt-1 block w-full text-xs text-slate-300" />{previewUrl && <span className="mt-1 block break-all text-[11px] text-emerald-300">アップロード済み: {previewUrl}</span>}</label>
          {lineType === 'video' && <label className="block text-xs text-slate-300">代替テキスト<input required value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white" /></label>}
        </div>}
        {channel === 'line' && lineType === 'flex' && <><label className="text-xs text-slate-300">代替テキスト<input required value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">Flex JSON<textarea required rows={10} value={flexJson} onChange={(event) => setFlexJson(event.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-white" placeholder='{"type":"bubble","body":{...}}' /></label></>}
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={resetEditor} className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300">閉じる</button><button disabled={busy} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? '保存中…' : '保存'}</button></div>
    </form>}
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-950 text-xs text-slate-400"><tr><th className="p-3">種類</th><th className="p-3">名前</th><th className="p-3">カテゴリ</th><th className="p-3">更新日</th><th className="p-3">操作</th></tr></thead><tbody className="divide-y divide-slate-800">
        {loading ? <tr><td colSpan={5} className="p-4 text-center text-slate-400">読み込み中…</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">テンプレートはまだありません。</td></tr> : visibleRows.map((item) => <tr key={item.source + item.id} className="text-slate-200"><td className="p-3"><span className="rounded-full bg-slate-700 px-2 py-1 text-xs">{item.channel === 'email' ? 'メール' : typeOf(item)}</span></td><td className="p-3 font-medium">{item.name}</td><td className="p-3 text-xs text-slate-400">{item.category}</td><td className="p-3 text-xs text-slate-400">{item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP') : '—'}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => startEdit(item)} className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">詳細・編集</button><InlineDeleteButton warning={`テンプレート「${item.name}」を削除しますか？${item.source === 'line' ? ' 素材ファイルも削除されます。' : ''}`} onConfirm={() => deleteTemplate(item)}><Trash2 className="mr-1 inline h-3 w-3" />削除</InlineDeleteButton></div></td></tr>)}
      </tbody></table>
    </div>
    <p className="text-xs text-slate-500">LINE画像・動画の素材はSupabase Storageに保存します。使用回数は現在記録していないため表示していません。</p>
  </section>;
};
