import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import {
  MessageSquare,
  ArrowRight,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  RICH_MENU_LAYOUTS,
  RICH_MENU_WIDTH,
  RICH_MENU_HEIGHT,
  DEFAULT_MST_BOOKING_URL,
  type RichMenuActionItem,
  type RichMenuLayoutId,
  createMstRecommendedRichMenuPreset,
  getRichMenuLayoutAreas,
  getRichMenuLayoutConfig,
  getRichMenuCellStylePercent,
} from '../../utils/lineRichMenuLayouts';
import { renderMstRichMenuImage } from '../../utils/mstRichMenuRenderer';

export type WelcomeChoiceRoute = 'form' | 'booking' | 'template' | 'chat' | 'care_interactive';

export interface WelcomeChoice {
  id: string;
  label: string;
  tag: string;
  route: WelcomeChoiceRoute;
  formSlug?: string;
  templateId?: string;
  replyText?: string;
}

export interface WelcomePatternDiagnosisConfig {
  title: string;
  body: string;
  buttonLabel: string;
  diagnosisUrl: string;
}

export interface WelcomePatternAConfig {
  title: string;
  greetingBody: string;
  promptTitle: string;
  promptExamples: string;
  footerNote: string;
  bookingButtonLabel: string;
}

export interface WelcomePatternBQ1Choice {
  value: string;
  label: string;
  displayText: string;
  color: string;
}

export interface WelcomePatternBQ2Choice {
  value: string;
  label: string;
  displayText: string;
}

export interface WelcomePatternBConfig {
  q1: {
    title: string;
    greeting: string;
    question: string;
    choices: WelcomePatternBQ1Choice[];
  };
  q2: {
    title: string;
    introTemplate: string;
    choices: WelcomePatternBQ2Choice[];
  };
  completion: {
    title: string;
    greeting: string;
    body: string;
    pdfButtonLabel: string;
    pdfButtonUrl: string;
    bookingButtonLabel: string;
  };
}

export const DEFAULT_WELCOME_PATTERN_DIAGNOSIS: WelcomePatternDiagnosisConfig = {
  title: '📊 3分無料経営診断',
  body:
    '{recipient_name} 様\n無料経営診断をお選びいただきありがとうございます！\n約3分のチェックにご回答いただくと、送信直後にホームページ上で【簡易診断結果】をすぐにご確認いただけます。\n（※詳細な診断レポート・改善提案書は30分商談後に進呈）',
  buttonLabel: '診断を始める（約3分）',
  diagnosisUrl: 'https://corp.mstcorp.info/diagnosis',
};

export const DEFAULT_WELCOME_PATTERN_A: WelcomePatternAConfig = {
  title: '🗓️ 経営改善の個別相談',
  greetingBody:
    '{recipient_name} 様\n\n個別相談をお選びいただきありがとうございます！\n有限会社MST代表の大橋真人です。\n\n親身にお応えするため、このトーク画面で直接お話を伺わせていただきます。',
  promptTitle:
    '💬 まずは【いま一番困っていること】や【相談したいテーマ】を一言メッセージでそのままご返信いただけますでしょうか？',
  promptExamples:
    '（例：新規の反響が止まっている、売上は伸びたが利益が残らない、右腕が育たない、など何でも結構です）',
  footerNote:
    'メッセージを確認次第、私から直接アドバイス・ご返信を差し上げます！\n※Zoom等での30分オンライン相談をご希望の場合は「面談希望」とお送りいただくか、下のボタンから直接ご予約いただけます。',
  bookingButtonLabel: '🗓️ 30分オンライン相談予約',
};

