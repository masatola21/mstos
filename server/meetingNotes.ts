/**
 * 面談メモのAI整理(貼り付けた文字起こし → 要約・決定事項・ToDo・ヒアリングの回答)と、
 * D6の追加質問(最大5問)の生成。
 *
 * - AI は、話されたことだけを整理する。話されていない項目は空にする(推測で埋めない)。
 * - 面談の種類: sales(商談。ヒアリングの回答も取り出す) / support(顧客サポート。要約・決定事項・ToDoのみ)。
 * - 出力は JSON。壊れた JSON や想定外の値は、ここで落とすか、決めた形に整える。
 */

import {
  HEARING_QUESTIONS,
  HEARING_TYPE_QUESTIONS,
  ALL_ANSWER_IDS,
  MAX_EXTRA_QUESTIONS,
  MAX_MEMO_LENGTH,
  sanitizeCoreAnswers,
  type CoreAnswers,
} from '../src/constants/hearingSheet.js';

export type MeetingKind = 'sales' | 'support' | 'support_meeting';
export const MEETING_KINDS: readonly MeetingKind[] = ['sales', 'support', 'support_meeting'];

export class MeetingNotesFormatError extends Error {}

export const MEETING_SYSTEM_INSTRUCTION =
  'あなたは面談の記録を整理する、事実に忠実で慎重なアシスタントです。話されたことだけを整理し、推測や補完はしません。';

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

/** 画面から受け取った文字起こしを整える(長さの上限つき) */
export function sanitizeTranscript(raw: unknown): string {
  return clip(raw, MAX_MEMO_LENGTH);
}

// ─── 面談メモの整理 ─────────────────────────────────────────

const ORGANIZE_RULES = `【守ること】
・話されたことだけを書く。話されていない項目は、推測せず空の文字列("")にする。
・金額、期間、時間、人数などの数値は、話された通りに書く。話されていない数値は作らない。
・お客様の発言と、こちらの発言を混ぜない。迷ったら空にする。
・個人の電話番号・住所・メールアドレスは、要約や回答に書かない。
・出力は JSON のオブジェクト1つだけ(前置き・コードブロック・説明は付けない)。`;

function salesSchema(): string {
  const core = HEARING_QUESTIONS.map((q) => `    "${q.id}": "${q.label}への回答(話されていなければ空)"`).join(',\n');
  const t = HEARING_TYPE_QUESTIONS;
  return `{
  "summary": "商談の要約(ヒアリング10問に入りきらない背景・温度感など5文以内)",
  "decisions": ["商談での合意事項(見積・範囲・時期など、提案書へ転記する前提条件を1件ずつ)"],
  "answers": {
${core},
    "t01": "${t.t01.label}。お客様がはっきり言った場合だけ spot_build(一点だけ直したい) / retainer(継続して見てほしい) / hybrid(両方)のどれか。それ以外は空",
    "t02": "${t.t02.label}。はっきり分かる場合だけ single(1つに絞れる) / multiple(複数にまたがる)。それ以外は空",
    "t03": "${t.t03.label}(話されていなければ空)"
  }
}`;
}

const SUPPORT_SCHEMA = `{
  "summary": "面談の要約(5文以内)",
  "decisions": ["決まったこと(1件ずつ)"],
  "todos": ["やること(担当・期限が話されていれば含める)"]
}`;

const SUPPORT_MEETING_SCHEMA = `{
  "purpose": "今回の打ち合わせの目的(話されていなければ空)",
  "topic": "今回のテーマ(1行で簡潔に。話されていなければ空)",
  "discussion": "話し合った内容の要約(事実ベースで箇条書きまたは5文以内)",
  "decisions": ["決定事項(1件ずつ)"],
  "unresolved_items": ["保留事項・未解決課題(1件ずつ)"],
  "client_homework": ["顧客側の宿題(担当・期限が話されていれば含める)"],
  "mst_homework": ["MST側の宿題(担当・期限が話されていれば含める)"],
  "next_topic": "次回テーマ(話されていれば1行、なければ空)"
}`;

export function buildOrganizePrompt(kind: MeetingKind, transcript: string): string {
  if (kind === 'support_meeting') {
    return buildSupportMeetingOrganizePrompt(transcript);
  }
  const what = kind === 'sales' ? '商談' : 'お客様のサポート面談';
  return `次の${what}の文字起こし(または議事メモ)を整理してください。\n\n${ORGANIZE_RULES}\n\n【出力の形(JSON)】\n${kind === 'sales' ? salesSchema() : SUPPORT_SCHEMA}\n\n【文字起こし】\n${transcript}\n`;
}

export function buildSupportMeetingOrganizePrompt(transcript: string): string {
  return `次の既存顧客との定例面談・サポート打ち合わせの文字起こし(または議事メモ)を整理してください。\n\n${ORGANIZE_RULES}\n・顧客側の宿題とMST側の宿題は、発言の主語を確認して明確に分けて書く。\n\n【出力の形(JSON)】\n${SUPPORT_MEETING_SCHEMA}\n\n【文字起こし】\n${transcript}\n`;
}

export interface OrganizedNotes {
  summary: string;
  decisions: string[];
  todos: string[];
  /** sales のときだけ。話されていない項目は空文字 */
  answers: CoreAnswers | null;
}

export interface SupportMeetingNotes {
  purpose: string;
  topic: string;
  discussion: string;
  decisions: string;
  unresolved_items: string;
  client_homework: string;
  mst_homework: string;
  next_topic: string;
}

