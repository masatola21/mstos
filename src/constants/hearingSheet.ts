/**
 * ヒアリングシート(仕様書 §6)。固定の質問10問と、型の判断用3問。
 *
 * - 質問の文面はここ(コード側の定数)で持つ。DB(hearing_sheets)には回答と版(core_version)だけを保存する。
 *   質問を直したら版を上げる。過去の回答は壊れない。
 * - 診断フォームで取得済みの項目(業種・従業員数)は「確認」にとどめ、聞き直さない。
 * - 他のファイルに依存しない(サーバー・画面・テストのどこからでも読める)。
 */

import type { ProposalKind } from './proposalChapters';

export const HEARING_CORE_VERSION = 'core_v1';

export interface HearingQuestion {
  id: string;
  /** 聞くこと */
  label: string;
  /** 聞く理由(担当者向けの補足) */
  why: string;
  /** 回答が入る章 */
  chapters: readonly string[];
  /** 診断フォームの回答を確認する質問か(聞き直さない) */
  confirmOnly?: boolean;
}

export const HEARING_QUESTIONS: readonly HearingQuestion[] = [
  { id: 'q01', label: '業種・従業員数(フォーム回答の確認)と売上規模感', why: '診断の前提', chapters: ['D1'], confirmOnly: true },
  { id: 'q02', label: '一番手放したい業務は何か', why: '急所の具体化', chapters: ['D3', 'P3'] },
  { id: 'q03', label: 'その業務は誰が、月に何時間かけているか', why: '効果の試算の根拠', chapters: ['P3'] },
  { id: 'q04', label: '今使っているツール(請求・顧客管理・LINE等)', why: '構築範囲の判断', chapters: ['P2', 'P5'] },
  { id: 'q05', label: '過去に改善を試した経験と、うまくいかなかった理由', why: '提案の方向づけ', chapters: ['P1'] },
  { id: 'q06', label: '3〜6か月後にどうなっていたいか', why: 'ゴールの設定', chapters: ['P3'] },
  { id: 'q07', label: '導入後に運用する社内担当者は誰か', why: '自走化の前提', chapters: ['P5'] },
  { id: 'q08', label: '希望時期・予算感', why: '規模と期間の調整', chapters: ['P3', 'P4'] },
  { id: 'q09', label: '決裁者と判断のタイミング', why: '次のステップの設計', chapters: ['P7'] },
  { id: 'q10', label: '支払いの希望(一括・分割・月額)と、対象外にしたい範囲', why: '条件の確定', chapters: ['P5', 'P6'] },
];

/** 型の判断用(別枠)。t01 はお客様の意向、t02 は課題の広がり、t03 は継続相談の頻度。 */
export const HEARING_TYPE_QUESTIONS = {
  t01: {
    label: '一点だけ直したいか、継続して見てほしいか(お客様の意向)',
    options: [
      { value: 'spot_build', label: '一点だけ直したい(構築)' },
      { value: 'retainer', label: '継続して見てほしい(伴走)' },
      { value: 'hybrid', label: '両方(構築+伴走)' },
    ] as const,
  },
  t02: {
    label: '課題は1つに絞れるか、複数にまたがるか',
    options: [
      { value: 'single', label: '1つに絞れる' },
      { value: 'multiple', label: '複数にまたがる' },
    ] as const,
  },
  t03: { label: '継続して相談したい頻度' },
} as const;

export const CORE_QUESTION_IDS = HEARING_QUESTIONS.map((q) => q.id);
export const TYPE_QUESTION_IDS = ['t01', 't02', 't03'] as const;
export const ALL_ANSWER_IDS: readonly string[] = [...CORE_QUESTION_IDS, ...TYPE_QUESTION_IDS];

/** 面談メモなど、質問に属さない値は、core_answers の中で先頭が _ のキーに入れる(DBの列は増やさない) */
export const MEMO_KEY = '_memo';
export const SUMMARY_KEY = '_summary';
export const DECISIONS_KEY = '_decisions';
export const TODOS_KEY = '_todos';

export type CoreAnswers = Record<string, string>;