export const DEFAULT_WELCOME_PATTERN_B: WelcomePatternBConfig = {
  q1: {
    title: '🌿 介護保険外サービスの開業相談',
    greeting:
      '{recipient_name} 様\n\n開業相談をお選びいただきありがとうございます！有限会社MST代表の大橋真人です。\n\n貴社の状況に合わせたアドバイスをお送りするため、2問だけ教えてください。',
    question: '【Q1】現在の状況に一番近いものはどれですか？',
    choices: [
      { value: 'existing', label: '🏢 既存の介護・福祉事業者', displayText: '既存の介護・福祉事業者です', color: '#0284C7' },
      { value: 'new_entry', label: '🚀 他業種からの新規参入', displayText: '他業種からの新規参入を検討しています', color: '#1E3A5F' },
      { value: 'individual', label: '👤 個人での独立・開業', displayText: '個人での独立・開業を検討しています', color: '#10B981' },
    ],
  },
  q2: {
    title: '🌿 介護保険外サービスの開業相談 (2/2)',
    introTemplate:
      'ありがとうございます（状況: {q1_label}）。\n\n【Q2】いま一番知りたいテーマはどれですか？',
    choices: [
      { value: 'revenue', label: '💰 収益モデル・料金設定', displayText: '収益モデル・料金設定について知りたい' },
      { value: 'marketing', label: '📢 集客・営業・チラシ', displayText: '集客・営業・チラシのやり方を知りたい' },
      { value: 'docs', label: '📄 必要書類・利用規約', displayText: '必要な書類や利用規約について知りたい' },
      { value: 'steps', label: '🗺️ 全体像・開業ステップ', displayText: '全体の開業ステップについて知りたい' },
    ],
  },
  completion: {
    title: '🌿 介護保険外サービスの開業相談',
    greeting: 'ご回答ありがとうございます！状況を把握いたしました。\n\n有限会社MST代表の大橋真人です。',
    body: '直営事業「アシスタ大垣」の現場データと実績をもとに、貴社に最適な開業ステップと具体的なアドバイスを、このLINEトークにて直接お送りいたします。\n\n何か気になる点やお悩みがございましたら、このままメッセージを送信してください！',
    pdfButtonLabel: '📘 開業パッケージ概要PDF',
    pdfButtonUrl: '',
    bookingButtonLabel: '🗓️ 30分無料開業相談を予約',
  },
};

export const DEFAULT_WELCOME_CHOICES: WelcomeChoice[] = [
  { id: 'diagnosis', label: '📊 3分無料経営診断を受ける', tag: '選択:診断', route: 'form', formSlug: 'business-diagnosis' },
  { id: 'consult', label: '🗓️ 経営改善について個別相談する', tag: '選択:個別相談', route: 'chat' },
  { id: 'care', label: '🌿 介護保険外サービスの開業相談', tag: '介護保険外開業', route: 'care_interactive' },
];

type Action = RichMenuActionItem;
type LayoutId = RichMenuLayoutId;

const buildActionsForCount = (count: number, current: Action[] = []): Action[] =>
  Array.from({ length: count }, (_, i) =>
    current[i]
      ? { ...current[i] }
      : { type: 'uri', label: `メニュー ${i + 1}`, value: '' }
  );

export interface MarketingLineSettingsViewProps {
  onNavigateToWelcomeFlow?: () => void;
}

