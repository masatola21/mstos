import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X, Sparkles, Filter, Copy, Mail, Smartphone } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { LineMessagePreview } from '../LineMessagePreview';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { PlaceholderAssist } from '../common/PlaceholderAssist';
import { appendEmailFooter } from '../../../server/emailFooter';

export type Channel = 'email' | 'line';
export type LineType = 'text' | 'image' | 'flex' | 'video';

export const CATEGORY_LABELS: Record<string, string> = {
  announcement: 'キャンペーン・お知らせ・汎用',
  customer_meeting: '顧客フォロー・お礼',
  deal: '商談・相談日程調整',
  diagnosis: '診断のご案内',
  form: 'フォーム・アンケート案内',
  document: '重要書類送付（見積・契約・請求）',
};

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));
const isNamedLibraryTemplate = (item: EmailTemplate) => {
  const trimmedName = (item.name || '').trim();
  const key = (item.template_key || '').trim();
  if (key.startsWith('tpl_')) return true;
  return Boolean(trimmedName && trimmedName !== key);
};

export type EmailTemplate = {
  id: string;
  name?: string;
  category: string;
  channel: Channel;
  template_key: string;
  subject: string;
  body_text: string;
  updated_at?: string;
};

export type LineTemplate = {
  id: string;
  name: string;
  reply_type: LineType;
  payload: Record<string, any>;
  updated_at?: string;
};

export type TemplateRow =
  | { source: 'communication'; id: string; name: string; channel: Channel; type: 'text'; category: string; updatedAt?: string; subject: string; body: string }
  | { source: 'line'; id: string; name: string; channel: 'line'; type: LineType; category: string; updatedAt?: string; payload: Record<string, any> };

const BUCKET = 'mst-line-message-assets';
const typeLabel: Record<LineType, string> = { text: 'テキスト', image: '画像', flex: 'Flex', video: '動画' };

const PRESET_SNIPPETS = [
  {
    label: '【一斉配信】キャンペーン・新企画のご案内',
    category: 'announcement',
    channel: 'email' as Channel,
    name: '【一斉配信】キャンペーン・新企画のご案内',
    subject: '【ご案内】期間限定サポート企画のお知らせ｜{会社名} 様',
    body: `{お名前} 様\n\nいつも大変お世話になっております。有限会社MSTの大橋です。\n\nこの度、日頃のご愛顧・ご相談をいただいている企業様向けに、新しいサポート企画をご案内いたします。\n\n▼ 企画概要・お申込みページ\n{案内URL}\n\n■ おすすめの対象企業様\n・業務の属人化や管理コストを今期中に整理したい\n・補助金や既存リソースを活かして仕組み化を進めたい\n\nご関心をお持ちいただけましたら、上記ページまたは本メールへのご返信にてお気軽にお知らせください。\n今後ともよろしくお願いいたします。\n\n有限会社MST 大橋真人`,
  },
  {
    label: '【返信文例】お打ち合わせのお礼・フォロー',
    category: 'customer_meeting',
    channel: 'email' as Channel,
    name: '【返信文例】お打ち合わせのお礼・次回フォロー',
    subject: '本日はお時間をいただきありがとうございました｜{会社名} 様',
    body: `{お名前} 様\n\n本日は貴重なお時間をいただき、誠にありがとうございました。\n有限会社MSTの大橋です。\n\n本日お伺いいたしました内容をもとに、整理したご提案・次回アクションをお送りいたします。\nご確認のうえ、補足やご希望がございましたらお気軽にご返信ください。\n\n引き続き、何卒よろしくお願い申し上げます。\n\n有限会社MST 大橋真人`,
  },
  {
    label: '【返信文例】30分オンライン個別相談の日程調整',
    category: 'deal',
    channel: 'email' as Channel,
    name: '【返信文例】30分オンライン個別相談のご案内',
    subject: '【オンライン個別相談】日程調整のお願い｜{会社名} 様',
    body: `{お名前} 様\n\nお世話になっております。有限会社MSTの大橋です。\n\nオンライン（Google Meet）にて、30分の個別相談を実施させていただければと存じます。\n下記のカレンダーより、ご都合の良い日時を1つお選びください。\n\n▼ 面談日程の選択（カレンダー）\n{面談予約URL}\n\nご都合が合わない場合は、本メールにご希望日時を2〜3候補ご返信ください。\nよろしくお願いいたします。\n\n有限会社MST 大橋真人`,
  },
  {
    label: '【LINEテキスト】セミナー・個別相談のご案内',
    category: 'announcement',
    channel: 'line' as Channel,
    lineType: 'text' as LineType,
    name: '【LINEテキスト】無料診断・個別相談のご案内',
    body: `{お名前} 様\nいつもご覧いただきありがとうございます。有限会社MSTです。\n\nただいま「現状の課題整理・仕組み化」に関する個別相談を受け付けております。\n下記よりご希望のメニューをご覧ください。\n\n▼ ご案内ページ\n{案内URL}\n\nご質問があればこのままLINEでお気軽にメッセージをお送りください。`,
  },
  {
    label: '【LINE Flex】診断・相談カード（選択肢付き）',
    category: 'diagnosis',
    channel: 'line' as Channel,
    lineType: 'flex' as LineType,
    name: '【LINE Flex】無料診断＆オンライン相談ご案内カード',
    altText: '【無料診断・個別相談のご案内】ご希望のメニューをお選びください',
    flexJson: JSON.stringify({
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '【MST】経営改善サポート', weight: 'bold', size: 'lg', color: '#1E293B' },
          { type: 'text', text: '{お名前} 様、ご登録ありがとうございます。下記のメニューより、ご希望の案内をお選びください。', size: 'sm', color: '#475569', wrap: true },
          { type: 'separator', margin: 'md' },
          {
            type: 'button',
            style: 'primary',
            color: '#10B981',
            action: { type: 'uri', label: '📊 3分無料診断を始める', uri: '{案内URL}' },
            margin: 'md'
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: '📅 30分オンライン相談を予約', uri: '{面談予約URL}' },
            margin: 'sm'
          }
        ]
      }
    }, null, 2),
    body: '',
  },
];

