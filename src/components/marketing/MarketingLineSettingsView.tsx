import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { MessageSquare, Save, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

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

export const MarketingLineSettingsView: React.FC = () => {
  const db = getSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── 友だち追加ウェルカムFlexメッセージ状態 ───
  const [welcomeHeading, setWelcomeHeading] = useState('大橋真人です。');
  const [welcomeSubheading, setWelcomeSubheading] = useState('LINE登録ありがとうございます。');
  const [welcomeIntro, setWelcomeIntro] = useState(
    'MSTでは、中小企業の\n「経営の仕組み化×利益改善」と\n介護保険外サービスの開業を支援しています。'
  );
  const [welcomeQuestion, setWelcomeQuestion] = useState('まず、どのようなご相談をご希望ですか？');
  const [welcomeInstruction, setWelcomeInstruction] = useState('ご希望に近いものをお選びください');

  // ボタン設定
  const [btn1Label, setBtn1Label] = useState('経営改善について相談する');
  const [btn1Text, setBtn1Text] = useState('経営改善について相談する');
  const [btn2Label, setBtn2Label] = useState('介護保険外サービスについて相談する');
  const [btn2Text, setBtn2Text] = useState('介護保険外サービスについて相談する');
  const [btn3Label, setBtn3Label] = useState('📊 3分無料経営診断を受ける');
  const [btn3Uri, setBtn3Uri] = useState('');

  const [welcomeRuleId, setWelcomeRuleId] = useState<string | null>(null);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState('');
  const [welcomeError, setWelcomeError] = useState('');

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

  // 診断URLの初期値を設定
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!btn3Uri) {
      setBtn3Uri(`${origin}/forms/business-diagnosis?source=line`);
    }
  }, []);

  // 既存のウェルカム設定をロード
  useEffect(() => {
    if (!db) return;
    const loadWelcomeRule = async () => {
      try {
        const { data: sessionData } = await db.auth.getSession();
        const ownerId = sessionData.session?.user?.id;
        if (!ownerId) return;

        const { data, error: fetchErr } = await db
          .from('line_auto_reply_rules')
          .select('id, reply_type, reply_payload, enabled')
          .eq('owner_id', ownerId)
          .eq('match_text', '__welcome__')
          .maybeSingle();

        if (fetchErr || !data) return;
        setWelcomeRuleId(data.id);
        setWelcomeEnabled(data.enabled);

        const payload = data.reply_payload as any;
        const bodyContents = payload?.contents?.body?.contents;
        if (Array.isArray(bodyContents)) {
          // テキスト抽出
          if (bodyContents[0]?.text) setWelcomeHeading(bodyContents[0].text);
          if (bodyContents[1]?.text) setWelcomeSubheading(bodyContents[1].text);
          if (bodyContents[3]?.text) setWelcomeIntro(bodyContents[3].text);
          if (bodyContents[4]?.text) setWelcomeQuestion(bodyContents[4].text);
          if (bodyContents[5]?.text) setWelcomeInstruction(bodyContents[5].text);

          // ボタン抽出
          const btns = bodyContents.filter((c: any) => c.type === 'button');
          if (btns[0]?.action) {
            setBtn1Label(btns[0].action.label || '');
            setBtn1Text(btns[0].action.text || '');
          }
          if (btns[1]?.action) {
            setBtn2Label(btns[1].action.label || '');
            setBtn2Text(btns[1].action.text || '');
          }
          if (btns[2]?.action) {
            setBtn3Label(btns[2].action.label || '');
            setBtn3Uri(btns[2].action.uri || '');
          }
        }
      } catch {
        // ignore load errors
      }
    };
    void loadWelcomeRule();
  }, [db]);

  const buildFlexPayload = () => {
    return {
      altText: `${welcomeHeading} ${welcomeSubheading}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'lg',
          contents: [
            { type: 'text', text: welcomeHeading, size: 'xl', weight: 'bold', align: 'center', color: '#1E293B', wrap: true },
            { type: 'text', text: welcomeSubheading, size: 'md', align: 'center', color: '#334155', margin: 'sm', wrap: true },
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: welcomeIntro, size: 'sm', align: 'center', color: '#475569', margin: 'lg', wrap: true },
            { type: 'text', text: welcomeQuestion, size: 'lg', weight: 'bold', align: 'center', color: '#1E293B', margin: 'xl', wrap: true },
            { type: 'text', text: welcomeInstruction, size: 'sm', align: 'center', color: '#64748B', margin: 'sm', wrap: true },
            {
              type: 'button',
              style: 'primary',
              color: '#1E3A5F',
              height: 'lg',
              margin: 'lg',
              action: { type: 'message', label: btn1Label, text: btn1Text || btn1Label },
            },
            {
              type: 'button',
              style: 'primary',
              color: '#0284C7',
              height: 'lg',
              margin: 'sm',
              action: { type: 'message', label: btn2Label, text: btn2Text || btn2Label },
            },
            {
              type: 'button',
              style: 'primary',
              color: '#10B981',
              height: 'lg',
              margin: 'sm',
              action: { type: 'uri', label: btn3Label, uri: btn3Uri },
            },
          ],
        },
      },
    };
  };

  const handleSaveWelcome = async () => {
    if (!db) return;
    setWelcomeSaving(true);
    setWelcomeNotice('');
    setWelcomeError('');

    try {
      const { data: sessionData } = await db.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      if (!ownerId) throw new Error('ログイン状態を確認できません');

      const payload = buildFlexPayload();

      if (welcomeRuleId) {
        const { error: updateErr } = await db
          .from('line_auto_reply_rules')
          .update({
            reply_type: 'flex',
            reply_payload: payload,
            reply_text: `[ウェルカムFlexメッセージ: ${welcomeHeading}]`,
            enabled: welcomeEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', welcomeRuleId);
        if (updateErr) throw updateErr;
      } else {
        const { data: inserted, error: insertErr } = await db
          .from('line_auto_reply_rules')
          .insert({
            owner_id: ownerId,
            name: '友だち追加ウェルカムFlexメッセージ',
            match_mode: 'exact',
            match_text: '__welcome__',
            reply_type: 'flex',
            reply_payload: payload,
            reply_text: `[ウェルカムFlexメッセージ: ${welcomeHeading}]`,
            priority: 10,
            enabled: welcomeEnabled,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        if (inserted) setWelcomeRuleId(inserted.id);
      }

      // テンプレート一覧にも同期保存（テンプレート管理でも呼び出せるように）
      await db.from('line_auto_reply_templates').upsert(
        {
          owner_id: ownerId,
          name: '大橋真人 公式ウェルカムメッセージ（無料診断誘導付き）',
          reply_type: 'flex',
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id,name' }
      );

      setWelcomeNotice('友だち追加ウェルカムメッセージを更新保存しました！');
    } catch (e: any) {
      setWelcomeError(e?.message || '保存に失敗しました');
    } finally {
      setWelcomeSaving(false);
    }
  };

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
      {/* ─── 友だち追加ウェルカムFlexメッセージ設定＆プレビュー ─── */}
      <section className="space-y-5 rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> 友だち追加時 自動送信（Flex）
              </span>
              <span className="text-xs text-slate-400">友だち追加 ➜ 即座に診断誘導 ➜ 回答 ➜ リード化</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">友だち追加ウェルカムメッセージ編集</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              LINE公式アカウントの新規友だち追加（およびブロック解除）時に自動送信されるFlexカードの文面とボタン設定
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={welcomeEnabled}
                onChange={(e) => setWelcomeEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-500 cursor-pointer"
              />
              自動送信を有効化
            </label>
            <button
              type="button"
              disabled={welcomeSaving}
              onClick={() => void handleSaveWelcome()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Save className="h-4 w-4" />
              {welcomeSaving ? '保存中…' : 'ウェルカムメッセージを更新保存'}
            </button>
          </div>
        </div>

        {welcomeNotice && (
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{welcomeNotice}</span>
          </div>
        )}
        {welcomeError && (
          <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{welcomeError}</span>
          </div>
        )}

        {/* 2カラム構成: 左側フォーム / 右側リアルタイムプレビュー */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* 左側: 入力フォーム */}
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-xs font-bold text-slate-200">1. ご挨拶・導入文</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">メイン見出し（送信者名）</label>
                  <input
                    type="text"
                    value={welcomeHeading}
                    onChange={(e) => setWelcomeHeading(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">サブ挨拶文</label>
                  <input
                    type="text"
                    value={welcomeSubheading}
                    onChange={(e) => setWelcomeSubheading(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">事業・サービス紹介文（改行可）</label>
                <textarea
                  rows={3}
                  value={welcomeIntro}
                  onChange={(e) => setWelcomeIntro(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">相談喚起の問いかけ</label>
                  <input
                    type="text"
                    value={welcomeQuestion}
                    onChange={(e) => setWelcomeQuestion(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">操作案内文</label>
                  <input
                    type="text"
                    value={welcomeInstruction}
                    onChange={(e) => setWelcomeInstruction(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* ボタン設定 */}
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-xs font-bold text-slate-200">2. アクションボタン設定</h3>

              {/* ボタン1 */}
              <div className="rounded-lg border border-slate-800 p-3 space-y-2">
                <span className="text-[11px] font-semibold text-indigo-400">ボタン 1（メッセージ送信）</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={btn1Label}
                    onChange={(e) => setBtn1Label(e.target.value)}
                    placeholder="ボタン表示名"
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={btn1Text}
                    onChange={(e) => setBtn1Text(e.target.value)}
                    placeholder="タップ時に送信される返信文字"
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* ボタン2 */}
              <div className="rounded-lg border border-slate-800 p-3 space-y-2">
                <span className="text-[11px] font-semibold text-sky-400">ボタン 2（メッセージ送信）</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={btn2Label}
                    onChange={(e) => setBtn2Label(e.target.value)}
                    placeholder="ボタン表示名"
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={btn2Text}
                    onChange={(e) => setBtn2Text(e.target.value)}
                    placeholder="タップ時に送信される返信文字"
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* ボタン3 (診断リンク) */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 space-y-2">
                <span className="text-[11px] font-semibold text-emerald-400">ボタン 3（診断フォームURLリンク）</span>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={btn3Label}
                    onChange={(e) => setBtn3Label(e.target.value)}
                    placeholder="ボタン表示名"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                  />
                  <input
                    type="url"
                    value={btn3Uri}
                    onChange={(e) => setBtn3Uri(e.target.value)}
                    placeholder="遷移先URL (https://...)"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 右側: リアルタイムFlexプレビュー */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-3">
                <span>リアルタイムFlexプレビュー</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  LINE受信画面イメージ
                </span>
              </div>

              <div className="max-w-[320px] mx-auto bg-white rounded-2xl p-5 text-slate-900 shadow-2xl space-y-2.5">
                <div className="text-center font-bold text-lg text-slate-800 break-words">{welcomeHeading || '（見出し）'}</div>
                <div className="text-center text-xs text-slate-600 break-words">{welcomeSubheading || '（サブ見出し）'}</div>
                <hr className="border-slate-200 my-1.5" />
                <div className="text-center text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                  {welcomeIntro || '（事業紹介文）'}
                </div>
                <div className="text-center font-bold text-xs text-slate-800 pt-2 break-words">
                  {welcomeQuestion || '（質問）'}
                </div>
                <div className="text-center text-[10px] text-slate-500 break-words">
                  {welcomeInstruction || '（案内文）'}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="w-full py-2 px-3 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold text-center shadow-sm truncate">
                    {btn1Label || 'ボタン1'}
                  </div>
                  <div className="w-full py-2 px-3 rounded-xl bg-[#0284C7] text-white text-xs font-bold text-center shadow-sm truncate">
                    {btn2Label || 'ボタン2'}
                  </div>
                  <div className="w-full py-2 px-3 rounded-xl bg-[#10B981] text-white text-xs font-bold text-center shadow-sm flex items-center justify-center gap-1 truncate">
                    <span>{btn3Label || 'ボタン3'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LINEリッチメニュー ─── */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white">LINEリッチメニュー</h2>
          <p className="mt-1 text-sm text-slate-400">
            画像とタッチ領域のレイアウトを選び、各領域の動作を設定します。「LINEに反映」で公式アカウント全体の既定メニューが切り替わります。
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs text-slate-300">
              メニュー名
              <input
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-300">
              開閉バーの表示
              <input
                maxLength={14}
                value={chatBarText}
                onChange={(e) => setChatBarText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-300">
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
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
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
              className="w-full rounded-lg border border-dashed border-slate-600 px-4 py-5 text-sm text-slate-300 hover:bg-slate-800"
            >
              メニュー画像を選択（PNG/JPEG、1MB以下）
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {actions.map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-800 p-3">
                  <div className="mb-2 text-xs font-semibold text-white">タッチ領域 {i + 1}</div>
                  <input
                    value={a.label}
                    maxLength={20}
                    onChange={(e) =>
                      setActions((v) => v.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="表示名"
                    className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  />
                  <select
                    value={a.type}
                    onChange={(e) =>
                      setActions((v) =>
                        v.map((x, j) => (j === i ? { ...x, type: e.target.value as Action['type'] } : x))
                      )
                    }
                    className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
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
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-300">
              プレビュー（{selectedLayout.label}）
            </div>
            <div className="relative aspect-[2500/1686] overflow-hidden rounded-xl bg-slate-950">
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
                    className="flex items-center justify-center border border-white/50 bg-indigo-950/20 text-center text-xs font-bold text-white [text-shadow:0_1px_3px_#000]"
                  >
                    {a.label}
                  </div>
                ))}
              </div>
              {!image && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  画像プレビュー
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              画像は2500×1686 pxです。選択したレイアウトに合わせて領域を配置します。
            </p>
            {currentId && (
              <p className="mt-2 break-all text-xs text-emerald-300">
                現在のリッチメニューID: {currentId}
              </p>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-emerald-300">
            {notice}
          </p>
        )}
        <button
          disabled={busy}
          onClick={() => void apply()}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'LINEへ反映中…' : 'LINEに反映'}
        </button>
      </section>
    </div>
  );
};
