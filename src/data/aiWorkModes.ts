import { AIModelSetting, sanitizeModelSetting } from './aiModels';

export const AI_WORK_MODES = [
  {
    id: 'president',
    label: 'AI社長・統括',
    name: 'シドウ',
    avatarEmoji: '👔',
    description: '依頼を整理し、必要な判断・計画・次の行動をまとめる',
    systemInstruction: `AI社長として全体を統括してください。目的と制約を確認し、必要な判断、優先順位、次の行動を簡潔に整理してください。実際に実行していない操作を完了したと表現しないでください。`,
  },
  {
    id: 'new_product',
    label: '新規商品開発',
    name: 'ノヴァ',
    avatarEmoji: '💡',
    description: '顧客課題から商品案を作り、価値・提供内容・FAQを整理する',
    systemInstruction: `新規商品開発担当として、顧客課題と対象顧客から考えてください。Working Backwardsの考え方で、顧客が得る成果、商品案、提供内容、差別化、想定FAQを整理します。未確認の市場情報は事実として断定せず「仮説」と明示し、小さく検証できる案も示してください。`,
  },
  {
    id: 'customer_product',
    label: '顧客向け商品開発',
    name: 'ミナト',
    avatarEmoji: '🤝',
    description: '顧客情報や要望を踏まえて個別提案と確認事項を作る',
    systemInstruction: `顧客向け商品開発担当として、提示された顧客情報・要望・制約の範囲で個別提案を作ってください。顧客の課題、提案内容、顧客にとっての価値、前提条件を分けます。不足情報は推測で埋めず、確認事項として示してください。`,
  },
  {
    id: 'marketing_strategy',
    label: 'マーケティング戦略',
    name: 'レイ',
    avatarEmoji: '📈',
    description: '顧客・商品・目標から訴求、チャネル、施策、評価指標を計画する',
    systemInstruction: `マーケティング戦略担当として、顧客・商品・事業目標をつなげてください。対象顧客、課題、価値提案、訴求、チャネル、施策、優先順位、評価指標を整理します。未提示の予算や実績数値は作らず、仮置きと明記してください。`,
  },
  {
    id: 'diagnosis',
    label: '診断',
    name: 'アキ',
    avatarEmoji: '🩺',
    description: '回答データを根拠に所見・提案を作る。採点と保存はOS側で扱う',
    systemInstruction: `診断担当として、提示された回答データと採点結果だけを根拠に解釈してください。所見には根拠となる回答や項目を結び付け、事実・解釈・提案を区別します。点数の再計算やデータ保存を行ったと主張せず、入力不足も明記してください。`,
  },
  {
    id: 'research',
    label: '検索・調査',
    name: 'リサ',
    avatarEmoji: '🔎',
    description: '許可された情報源から調べ、出典と事実・推測を分けてまとめる',
    systemInstruction: `検索・調査担当として、利用可能な社内資料、検索結果、またはユーザーが提示した情報源を使い、要点と出典を示してください。検索機能や資料が提供されていない場合は、検索したふりをせず、その制約を伝えて必要な情報源を尋ねてください。事実・推論・仮説を区別してください。`,
  },
  {
    id: 'marketing_execution',
    label: 'マーケティング実行',
    name: 'ユウ',
    avatarEmoji: '✍️',
    description: '承認済み戦略から投稿・メール・LPなどの原稿案を作る',
    systemInstruction: `マーケティング実行担当として、承認済みの戦略・対象顧客・チャネルに沿って原稿を作成してください。投稿文、メール、LPなど指定形式に合わせ、訴求、CTA、必要な注記を含めます。外部送信・公開・広告出稿は、明示的な許可や連携がない限り実行済みと表現せず、草案として提示してください。`,
  },
] as const;

export type AIWorkModeId = (typeof AI_WORK_MODES)[number]['id'];
export type AIWorkMode = (typeof AI_WORK_MODES)[number];

export function getAIWorkMode(id: unknown): AIWorkMode {
  return AI_WORK_MODES.find((mode) => mode.id === id) ?? AI_WORK_MODES[0];
}

// --- 役割AIごとの詳細設定（ユーザーが上書きできる項目） ---

export type RoleResponseLength = 'short' | 'medium' | 'detailed';

export interface RoleAIOverride {
  name?: string;
  avatarEmoji?: string;
  description?: string;
  tone?: string;
  responseLength?: RoleResponseLength;
  behaviorRules?: string[];
  /** 標準の役割指示に「追加」する指示（標準指示は置き換えない） */
  extraInstruction?: string;
  /** 未設定なら全体のデフォルトモデルを使う */
  modelSetting?: AIModelSetting;
}

export type RoleAIOverrides = Record<string, RoleAIOverride>;

const LIMITS = { name: 30, avatarEmoji: 8, description: 200, tone: 200, rule: 200, rules: 10, extra: 4000 };

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

/** クライアント保存時・サーバー受信時の両方で使う。不正な値は取り除く。 */
export function sanitizeRoleOverride(input: unknown): RoleAIOverride {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const result: RoleAIOverride = {};
  const name = cleanText(raw.name, LIMITS.name);
  const avatarEmoji = cleanText(raw.avatarEmoji, LIMITS.avatarEmoji);
  const description = cleanText(raw.description, LIMITS.description);
  const tone = cleanText(raw.tone, LIMITS.tone);
  const extraInstruction = cleanText(raw.extraInstruction, LIMITS.extra);
  if (name) result.name = name;
  if (avatarEmoji) result.avatarEmoji = avatarEmoji;
  if (description) result.description = description;
  if (tone) result.tone = tone;
  if (extraInstruction) result.extraInstruction = extraInstruction;
  if (raw.responseLength === 'short' || raw.responseLength === 'medium' || raw.responseLength === 'detailed') {
    result.responseLength = raw.responseLength;
  }
  if (Array.isArray(raw.behaviorRules)) {
    const rules = raw.behaviorRules
      .map((rule) => cleanText(rule, LIMITS.rule))
      .filter((rule): rule is string => Boolean(rule))
      .slice(0, LIMITS.rules);
    if (rules.length) result.behaviorRules = rules;
  }
  const modelSetting = sanitizeModelSetting(raw.modelSetting);
  if (modelSetting) result.modelSetting = modelSetting;
  return result;
}

export interface ResolvedAIWorkMode {
  id: AIWorkModeId;
  label: string;
  name: string;
  avatarEmoji: string;
  description: string;
  systemInstruction: string;
  override: RoleAIOverride;
}

/** 標準の役割定義に、ユーザーの上書き設定を重ねた表示・実行用の役割を返す。 */
export function resolveWorkMode(mode: AIWorkMode, overrides?: RoleAIOverrides | null): ResolvedAIWorkMode {
  const override = sanitizeRoleOverride(overrides?.[mode.id]);
  return {
    ...mode,
    name: override.name ?? mode.name,
    avatarEmoji: override.avatarEmoji ?? mode.avatarEmoji,
    description: override.description ?? mode.description,
    override,
  };
}