export const CommunicationTemplateLibraryView: React.FC = () => {
  const db = getSupabase();
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [lineTemplates, setLineTemplates] = useState<LineTemplate[]>([]);
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | LineType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('announcement');
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
    if (!db) {
      setError('Supabaseに接続してください。');
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: userData }, emailResult, lineResult] = await Promise.all([
      db.auth.getUser(),
      db.from('communication_templates').select('*').order('updated_at', { ascending: false }),
      db.from('line_auto_reply_templates').select('*').order('updated_at', { ascending: false }),
    ]);
    setOwnerId(userData.user?.id || '');
    if (emailResult.error) {
      setError('メールテンプレートを読み込めません。');
    } else {
      setEmailTemplates((emailResult.data || []) as EmailTemplate[]);
    }
    if (lineResult.error) {
      setError((current) => current || 'LINEテンプレートを読み込めません。');
    } else {
      setLineTemplates((lineResult.data || []) as LineTemplate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen]);

  const rows = useMemo<TemplateRow[]>(() => [
    ...emailTemplates
      .filter((item) => item.channel === 'email' && isNamedLibraryTemplate(item))
      .map((item) => ({
        source: 'communication' as const,
        id: item.id,
        name: item.name?.trim() || `${CATEGORY_LABELS[item.category] || item.category} · ${item.template_key}`,
        channel: item.channel,
        type: 'text' as const,
        category: VALID_CATEGORIES.has(item.category) ? item.category : 'announcement',
        updatedAt: item.updated_at,
        subject: item.subject || '',
        body: item.body_text || '',
      })),
    ...lineTemplates.map((item) => {
      let inferredCat = 'announcement';
      const n = item.name.toLowerCase();
      if (n.includes('診断') || n.includes('カルテ')) inferredCat = 'diagnosis';
      else if (n.includes('面談') || n.includes('予約') || n.includes('日程') || n.includes('相談')) inferredCat = 'deal';
      else if (n.includes('フォーム') || n.includes('アンケート')) inferredCat = 'form';
      else if (n.includes('書類') || n.includes('請求') || n.includes('見積') || n.includes('契約')) inferredCat = 'document';
      else if (n.includes('お礼') || n.includes('フォロー')) inferredCat = 'customer_meeting';

      return {
        source: 'line' as const,
        id: item.id,
        name: item.name,
        channel: 'line' as const,
        type: item.reply_type,
        category: inferredCat,
        updatedAt: item.updated_at,
        payload: item.payload || {},
      };
    }),
  ], [emailTemplates, lineTemplates]);

  const visibleRows = useMemo(() => {
    return rows.filter((item) => {
      if (channelFilter !== 'all') {
        if (channelFilter === 'email' && item.channel !== 'email') return false;
        if (channelFilter !== 'email' && (item.channel !== 'line' || item.type !== channelFilter)) return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = (CATEGORY_LABELS[item.category] || item.category).toLowerCase().includes(q);
        const matchesSubject = item.source === 'communication' && item.subject.toLowerCase().includes(q);
        const matchesBody = item.source === 'communication' && item.body.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesSubject && !matchesBody) return false;
      }
      return true;
    });
  }, [rows, channelFilter, categoryFilter, searchQuery]);

  const resetEditor = () => {
    setEditing(null);
    setName('');
    setCategory('announcement');
    setChannel('email');
    setLineType('text');
    setSubject('');
    setBody('');
    setAltText('');
    setFlexJson('');
    setAssetUrl('');
    setAssetPath('');
    setPreviewUrl('');
    setPreviewPath('');
    setEditorOpen(false);
  };

  const startCreate = () => {
    resetEditor();
    setError('');
    setNotice('');
    setEditorOpen(true);
  };

  const applyPreset = (preset: typeof PRESET_SNIPPETS[0]) => {
    setName(preset.name);
    setCategory(preset.category);
    setChannel(preset.channel);
    if (preset.channel === 'email') {
      setLineType('text');
      setSubject(preset.subject || '');
      setBody(preset.body || '');
      setAltText('');
      setFlexJson('');
    } else {
      setLineType(preset.lineType || 'text');
      setSubject('');
      setBody(preset.body || '');
      setAltText(preset.altText || '');
      setFlexJson(preset.flexJson || '');
    }
  };

  const startEdit = (item: TemplateRow) => {
    setEditing(item);
    setName(item.name);
    setCategory(VALID_CATEGORIES.has(item.category) ? item.category : 'announcement');
    setChannel(item.channel);
    if (item.source === 'communication') {
      setLineType('text');
      setSubject(item.subject);
      setBody(item.body);
      setAssetUrl('');
      setPreviewUrl('');
      setAssetPath('');
      setPreviewPath('');
      setAltText('');
      setFlexJson('');
    } else {
      const payload = item.payload || {};
      setLineType(item.type);
      setSubject('');
      setBody(String(payload.text || ''));
      setAltText(String(payload.altText || ''));
      setFlexJson(payload.contents ? JSON.stringify(payload.contents, null, 2) : '');
      const paths = Array.isArray(payload.storagePaths) ? payload.storagePaths : [];
      const isVideo = item.type === 'video';
      setAssetUrl(isVideo ? String(payload.originalContentUrl || '') : item.type === 'image' ? String(payload.originalContentUrl || '') : '');
      setPreviewUrl(String(payload.previewImageUrl || ''));
      setAssetPath(typeof paths[0] === 'string' ? paths[0] : '');
      setPreviewPath(typeof paths[1] === 'string' ? paths[1] : '');
    }
    setError('');
    setNotice('');
    setEditorOpen(true);
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
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadAsset(file, slot === 'asset' && lineType === 'video' ? 'video' : 'image');
      if (slot === 'asset') {
        setAssetPath(uploaded.path);
        setAssetUrl(uploaded.url);
      } else {
        setPreviewPath(uploaded.path);
        setPreviewUrl(uploaded.url);
      }
    } catch (e: any) {
      setError(e.message || '素材をアップロードできませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const removeStoredAssets = async (paths: string[]) => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (!db || uniquePaths.length === 0) return;
    const { error: storageError } = await db.storage.from(BUCKET).remove(uniquePaths);
    if (storageError) setError((current) => current || `テンプレートは保存しましたが、古い素材を削除できませんでした: ${storageError.message}`);
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!db) {
      setError('Supabaseに接続してください。');
      return;
    }
    if (!ownerId) {
      setError('ログインしてください。');
      return;
    }
    if (!name.trim()) {
      setError('テンプレート名を入力してください。');
      return;
    }
    setError('');
    setNotice('');

    let linePayload: Record<string, any> | null = null;
    if (channel === 'line') {
      if (lineType === 'text' && !body.trim()) {
        setError('本文を入力してください。');
        return;
      }
      if ((lineType === 'image' || lineType === 'video') && (!assetUrl || !previewUrl || !assetPath || !previewPath)) {
        setError('素材本体とプレビュー画像をアップロードしてください。');
        return;
      }
      if (lineType === 'video' && !altText.trim()) {
        setError('動画の代替テキストを入力してください。');
        return;
      }
      if (lineType === 'flex') {
        if (!altText.trim()) {
          setError('Flexメッセージの代替テキストを入力してください。');
          return;
        }
        try {
          const contents = JSON.parse(flexJson);
          if (!contents || typeof contents !== 'object' || !['bubble', 'carousel'].includes(contents.type)) {
            throw new Error();
          }
          linePayload = { altText: altText.trim(), contents };
        } catch {
          setError('Flex本文はbubbleまたはcarousel形式の正しいJSONで入力してください。');
          return;
        }
      } else if (lineType === 'text') {
        linePayload = { text: body.trim() };
      } else {
        linePayload = {
          originalContentUrl: assetUrl,
          previewImageUrl: previewUrl,
          ...(lineType === 'video' ? { altText: altText.trim() } : {}),
          storagePaths: [assetPath, previewPath],
        };
      }
    }

    setBusy(true);
    let saveError: any = null;
    let oldPaths: string[] = [];

    if (editing?.source === 'communication' || (!editing && channel === 'email')) {
      const previous = editing?.source === 'communication' ? emailTemplates.find((item) => item.id === editing.id) : null;
      if (editing?.source === 'communication' && previous) {
        const { error: updateError } = await db.from('communication_templates').update({
          name: name.trim(),
          category,
          subject: channel === 'email' ? subject : '',
          body_text: body,
          updated_at: new Date().toISOString(),
        }).eq('id', editing.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await db.from('communication_templates').insert({
          owner_id: ownerId,
          template_key: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          category,
          channel: 'email',
          name: name.trim(),
          subject,
          body_text: body,
        });
        saveError = insertError;
      }
    } else {
      const previous = editing?.source === 'line' ? lineTemplates.find((item) => item.id === editing.id) : null;
      const oldPayload = previous?.payload || {};
      oldPaths = Array.isArray(oldPayload.storagePaths) ? oldPayload.storagePaths.filter((path: unknown): path is string => typeof path === 'string') : [];
      const payload = linePayload || { text: body.trim() };

      const result = editing?.source === 'line'
        ? await db.from('line_auto_reply_templates').update({
            name: name.trim(),
            reply_type: lineType,
            payload,
            updated_at: new Date().toISOString(),
          }).eq('id', editing.id)
        : await db.from('line_auto_reply_templates').insert({
            owner_id: ownerId,
            name: name.trim(),
            reply_type: lineType,
            payload,
          });
      saveError = result.error;
      if (saveError) oldPaths = [];
    }

    if (saveError) {
      setError(saveError.message);
    } else {
      if (editing?.source === 'line') {
        const savedPayload = linePayload || { text: body.trim() };
        const retainedPaths = Array.isArray(savedPayload.storagePaths) ? savedPayload.storagePaths : [];
        await removeStoredAssets(oldPaths.filter((path) => !retainedPaths.includes(path)));
      }
      setNotice('文例・LINE素材ストックに保存しました。一斉配信・個別送信の引用・LINE受信箱ですぐに呼び出せます。');
      resetEditor();
      await load();
    }
    setBusy(false);
  };

  const deleteTemplate = async (item: TemplateRow) => {
    if (!db) return;
    setError('');
    setNotice('');
    const result = item.source === 'communication'
      ? await db.from('communication_templates').delete().eq('id', item.id)
      : await db.from('line_auto_reply_templates').delete().eq('id', item.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (item.source === 'line') {
      const paths = Array.isArray(item.payload.storagePaths) ? item.payload.storagePaths.filter((path: unknown): path is string => typeof path === 'string') : [];
      await removeStoredAssets(paths);
    }
    setNotice(`テンプレート「${item.name}」を削除しました。`);
    await load();
  };

  const typeOf = (item: TemplateRow) =>
    item.source === 'communication' ? (item.channel === 'email' ? 'メール文面' : 'テキスト') : typeLabel[item.type];

  const channelFilterItems: Array<{ id: 'all' | 'email' | LineType; label: string }> = [
    { id: 'all', label: '全形式' },
    { id: 'email', label: 'メール' },
    { id: 'text', label: 'LINEテキスト' },
    { id: 'flex', label: 'LINE Flex' },
    { id: 'image', label: 'LINE画像' },
    { id: 'video', label: 'LINE動画' },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-slate-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-[19px] font-bold text-slate-800 tracking-tight">文例・LINE素材ストック</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            一斉配信・個別送信での引用・LINE受信箱の返信で使い回す文例やLINE素材（Flex・画像・動画）を管理します。（※自動配信ステップや個別送信の標準初期文面とは独立しています）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPresets((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span>雛形から作成</span>
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            新規作成
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={error ? 'rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800'}
        >
          {error || notice}
        </div>
      )}

      {/* Collapsible Preset Fast Picker */}
      {showPresets && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>よく使う定型雛形（クリックして編集画面を開く）</span>
            <button type="button" onClick={() => setShowPresets(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SNIPPETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  resetEditor();
                  applyPreset(preset);
                  setShowPresets(false);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 px-2.5 py-1 text-xs text-purple-800 transition cursor-pointer font-medium"
              >
                <Copy className="h-3 w-3 text-purple-600" />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-purple-600" /> 用途:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            すべて
          </button>
          {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setCategoryFilter(catKey)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                categoryFilter === catKey
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {catLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1">媒体:</span>
            {channelFilterItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setChannelFilter(item.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  channelFilter === item.id
                    ? 'border-purple-300 bg-purple-50 text-purple-800 font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="テンプレート名や本文で検索…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Spacious 2-Column Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={(event) => void saveTemplate(event)}
            className="bg-white border border-slate-200 rounded-2xl max-w-6xl w-[95vw] h-[90vh] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editing ? 'テンプレートを編集' : '新規テンプレート作成'}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Column: Form Inputs & Large Body */}
              <div className="lg:col-span-7 p-6 overflow-y-auto flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-200">
                <div className="grid gap-3 md:grid-cols-12">
                  <label className="text-xs font-bold text-slate-700 md:col-span-6">
                    テンプレート名 <span className="text-rose-500">*</span>
                    <input
                      required
                      maxLength={120}
                      placeholder="例: 【診断】製造業向け3分無料診断案内"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                  </label>

                  <label className="text-xs font-bold text-slate-700 md:col-span-3">
                    用途 <span className="text-rose-500">*</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
                        <option key={catKey} value={catKey}>
                          {catLabel}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-bold text-slate-700 md:col-span-3">
                    媒体
                    <select
                      disabled={!!editing}
                      value={channel}
                      onChange={(event) => {
                        const value = event.target.value as Channel;
                        setChannel(value);
                        if (value === 'email') setLineType('text');
                      }}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="email">メール</option>
                      <option value="line">LINE</option>
                    </select>
                  </label>
                </div>

                {channel === 'line' && (
                  <label className="text-xs font-bold text-slate-700 max-w-xs">
                    LINE形式
                    <select
                      disabled={editing?.source === 'communication'}
                      value={lineType}
                      onChange={(event) => {
                        setLineType(event.target.value as LineType);
                        setBody('');
                        setAltText('');
                        setFlexJson('');
                        setAssetUrl('');
                        setAssetPath('');
                        setPreviewUrl('');
                        setPreviewPath('');
                      }}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    >
                      {Object.entries(typeLabel).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {channel === 'email' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      件名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      maxLength={200}
                      placeholder="例: 【3分無料診断】改善優先度レポートのご案内｜{会社名} 様"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}

                {(channel === 'email' || lineType === 'text') && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      本文 <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={16}
                      maxLength={10000}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      className="flex-1 min-h-[340px] block w-full rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 font-sans leading-relaxed focus:border-purple-500 focus:outline-none resize-y"
                      placeholder="お名前は {お名前}、会社名は {会社名}、診断URLは {案内URL}、面談カレンダーは {面談予約URL} のように埋め込めます。"
                    />
                    <PlaceholderAssist
                      text={body}
                      onInsert={(token) => setBody((curr) => curr + token)}
                      showPreview={false}
                      compact
                    />
                  </div>
                )}

                {channel === 'line' && (lineType === 'image' || lineType === 'video') && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      {lineType === 'video' ? '動画ファイル（MP4）' : '画像ファイル（JPEG / PNG）'}
                      <input
                        type="file"
                        accept={lineType === 'video' ? 'video/mp4' : 'image/jpeg,image/png'}
                        onChange={(event) => void onUpload(event.target.files?.[0], 'asset')}
                        className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-slate-700"
                      />
                      {assetUrl && <span className="mt-1 block break-all text-[11px] text-purple-700 font-mono">URL: {assetUrl}</span>}
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      プレビュー画像（JPEG / PNG）
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(event) => void onUpload(event.target.files?.[0], 'preview')}
                        className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-slate-700"
                      />
                      {previewUrl && <span className="mt-1 block break-all text-[11px] text-purple-700 font-mono">URL: {previewUrl}</span>}
                    </label>
                    {lineType === 'video' && (
                      <label className="block text-xs font-bold text-slate-700">
                        代替テキスト
                        <input
                          required
                          value={altText}
                          onChange={(event) => setAltText(event.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500"
                        />
                      </label>
                    )}
                  </div>
                )}

                {channel === 'line' && lineType === 'flex' && (
                  <div className="flex-1 min-h-0 flex flex-col gap-3">
                    <label className="block text-xs font-bold text-slate-700">
                      代替テキスト（通知に表示される文字） <span className="text-rose-500">*</span>
                      <input
                        required
                        value={altText}
                        onChange={(event) => setAltText(event.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500"
                      />
                    </label>
                    <div className="flex-1 min-h-0 flex flex-col">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Flex JSON構造 <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={14}
                        value={flexJson}
                        onChange={(event) => setFlexJson(event.target.value)}
                        className="flex-1 min-h-[300px] block w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 focus:border-purple-500 resize-y"
                        placeholder='{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[...]}}'
                      />
                      <PlaceholderAssist
                        text={flexJson}
                        onInsert={(token) => setFlexJson((curr) => curr + token)}
                        showPreview={false}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Preview */}
              <div className="lg:col-span-5 p-6 bg-slate-50/70 overflow-y-auto space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  {channel === 'email' ? (
                    <>
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>メール受信プレビュー（サンプル差込済み）</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>LINE表示プレビュー</span>
                    </>
                  )}
                </div>

                {channel === 'email' ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/60 space-y-1">
                      <div className="text-[11px] text-slate-500">
                        宛先例: 株式会社サンプル 山田 太郎 様
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {renderPlaceholders(subject || '（件名未設定）', PLACEHOLDER_SAMPLE_VALUES)}
                      </div>
                    </div>
                    <div className="p-4 whitespace-pre-wrap leading-relaxed text-slate-800 text-xs font-sans max-h-[520px] overflow-y-auto">
                      {appendEmailFooter(
                        renderPlaceholders(body || '（本文未設定）', PLACEHOLDER_SAMPLE_VALUES),
                        { senderEmail: 'contact@mstcorp.info' }
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#7494c0] rounded-2xl">
                    <LineMessagePreview
                      type={lineType}
                      title={name || 'LINEテンプレート'}
                      payload={
                        lineType === 'text'
                          ? { text: renderPlaceholders(body || '（本文未設定）', PLACEHOLDER_SAMPLE_VALUES) }
                          : lineType === 'image'
                          ? { originalContentUrl: assetUrl, previewImageUrl: previewUrl }
                          : lineType === 'video'
                          ? { originalContentUrl: assetUrl, previewImageUrl: previewUrl, altText }
                          : { altText, contents: flexJson }
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                disabled={busy}
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <Save className="h-4 w-4" />
                {busy ? '保存中…' : 'テンプレートを保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates Table List */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">媒体</th>
              <th className="p-3">カテゴリ（用途）</th>
              <th className="p-3">テンプレート名</th>
              <th className="p-3">更新日時</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  テンプレートを読み込み中…
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  条件に合致するテンプレートはありません。「新規作成」または上部のプリセットから追加できます。
                </td>
              </tr>
            ) : (
              visibleRows.map((item) => (
                <tr key={item.source + item.id} className="text-slate-800 hover:bg-slate-50/70 transition">
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      item.channel === 'email' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {item.channel === 'email' ? 'メール' : `LINE (${typeOf(item)})`}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700 font-medium">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{item.name}</div>
                    {item.source === 'communication' && item.subject && (
                      <div className="text-slate-500 truncate max-w-md mt-0.5">件名: {item.subject}</div>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                      >
                        編集
                      </button>
                      <InlineDeleteButton
                        warning={`テンプレート「${item.name}」を削除しますか？${item.source === 'line' ? ' 関連ファイルも削除されます。' : ''}`}
                        onConfirm={() => deleteTemplate(item)}
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" />
                        削除
                      </InlineDeleteButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
        <span>合計 {visibleRows.length} 件の文例・素材を表示中</span>
        <span>※LINE画像・動画の素材ファイルはSupabase Storageでセキュアに管理されます。</span>
      </div>
    </section>
  );
};
