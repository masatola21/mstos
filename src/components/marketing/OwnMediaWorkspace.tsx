import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { Plus, Save, Trash2, Sparkles, RefreshCw, Globe, ExternalLink, Send, CheckCircle2, AlertCircle, Wrench, FileText, ArrowRight, Code2, Zap, Layers, Pencil } from 'lucide-react';
import { TabMarketingAssetManager } from './TabMarketingAssetManager';

type Kind = 'media' | 'article' | 'seo' | 'rewrite' | 'attribution';
type Row = {
  id: string;
  record_type: Kind;
  title: string;
  product_id: string | null;
  status: string | null;
  payload: Record<string, string>;
  updated_at: string;
};
type Product = { id: string; product_name: string };
type Lead = { id: string; source?: string | null; report_url?: string | null };
type Deal = { id: string; lead_id?: string | null; proposal_status?: string | null };

const kinds: Kind[] = ['media', 'article', 'seo', 'rewrite', 'attribution'];

const sections = [
  ['articles', '📝 記事作成・自社HP公開'],
  ['settings', '🌐 自社HP（Astro・Vercel）連携設定'],
  ['seo', '📈 SEO・アクセス分析'],
  ['rewrite', '🔄 リライト・記事改善'],
  ['attribution', '🤝 リード・売上成果'],
] as const;
type Tab = typeof sections[number][0];

const cls = 'mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500';

