import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Search,
  Bookmark,
  BookOpen,
  Link2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  FilePlus2,
} from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { OfficialLinkItem } from '../../types/marketing';
import { loadStoredOfficialLinks, OFFICIAL_VERCEL_URLS } from '../../utils/marketingStorage';
import { loadKnowledgeItems } from '../../utils/storage';
import type { KnowledgeItem } from '../../types/ai-president';
import { InlineDeleteButton } from '../InlineDeleteButton';

export type DmTemplateCategory =
  | '初回アプローチ'
  | 'リアクションお礼'
  | 'フォローアップ'
  | '返信・商談案内'
  | '提携提案'
  | 'その他';

export type DmPlatform = 'x' | 'instagram' | 'linkedin' | 'facebook' | 'threads' | 'all';

export interface DmTemplateItem {
  id: string;
  title: string;
  category: DmTemplateCategory;
  platform: DmPlatform;
  body: string;
  usageNote?: string;
  isPreset?: boolean;
  updatedAt: string;
}

export interface SocialDmSalesStudioProps {
  mode?: 'outbound' | 'inbound' | 'all';
  onNavigateTab?: (tab: any, options?: any) => void;
}

const STORAGE_KEY = 'mst_dm_templates_v1';

const CATEGORY_OPTIONS: DmTemplateCategory[] = [
  '初回アプローチ',
  'リアクションお礼',
  'フォローアップ',
  '返信・商談案内',
  '提携提案',
  'その他',
];

