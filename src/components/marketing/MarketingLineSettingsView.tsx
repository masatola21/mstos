import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { LineMessagePreview } from '../LineMessagePreview';
import {
  MessageSquare,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
  LayoutTemplate,
  HelpCircle,
  Copy,
  Database,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';

export type WelcomeChoiceRoute = 'form' | 'booking' | 'template';

export interface WelcomeChoice {
  id: string;
  label: string;
  tag: string;
  route: WelcomeChoiceRoute;
  formSlug?: string;
  templateId?: string;
  replyText?: string;
}

export const DEFAULT_WELCOME_CHOICES: WelcomeChoice[] = [
  { id: 'diagnosis', label: '📊 3分無料経営診断を受ける', tag: '選択:診断', route: 'form', formSlug: 'business-diagnosis' },
  { id: 'consult', label: '経営改善について個別相談する', tag: '選択:個別相談', route: 'booking' },
  { id: 'care', label: '介護保険外サービス開業パッケージについて知る', tag: '選択:開業パッケージ', route: 'template', templateId: '' },
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

export const MarketingLineSettingsView: React.FC = () => {
  const db = getSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── モード切替: 'form' (かんたん入力) | 'json' (JSON直接編集) ───
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');

  // かんたんフォーム入力用状態
  const [welcomeHeading, setWelcomeHeading] = useState('大橋真人です。');
  const [welcomeSubheading, setWelcomeSubheading] = useState('LINE登録ありがとうございます。');
  const [welcomeIntro, setWelcomeIntro] = useState(
    'MSTでは、中小企業の\n「経営の仕組み化×利益改善」と\n介護保険外サービスの開業を支援しています。'
  );
  const [welcomeQuestion, setWelcomeQuestion] = useState('まず、どのようなご相談をご希望ですか？');
  const [welcomeInstruction, setWelcomeInstruction] = useState('ご希望に近いものをお選びください');

  // 選択肢（postback分岐）
  const [choices, setChoices] = useState<WelcomeChoice[]>(DEFAULT_WELCOME_CHOICES);
  const [templates, setTemplates] = useState<{ id: string; name: string; reply_type?: string }[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);

  // ─── JSON直接編集用状態 ───
  const [jsonText, setJsonText] = useState('');
  const [jsonParseError, setJsonParseError] = useState('');

  const [welcomeRuleId, setWelcomeRuleId] = useState<string | null>(null);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState('');
  const [welcomeError, setWelcomeError] = useState('');
  const [schemaMissingColumn, setSchemaMissingColumn] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);

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

  const buildFormFlexPayload = () => {
    const buttonColors = ['#10B981', '#1E3A5F', '#0284C7', '#8B5CF6'];
    const buttons = choices.map((c, i) => ({
      type: 'button',
      style: 'primary',
      color: buttonColors[i % buttonColors.length],
      height: 'lg',
      margin: i === 0 ? 'lg' : 'sm',
      action: {
        type: 'postback',
        label: (c.label || `選択肢 ${i + 1}`).slice(0, 20),
        data: `wc=${c.id}`,
        displayText: c.label || `選択肢 ${i + 1}`,
      },
    }));

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
            ...buttons,
          ],
        },
      },
      choices,
    };
  };

  // 既存設定をロード
  useEffect(() => {
    if (!db) return;
    const loadWelcomeRule = async () => {
      try {
        const { data: sessionData } = await db.auth.getSession();
        const ownerId = sessionData.session?.user?.id;
        if (!ownerId) return;

        // テンプレート保管庫とシナリオ一覧をロード
        const [tplRes, scRes] = await Promise.all([
          db.from('line_auto_reply_templates').select('id, name, reply_type').eq('owner_id', ownerId).order('name'),
          db.from('marketing_automation_scenarios').select('scenario_id, config').eq('owner_id', ownerId),
        ]);
        if (tplRes.data) setTemplates(tplRes.data);
        if (scRes.data) setScenarios(scRes.data.map((item: any) => item.config).filter(Boolean));

        let ruleData: any = null;
        const { data, error: fetchErr } = await db
          .from('line_auto_reply_rules')
          .select('id, reply_type, reply_payload, enabled')
          .eq('owner_id', ownerId)
          .eq('match_text', '__welcome__')
          .maybeSingle();

        if (fetchErr) {
          if (fetchErr.message?.includes('reply_payload') || fetchErr.code === 'PGRST204') {
            setSchemaMissingColumn(true);
            const { data: fallbackData } = await db
              .from('line_auto_reply_rules')
              .select('id, reply_text, enabled')
              .eq('owner_id', ownerId)
              .eq('match_text', '__welcome__')
              .maybeSingle();
            ruleData = fallbackData;
          }
        } else {
          ruleData = data;
        }

        if (!ruleData) {
          // テンプレート保管庫もチェック
          const { data: tpl } = await db
            .from('line_auto_reply_templates')
            .select('payload')
            .eq('owner_id', ownerId)
            .ilike('name', '%ウェルカム%')
            .maybeSingle();
          if (tpl?.payload) {
            setJsonText(JSON.stringify(tpl.payload, null, 2));
            return;
          }
          setJsonText(JSON.stringify(buildFormFlexPayload(), null, 2));
          return;
        }
        setWelcomeRuleId(ruleData.id);
        setWelcomeEnabled(ruleData.enabled);

        let payload = ruleData.reply_payload as any;
        if (!payload && ruleData.reply_text) {
          try {
            payload = JSON.parse(ruleData.reply_text);
          } catch {
            // text was summary
          }
        }
        if (!payload) {
          const { data: tpl } = await db
            .from('line_auto_reply_templates')
            .select('payload')
            .eq('owner_id', ownerId)
            .ilike('name', '%ウェルカム%')
            .maybeSingle();
          if (tpl?.payload) payload = tpl.payload;
        }
        if (payload) {
          setJsonText(JSON.stringify(payload, null, 2));

          const bodyContents = payload?.contents?.body?.contents;
          if (Array.isArray(bodyContents)) {
            if (bodyContents[0]?.text) setWelcomeHeading(bodyContents[0].text);
            if (bodyContents[1]?.text) setWelcomeSubheading(bodyContents[1].text);
            if (bodyContents[3]?.text) setWelcomeIntro(bodyContents[3].text);
            if (bodyContents[4]?.text) setWelcomeQuestion(bodyContents[4].text);
            if (bodyContents[5]?.text) setWelcomeInstruction(bodyContents[5].text);
          }

          if (Array.isArray(payload.choices) && payload.choices.length > 0) {
            setChoices(payload.choices);
          } else if (Array.isArray(bodyContents)) {
            const btns = bodyContents.filter((c: any) => c.type === 'button');
            if (btns.length > 0) {
              const recoveredChoices: WelcomeChoice[] = btns.slice(0, 4).map((b: any, idx: number) => {
                const data = String(b.action?.data || '');
                const idMatch = data.match(/^wc=([a-z0-9_-]+)/i);
                const choiceId = idMatch ? idMatch[1] : (idx === 0 ? 'diagnosis' : idx === 1 ? 'consult' : idx === 2 ? 'care' : `choice_${idx + 1}`);
                const defaultForId = DEFAULT_WELCOME_CHOICES.find(d => d.id === choiceId) || DEFAULT_WELCOME_CHOICES[idx];
                return {
                  id: choiceId,
                  label: b.action?.label || defaultForId?.label || `選択肢 ${idx + 1}`,
                  tag: defaultForId?.tag || `選択:${choiceId}`,
                  route: defaultForId?.route || (idx === 0 ? 'form' : idx === 1 ? 'booking' : 'template'),
                  formSlug: defaultForId?.formSlug || 'business-diagnosis',
                  templateId: defaultForId?.templateId || '',
                };
              });
              setChoices(recoveredChoices);
            }
          }
        }
      } catch {
        // ignore load errors
      }
    };
    void loadWelcomeRule();
  }, [db]);

  const updateChoice = (index: number, patch: Partial<WelcomeChoice>) => {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addChoice = () => {
    if (choices.length >= 4) return;
    const nextIdx = choices.length + 1;
    const newChoice: WelcomeChoice = {
      id: `choice_${Date.now().toString(36)}`,
      label: `選択肢 ${nextIdx}`,
      tag: `選択:項目${nextIdx}`,
      route: 'form',
      formSlug: 'business-diagnosis',
    };
    setChoices((prev) => [...prev, newChoice]);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 1) return;
    setChoices((prev) => prev.filter((_, i) => i !== index));
  };

  const getScenariosForTag = (tagName: string) => {
    if (!tagName || !tagName.trim()) return [];
    const normalizedTag = tagName.trim().toLowerCase();
    return scenarios.filter((s: any) => {
      const trig = String(s.trigger || '').toLowerCase();
      const aud = String(s.audience || '').toLowerCase();
      const name = String(s.name || '').toLowerCase();
      return (trig === 'tag_added' && (aud.includes(normalizedTag) || name.includes(normalizedTag))) ||
        aud.includes(normalizedTag);
    });
  };

  // モードをJSONに切り替えたときは現在のフォーム内容からJSONを最新化
  const switchToJsonMode = () => {
    setJsonText(JSON.stringify(buildFormFlexPayload(), null, 2));
    setJsonParseError('');
    setEditorMode('json');
  };

  // モードをフォームに切り替えるときはJSONからフォーム状態を逆反映（解析可能な場合）
  const switchToFormMode = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const bodyContents = parsed?.contents?.body?.contents;
      if (Array.isArray(bodyContents)) {
        if (bodyContents[0]?.text) setWelcomeHeading(bodyContents[0].text);
        if (bodyContents[1]?.text) setWelcomeSubheading(bodyContents[1].text);
        if (bodyContents[3]?.text) setWelcomeIntro(bodyContents[3].text);
        if (bodyContents[4]?.text) setWelcomeQuestion(bodyContents[4].text);
        if (bodyContents[5]?.text) setWelcomeInstruction(bodyContents[5].text);
      }
      if (Array.isArray(parsed?.choices) && parsed.choices.length > 0) {
        setChoices(parsed.choices);
      }
      setJsonParseError('');
    } catch {
      // 独自JSONの場合はフォーム側へ逆反映しないが、切り替えは許可
    }
    setEditorMode('form');
  };

  // プレビュー表示用payloadの決定
  const getCurrentPreviewPayload = () => {
    if (editorMode === 'form') {
      return buildFormFlexPayload();
    }
    try {
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch {
      return null;
    }
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

      let payload: any;
      if (editorMode === 'form') {
        payload = buildFormFlexPayload();
      } else {
        try {
          payload = JSON.parse(jsonText);
        } catch (e: any) {
          throw new Error('JSONの構文が正しくありません: ' + e.message);
        }
      }

      // altTextが抜けている場合は補正
      if (!payload.altText) {
        payload.altText = '友だち追加ありがとうございます（Flexメッセージ）';
      }
      // contents単体でコピーされた場合（Simulatorのコピー仕様対応）
      if (!payload.contents && (payload.type === 'bubble' || payload.type === 'carousel')) {
        payload = {
          altText: '友だち追加ありがとうございます（Flexメッセージ）',
          contents: payload,
        };
      }

      const summaryText =
        editorMode === 'form'
          ? `[ウェルカムFlexメッセージ: ${welcomeHeading}]`
          : `[ウェルカムFlexメッセージ: ${payload.altText || 'カスタムFlex'}]`;

      try {
        if (welcomeRuleId) {
          const { error: updateErr } = await db
            .from('line_auto_reply_rules')
            .update({
              reply_type: 'flex',
              reply_payload: payload,
              reply_text: summaryText,
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
              reply_text: summaryText,
              priority: 10,
              enabled: welcomeEnabled,
            })
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          if (inserted) setWelcomeRuleId(inserted.id);
        }
      } catch (ruleErr: any) {
        // 'reply_payload' カラムが見つからない場合（スキーマ未マイグレーション）
        if (ruleErr?.message?.includes('reply_payload') || ruleErr?.code === 'PGRST204' || ruleErr?.message?.includes('schema cache')) {
          setSchemaMissingColumn(true);
          // フォールバック: reply_payload を除外して reply_text に JSON を保存
          if (welcomeRuleId) {
            const { error: fbErr } = await db
              .from('line_auto_reply_rules')
              .update({
                reply_text: JSON.stringify(payload),
                enabled: welcomeEnabled,
                updated_at: new Date().toISOString(),
              })
              .eq('id', welcomeRuleId);
            if (fbErr) throw fbErr;
          } else {
            const { data: fbInserted, error: fbInsertErr } = await db
              .from('line_auto_reply_rules')
              .insert({
                owner_id: ownerId,
                name: '友だち追加ウェルカムFlexメッセージ',
                match_mode: 'exact',
                match_text: '__welcome__',
                reply_text: JSON.stringify(payload),
                priority: 10,
                enabled: welcomeEnabled,
              })
              .select('id')
              .single();
            if (fbInsertErr) throw fbInsertErr;
            if (fbInserted) setWelcomeRuleId(fbInserted.id);
          }
        } else {
          throw ruleErr;
        }
      }

      // テンプレート管理側にも同期保存
      try {
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
      } catch (tplErr) {
        console.warn('Template sync warning:', tplErr);
      }

      setWelcomeNotice(
        schemaMissingColumn
          ? 'ウェルカムメッセージを互換モードで保存しました。Flexの完全なネイティブ保存を行うには下記のSQLを実行してください。'
          : '友だち追加ウェルカムFlexメッセージを更新保存しました！'
      );
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

  const previewPayload = getCurrentPreviewPayload();

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
              LINE公式アカウントの新規友だち追加（およびブロック解除）時に自動送信されるFlexカードの文面・JSON設定
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

        {/* 編集モード切り替えタブ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={switchToFormMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                editorMode === 'form'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              かんたんフォーム入力
            </button>
            <button
              type="button"
              onClick={switchToJsonMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                editorMode === 'json'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              JSON直接編集（Simulator対応）
            </button>
          </div>

          <a
            href="https://developers.line.biz/flex-simulator/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            <span>LINE公式 Flex Message Simulator を開く</span>
            <ExternalLink className="h-3 w-3" />
          </a>
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
        {schemaMissingColumn && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-xs text-amber-200 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Database className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">
                    Supabaseの「line_auto_reply_rules」に reply_payload カラムが未適用です
                  </div>
                  <p className="mt-1 text-[11px] text-amber-200/90 leading-relaxed">
                    アプリ側で自動フォールバックを行っているため保存は完了していますが、Flex・画像・動画のネイティブ保存を完了するにはSupabase SQL Editorで以下のSQLを1回実行してください。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`ALTER TABLE public.line_auto_reply_rules\n  ADD COLUMN IF NOT EXISTS reply_type text NOT NULL DEFAULT 'text',\n  ADD COLUMN IF NOT EXISTS reply_payload jsonb NOT NULL DEFAULT '{}'::jsonb;\nNOTIFY pgrst, 'reload schema';`);
                  setMigrationCopied(true);
                  setTimeout(() => setMigrationCopied(false), 3000);
                }}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors cursor-pointer"
              >
                {migrationCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{migrationCopied ? 'コピー完了' : 'SQLをコピー'}</span>
              </button>
            </div>
            <div className="rounded-lg bg-slate-950/80 p-2 font-mono text-[11px] text-slate-300 overflow-x-auto select-all">
              ALTER TABLE public.line_auto_reply_rules ADD COLUMN IF NOT EXISTS reply_type text NOT NULL DEFAULT &apos;text&apos;, ADD COLUMN IF NOT EXISTS reply_payload jsonb NOT NULL DEFAULT &apos;&#123;&#125;&apos;::jsonb; NOTIFY pgrst, &apos;reload schema&apos;;
            </div>
          </div>
        )}

        {/* 2カラム構成: 左側フォームまたはJSON / 右側リアルタイムプレビュー */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* 左側: 入力フォーム or JSON */}
          <div className="lg:col-span-7 space-y-4">
            {editorMode === 'form' ? (
              <>
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

                {/* 選択肢・分岐アクション設定（最大4つ） */}
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>2. 選択肢・自動分岐設定（最大4つ）</span>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">postback方式</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        友だち追加時に届くFlexカードのボタンです。選択時にタグを付与し、それぞれの専用ルートへ分岐返信します。
                      </p>
                    </div>
                    {choices.length < 4 && (
                      <button
                        type="button"
                        onClick={addChoice}
                        className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> 選択肢を追加
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {choices.map((choice, idx) => {
                      const matchedScenarios = getScenariosForTag(choice.tag);
                      const badgeColors = [
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                        'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                        'bg-sky-500/20 text-sky-300 border-sky-500/30',
                        'bg-purple-500/20 text-purple-300 border-purple-500/30',
                      ];

                      return (
                        <div key={choice.id || idx} className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badgeColors[idx % badgeColors.length]}`}>
                                選択肢 {idx + 1}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">id: {choice.id}</span>
                            </div>
                            {choices.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeChoice(idx)}
                                className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                                title="この選択肢を削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                ボタン表示名 <span className="text-rose-400">*</span>（最大20文字）
                              </label>
                              <input
                                type="text"
                                maxLength={20}
                                value={choice.label}
                                onChange={(e) => updateChoice(idx, { label: e.target.value })}
                                placeholder="例: 📊 3分無料経営診断を受ける"
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                付与するタグ名 <span className="text-rose-400">*</span>（シナリオ起動条件）
                              </label>
                              <input
                                type="text"
                                value={choice.tag}
                                onChange={(e) => updateChoice(idx, { tag: e.target.value })}
                                placeholder="例: 選択:診断"
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">
                                分岐先の返信タイプ（route）
                              </label>
                              <select
                                value={choice.route}
                                onChange={(e) => updateChoice(idx, { route: e.target.value as WelcomeChoiceRoute })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                              >
                                <option value="form">📊 診断フォーム（識別付きURLを返信）</option>
                                <option value="booking">🗓️ 個別相談・面談予約（予約カレンダーURLを返信）</option>
                                <option value="template">📑 登録済みテンプレート（Flex等テンプレートを返信）</option>
                              </select>
                            </div>

                            {choice.route === 'form' && (
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  フォーム識別スラッグ
                                </label>
                                <input
                                  type="text"
                                  value={choice.formSlug || 'business-diagnosis'}
                                  onChange={(e) => updateChoice(idx, { formSlug: e.target.value })}
                                  placeholder="business-diagnosis"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono"
                                />
                                <span className="text-[10px] text-slate-500">
                                  /f/{choice.formSlug || 'business-diagnosis'}?cid=&luid= で送信されます
                                </span>
                              </div>
                            )}

                            {choice.route === 'template' && (
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  返信する登録済みテンプレート
                                </label>
                                <select
                                  value={choice.templateId || ''}
                                  onChange={(e) => updateChoice(idx, { templateId: e.target.value })}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="">自動選択（「介護/開業」テンプレートを検索）</option>
                                  {templates.map((tpl) => (
                                    <option key={tpl.id} value={tpl.id}>
                                      {tpl.name}（{tpl.reply_type || 'flex'}）
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-slate-500">
                                  「テンプレート保管庫」に登録済みのFlexメッセージを選択できます
                                </span>
                              </div>
                            )}

                            {choice.route === 'booking' && (
                              <div className="flex flex-col justify-center">
                                <span className="text-[11px] text-slate-400 mb-1">面談予約カレンダー</span>
                                <span className="text-[11px] text-slate-300">
                                  営業設定の予約URL（booking_page_url）が自動差し込みされます
                                </span>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                              個別返信メッセージ・備考（任意）
                            </label>
                            <input
                              type="text"
                              value={choice.replyText || ''}
                              onChange={(e) => updateChoice(idx, { replyText: e.target.value })}
                              placeholder="空欄の場合は標準のご案内メッセージが送信されます"
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>

                          {/* この選択で起動するシナリオ表示 */}
                          <div className="pt-1">
                            {matchedScenarios.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                <span>
                                  この選択で起動するシナリオ: <span className="font-semibold text-emerald-200">{matchedScenarios.map((s) => s.name).join('、')}</span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg px-2.5 py-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                <span>
                                  タグ「<span className="font-mono">{choice.tag || '未設定'}</span>」で起動するシナリオは現在未設定です（「教育・フォロー」タブで作成できます）
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* JSON直接編集モード */
              <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Code className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200">Flex Message JSON 直接編集</h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    LINE SimulatorのJSONをそのまま貼り付け可能
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-400">
                  <span className="text-amber-300 font-semibold">【使い方】</span>
                  LINE Developersの <a href="https://developers.line.biz/flex-simulator/" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">Flex Message Simulator</a> でデザインしたBubbleまたはCarouselのJSONをここに貼り付けて保存できます。
                </p>

                <textarea
                  rows={20}
                  value={jsonText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setJsonText(text);
                    try {
                      JSON.parse(text);
                      setJsonParseError('');
                    } catch (err: any) {
                      setJsonParseError(err.message);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder='{\n  "type": "bubble",\n  "body": { ... }\n}'
                />

                {jsonParseError && (
                  <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2.5 font-mono">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>JSON構文エラー: {jsonParseError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右側: リアルタイムFlexプレビュー */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-3">
                <span>リアルタイムプレビュー</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  {editorMode === 'form' ? 'フォーム連動' : 'JSONレンダリング'}
                </span>
              </div>

              {previewPayload ? (
                <div className="max-w-[340px] mx-auto overflow-hidden">
                  <LineMessagePreview
                    type="flex"
                    title="ウェルカムメッセージ"
                    payload={previewPayload}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  JSONの構文にエラーがあるためプレビューを表示できません
                </div>
              )}
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