export const MarketingLineSettingsView: React.FC<MarketingLineSettingsViewProps> = ({ onNavigateToWelcomeFlow }) => {
  const db = getSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  const initialPreset = createMstRecommendedRichMenuPreset(DEFAULT_MST_BOOKING_URL);

  // ─── リッチメニュー用状態 ───
  const [title, setTitle] = useState(initialPreset.title);
  const [chatBarText, setChatBarText] = useState(initialPreset.chatBarText);
  const [layout, setLayout] = useState<LayoutId>(initialPreset.layout);
  const selectedLayout = getRichMenuLayoutConfig(layout) || RICH_MENU_LAYOUTS[0];
  const layoutBounds = getRichMenuLayoutAreas(selectedLayout.id);
  const [actions, setActions] = useState<Action[]>(initialPreset.actions);
  const [bookingUrlDefault, setBookingUrlDefault] = useState(DEFAULT_MST_BOOKING_URL);
  const [image, setImage] = useState<{
    base64: string;
    mime: string;
    url: string;
    byteLength?: number;
    isGenerated?: boolean;
  } | null>(null);
  const [showOverlayGuide, setShowOverlayGuide] = useState(true);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const generateMstDesignImage = async (
    targetLayout: LayoutId = layout,
    targetActions: Action[] = actions,
    quiet = false
  ) => {
    setGeneratingImage(true);
    try {
      const rendered = await renderMstRichMenuImage({
        layout: targetLayout,
        actions: targetActions,
      });
      setImage({ ...rendered, isGenerated: true });
      if (!quiet) {
        setError('');
        setNotice(
          `MSTデザイン画像（${RICH_MENU_WIDTH}×${RICH_MENU_HEIGHT} px / ${Math.round(rendered.byteLength / 1024)} KB）を生成しました。`
        );
      }
    } catch (e: any) {
      if (!quiet) {
        setError(e?.message || 'リッチメニュー画像を生成できませんでした');
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  // 初回マウント時にMSTデザイン画像を自動生成 ＋ DBから現在のメニューID・TimeRex予約URLを取得
  useEffect(() => {
    let active = true;
    void renderMstRichMenuImage({
      layout: initialPreset.layout,
      actions: initialPreset.actions,
    })
      .then((rendered) => {
        if (active) {
          setImage({ ...rendered, isGenerated: true });
        }
      })
      .catch(() => {});

    if (db) {
      void (async () => {
        try {
          const { data: auth } = await db.auth.getUser();
          const uid = auth.user?.id;
          if (!uid || !active) return;

          const [{ data: integration }, { data: salesSettings }] = await Promise.all([
            db
              .from('line_channel_integrations')
              .select('rich_menu_id')
              .eq('owner_id', uid)
              .maybeSingle(),
            db
              .from('sales_workspace_settings')
              .select('booking_page_url')
              .eq('owner_id', uid)
              .maybeSingle(),
          ]);

          if (!active) return;
          if (integration?.rich_menu_id) {
            setCurrentId(integration.rich_menu_id);
          }
          const rawBookingUrl =
            typeof salesSettings?.booking_page_url === 'string' &&
            /^https:\/\//i.test(salesSettings.booking_page_url.trim())
              ? salesSettings.booking_page_url.trim()
              : '';
          if (rawBookingUrl) {
            let configuredBookingUrl = rawBookingUrl;
            try {
              const parsed = new URL(rawBookingUrl);
              if (!parsed.searchParams.has('utm_source')) {
                parsed.searchParams.set('utm_source', 'line');
              }
              if (!parsed.searchParams.has('utm_medium')) {
                parsed.searchParams.set('utm_medium', 'chat');
              }
              configuredBookingUrl = parsed.toString();
            } catch {
              // keep rawBookingUrl
            }
            setBookingUrlDefault(configuredBookingUrl);
            setActions((prev) =>
              prev.map((item, idx) =>
                idx === 1 && item.value === DEFAULT_MST_BOOKING_URL
                  ? { ...item, value: configuredBookingUrl }
                  : item
              )
            );
          }
        } catch {
          // optional prefill
        }
      })();
    }

    return () => {
      active = false;
    };
  }, []);

  // ラベルやアクション変更時、MST自動生成画像を使っている場合はリアルタイムに画像プレビューを最新化
  useEffect(() => {
    if (!image?.isGenerated) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void renderMstRichMenuImage({ layout, actions })
        .then((rendered) => {
          if (active) {
            setImage({ ...rendered, isGenerated: true });
          }
        })
        .catch(() => {});
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [actions, layout, image?.isGenerated]);

  const applyMstRecommendedPreset = async () => {
    const preset = createMstRecommendedRichMenuPreset(bookingUrlDefault);
    setTitle(preset.title);
    setChatBarText(preset.chatBarText);
    setLayout(preset.layout);
    setActions(preset.actions);
    await generateMstDesignImage(preset.layout, preset.actions, false);
    setNotice('MSTおすすめ5分割構成（上2:1・下3）とデザイン画像をセットしました。');
  };

  const downloadImage = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = `mst-rich-menu-${layout}-${RICH_MENU_WIDTH}x${RICH_MENU_HEIGHT}.${
      image.mime === 'image/jpeg' ? 'jpg' : 'png'
    }`;
    a.click();
  };

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
      setError('2500×1686 pxのPNGまたはJPEG画像（1MB以下）を選んでください');
      return;
    }
    void createImageBitmap(file)
      .then((bitmap) => {
        const validSize = bitmap.width === RICH_MENU_WIDTH && bitmap.height === RICH_MENU_HEIGHT;
        bitmap.close();
        if (!validSize) {
          setError(`画像サイズは${RICH_MENU_WIDTH}×${RICH_MENU_HEIGHT} pxにしてください`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const data = String(reader.result || '');
          setImage({
            base64: data.split(',')[1] || '',
            mime: file.type,
            url: data,
            byteLength: file.size,
            isGenerated: false,
          });
          setError('');
        };
        reader.onerror = () => setError('画像を読み込めませんでした');
        reader.readAsDataURL(file);
      })
      .catch(() => setError('画像を読み込めませんでした'));
  };

  const apply = async () => {
    if (!db) return;
    if (!image) {
      setError('リッチメニュー画像を選択または生成してください');
      return;
    }
    if (actions.some((a) => !a.label.trim() || !a.value.trim())) {
      setError('すべてのタッチ領域にラベルと遷移先または返信文章を設定してください');
      return;
    }
    if (actions.some((a) => a.type === 'uri' && !/^https:\/\//i.test(a.value.trim()))) {
      setError('URLアクションにはHTTPSのURLを入力してください');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data: s } = await db.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('ログインしてください');
      const response = await fetch('/api/line/rich-menu', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          chatBarText: chatBarText.trim(),
          imageBase64: image.base64,
          imageMimeType: image.mime,
          layout,
          actions,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'リッチメニューを反映できませんでした');
      setCurrentId(result.richMenuId || '');
      setNotice('リッチメニューをLINE公式アカウントの全友だちに反映しました');
    } catch (e: any) {
      setError(e?.message || 'リッチメニューを反映できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* ─── 友だち追加ウェルカムFlexメッセージ（導線フローで一元管理） ─── */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  📱 友だち追加時 自動送信（Flex）
                </span>
                <span className="text-xs text-slate-500">一元管理：導線フロー連動</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">友だち追加ウェルカムメッセージ</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                友だち追加（およびブロック解除）時に即時送信されるFlexメッセージや、3大ご相談メニュー（診断・個別相談・介護開業）の分岐は、設定の二重化を防ぐため「<strong className="text-emerald-800 font-semibold">🗺️ 導線フロー ＆ シナリオ管理</strong>」で一元管理されています。
              </p>
            </div>
          </div>
          {onNavigateToWelcomeFlow && (
            <button
              type="button"
              onClick={onNavigateToWelcomeFlow}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>🗺️ 導線フローでウェルカム文面を編集</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {/* ─── LINEリッチメニュー ─── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">LINEリッチメニュー</h2>
            <p className="mt-1 text-sm text-slate-500">
              5分割（上2:1・下3 / 上2・下3均等）を含むレイアウトを選び、各領域の動作とMSTデザイン画像を設定します。「LINEに反映」で公式アカウント全体の既定メニューが切り替わります。
            </p>
          </div>
          <button
            type="button"
            disabled={generatingImage}
            onClick={() => void applyMstRecommendedPreset()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F2B6B] hover:bg-[#1B41AE] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0 self-start"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E7D897]" />
            <span>MSTおすすめ5分割構成をセット</span>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                メニュー名
                <input
                  maxLength={300}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                開閉バーの表示
                <input
                  maxLength={14}
                  value={chatBarText}
                  onChange={(e) => setChatBarText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              タッチ領域のレイアウト
              <select
                value={layout}
                onChange={(e) => {
                  const next = e.target.value as LayoutId;
                  const config = getRichMenuLayoutConfig(next);
                  if (config) {
                    const nextActions = buildActionsForCount(config.cellCount, actions);
                    setLayout(next);
                    setActions(nextActions);
                    if (image?.isGenerated) {
                      void generateMstDesignImage(next, nextActions, true);
                    }
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
              >
                {RICH_MENU_LAYOUTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.recommended ? ' ★おすすめ' : ''}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-slate-500">
                {selectedLayout.description}
              </span>
            </label>

            {/* 画像生成・選択・ダウンロード操作 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  メニュー画像（{RICH_MENU_WIDTH}×{RICH_MENU_HEIGHT} px）
                </span>
                {image?.byteLength != null && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {image.isGenerated ? 'MST自動生成' : 'カスタム画像'} · {Math.round(image.byteLength / 1024)} KB
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={generatingImage}
                  onClick={() => void generateMstDesignImage(layout, actions, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${generatingImage ? 'animate-spin' : ''}`} />
                  <span>{generatingImage ? '生成中…' : 'MSTデザイン画像を再生成'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>画像ファイルを選択（PNG/JPEG・1MB以下）</span>
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={downloadImage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>画像をダウンロード</span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => chooseImage(e.target.files?.[0])}
              />
            </div>

            {/* タッチ領域設定カード */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {actions.map((a, i) => {
                const bounds = layoutBounds[i];
                const isWideHero = bounds && bounds.width >= 1400;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 shadow-xs ${
                      isWideHero
                        ? 'sm:col-span-2 border-blue-200 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        領域 {i + 1}
                        {isWideHero && (
                          <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                            特大枠
                          </span>
                        )}
                      </span>
                      {bounds && (
                        <span className="text-[10px] font-mono text-slate-500">
                          幅{bounds.width} × 高{bounds.height} px
                        </span>
                      )}
                    </div>
                    <input
                      value={a.label}
                      maxLength={20}
                      onChange={(e) =>
                        setActions((v) => v.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="表示名（20文字以内）"
                      className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
                    />
                    <select
                      value={a.type}
                      onChange={(e) =>
                        setActions((v) =>
                          v.map((x, j) => (j === i ? { ...x, type: e.target.value as Action['type'] } : x))
                        )
                      }
                      className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="uri">URLを開く</option>
                      <option value="message">テキストを送る</option>
                    </select>
                    <input
                      value={a.value}
                      maxLength={1000}
                      onChange={(e) =>
                        setActions((v) => v.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                      }
                      placeholder={a.type === 'uri' ? 'https://example.com' : '送信するテキスト'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-mono shadow-xs focus:outline-none focus:border-emerald-500"
                    />
                    {a.type === 'message' && a.value.trim() === '【LINEで相談したい】' && (
                      <p className="mt-1.5 text-[10px] font-medium text-emerald-700">
                        ⚡ 導線フローのキーワード自動応答「【LINEで相談したい】」と完全一致で連動します
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* プレビュー ＆ ピクセル目安 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700">
                プレビュー（{selectedLayout.label}）
              </div>
              <button
                type="button"
                onClick={() => setShowOverlayGuide((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition cursor-pointer"
              >
                {showOverlayGuide ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showOverlayGuide ? '分割枠・px目安を隠す' : '分割枠・px目安を表示'}</span>
              </button>
            </div>

            <div className="relative aspect-[2500/1686] overflow-hidden rounded-xl bg-slate-900 border border-slate-200 shadow-inner">
              {image && (
                <img
                  src={image.url}
                  alt="リッチメニュー画像"
                  className="absolute inset-0 h-full w-full object-fill"
                />
              )}
              {showOverlayGuide && (
                <div className="absolute inset-0">
                  {actions.map((a, i) => {
                    const bounds = layoutBounds[i];
                    if (!bounds) return null;
                    const posStyle = getRichMenuCellStylePercent(bounds);
                    return (
                      <div
                        key={i}
                        style={posStyle}
                        className="absolute flex flex-col items-center justify-center border border-dashed border-amber-300/80 bg-slate-950/35 px-1.5 text-center backdrop-blur-[0.5px]"
                      >
                        <span className="rounded bg-amber-400/95 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950 shadow-xs">
                          #{i + 1} {a.label}
                        </span>
                        <span className="mt-1 rounded bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-mono font-medium text-white">
                          幅{bounds.width} × 高{bounds.height} px
                        </span>
                        <span className="mt-0.5 text-[9px] font-medium text-emerald-200 [text-shadow:0_1px_2px_#000]">
                          {a.type === 'uri' ? 'URLを開く' : 'テキスト送信'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!image && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  画像プレビュー
                </div>
              )}
            </div>

            {/* 領域別サイズ＆座標一覧（デザイナー・画像差し替え用） */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-700">
                画像作成・タップ座標の目安（全体 {RICH_MENU_WIDTH} × {RICH_MENU_HEIGHT} px）
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {layoutBounds.map((bounds, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-semibold text-slate-700 truncate pr-2">
                      #{idx + 1} {actions[idx]?.label || `領域${idx + 1}`}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {bounds.width}×{bounds.height} px
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {currentId && (
              <p className="mt-2 break-all text-xs text-emerald-700 font-medium">
                現在のリッチメニューID: {currentId}
              </p>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            ※ ラベルを変更した場合は「MSTデザイン画像を再生成」を押すと画像内のタイトル文字も更新されます。
          </p>
          <button
            disabled={busy}
            onClick={() => void apply()}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'LINEへ反映中…' : 'LINEに反映'}
          </button>
        </div>
      </section>
    </div>
  );
};