/** AI の出力から、最初の JSON オブジェクトを取り出す(コードブロックや前置きが付いても読む) */
export function extractJsonObject(text: string): unknown {
  const raw = String(text ?? '').replace(/```(?:json)?/gi, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new MeetingNotesFormatError('AIの出力を読み取れませんでした。もう一度お試しください。');
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new MeetingNotesFormatError('AIの出力を読み取れませんでした。もう一度お試しください。');
  }
}

const toStringList = (value: unknown, max = 20, each = 300): string[] =>
  Array.isArray(value) ? value.map((v) => clip(v, each)).filter(Boolean).slice(0, max) : [];

const toBulletText = (value: unknown, maxItems = 20, each = 300): string => {
  if (Array.isArray(value)) {
    return toStringList(value, maxItems, each).map((item) => (item.startsWith('・') ? item : `・${item}`)).join('\n');
  }
  return clip(value, 2000);
};

export function parseSupportMeetingNotes(text: string): SupportMeetingNotes {
  const obj = extractJsonObject(text) as any;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new MeetingNotesFormatError('AIの出力の形が正しくありません。もう一度お試しください。');
  }
  const notes: SupportMeetingNotes = {
    purpose: clip(obj.purpose, 200),
    topic: clip(obj.topic, 200),
    discussion: clip(obj.discussion, 3000),
    decisions: toBulletText(obj.decisions),
    unresolved_items: toBulletText(obj.unresolved_items),
    client_homework: toBulletText(obj.client_homework),
    mst_homework: toBulletText(obj.mst_homework),
    next_topic: clip(obj.next_topic, 200),
  };
  if (!Object.values(notes).some((v) => Boolean(v.trim()))) {
    throw new MeetingNotesFormatError('文字起こしから整理できる内容が見つかりませんでした。内容をご確認ください。');
  }
  return notes;
}

export function parseOrganizedNotes(text: string, kind: MeetingKind): OrganizedNotes {
  const obj = extractJsonObject(text) as any;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new MeetingNotesFormatError('AIの出力の形が正しくありません。もう一度お試しください。');
  const notes: OrganizedNotes = {
    summary: clip(obj.summary, 1500),
    decisions: toStringList(obj.decisions),
    todos: toStringList(obj.todos),
    answers: null,
  };
  if (kind === 'sales') {
    // 決めたキーだけを残し、選択式は決めた値だけにする
    const cleaned = sanitizeCoreAnswers(obj.answers);
    notes.answers = Object.fromEntries(ALL_ANSWER_IDS.map((id) => [id, cleaned[id] || ''])) as CoreAnswers;
  }
  if (!notes.summary && !notes.decisions.length && !notes.todos.length && !(notes.answers && Object.values(notes.answers).some(Boolean))) {
    throw new MeetingNotesFormatError('文字起こしから整理できる内容が見つかりませんでした。内容をご確認ください。');
  }
  return notes;
}

// ─── D6 の追加質問 ──────────────────────────────────────────

export interface ExtraQuestionsContext {
  /** 診断レポート(D0〜D5)の本文 */
  report?: string;
  /** 診断フォームの回答(質問名 → 回答) */
  answers?: Record<string, unknown>;
}

export function sanitizeExtraQuestionsContext(raw: any): ExtraQuestionsContext {
  const answers: Record<string, string> = {};
  if (raw?.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)) {
    for (const [k, v] of Object.entries(raw.answers).slice(0, 40)) {
      const value = clip(v, 600);
      if (value) answers[clip(k, 120)] = value;
    }
  }
  return { report: clip(raw?.report, 12000), answers };
}

export function buildExtraQuestionsPrompt(ctx: ExtraQuestionsContext): string {
  const fixed = HEARING_QUESTIONS.map((q) => `・${q.label}`).join('\n');
  const answers = Object.entries(ctx.answers || {}).map(([k, v]) => `・${k}: ${v}`).join('\n') || '(回答がありません)';
  return `商談で確認したいことの、追加の質問を最大${MAX_EXTRA_QUESTIONS}問、考えてください。

【考え方】
・診断フォームの回答から読み取れなかった点、あいまいな点だけを質問にする。
・次の固定の質問と重ならないようにする。
${fixed}
・1問は1文で、お客様にそのまま聞ける言葉にする。はい・いいえだけで終わらない聞き方にする。
・回答に書かれていない事実を前提にしない。
・質問が思いつかなければ、少なくてよい(0問でもよい)。

【出力の形(JSON)】
{ "questions": ["質問1", "質問2"] }
出力は JSON のオブジェクト1つだけ(前置き・コードブロック・説明は付けない)。

【診断フォームの回答】
${answers}

【診断レポート(参考)】
${ctx.report || '(なし)'}
`;
}

/** AI の出力から質問を取り出す。最大5問、重複と短すぎる・長すぎるものは捨てる */
export function parseExtraQuestions(text: string): string[] {
  const obj = extractJsonObject(text) as any;
  const list = Array.isArray(obj?.questions) ? obj.questions : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const q = clip(item, 200).replace(/^[・\-\d.\s]+/, '');
    if (q.length < 6 || seen.has(q)) continue;
    seen.add(q);
    out.push(q);
    if (out.length >= MAX_EXTRA_QUESTIONS) break;
  }
  return out;
}