export const OwnMediaWorkspace: React.FC<{
  products: Product[];
  onAskAI?: (prompt: string) => void;
  strategyContext?: string;
  userId?: string;
}> = ({ products, onAskAI, strategyContext = '', userId: propUserId }) => {
  const [tab, setTab] = useState<Tab>('articles');
  const [rows, setRows] = useState<Row[]>([]);
  const [userId, setUserId] = useState(propUserId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [form, setForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crmLeads, setCrmLeads] = useState<Lead[]>([]);
  const [crmDeals, setCrmDeals] = useState<Deal[]>([]);

  // AI自動生成状態
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [aiError, setAiError] = useState('');

  // CMS投稿状態
  const [cmsPosting, setCmsPosting] = useState<string | null>(null);
  const [cmsResult, setCmsResult] = useState<{ id: string; success: boolean; message: string; url?: string } | null>(null);

  // 自社公式HP / オウンドメディア URL設定（localStorage & Supabase連動）
  const [customSiteUrl, setCustomSiteUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mst_official_site_url') || 'https://corp.mstcorp.info';
    }
    return 'https://corp.mstcorp.info';
  });

  const [customMediaUrl, setCustomMediaUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mst_official_media_url') || 'https://corp.mstcorp.info/media';
    }
    return 'https://corp.mstcorp.info/media';
  });

  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [tempSiteUrl, setTempSiteUrl] = useState<string>('');
  const [tempMediaUrl, setTempMediaUrl] = useState<string>('');
  const [savingUrlConfig, setSavingUrlConfig] = useState<boolean>(false);

  // Vercel Deploy Hook テスト状態
  const [testingDeployHook, setTestingDeployHook] = useState(false);
  const [deployHookNotice, setDeployHookNotice] = useState<string | null>(null);

  const testVercelDeployHook = async (hookUrl?: string) => {
    const url = hookUrl || payload.vercelDeployHook;
    if (!url || !url.startsWith('https://')) {
      setDeployHookNotice('有効なVercel Deploy Hook URL（https://api.vercel.com/...）を入力してください。');
      return;
    }
    setTestingDeployHook(true);
    setDeployHookNotice(null);
    try {
      await fetch(url, { method: 'POST' });
      setDeployHookNotice('✅ Vercel Deploy Hook の送信に成功しました！Vercel側で再デプロイが開始されました。');
    } catch (err: any) {
      setDeployHookNotice('⚠️ Deploy Hook へのリクエストに失敗しました: ' + (err.message || 'ネットワークエラー'));
    } finally {
      setTestingDeployHook(false);
    }
  };

  const load = async () => {
    const db = getSupabase();
    setLoading(true);
    setError('');
    if (!db) {
      setError('Supabaseに接続してください。既存の集客運用DBへの接続が必要です。');
      setLoading(false);
      return;
    }
    const { data: auth, error: ae } = await db.auth.getUser();
    if (ae || !auth.user) {
      setError('ログイン状態を確認できません。');
      setLoading(false);
      return;
    }
    setUserId(auth.user.id);
    const [saved, leadsResult, dealsResult] = await Promise.all([
      db.from('mst_ai_acquisition_records').select('*').eq('user_id', auth.user.id).in('record_type', kinds).order('updated_at', { ascending: false }),
      db.from('leads').select('id,source,report_url'),
      db.from('deals').select('id,lead_id,proposal_status'),
    ]);
    const { data, error: e } = saved;
    if (!leadsResult.error) setCrmLeads((leadsResult.data || []) as Lead[]);
    if (!dealsResult.error) setCrmDeals((dealsResult.data || []) as Deal[]);
    if (e) {
      setError('自社メディアデータを読み込めませんでした: ' + e.message);
      setLoading(false);
      return;
    }

    const rowsData = (data || []) as Row[];
    setRows(rowsData);

    // 保存済みの公式メディアレコードがあればURLを同期
    const officialRow = rowsData.find((r) => r.record_type === 'media' && (r.id === 'mst_official_corporate_hp' || (r.payload?.cms || '').includes('Astro') || (r.payload?.url || '').includes('mstcorp.info')));
    if (officialRow?.payload?.url) {
      setCustomSiteUrl(officialRow.payload.url);
      if (typeof window !== 'undefined') localStorage.setItem('mst_official_site_url', officialRow.payload.url);
    }
    if (officialRow?.payload?.mediaUrl) {
      setCustomMediaUrl(officialRow.payload.mediaUrl);
      if (typeof window !== 'undefined') localStorage.setItem('mst_official_media_url', officialRow.payload.mediaUrl);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // 自社公式HP・オウンドメディア URL設定の保存
  const handleSaveUrlConfig = async () => {
    let cleanMediaUrl = tempMediaUrl.trim();
    let cleanSiteUrl = tempSiteUrl.trim();
    if (!cleanMediaUrl) {
      cleanMediaUrl = 'https://corp.mstcorp.info/media';
    }
    if (!cleanSiteUrl) {
      cleanSiteUrl = 'https://corp.mstcorp.info';
    }
    if (!cleanMediaUrl.startsWith('http://') && !cleanMediaUrl.startsWith('https://')) {
      cleanMediaUrl = `https://${cleanMediaUrl}`;
    }
    if (!cleanSiteUrl.startsWith('http://') && !cleanSiteUrl.startsWith('https://')) {
      cleanSiteUrl = `https://${cleanSiteUrl}`;
    }

    setSavingUrlConfig(true);
    try {
      setCustomSiteUrl(cleanSiteUrl);
      setCustomMediaUrl(cleanMediaUrl);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mst_official_site_url', cleanSiteUrl);
        localStorage.setItem('mst_official_media_url', cleanMediaUrl);
      }

      // Supabaseに反映
      const db = getSupabase();
      if (db && userId) {
        const targetMediaId = 'mst_official_corporate_hp';
        const existing = media.find((m) => m.id === targetMediaId) || DEFAULT_OFFICIAL_MEDIA;
        const newPayload = {
          ...existing.payload,
          url: cleanSiteUrl,
          mediaUrl: cleanMediaUrl,
        };
        await db.from('mst_ai_acquisition_records').upsert({
          user_id: userId,
          id: targetMediaId,
          record_type: 'media',
          title: existing.title || '有限会社MST 公式オウンドメディア / コーポレートHP',
          status: '連携稼働中',
          payload: newPayload,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,id' });

        setRows((prev) => {
          const others = prev.filter((r) => r.id !== targetMediaId);
          return [
            {
              id: targetMediaId,
              record_type: 'media',
              title: existing.title || '有限会社MST 公式オウンドメディア / コーポレートHP',
              product_id: null,
              status: '連携稼働中',
              payload: newPayload,
              updated_at: new Date().toISOString(),
            } as Row,
            ...others,
          ];
        });
      }

      setNotice(`✅ 自社公式HPの公開先URLを「${cleanMediaUrl}」に更新しました。`);
      setShowUrlModal(false);
    } catch (e: any) {
      setError('URL設定の保存に失敗しました: ' + (e.message || ''));
    } finally {
      setSavingUrlConfig(false);
    }
  };

  // 有限会社MST 公式オウンドメディア / コーポレートHP（Astro + Supabase + Vercel / Google Antigravity）
  const DEFAULT_OFFICIAL_MEDIA: Row = useMemo(() => ({
    id: 'mst_official_corporate_hp',
    record_type: 'media',
    title: '有限会社MST 公式オウンドメディア / コーポレートHP',
    product_id: null,
    status: '連携稼働中',
    payload: {
      url: customSiteUrl,
      mediaUrl: customMediaUrl,
      mediaType: '自社公式メディア / コーポレートHP',
      cms: 'Astro + Supabase (Vercel) / Google Antigravity',
      githubRepo: 'mst-corporate-website (/hp)',
      connectionType: 'supabase_direct',
      target: '中小企業・小規模事業者の経営者・事業責任者',
      purpose: '現場実践の利益改善・業務標準化・DX/AIノウハウの発信とリード獲得',
      vercelDeployHook: '',
    },
    updated_at: new Date().toISOString(),
  }), [customSiteUrl, customMediaUrl]);

  const media = useMemo(() => {
    const list = rows.filter((r) => r.record_type === 'media');
    if (list.length === 0) {
      return [DEFAULT_OFFICIAL_MEDIA];
    }
    const hasOfficial = list.some((m) => (m.payload?.url || '').includes('mstcorp.info') || (m.payload?.cms || '').includes('Astro'));
    if (!hasOfficial) {
      return [DEFAULT_OFFICIAL_MEDIA, ...list];
    }
    return list;
  }, [rows, DEFAULT_OFFICIAL_MEDIA]);

  const articles = useMemo(() => rows.filter((r) => r.record_type === 'article'), [rows]);
  const seoList = useMemo(() => rows.filter((r) => r.record_type === 'seo'), [rows]);
  const rewriteList = useMemo(() => rows.filter((r) => r.record_type === 'rewrite'), [rows]);
  const attributionList = useMemo(() => rows.filter((r) => r.record_type === 'attribution'), [rows]);

  const reset = () => {
    setEditing(null);
    setTitle('');
    setProductId('');
    setPayload(
      tab === 'articles'
        ? {
            mediaId: media[0]?.id || DEFAULT_OFFICIAL_MEDIA.id,
            publishStatus: '下書き',
            category: '経営改善・利益改善',
            slug: '',
          }
        : tab === 'settings'
        ? {
            mediaType: '自社公式メディア / コーポレートHP',
            cms: 'Astro + Supabase (Vercel)',
            url: customSiteUrl,
            mediaUrl: customMediaUrl,
            githubRepo: 'mst-corporate-website (/hp)',
            connectionType: 'supabase_direct',
            target: '中小企業・小規模事業者の経営者・事業責任者',
            purpose: '現場実践の利益改善・業務標準化・DX/AIノウハウの発信とリード獲得',
            vercelDeployHook: '',
          }
        : {}
    );
    setForm(true);
    setError('');
    setNotice('');
    setAiNotice('');
    setAiError('');
    setCmsResult(null);
  };

  const edit = (r: Row) => {
    setEditing(r);
    setTitle(r.title);
    setProductId(r.product_id || '');
    setPayload(r.payload || {});
    setForm(true);
    setNotice('');
    setError('');
    setAiNotice('');
    setAiError('');
    setCmsResult(null);
  };

  // 保存処理
  const save = async (e?: React.FormEvent, customPayload?: Record<string, string>) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('名称を入力してください。');
      return;
    }

    const payloadToSave = customPayload || payload;

    if (tab === 'settings' && !payloadToSave.url?.trim()) {
      setError('メディア・HPのURLを入力してください。');
      return;
    }
    if (tab === 'articles' && !payloadToSave.mediaId && media.length > 0) {
      payloadToSave.mediaId = media[0].id;
    }

    const db = getSupabase();
    if (!db || !userId) {
      setError('Supabaseに接続してログインしてください。');
      return;
    }
    setSaving(true);
    setError('');
    const id = editing?.id || `${tab === 'settings' ? 'media' : tab === 'articles' ? 'article' : tab}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const currentRecordType: Kind = tab === 'settings' ? 'media' : tab === 'articles' ? 'article' : (tab as Kind);
    const status = currentRecordType === 'article' ? payloadToSave.publishStatus || '下書き' : payloadToSave.status || null;

    const row = {
      user_id: userId,
      id,
      record_type: currentRecordType,
      title: title.trim(),
      product_id: productId || null,
      status,
      payload: payloadToSave,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = await db.from('mst_ai_acquisition_records').upsert(row, { onConflict: 'user_id,id' });
    setSaving(false);
    if (saveError) {
      setError('保存できませんでした: ' + saveError.message);
      return;
    }
    setRows((p) => [{ ...row } as Row, ...p.filter((r) => r.id !== id)]);
    setForm(false);
    setEditing(null);
    setNotice('保存しました。');
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`「${r.title}」を削除しますか？`)) return;
    const db = getSupabase();
    if (!db) return;
    const { error: e } = await db.from('mst_ai_acquisition_records').delete().eq('user_id', userId).eq('id', r.id);
    if (e) {
      setError('削除できませんでした: ' + e.message);
      return;
    }
    setRows((p) => p.filter((x) => x.id !== r.id));
    setNotice('削除しました。');
  };

  // ★ AIで記事を一括自動生成（見出し構成・本文・メタタイトル・ディスクリプション）
  const generateArticleByAI = async () => {
    if (!title.trim() && !payload.keyword?.trim()) {
      setAiError('記事のタイトル、または狙うキーワードを先に入力してください。');
      return;
    }
    setAiGenerating(true);
    setAiError('');
    setAiNotice('');

    try {
      const selectedProduct = products.find((p) => p.id === productId);
      const targetMedia = media.find((m) => m.id === payload.mediaId);

      const promptText = [
        'あなたはオウンドメディア・ブログのプロの編集長兼Webライターです。',
        '以下の情報をもとに、読者の課題を解決しSEO検索上位を狙える魅力的な記事を一括生成してください。',
        '出力は必ずJSON形式のみで返してください。コードブロック (```json ... ```) 形式で返してください。',
        '',
        '【記事条件】',
        `- テーマ/仮タイトル: ${title || payload.keyword}`,
        `- 狙うキーワード: ${payload.keyword || '指定なし'}`,
        `- 対象商品・サービス: ${selectedProduct?.product_name || '自社サービス'}`,
        `- メディア情報: ${targetMedia?.title || '自社オウンドメディア'} (${targetMedia?.payload?.target || 'ビジネスパーソン'})`,
        `- 集客戦略の文脈: ${strategyContext || '質の高い見込み客獲得'}`,
        '',
        '【出力JSONフォーマット】',
        '{',
        '  "title": "読者の目を引く確定記事タイトル（32文字以内）",',
        '  "outline": "## 見出し構成\\n### H2 見出し1...\\n### H2 見出し2...",',
        '  "body": "記事本文（HTMLまたはMarkdown形式。導入、H2、H3見出し、具体例、まとめ、CTA誘導まで含めた1500〜2500文字の読み応えのある完全な記事本文）",',
        '  "metaTitle": "SEO検索結果用メタタイトル（30文字前後）",',
        '  "metaDescription": "クリック率を高めるメタディスクリプション（120文字前後）",',
        '  "excerpt": "記事の抜粋・要約（80〜120文字）",',
        '  "cta": "記事末尾に置く魅力的なアクション喚起（例: 無料相談・資料請求・LINE登録）"',
        '}',
      ].join('\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          workModeId: 'marketing_execution',
          character: {
            name: 'CMS専属AIライター',
            role: 'SEO記事制作・構成',
            personality: '具体的で実践的、読者ファーストの高品質な文章を書く',
            tone: '親しみやすく信頼感がある',
          },
          stream: false,
        }),
      });

      const resData = await response.json();
      if (!response.ok || typeof resData.text !== 'string') {
        throw new Error(resData.error || 'AI記事生成に失敗しました。');
      }

      const cleanedJson = resData.text.trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/i, '');
      const parsed = JSON.parse(cleanedJson);

      if (parsed.title && !title.trim()) {
        setTitle(parsed.title);
      }

      setPayload((prev) => ({
        ...prev,
        outline: parsed.outline || prev.outline || '',
        body: parsed.body || prev.body || '',
        metaTitle: parsed.metaTitle || prev.metaTitle || '',
        metaDescription: parsed.metaDescription || prev.metaDescription || '',
        excerpt: parsed.excerpt || prev.excerpt || '',
        cta: parsed.cta || prev.cta || '',
      }));

      setAiNotice('✨ AIが記事構成・本文・メタ情報をすべて自動生成しました！内容を確認して微調整してください。');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'AI記事生成中にエラーが発生しました。');
    } finally {
      setAiGenerating(false);
    }
  };

  // ★ ボタン1つでWordPress（CMS）へ自動投稿
  const postToWordPress = async (articleRow?: Row, postStatus: 'draft' | 'publish' = 'draft') => {
    const targetArticle = articleRow || editing;
    const articleTitle = articleRow ? articleRow.title : title;
    const articlePayload = articleRow ? articleRow.payload : payload;
    const articleId = articleRow ? articleRow.id : editing?.id;

    if (!articleTitle.trim()) {
      alert('記事タイトルを入力してください。');
      return;
    }

    // 対象メディアを特定
    const targetMediaId = articlePayload.mediaId || (media[0]?.id ?? '');
    const targetMedia = media.find((m) => m.id === targetMediaId);

    const wpUrl = targetMedia?.payload?.wpUrl || targetMedia?.payload?.url;
    const wpUsername = targetMedia?.payload?.wpUsername;
    const wpAppPassword = targetMedia?.payload?.wpAppPassword;

    if (!wpUrl || !wpUsername || !wpAppPassword) {
      setCmsResult({
        id: articleId || 'current',
        success: false,
        message: 'WordPressの連携設定（URL・ユーザー名・アプリケーションパスワード）が未完了です。「⚙️ 自社メディア・CMS連携設定」タブで設定してください。',
      });
      return;
    }

    setCmsPosting(articleId || 'current');
    setCmsResult(null);

    try {
      const response = await fetch('/api/cms/wordpress-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl,
          wpUsername,
          wpAppPassword,
          title: articleTitle,
          content: articlePayload.body || articlePayload.outline || '',
          excerpt: articlePayload.metaDescription || articlePayload.excerpt || '',
          status: postStatus,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'WordPress投稿に失敗しました。');
      }

      // レコードの更新
      const updatedPayload = {
        ...articlePayload,
        publishedUrl: resData.postUrl,
        wpPostId: String(resData.postId),
        publishStatus: postStatus === 'publish' ? '公開済み' : '下書き（CMS送信済）',
        publishedDate: new Date().toISOString().slice(0, 10),
      };

      if (!articleRow) {
        setPayload(updatedPayload);
      }

      // Supabaseに反映
      const db = getSupabase();
      if (db && userId && articleId) {
        await db.from('mst_ai_acquisition_records').update({
          payload: updatedPayload,
          status: postStatus === 'publish' ? '公開済み' : '下書き（CMS送信済）',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('id', articleId);

        setRows((prev) =>
          prev.map((r) =>
            r.id === articleId
              ? { ...r, payload: updatedPayload, status: postStatus === 'publish' ? '公開済み' : '下書き（CMS送信済）' }
              : r
          )
        );
      }

      setCmsResult({
        id: articleId || 'current',
        success: true,
        message: postStatus === 'publish' ? '🎉 WordPressに即時公開しました！' : '🚀 WordPressへ「下書き」として自動投稿しました！',
        url: resData.postUrl,
      });
    } catch (err: any) {
      console.error(err);
      setCmsResult({
        id: articleId || 'current',
        success: false,
        message: err.message || 'WordPressへの自動投稿に失敗しました。',
      });
    } finally {
      setCmsPosting(null);
    }
  };

  // ★ 自社公式HP（Astro + Supabase + Vercel / Google Antigravity）へワンクリック即時公開 / 下書き変更
  const publishToOfficialWebsite = async (articleRow?: Row, newStatus: '公開' | '下書き' = '公開') => {
    const targetArticle = articleRow || editing;
    const articleTitle = articleRow ? articleRow.title : title;
    const articlePayload = articleRow ? articleRow.payload : payload;
    const articleId = articleRow ? articleRow.id : editing?.id;

    if (!articleTitle.trim()) {
      alert('記事タイトルを入力してください。');
      return;
    }

    const db = getSupabase();
    if (!db || !userId) {
      alert('Supabaseに接続されていません。');
      return;
    }

    setCmsPosting(articleId || 'current');
    setCmsResult(null);

    try {
      // スラッグを正規化
      let cleanSlug = (articlePayload.slug || '').trim();
      if (!cleanSlug) {
        cleanSlug = (articleId || `article-${Date.now().toString(36)}`).replace(/^article-/, '');
      }
      cleanSlug = cleanSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      if (!cleanSlug || cleanSlug === '-') cleanSlug = `insight-${Date.now().toString(36)}`;

      const targetMediaId = (articlePayload as Record<string, any>).mediaId || payload.mediaId;
      const activeMedia = media.find((m) => m.id === targetMediaId) || media[0] || DEFAULT_OFFICIAL_MEDIA;
      const baseMediaUrl = (activeMedia?.payload?.mediaUrl || customMediaUrl || `${(activeMedia?.payload?.url || customSiteUrl).replace(/\/$/, '')}/media`).replace(/\/$/, '');
      const hpUrl = `${baseMediaUrl}/${cleanSlug}`;

      const updatedPayload = {
        ...articlePayload,
        slug: cleanSlug,
        publishedUrl: newStatus === '公開' ? hpUrl : '',
        publishStatus: newStatus,
        publishedDate: newStatus === '公開' ? (articlePayload.publishedDate || new Date().toISOString().slice(0, 10).replace(/-/g, '.')) : '',
      };

      if (!articleRow) {
        setPayload(updatedPayload);
      }

      const rowId = articleId || `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // 1. Supabaseの mst_ai_acquisition_records を更新（HP側の getLiveArticles がこれを直接読み出します）
      const { error: upsertErr } = await db.from('mst_ai_acquisition_records').upsert({
        user_id: userId,
        id: rowId,
        record_type: 'article',
        title: articleTitle,
        product_id: productId || null,
        status: newStatus,
        payload: updatedPayload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,id' });

      if (upsertErr) throw upsertErr;

      setRows((prev) => [
        {
          id: rowId,
          record_type: 'article',
          title: articleTitle,
          product_id: productId || null,
          status: newStatus,
          payload: updatedPayload,
          updated_at: new Date().toISOString(),
        } as Row,
        ...prev.filter((r) => r.id !== rowId),
      ]);

      // 2. Vercel Deploy Hook が設定されていればキック（静的ビルド再生成）
      const vercelHook = activeMedia?.payload?.vercelDeployHook;
      let deployNotice = '';
      if (vercelHook && vercelHook.startsWith('https://')) {
        try {
          await fetch(vercelHook, { method: 'POST' });
          deployNotice = '（Vercel再デプロイを自動キックしました）';
        } catch (e) {
          console.warn('Vercel Deploy Hook notice:', e);
        }
      }

      setCmsResult({
        id: rowId,
        success: true,
        message: newStatus === '公開'
          ? `🎉 自社公式HP（Astro + Supabase: ${hpUrl}）に即時公開しました！${deployNotice}`
          : '📁 記事を「下書き」に戻しました。',
        url: newStatus === '公開' ? hpUrl : undefined,
      });
    } catch (err: any) {
      console.error(err);
      setCmsResult({
        id: articleId || 'current',
        success: false,
        message: err.message || '公式HPへの公開処理に失敗しました。',
      });
    } finally {
      setCmsPosting(null);
    }
  };

  return (
    <section className="space-y-4 text-slate-100">
      {/* ヘッダー */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-900 p-5 shadow-lg">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            自社メディア・CMS運用ステーション
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            面倒な手入力を削ぎ落とし、AIで記事構成・本文を一発作成。ボタン1つでWordPress等のCMSへ下書き・公開投稿できます。
          </p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm hover:bg-slate-700 transition">
          <RefreshCw className="h-4 w-4" />
          一覧を再読み込み
        </button>
      </header>

      {/* タブナビゲーション */}
      <nav className="flex gap-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 p-1.5" aria-label="自社メディア運用">
        {sections.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setForm(false);
              setError('');
              setNotice('');
              setAiNotice('');
              setAiError('');
              setCmsResult(null);
            }}
            aria-current={tab === id ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition ${
              tab === id ? 'bg-cyan-600 font-semibold text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* アラート・通知メッセージ */}
      {(error || notice) && (
        <div className={`flex items-center gap-2 rounded-lg p-3.5 text-sm ${error ? 'bg-rose-950/50 border border-rose-800 text-rose-200' : 'bg-emerald-950/50 border border-emerald-800 text-emerald-200'}`}>
          {error ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      {/* CMS投稿結果メッセージ */}
      {cmsResult && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm ${cmsResult.success ? 'bg-cyan-950/70 border border-cyan-500/50 text-cyan-200' : 'bg-amber-950/60 border border-amber-600/50 text-amber-200'}`}>
          <div className="flex items-center gap-2">
            {cmsResult.success ? <CheckCircle2 className="h-5 w-5 text-cyan-400" /> : <AlertCircle className="h-5 w-5 text-amber-400" />}
            <div>
              <p className="font-semibold">{cmsResult.message}</p>
              {cmsResult.url && (
                <p className="text-xs text-slate-300 mt-0.5">
                  記事URL: <a href={cmsResult.url} target="_blank" rel="noopener noreferrer" className="underline text-cyan-300 hover:text-cyan-200">{cmsResult.url}</a>
                </p>
              )}
            </div>
          </div>
          {cmsResult.url && (
            <a
              href={cmsResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              投稿記事を確認
            </a>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          メディアデータを読み込み中…
        </div>
      ) : (
        <>
          {/* ========================================================
              TAB 1: 記事作成・CMS自動投稿（メイン画面）
             ======================================================== */}
          {tab === 'articles' && (
            <div className="space-y-4">
              {/* ヘッダーガイド ＆ 新規作成ボタン */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-bold text-base text-white">自社メディア記事一覧 & HP即時公開</h3>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                      Astro + Supabase 直結稼働
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300 mt-1.5">
                    <span>手入力を減らし、AIで記事（見出し・本文・メタ）を一括作成。ボタン1つで自社公式HP（</span>
                    <a
                      href={customMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 underline font-mono inline-flex items-center gap-1 hover:text-cyan-200"
                    >
                      <span>{customMediaUrl}</span>
                      <ExternalLink className="h-3 w-3 inline" />
                    </a>
                    <span>）へ即時公開できます。</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempSiteUrl(customSiteUrl);
                        setTempMediaUrl(customMediaUrl);
                        setShowUrlModal(true);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-cyan-300 px-2.5 py-0.5 border border-cyan-500/30 transition cursor-pointer shadow-sm"
                      title="自社公式HPの公開先URL（ドメインやパス）を変更"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      <span>URL設定・変更</span>
                    </button>
                  </div>
                </div>
                {!form && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20"
                  >
                    <Plus className="h-4 w-4" />
                    新しい記事を作成
                  </button>
                )}
              </div>

              {/* 記事作成・編集フォーム */}
              {form && (
                <form onSubmit={(e) => void save(e)} className="space-y-5 rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-400" />
                      {editing ? `記事を編集: ${editing.title}` : '新規記事を作成'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setForm(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      閉じる
                    </button>
                  </div>

                  {/* 必須・基本情報（これだけでOK！） */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        対象メディア（自社HP / Astro） <span className="text-cyan-400">*</span>
                      </label>
                      <select
                        value={payload.mediaId || (media[0]?.id ?? '')}
                        onChange={(e) => setPayload((p) => ({ ...p, mediaId: e.target.value }))}
                        className={cls}
                      >
                        {media.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} {m.payload?.url ? `(${m.payload.url})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300">
                        記事タイトル / テーマ <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例: 中小企業のためのAI導入ロードマップ完全ガイド"
                        className={cls}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        公式HP URLスラッグ（半角英数ハイフン）
                      </label>
                      <input
                        value={payload.slug || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, slug: e.target.value }))}
                        placeholder="例: ai-automation-roadmap"
                        className={cls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        自社メディア カテゴリ
                      </label>
                      <select
                        value={payload.category || '経営改善・利益改善'}
                        onChange={(e) => setPayload((p) => ({ ...p, category: e.target.value }))}
                        className={cls}
                      >
                        <option value="経営改善・利益改善">経営改善・利益改善</option>
                        <option value="業務改善・業務効率化">業務改善・業務効率化</option>
                        <option value="マーケティング・集客">マーケティング・集客</option>
                        <option value="IT・DX・AI活用">IT・DX・AI活用</option>
                        <option value="新規事業・事業づくり">新規事業・事業づくり</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        狙うキーワード（任意）
                      </label>
                      <input
                        value={payload.keyword || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, keyword: e.target.value }))}
                        placeholder="例: 中小企業 AI 導入, 業務効率化"
                        className={cls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        関連商品・サービス（任意）
                      </label>
                      <select
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        className={cls}
                      >
                        <option value="">商品を選択（任意）</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ★ AI一括自動生成バナー（手入力ゼロで完成！） ★ */}
                  <div className="rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-950/60 to-purple-950/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h5 className="font-bold text-sm text-violet-200 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-violet-400" />
                          AI記事一括自動生成
                        </h5>
                        <p className="text-xs text-slate-300 mt-0.5">
                          タイトル・キーワードから、見出し構成・読み応えのある完全な本文・メタタグを一撃で自動執筆します。
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={aiGenerating}
                        onClick={() => void generateArticleByAI()}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        {aiGenerating ? 'AIが記事を一括執筆中…' : '✨ AIで記事を一括生成する'}
                      </button>
                    </div>
                    {aiNotice && <p className="mt-2 text-xs font-medium text-emerald-300">{aiNotice}</p>}
                    {aiError && <p className="mt-2 text-xs font-medium text-rose-300">{aiError}</p>}
                  </div>

                  {/* 記事本文 & 見出し構成 */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-300">
                          記事本文（HTMLまたはMarkdown）
                        </label>
                        <span className="text-[11px] text-slate-500">
                          文字数: {(payload.body || '').length} 文字
                        </span>
                      </div>
                      <textarea
                        value={payload.body || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, body: e.target.value }))}
                        rows={14}
                        placeholder="AI一括生成ボタンを押すか、外部で作成した文章を貼り付けてください。見出しタグ（<h2>, <h3>）やMarkdown（##, ###）に対応しています。"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white font-mono leading-relaxed focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          メタタイトル案（検索結果表示）
                        </label>
                        <input
                          value={payload.metaTitle || ''}
                          onChange={(e) => setPayload((p) => ({ ...p, metaTitle: e.target.value }))}
                          placeholder="例: 【2026年最新】中小企業のAI導入手順と成功のポイント"
                          className={cls}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          メタディスクリプション / 抜粋
                        </label>
                        <textarea
                          rows={2}
                          value={payload.metaDescription || payload.excerpt || ''}
                          onChange={(e) => setPayload((p) => ({ ...p, metaDescription: e.target.value, excerpt: e.target.value }))}
                          placeholder="記事の要約・読者がクリックしたくなる説明文"
                          className={cls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 保存 & CMS自動投稿アクション */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-bold text-white transition"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? '保存中…' : '下書きとして保存'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(false)}
                        className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs text-slate-400 hover:text-white"
                      >
                        キャンセル
                      </button>
                    </div>

                    {/* 自社公式HP（Astro + Supabase）即時公開ボタン */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={cmsPosting === (editing?.id || 'current')}
                        onClick={() => void publishToOfficialWebsite(undefined, '公開')}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Globe className="h-4 w-4" />
                        {cmsPosting === (editing?.id || 'current') ? 'HPへ反映中…' : '🚀 自社公式HP（Astroメディア）へ即時公開'}
                      </button>

                      {/* 外部WordPress等との併用オプション（任意） */}
                      <button
                        type="button"
                        disabled={cmsPosting === (editing?.id || 'current')}
                        onClick={() => void postToWordPress(undefined, 'draft')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
                        title="外部のWordPressブログにも送信する場合"
                      >
                        <Send className="h-3.5 w-3.5 text-slate-400" />
                        <span>外部WordPressへ</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* 記事一覧 */}
              {!form && (
                <div className="space-y-3">
                  {articles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                      <p className="text-sm font-medium text-slate-400">作成された記事はまだありません。</p>
                      <p className="text-xs text-slate-500 mt-1">「新しい記事を作成」ボタンから、AIを使って一瞬で記事を作成できます。</p>
                    </div>
                  ) : (
                    articles.map((art) => {
                      const linkedMedia = media.find((m) => m.id === art.payload.mediaId);
                      const isPosted = Boolean(art.payload.publishedUrl || art.payload.wpPostId);

                      return (
                        <article
                          key={art.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-md hover:border-slate-700 transition"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-base text-white">{art.title}</h4>
                                {isPosted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {art.status || 'CMS送信済'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                    下書き（未投稿）
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                <span>メディア: <strong className="text-slate-300">{linkedMedia?.title || '未設定'}</strong></span>
                                {art.payload.keyword && <span>・ 狙うKW: <strong className="text-cyan-300">{art.payload.keyword}</strong></span>}
                                {art.payload.publishedDate && <span>・ 公開日: {art.payload.publishedDate}</span>}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* 公式HPへの公開・下書きトグル */}
                              {art.status === '公開' || art.payload?.publishStatus === '公開' ? (
                                <button
                                  type="button"
                                  disabled={cmsPosting === art.id}
                                  onClick={() => void publishToOfficialWebsite(art, '下書き')}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition disabled:opacity-50"
                                  title="公式HPで公開中（クリックで下書きに戻す）"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  HP公開中
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={cmsPosting === art.id}
                                  onClick={() => void publishToOfficialWebsite(art, '公開')}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 shadow"
                                  title="公式HPに即時公開する"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  HPに公開
                                </button>
                              )}

                              <button
                                onClick={() => edit(art)}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => void remove(art)}
                                aria-label={`${art.title}を削除`}
                                className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/60 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* 本文プレビューまたはURL */}
                          {art.payload.publishedUrl && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40 p-2.5 text-xs text-cyan-200">
                              <Globe className="h-4 w-4 shrink-0 text-cyan-400" />
                              <span className="truncate">公開URL: {art.payload.publishedUrl}</span>
                              <a
                                href={art.payload.publishedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto inline-flex items-center gap-1 font-semibold underline text-cyan-300 hover:text-cyan-200 shrink-0"
                              >
                                記事を開く
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}

                          {art.payload.metaDescription && (
                            <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                              {art.payload.metaDescription}
                            </p>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: 自社HP・メディア連携設定（Astro + Supabase + Vercel）
             ======================================================== */}
          {tab === 'settings' && (
            <div className="space-y-6">
              {/* ヘッダー */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 p-5 shadow-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-bold text-base text-white">自社HP・オウンドメディア連携設定（Astro + Supabase + Vercel）</h3>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                      ● Supabase直結稼働中
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Google Antigravityで構築された自社HP（Astro）とネイティブ連動しています。WordPressのような面倒なAPIキー設定は不要で、記事の自動同期とリード集約がリアルタイムに連携されます。
                  </p>
                </div>
                {!form && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    連携設定を追加・編集
                  </button>
                )}
              </div>

              {/* ★ メイン連携ステータスカード（Astro + Supabase + Vercel / Google Antigravity） ★ */}
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        有限会社MST 公式コーポレートHP / オウンドメディア
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                          Google Antigravity 構築
                        </span>
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span>サイトURL: <a href={customSiteUrl} target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">{customSiteUrl}</a></span>
                        <span>・ メディア: <a href={customMediaUrl} target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">{customMediaUrl}</a></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTempSiteUrl(customSiteUrl);
                        setTempMediaUrl(customMediaUrl);
                        setShowUrlModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-xs font-bold text-cyan-300 transition cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>URL設定・変更</span>
                    </button>
                    <a
                      href={customMediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition"
                    >
                      <span>本番メディアを確認</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* システム構成スペック */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Framework</span>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-cyan-400" />
                      Astro 5 + Tailwind
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">ソース: /hp ディレクトリ</p>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Database (CMS)</span>
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Supabase 直結
                    </p>
                    <p className="text-[10px] text-slate-400">mst_ai_acquisition_records</p>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Hosting / Deploy</span>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Vercel
                    </p>
                    <p className="text-[10px] text-slate-400">GitHub連携自動ビルド</p>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">CRM & Lead Sync</span>
                    <p className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                      リード自動集約
                    </p>
                    <p className="text-[10px] text-slate-400">leads テーブルに直接蓄積</p>
                  </div>
                </div>

                {/* 自動同期の仕組みガイド */}
                <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/20 p-3.5 text-xs text-indigo-200 leading-relaxed space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Astro + Supabase 連携がなぜ自動で動くのか？（仕組みの解説）</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-950/70 p-2.5 border border-slate-800/80 space-y-1">
                      <strong className="text-white block font-bold">1. 記事作成 ➡ 自社HPへ即時反映</strong>
                      <p className="text-slate-400">
                        本システムで作成した記事を「自社HPに即時公開」すると、同じSupabaseの <code className="text-cyan-300">mst_ai_acquisition_records</code> に保存されます。自社HP（<code className="text-cyan-300">/hp/src/data/articles.ts</code>）が直接このテーブルを読み込むため、WordPressのようなAPIパスワード設定なしに完全同期されます。
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-2.5 border border-slate-800/80 space-y-1">
                      <strong className="text-white block font-bold">2. 自社HPからの問い合わせ ➡ CRM顧客台帳へ直結</strong>
                      <p className="text-slate-400">
                        自社HP（<code className="text-cyan-300">{customSiteUrl}</code>）の無料診断や資料請求から送信されたデータは、同じSupabaseの <code className="text-emerald-300">leads</code> テーブルに直接挿入されます。本システムの「CRM・リード台帳」でリアルタイムに確認・商談化できます。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vercel Deploy Hook（即時再ビルド）設定セクション */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-amber-400" />
                        Vercel Deploy Hook 設定（公開時の自動再ビルド用・任意）
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Vercelのプロジェクト設定 ＞「Git」＞「Deploy Hooks」で発行したURLを登録すると、記事公開時にVercelの自動再ビルドを即座にキックできます。
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={testingDeployHook}
                      onClick={() => void testVercelDeployHook(media[0]?.payload?.vercelDeployHook)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${testingDeployHook ? 'animate-spin' : ''}`} />
                      {testingDeployHook ? 'テスト送信中…' : '🔔 デプロイフックのテスト送信'}
                    </button>
                  </div>

                  {deployHookNotice && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-cyan-200">
                      {deployHookNotice}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                    <div className="sm:col-span-10">
                      <input
                        type="url"
                        value={media[0]?.payload?.vercelDeployHook || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === (media[0]?.id || DEFAULT_OFFICIAL_MEDIA.id)
                                ? { ...r, payload: { ...r.payload, vercelDeployHook: val } }
                                : r
                            )
                          );
                        }}
                        placeholder="例: https://api.vercel.com/v1/integrations/deploy/prj_.../..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const targetMedia = media[0] || DEFAULT_OFFICIAL_MEDIA;
                          const db = getSupabase();
                          if (db && userId) {
                            await db.from('mst_ai_acquisition_records').upsert({
                              user_id: userId,
                              id: targetMedia.id,
                              record_type: 'media',
                              title: targetMedia.title,
                              status: '連携稼働中',
                              payload: targetMedia.payload,
                              updated_at: new Date().toISOString(),
                            }, { onConflict: 'user_id,id' });
                            setNotice('Vercel Deploy Hook 設定を保存しました。');
                            setTimeout(() => setNotice(''), 3000);
                          }
                        }}
                        className="w-full py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs transition shadow"
                      >
                        Hook保存
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* メディア登録・編集フォーム（新規追加または詳細編集時） */}
              {form && (
                <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
                  <h4 className="font-bold text-white text-base">
                    {editing ? `メディア設定を編集: ${editing.title}` : '新規メディア・CMSを登録'}
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        メディア名称 <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例: 有限会社MST 公式オウンドメディア"
                        className={cls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        サイトURL <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        required
                        value={payload.url || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, url: e.target.value }))}
                        placeholder="https://corp.mstcorp.info"
                        className={cls}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        CMS・システム種別
                      </label>
                      <select
                        value={payload.cms || 'Astro + Supabase (Vercel)'}
                        onChange={(e) => setPayload((p) => ({ ...p, cms: e.target.value }))}
                        className={cls}
                      >
                        <option value="Astro + Supabase (Vercel) / Google Antigravity">
                          Astro + Supabase (Vercel) / Google Antigravity（推奨・自社HP）
                        </option>
                        <option value="WordPress">外部WordPress（REST API）</option>
                        <option value="その他・自社独自CMS">その他・自社独自CMS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Vercel Deploy Hook URL（任意）
                      </label>
                      <input
                        value={payload.vercelDeployHook || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, vercelDeployHook: e.target.value }))}
                        placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                        className={cls}
                      />
                    </div>
                  </div>

                  {/* 外部WordPressを選択した場合のみ表示 */}
                  {payload.cms === 'WordPress' && (
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                      <h5 className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                        <Wrench className="h-4 w-4" />
                        外部WordPress REST API 連携（必要な場合のみ設定）
                      </h5>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            WordPress ユーザー名
                          </label>
                          <input
                            value={payload.wpUsername || ''}
                            onChange={(e) => setPayload((p) => ({ ...p, wpUsername: e.target.value }))}
                            placeholder="例: admin"
                            className={cls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            アプリケーションパスワード
                          </label>
                          <input
                            type="password"
                            value={payload.wpAppPassword || ''}
                            onChange={(e) => setPayload((p) => ({ ...p, wpAppPassword: e.target.value }))}
                            placeholder="xxxx xxxx xxxx xxxx"
                            className={cls}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">ターゲット読者</label>
                      <input
                        value={payload.target || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, target: e.target.value }))}
                        placeholder="例: 業務改善やAI活用を検討する経営層・事業責任者"
                        className={cls}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">運用目的・ゴール</label>
                      <input
                        value={payload.purpose || ''}
                        onChange={(e) => setPayload((p) => ({ ...p, purpose: e.target.value }))}
                        placeholder="例: 利益改善・DXノウハウ発信による無料診断受診・リード獲得"
                        className={cls}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForm(false)}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow"
                    >
                      {saving ? '保存中…' : '設定を保存'}
                    </button>
                  </div>
                </form>
              )}

              {/* 登録済みメディア一覧 */}
              {!form && (
                <div className="space-y-3">
                  {media.map((m) => {
                    const isAstro = (m.payload?.cms || '').includes('Astro') || (m.payload?.url || '').includes('mstcorp.info');

                    return (
                      <article key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-white">{m.title}</h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isAstro
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              }`}>
                                {m.payload?.cms || 'Astro + Supabase'}
                              </span>
                            </div>
                            <p className="text-xs text-cyan-300 mt-1 flex items-center gap-1.5 font-mono">
                              <Globe className="h-3.5 w-3.5" />
                              <a href={m.payload?.url || 'https://mstcorp.info'} target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-200">
                                {m.payload?.url || 'https://mstcorp.info'}
                              </a>
                              {m.payload?.mediaUrl && (
                                <span className="text-slate-400 font-normal">
                                  （メディア: <a href={m.payload.mediaUrl} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{m.payload.mediaUrl}</a>）
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              {isAstro ? 'Supabase直結同期中' : 'CMS設定済'}
                            </span>
                            <button
                              onClick={() => edit(m)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              編集
                            </button>
                            {m.id !== 'mst_official_corporate_hp' && (
                              <button
                                onClick={() => void remove(m)}
                                aria-label={`${m.title}を削除`}
                                className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950/60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {m.payload?.target && (
                          <p className="mt-2 text-xs text-slate-400">
                            ターゲット: {m.payload.target}
                          </p>
                        )}
                        {m.payload?.purpose && (
                          <p className="mt-1 text-xs text-slate-500">
                            目的: {m.payload.purpose}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* 自社メディア用の素材・成果物管理セクション */}
              <div className="pt-6 border-t border-slate-800">
                <TabMarketingAssetManager
                  toolType="media"
                  title="自社メディアのHP URL・素材・成果物"
                  description="HPのURL、オウンドメディアのURL、サイト用ロゴ・画像、元HTMLファイル、仕様書をこのタブで管理します。"
                  currentRecordId={editing?.id}
                  currentRecordTitle={editing?.title}
                  records={rows.map((r) => ({ id: r.id, title: r.title, record_type: r.record_type }))}
                  products={products}
                  userId={userId}
                />
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: SEO・アクセス分析
             ======================================================== */}
          {tab === 'seo' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <h3 className="font-bold text-base text-white">SEO・検索アクセス分析</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    各記事の表示回数・クリック数・平均掲載順位を記録し、CTRを自動計算します。
                  </p>
                </div>
                {!form && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow"
                  >
                    <Plus className="h-4 w-4" />
                    検索実績を記録
                  </button>
                )}
              </div>

              {form && (
                <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
                  <h4 className="font-bold text-white text-base">SEO実績を記録</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">記録タイトル</label>
                      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 2026年10月度 検索順位レポート" className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">対象記事</label>
                      <select value={payload.articleId || ''} onChange={(e) => setPayload((p) => ({ ...p, articleId: e.target.value }))} className={cls}>
                        <option value="">記事を選択してください</option>
                        {articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">検索表示回数</label>
                      <input type="number" min="0" value={payload.impressions || ''} onChange={(e) => setPayload((p) => ({ ...p, impressions: e.target.value }))} className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">クリック数</label>
                      <input type="number" min="0" value={payload.clicks || ''} onChange={(e) => setPayload((p) => ({ ...p, clicks: e.target.value }))} className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">平均掲載順位</label>
                      <input type="number" step="0.1" min="1" value={payload.avgPosition || ''} onChange={(e) => setPayload((p) => ({ ...p, avgPosition: e.target.value }))} className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">問い合わせ数 / リード数</label>
                      <input type="number" min="0" value={payload.leads || ''} onChange={(e) => setPayload((p) => ({ ...p, leads: e.target.value }))} className={cls} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setForm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400">キャンセル</button>
                    <button type="submit" disabled={saving} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white">保存</button>
                  </div>
                </form>
              )}

              {!form && (
                <div className="space-y-3">
                  {seoList.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                      SEO実績データはまだ登録されていません。
                    </div>
                  ) : (
                    seoList.map((r) => {
                      const linkedArticle = articles.find((a) => a.id === r.payload.articleId);
                      const ctr = Number(r.payload.impressions) > 0
                        ? ((Number(r.payload.clicks || 0) / Number(r.payload.impressions)) * 100).toFixed(2) + '%'
                        : '-';
                      return (
                        <article key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-white">{r.title}</h4>
                              <p className="text-xs text-slate-400">対象記事: {linkedArticle?.title || '未選択'}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => edit(r)} className="rounded border border-slate-700 px-2 py-1 text-xs">編集</button>
                              <button onClick={() => void remove(r)} className="rounded border border-rose-900 px-2 py-1 text-xs text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-4 text-xs text-cyan-300">
                            <span>表示: {r.payload.impressions || 0}回</span>
                            <span>クリック: {r.payload.clicks || 0}回</span>
                            <span>CTR: {ctr}</span>
                            <span>順位: {r.payload.avgPosition || '-'}位</span>
                            <span>リード: {r.payload.leads || 0}件</span>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 4: リライト・記事改善
             ======================================================== */}
          {tab === 'rewrite' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <h3 className="font-bold text-base text-white">記事リライト・改善管理</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    検索順位やCTRが低い記事の改善ポイントを記録・管理します。
                  </p>
                </div>
                {!form && (
                  <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow">
                    <Plus className="h-4 w-4" />
                    改善タスクを登録
                  </button>
                )}
              </div>

              {form && (
                <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 shadow-2xl">
                  <h4 className="font-bold text-white text-base">リライト課題を登録</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">課題タイトル</label>
                      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: CTR改善のための見出し・アイキャッチ見直し" className={cls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">対象記事</label>
                      <select value={payload.articleId || ''} onChange={(e) => setPayload((p) => ({ ...p, articleId: e.target.value }))} className={cls}>
                        <option value="">記事を選択してください</option>
                        {articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300">改善内容・指示</label>
                      <textarea rows={3} value={payload.change || ''} onChange={(e) => setPayload((p) => ({ ...p, change: e.target.value }))} className={cls} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setForm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400">キャンセル</button>
                    <button type="submit" disabled={saving} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white">保存</button>
                  </div>
                </form>
              )}

              {!form && (
                <div className="space-y-3">
                  {rewriteList.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                      リライト課題は登録されていません。
                    </div>
                  ) : (
                    rewriteList.map((r) => (
                      <article key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-white">{r.title}</h4>
                          <div className="flex gap-2">
                            <button onClick={() => edit(r)} className="rounded border border-slate-700 px-2 py-1 text-xs">編集</button>
                            <button onClick={() => void remove(r)} className="rounded border border-rose-900 px-2 py-1 text-xs text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        {r.payload.change && <p className="mt-2 text-xs text-slate-300">{r.payload.change}</p>}
                      </article>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 5: リード・売上成果連携
             ======================================================== */}
          {tab === 'attribution' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-bold text-base text-white">リード・売上成果連携（CRM自動紐付け）</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  記事のURLとCRM内のリード獲得元・診断URLを自動照合し、流入成果を把握できます。
                </p>
              </div>

              <div className="space-y-3">
                {articles.map((art) => {
                  const url = art.payload.publishedUrl?.trim();
                  const slug = art.payload.slug || art.id;
                  const matched = crmLeads.filter((l) => {
                    const s = l.source?.trim() || '';
                    const r = l.report_url?.trim() || '';
                    return (
                      (url && (s === url || r === url)) ||
                      (slug && (s === `media_${slug}` || s.includes(slug) || r.includes(slug)))
                    );
                  });
                  const ids = new Set(matched.map((l) => l.id));
                  const matchingDeals = crmDeals.filter((d) => d.lead_id && ids.has(d.lead_id));

                  return (
                    <div key={art.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <h4 className="font-semibold text-white">{art.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">URL: {url || '公開URL未設定'}</p>
                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="rounded-lg bg-cyan-950/60 border border-cyan-800/40 px-3 py-1 text-cyan-300">
                          獲得リード: <strong>{url ? matched.length : 0}</strong> 件
                        </span>
                        <span className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 text-emerald-300">
                          商談創出: <strong>{url ? matchingDeals.length : 0}</strong> 件
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 自社公式HP / オウンドメディア URL変更モーダル */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Globe className="h-5 w-5 text-cyan-400" />
                <span>自社公式HP / オウンドメディア公開先URL設定</span>
              </div>
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              記事公開ボタンを押した際に公開される自社公式HP（Astro + Supabase直結）のURLを設定します。
              変更すると記事一覧のリンク・案内文・即時公開先URLが自動で更新されます。
            </p>

            {/* プリセット選択チップ */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">ワンクリック選択（プリセット候補）:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { site: 'https://corp.mstcorp.info', media: 'https://corp.mstcorp.info/media', label: 'corp.mstcorp.info/media（Astro公式HP）' },
                  { site: 'https://mstcorp.info', media: 'https://mstcorp.info/media', label: 'mstcorp.info/media' },
                  { site: 'https://mstcorp.info', media: 'https://mstcorp.info', label: 'mstcorp.info（トップ直下）' },
                  { site: 'https://corp.mstcorp.info', media: 'https://corp.mstcorp.info', label: 'corp.mstcorp.info（トップ直下）' },
                ].map((preset) => (
                  <button
                    key={preset.media}
                    type="button"
                    onClick={() => {
                      setTempSiteUrl(preset.site);
                      setTempMediaUrl(preset.media);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer transition font-mono"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 入力欄 */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  メディア・記事ディレクトリURL <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="url"
                  value={tempMediaUrl}
                  onChange={(e) => setTempMediaUrl(e.target.value)}
                  placeholder="例: https://corp.mstcorp.info/media"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  ※ 記事公開時に <code>{tempMediaUrl ? tempMediaUrl.replace(/\/$/, '') : 'https://...'}/[記事スラッグ]</code> のURLが生成されます。
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  コーポレートHP トップURL <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="url"
                  value={tempSiteUrl}
                  onChange={(e) => setTempSiteUrl(e.target.value)}
                  placeholder="例: https://corp.mstcorp.info"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={savingUrlConfig || !tempMediaUrl.trim()}
                onClick={() => void handleSaveUrlConfig()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 shadow-md shadow-cyan-600/30 cursor-pointer"
              >
                {savingUrlConfig ? '保存中…' : '保存してURLを反映'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