export const MAX_ANSWER_LENGTH = 5000;
export const MAX_MEMO_LENGTH = 60000;
export const MAX_EXTRA_QUESTIONS = 5;

const T01_VALUES = HEARING_TYPE_QUESTIONS.t01.options.map((o) => o.value as string);
const T02_VALUES = HEARING_TYPE_QUESTIONS.t02.options.map((o) => o.value as string);

export function emptyCoreAnswers(): CoreAnswers {
  return Object.fromEntries(ALL_ANSWER_IDS.map((id) => [id, '']));
}

/** DB・画面・AI から来た値を、決めたキーだけ・文字列・長さ制限つきに整える */
export function sanitizeCoreAnswers(raw: unknown): CoreAnswers {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = emptyCoreAnswers();
  for (const id of ALL_ANSWER_IDS) {
    const v = src[id];
    if (typeof v === 'string' || typeof v === 'number') out[id] = String(v).trim().slice(0, MAX_ANSWER_LENGTH);
  }
  // 選択式は、決めた値以外は空にする
  if (!T01_VALUES.includes(out.t01)) out.t01 = '';
  if (!T02_VALUES.includes(out.t02)) out.t02 = '';
  for (const key of [MEMO_KEY, SUMMARY_KEY, DECISIONS_KEY, TODOS_KEY]) {
    const v = src[key];
    if (typeof v === 'string') out[key] = v.slice(0, MAX_MEMO_LENGTH);
  }
  return out;
}

export interface ExtraQuestion { q: string; a: string }

/** AIの追加質問と回答。最大5問(仕様書 §4)。空の質問は捨てる。 */
export function sanitizeExtraQuestions(raw: unknown): ExtraQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({ q: String(item?.q ?? '').trim().slice(0, 300), a: String(item?.a ?? '').trim().slice(0, MAX_ANSWER_LENGTH) }))
    .filter((item) => item.q)
    .slice(0, MAX_EXTRA_QUESTIONS);
}

/** t01(お客様の意向)を、提案の型の値にする。未回答は null */
export function customerIntentFrom(answers: CoreAnswers): ProposalKind | null {
  return T01_VALUES.includes(answers.t01) ? (answers.t01 as ProposalKind) : null;
}

/** 回答済みの数(10問のうち) */
export function answeredCount(answers: CoreAnswers): number {
  return CORE_QUESTION_IDS.filter((id) => (answers[id] || '').trim()).length;
}

/**
 * 提案書の「商談メモ」(AI下書きの材料)に取り込む文章を作る。
 * 回答のある質問だけを「質問: 回答」で並べる。面談メモの要約・決定事項があれば付ける。
 */
export function composeMeetingMemo(answers: CoreAnswers, extra: ExtraQuestion[] = []): string {
  const lines: string[] = [];
  for (const q of HEARING_QUESTIONS) {
    const a = (answers[q.id] || '').trim();
    if (a) lines.push(`${q.label}\n→ ${a}`);
  }
  const intent = HEARING_TYPE_QUESTIONS.t01.options.find((o) => o.value === answers.t01);
  if (intent) lines.push(`${HEARING_TYPE_QUESTIONS.t01.label}\n→ ${intent.label}`);
  const spread = HEARING_TYPE_QUESTIONS.t02.options.find((o) => o.value === answers.t02);
  if (spread) lines.push(`${HEARING_TYPE_QUESTIONS.t02.label}\n→ ${spread.label}`);
  if ((answers.t03 || '').trim()) lines.push(`${HEARING_TYPE_QUESTIONS.t03.label}\n→ ${answers.t03.trim()}`);
  for (const e of extra) if (e.a) lines.push(`${e.q}\n→ ${e.a}`);
  if ((answers[SUMMARY_KEY] || '').trim()) lines.push(`商談の要約\n→ ${answers[SUMMARY_KEY].trim()}`);
  if ((answers[DECISIONS_KEY] || '').trim()) lines.push(`商談での合意事項\n→ ${answers[DECISIONS_KEY].trim()}`);
  return lines.join('\n\n');
}