const PLATFORM_LABELS: Record<DmPlatform, string> = {
  all: '全SNS共通',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const DEFAULT_OFFICIAL_LINKS: OfficialLinkItem[] = [
  {
    id: 'diagnosis',
    title: '3分無料経営診断',
    url: OFFICIAL_VERCEL_URLS.diagnosis,
    badge: '診断',
    description: '課題整理・無料診断',
  },
  {
    id: 'care_consult',
    title: '介護保険外サービス開業LP',
    url: OFFICIAL_VERCEL_URLS.care_consult,
    badge: 'LP',
    description: '介護保険外事業の相談案内',
  },
  {
    id: 'material_download',
    title: '会社案内・資料ダウンロード',
    url: OFFICIAL_VERCEL_URLS.material_download,
    badge: '資料',
    description: '資料請求ページ',
  },
  {
    id: 'media_top',
    title: '自社コーポレートHP',
    url: OFFICIAL_VERCEL_URLS.media_top,
    badge: 'HP',
    description: '公式トップページ',
  },
];

const STARTER_DM_TEMPLATES: DmTemplateItem[] = [
  {
    id: 'tpl_reaction_thanks',
    title: 'リアクションへのお礼',
    category: 'リアクションお礼',
    platform: 'all',
    usageNote: '投稿への「いいね」やリポスト後に、売り込み感なく接点をつくる時用',
    isPreset: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: `{{相手のお名前}}様

突然のメッセージ失礼いたします。有限会社MSTの大橋と申します。

先ほどは私の投稿にリアクションをいただき、誠にありがとうございました！
{{相手のお名前}}様の日頃の発信も拝見しており、{{相手の関心事}}に関する視点に大変共感しておりました。

もしよろしければ、今後とも情報交換などさせていただけますと幸いです。
急ぎの用件ではございませんので、返信はお気になさらないでくださいね。

引き続きよろしくお願いいたします！`,
  },
  {
    id: 'tpl_first_outreach',
    title: '経営課題への共感・無料診断のご案内',
    category: '初回アプローチ',
    platform: 'all',
    usageNote: '相手の投稿で業務課題・人手不足などに触れていた時の初回DM',
    isPreset: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: `{{相手のお名前}}様

突然のDMにて失礼いたします。
有限会社MSTにて中小企業の「業務の仕組み化・利益改善」を支援しております、大橋真人と申します。

{{相手のお名前}}様の「{{相手の関心事}}」についての発信を拝見し、まさに多くの経営者様が頭を悩ませているテーマだと強く感じ、思わずご連絡いたしました。

弊社でも同じ課題を抱えていた企業様向けに、3分でボトルネックを整理できる「無料経営診断シート」をご用意しております。
押し売り等は一切ございませんので、もし今後のご参考になりそうでしたらご覧いただけますと幸いです。

▼ 無料診断・解決事例はこちら
{{公式案内リンク}}

お忙しいところ恐縮ですが、何卒よろしくお願いいたします。`,
  },
  {
    id: 'tpl_follow_up',
    title: 'フォローアップ（数日後の近況伺い）',
    category: 'フォローアップ',
    platform: 'all',
    usageNote: '初回DM後、返信を催促せずに新しいお役立ち情報を届ける時用',
    isPreset: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: `{{相手のお名前}}様

先日メッセージをお送りいたしました、有限会社MSTの大橋です。
お忙しい中でのご連絡となり恐縮です。

先日の{{相手の関心事}}の件につきまして、同業種での具体的な改善事例がまとまりましたので、お時間の許す際に参考程度にご覧いただければと思いお送りいたしました。

▼ 改善事例・無料診断はこちら
{{公式案内リンク}}

ご多忙の折、返信のお気遣いは不要でございます。
貴社の事業の発展を心より応援しております！`,
  },
  {
    id: 'tpl_inbound_consult',
    title: '問い合わせDMへの返信・30分オンライン相談案内',
    category: '返信・商談案内',
    platform: 'all',
    usageNote: '相手からDMで質問や相談をもらった後の返信・日程調整用',
    isPreset: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: `{{相手のお名前}}様

ご連絡いただき、誠にありがとうございます！有限会社MSTの大橋真人と申します。

{{相手の関心事}}についてのお問い合わせ、大変嬉しく拝読いたしました。
具体的な進め方や費用感につきましては、貴社の現在の体制を15〜30分ほど伺った上で、一番無理のない形をご提案できます。

営業色のない気軽な「オンライン壁打ち相談（30分・無料）」もご用意しておりますので、よろしければ以下よりご都合の良い日時をお選びください。

▼ オンライン相談・ご案内リンク
{{公式案内リンク}}

もちろんこのままDM上でのやり取りでも大歓迎です。引き続きよろしくお願いいたします！`,
  },
  {
    id: 'tpl_care_collab',
    title: '介護保険外サービス開業・協業のご案内',
    category: '提携提案',
    platform: 'all',
    usageNote: '介護・医療・福祉関連事業者への事業立ち上げ／協業提案用',
    isPreset: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: `{{相手のお名前}}様

突然のメッセージにて失礼いたします。有限会社MSTの大橋と申します。

{{相手のお名前}}様の地域密着での取り組みを拝見し、弊社の介護保険外サービス（自費事業立ち上げ・集客支援）のノウハウと親和性が高いと感じご連絡いたしました。

直営事業「アシスタ大垣」での実務モデルをもとにした開業パッケージ資料もございますので、ご関心がございましたら一度情報交換させていただけますと幸いです。

▼ 介護保険外サービス開業のご案内
{{公式案内リンク}}

ご多忙のところ恐れ入りますが、何卒よろしくお願いいたします。`,
  },
];

export const SocialDmSalesStudio: React.FC<SocialDmSalesStudioProps> = () => {
  const [templates, setTemplates] = useState<DmTemplateItem[]>(STARTER_DM_TEMPLATES);
  const [selectedId, setSelectedId] = useState<string>(STARTER_DM_TEMPLATES[0].id);

  // 編集中のフォーム状態
  const [title, setTitle] = useState<string>(STARTER_DM_TEMPLATES[0].title);
  const [category, setCategory] = useState<DmTemplateCategory>(STARTER_DM_TEMPLATES[0].category);
  const [platform, setPlatform] = useState<DmPlatform>(STARTER_DM_TEMPLATES[0].platform);
  const [usageNote, setUsageNote] = useState<string>(STARTER_DM_TEMPLATES[0].usageNote || '');
  const [body, setBody] = useState<string>(STARTER_DM_TEMPLATES[0].body);

  // フィルター・検索
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 公式リンク・社内ナレッジ連携
  const [officialLinks, setOfficialLinks] = useState<OfficialLinkItem[]>(DEFAULT_OFFICIAL_LINKS);
  const [selectedLinkId, setSelectedLinkId] = useState<string>(DEFAULT_OFFICIAL_LINKS[0].id);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string>('');

  // AI作成/改善入力
  const [aiInstruction, setAiInstruction] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const applyTemplateToEditor = (item: DmTemplateItem) => {
    setSelectedId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setPlatform(item.platform);
    setUsageNote(item.usageNote || '');
    setBody(item.body);
  };

  useEffect(() => {
    const storedLinks = loadStoredOfficialLinks();
    if (storedLinks && storedLinks.length > 0) {
      setOfficialLinks(storedLinks);
      setSelectedLinkId(storedLinks[0].id);
    }

    // ローカルナレッジ読み込み
    const localKnowledge = loadKnowledgeItems();
    if (localKnowledge.length > 0) {
      setKnowledgeItems(localKnowledge);
    }

    // ローカルテンプレート読み込み
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
          applyTemplateToEditor(parsed[0]);
        }
      }
    } catch {}

    // Supabase からテンプレートとナレッジを同期
    const loadRemote = async () => {
      const db = getSupabase();
      if (!db) return;
      try {
        const { data: auth } = await db.auth.getUser();
        if (!auth.user) return;

        const [tplRes, knowRes] = await Promise.all([
          db
            .from('mst_ai_acquisition_records')
            .select('*')
            .eq('user_id', auth.user.id)
            .eq('record_type', 'dm_template')
            .order('updated_at', { ascending: false }),
          db
            .from('mst_ai_knowledge_items')
            .select('payload')
            .eq('user_id', auth.user.id)
            .order('updated_at', { ascending: false }),
        ]);

        if (knowRes.data && knowRes.data.length > 0) {
          const remoteKnow = knowRes.data
            .map((r: any) => r.payload as KnowledgeItem)
            .filter((k) => k && k.id && k.title);
          if (remoteKnow.length > 0) {
            setKnowledgeItems((prev) => {
              const map = new Map<string, KnowledgeItem>();
              [...remoteKnow, ...prev].forEach((item) => {
                if (item?.id && !map.has(item.id)) map.set(item.id, item);
              });
              return Array.from(map.values());
            });
          }
        }

        if (tplRes.data && tplRes.data.length > 0) {
          const remoteTemplates: DmTemplateItem[] = tplRes.data.map((r: any) => ({
            id: r.id,
            title: r.title || '無題のテンプレート',
            category: CATEGORY_OPTIONS.includes(r.payload?.category) ? r.payload.category : 'その他',
            platform: (r.payload?.platform as DmPlatform) || 'all',
            body: r.payload?.body || '',
            usageNote: r.payload?.usageNote || '',
            isPreset: Boolean(r.payload?.isPreset),
            updatedAt: r.updated_at || new Date().toISOString(),
          }));

          // 未登録の初期テンプレートも補完しつつ、ユーザー保存済みを優先
          const map = new Map<string, DmTemplateItem>();
          remoteTemplates.forEach((t) => map.set(t.id, t));
          STARTER_DM_TEMPLATES.forEach((starter) => {
            if (!map.has(starter.id)) map.set(starter.id, starter);
          });
          const merged = Array.from(map.values());
          setTemplates(merged);
          applyTemplateToEditor(merged[0]);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      } catch (err) {
        console.warn('DM templates / knowledge load failed:', err);
      }
    };

    void loadRemote();
  }, []);

  const persistTemplate = async (item: DmTemplateItem, nextList: DmTemplateItem[]) => {
    setTemplates(nextList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch {}

    const db = getSupabase();
    if (!db) return;
    try {
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return;
      await db.from('mst_ai_acquisition_records').upsert(
        {
          user_id: auth.user.id,
          id: item.id,
          record_type: 'dm_template',
          title: item.title,
          status: '保存済み',
          payload: {
            category: item.category,
            platform: item.platform,
            body: item.body,
            usageNote: item.usageNote || '',
            isPreset: Boolean(item.isPreset),
          },
          updated_at: item.updatedAt,
        },
        { onConflict: 'user_id,id' }
      );
    } catch (err) {
      console.warn('Supabase DM template save failed:', err);
    }
  };

  const handleStartNew = () => {
    setSelectedId('');
    setTitle('');
    setCategory('初回アプローチ');
    setPlatform('all');
    setUsageNote('');
    setBody('');
    setFeedback(null);
  };

  const handleSave = async (asNew = false) => {
    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'テンプレート名を入力してください。' });
      return;
    }
    if (!body.trim()) {
      setFeedback({ type: 'error', message: 'テンプレート本文を入力してください。' });
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const targetId =
        asNew || !selectedId
          ? `dm_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          : selectedId;

      const existing = templates.find((t) => t.id === targetId);
      const item: DmTemplateItem = {
        id: targetId,
        title: asNew && selectedId ? `${title.trim()}（コピー）` : title.trim(),
        category,
        platform,
        usageNote: usageNote.trim(),
        body: body.trim(),
        isPreset: asNew ? false : Boolean(existing?.isPreset),
        updatedAt: now,
      };

      const nextList = existing && !asNew
        ? templates.map((t) => (t.id === targetId ? item : t))
        : [item, ...templates];

      await persistTemplate(item, nextList);
      applyTemplateToEditor(item);
      setFeedback({
        type: 'success',
        message: asNew ? '新しいテンプレートとして保管庫に保存しました。' : 'テンプレートを保存しました。',
      });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const nextList = templates.filter((t) => t.id !== id);
    const fallbackList = nextList.length > 0 ? nextList : STARTER_DM_TEMPLATES;
    setTemplates(fallbackList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackList));
    } catch {}

    const db = getSupabase();
    if (db) {
      try {
        const { data: auth } = await db.auth.getUser();
        if (auth.user) {
          await db
            .from('mst_ai_acquisition_records')
            .delete()
            .eq('user_id', auth.user.id)
            .eq('record_type', 'dm_template')
            .eq('id', id);
        }
      } catch (err) {
        console.warn('Supabase DM template delete failed:', err);
      }
    }

    if (selectedId === id) {
      applyTemplateToEditor(fallbackList[0]);
    }
    setFeedback({ type: 'info', message: 'テンプレートを削除しました。' });
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleRestorePreset = async () => {
    const preset = STARTER_DM_TEMPLATES.find((p) => p.id === selectedId);
    if (!preset) return;
    const restored: DmTemplateItem = { ...preset, updatedAt: new Date().toISOString() };
    const nextList = templates.map((t) => (t.id === preset.id ? restored : t));
    await persistTemplate(restored, nextList);
    applyTemplateToEditor(restored);
    setFeedback({ type: 'info', message: '標準テンプレートの内容に戻しました。' });
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleInsertLink = () => {
    const link = officialLinks.find((l) => l.id === selectedLinkId);
    if (!link) return;
    const insertion = link.url;
    if (body.includes('{{公式案内リンク}}')) {
      setBody((prev) => prev.replaceAll('{{公式案内リンク}}', insertion));
    } else {
      setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n▼ ${link.title}\n${insertion}` : insertion));
    }
  };

  const handleCopy = () => {
    if (!body.trim()) return;
    const link = officialLinks.find((l) => l.id === selectedLinkId);
    const resolved = link ? body.replaceAll('{{公式案内リンク}}', link.url) : body;
    navigator.clipboard.writeText(resolved);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAiGenerate = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: 'AIが営業DMテンプレートを作成・調整しています…' });

    try {
      const selectedKnow = knowledgeItems.find((k) => k.id === selectedKnowledgeId);
      const selectedLink = officialLinks.find((l) => l.id === selectedLinkId);

      const prompt = `あなたはBtoBのSNS DM営業に強いコピーライターです。
押し売り感を出さず、相手への敬意と共感があり、返信や案内リンク確認につながりやすい営業DMテンプレートを作成してください。

【作成条件】
・テンプレート名: ${title || '新規営業DM'}
・用途カテゴリ: ${category}
・想定SNS: ${PLATFORM_LABELS[platform]}
・用途メモ / 狙い: ${usageNote || '自然な関係構築から無料診断・相談へつなぐ'}
・差し込みたいリンク: ${selectedLink ? `${selectedLink.title} (${selectedLink.url})` : '{{公式案内リンク}}'}
・ユーザーからの指示: ${aiInstruction.trim() || '自然で読みやすく、スマホのDM画面でも圧迫感のない長さに整えてください。'}

${body.trim() ? `【現在の下書き（これを土台に改善・書き直し）】\n${body.trim()}\n` : ''}
【出力ルール】
・そのまま使える完成文面のみを出力してください（前置きや解説は不要）。
・差し替えが必要な固有名詞は {{相手のお名前}} や {{相手の関心事}} のように分かりやすく残してください。`;

      const knowledgeContext = selectedKnow
        ? `【参照する社内ナレッジ: ${selectedKnow.title}】\n${selectedKnow.content}`
        : undefined;

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'marketing_execution',
          knowledgeContext,
          character: {
            name: '営業DMテンプレート作成担当',
            role: '誠実で返信率の高いDM文面作成',
            personality: '丁寧で簡潔、相手の立場を尊重する',
            tone: '誠実・自然・プロフェッショナル',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI生成に失敗しました。');

      setBody(data.text.trim());
      if (!title.trim()) {
        setTitle(`${category}テンプレート`);
      }
      setFeedback({ type: 'success', message: 'DMテンプレートを作成しました。内容を確認し、必要に応じて「テンプレートを保存」してください。' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'AI作成に失敗しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          (t.usageNote || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templates, categoryFilter, searchQuery]);

  const currentIsPreset = Boolean(STARTER_DM_TEMPLATES.some((p) => p.id === selectedId));

  return (
    <div className="space-y-4 text-slate-800">
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-purple-200 bg-purple-50 text-purple-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── 左カラム (4カラム): テンプレート保管庫リスト ── */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-purple-700" />
              <span>テンプレート一覧</span>
              <span className="text-xs font-semibold text-slate-500">({filteredTemplates.length})</span>
            </h3>
            <button
              type="button"
              onClick={handleStartNew}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1.5 text-xs font-bold text-white transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新規作成</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="テンプレート名・本文で検索..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {['all', ...CATEGORY_OPTIONS].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'すべて' : cat}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredTemplates.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">該当するテンプレートがありません。</p>
            ) : (
              filteredTemplates.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyTemplateToEditor(item)}
                    className={`w-full text-left p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-purple-50/80 border-purple-400 ring-1 ring-purple-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {PLATFORM_LABELS[item.platform]}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.body}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── 右カラム (8カラム): ゆったり使える作成・AI編集エディタ ── */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {selectedId ? 'テンプレートの編集・コピー' : '新しい営業DMテンプレートを作成'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                よく使うDM文面をここに保存しておき、そのままコピーして各SNSから送信できます。
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentIsPreset && (
                <button
                  type="button"
                  onClick={() => void handleRestorePreset()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>標準に戻す</span>
                </button>
              )}
              {selectedId && !currentIsPreset && (
                <InlineDeleteButton
                  onConfirm={() => void handleDelete(selectedId)}
                  warning="このテンプレートを削除しますか？"
                  confirmLabel="削除する"
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition cursor-pointer"
                  ariaLabel="テンプレートを削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>削除</span>
                </InlineDeleteButton>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1">テンプレート名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 初回アプローチ（介護事業所向け）"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">用途カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DmTemplateCategory)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">想定SNS</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DmPlatform)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
              >
                {Object.entries(PLATFORM_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1">使う場面メモ（任意）</label>
              <input
                type="text"
                value={usageNote}
                onChange={(e) => setUsageNote(e.target.value)}
                placeholder="例: 投稿にいいねしてくれた経営者への初回挨拶用"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5 text-purple-600" />
                <span>案内リンクを差し込む</span>
              </label>
              <div className="flex gap-1.5">
                <select
                  value={selectedLinkId}
                  onChange={(e) => setSelectedLinkId(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-none"
                >
                  {officialLinks.map((link) => (
                    <option key={link.id} value={link.id}>
                      {link.title} ({link.url})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  className="shrink-0 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-2 text-xs font-bold text-purple-700 transition cursor-pointer"
                >
                  リンク挿入
                </button>
              </div>
            </div>
          </div>

          {/* ── メイン本文エディタ（広め） ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">テンプレート本文</label>
              <span className="text-[11px] font-mono text-slate-500">{body.length}文字</span>
            </div>
            <textarea
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="ここにDMテンプレート文面を入力するか、下の「AIで作成・調整」を使って草案を作れます…"
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 leading-relaxed focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* ── AI作成・ナレッジ参照バー ── */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>AIで文面を作成・ブラッシュアップ（社内ナレッジ参照対応）</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <select
                  value={selectedKnowledgeId}
                  onChange={(e) => setSelectedKnowledgeId(e.target.value)}
                  className="w-full rounded-lg border border-purple-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">社内ナレッジを参照しない（標準）</option>
                  {knowledgeItems.map((k) => (
                    <option key={k.id} value={k.id}>
                      📚 {k.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="指示例: もう少し短く柔らかく／介護施設向けに書き直して"
                  className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={aiGenerating}
                  onClick={() => void handleAiGenerate()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{aiGenerating ? '作成中…' : 'AIで作成・調整'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── 保存＆コピーバー ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!body.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              <span>{copied ? 'コピーしました！' : '文面をコピー（リンク反映済）'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {selectedId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-800 transition cursor-pointer disabled:opacity-50"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>別名で新規保存</span>
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>{saving ? '保存中…' : 'テンプレートを保存'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
