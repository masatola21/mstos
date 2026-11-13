import React, { useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import {
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  LayoutTemplate,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

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

type Action = { type: 'uri' | 'message'; label: string; value: string };
type LayoutId = 'single' | 'columns-2' | 'rows-2' | 'columns-3' | 'rows-3' | 'grid-2x2' | 'grid-2x3' | 'grid-3x2';

const layouts: { id: LayoutId; label: string; columns: number; rows: number }[] = [
  { id: 'single', label: '1分割（全面）', columns: 1, rows: 1 },
  { id: 'columns-2', label: '2分割（左右）', columns: 2, rows: 1 },
  { id: 'rows-2', label: '2分割（上下）', columns: 1, rows: 2 },
  { id: 'columns-3', label: '3分割（左右）', columns: 3, rows: 1 },
  { id: 'rows-3', label: '3分割（上下）', columns: 1, rows: 3 },
  { id: 'grid-2x2', label: '4分割（2×2）', columns: 2, rows: 2 },
  { id: 'grid-2x3', label: '6分割（2×3）', columns: 2, rows: 3 },
  { id: 'grid-3x2', label: '6分割（3×2）', columns: 3, rows: 2 },
];

const initial = (count = 6): Action[] =>
  Array.from({ length: count }, (_, i) => ({ type: 'uri', label: 'メニュー ' + (i + 1), value: '' }));

export interface MarketingLineSettingsViewProps {
  onNavigateToWelcomeFlow?: () => void;
}

export const MarketingLineSettingsView: React.FC<MarketingLineSettingsViewProps> = ({ onNavigateToWelcomeFlow }) => {
  const db = getSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── リッチメニュー用状態 ───
  const [title, setTitle] = useState('メニュー');
  const [chatBarText, setChatBarText] = useState('メニュー');
  const [layout, setLayout] = useState<LayoutId>('grid-2x3');
  const selectedLayout = layouts.find((item) => item.id === layout) || layouts[6];
  const [actions, setActions] = useState<Action[]>(initial());
  const [image, setImage] = useState<{ base64: string; mime: string; url: string } | null>(null);
  const [currentId, setCurrentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
      setError('2500×1686 pxのPNGまたはJPEG画像（1MB以下）を選んでください');
      return;
    }
    void createImageBitmap(file)
      .then((bitmap) => {
        const validSize = bitmap.width === 2500 && bitmap.height === 1686;
        bitmap.close();
        if (!validSize) {
          setError('画像サイズは2500×1686 pxにしてください');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const data = String(reader.result || '');
          setImage({ base64: data.split(',')[1] || '', mime: file.type, url: data });
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
      setError('リッチメニュー画像を選択してください');
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
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">LINEリッチメニュー</h2>
          <p className="mt-1 text-sm text-slate-500">
            画像とタッチ領域のレイアウトを選び、各領域の動作を設定します。「LINEに反映」で公式アカウント全体の既定メニューが切り替わります。
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
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
            <label className="block text-xs font-semibold text-slate-700">
              タッチ領域のレイアウト
              <select
                value={layout}
                onChange={(e) => {
                  const next = e.target.value as LayoutId;
                  const config = layouts.find((item) => item.id === next);
                  if (config) {
                    setLayout(next);
                    setActions(initial(config.columns * config.rows));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
              >
                {layouts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => chooseImage(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-5 text-sm text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              メニュー画像を選択（PNG/JPEG、1MB以下）
            </button>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {actions.map((a, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-xs">
                  <div className="mb-2 text-xs font-bold text-slate-800">タッチ領域 {i + 1}</div>
                  <input
                    value={a.label}
                    maxLength={20}
                    onChange={(e) =>
                      setActions((v) => v.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="表示名"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700">
              プレビュー（{selectedLayout.label}）
            </div>
            <div className="relative aspect-[2500/1686] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-inner">
              {image && (
                <img
                  src={image.url}
                  alt="リッチメニュー画像"
                  className="absolute inset-0 h-full w-full object-fill"
                />
              )}
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: 'repeat(' + selectedLayout.columns + ',minmax(0,1fr))',
                  gridTemplateRows: 'repeat(' + selectedLayout.rows + ',minmax(0,1fr))',
                }}
              >
                {actions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center border border-white/60 bg-purple-900/20 text-center text-xs font-bold text-white [text-shadow:0_1px_3px_#000]"
                  >
                    {a.label}
                  </div>
                ))}
              </div>
              {!image && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  画像プレビュー
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              画像は2500×1686 pxです。選択したレイアウトに合わせて領域を配置します。
            </p>
            {currentId && (
              <p className="mt-2 break-all text-xs text-emerald-700 font-medium">
                現在のリッチメニューID: {currentId}
              </p>
            )}
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100">
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
