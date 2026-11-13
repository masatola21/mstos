/**
 * 提案書の章のAI下書き(P1 提案の方針 / P3 ロードマップ)。
 *
 * AI は文章の下書きだけを担当する。サービス名・金額・期間・回数・数値の効果は決めさせない。
 * 決まっていない項目は「【○○: 要入力】」の印で残させ、担当者が埋める。
 * 出力に金額・期間・数値の効果が混ざっていないかは、scanDraftForForbidden で確認して警告を出す。
 */

import { PROPOSAL_KIND_LABELS, markdownToPlainText, type ProposalKind } from '../src/constants/proposalChapters.js';

export type DraftChapter = 'P1' | 'P3';
export const DRAFT_CHAPTERS: readonly DraftChapter[] = ['P1', 'P3'];

export interface ProposalDraftContext {
  companyName?: string;
  /** 診断パート(D0〜D5)の本文 */
  diagnosis?: { d0?: string; d2?: string; d3?: string; d5?: string };
  serviceName?: string;
  deliverables?: string;
  monthlySupport?: string;
  /** P3 の下書きでは、決まった P1 の方針も渡す */
  policy?: string;
  /** 商談でお聞きした内容(担当者のメモ) */
  meetingNotes?: string;
}

const MAX_FIELD = 3000;
const clip = (value: unknown): string => String(value ?? '').trim().slice(0, MAX_FIELD);

/** 画面から受け取った値を、文字列・長さ制限つきに整える */
export function sanitizeDraftContext(raw: any): ProposalDraftContext {
  const d = raw?.diagnosis ?? {};
  return {
    companyName: clip(raw?.companyName).slice(0, 200),
    diagnosis: { d0: clip(d.d0), d2: clip(d.d2), d3: clip(d.d3), d5: clip(d.d5) },
    serviceName: clip(raw?.serviceName).slice(0, 300),
    deliverables: clip(raw?.deliverables),
    monthlySupport: clip(raw?.monthlySupport),
    policy: clip(raw?.policy),
    meetingNotes: clip(raw?.meetingNotes),
  };
}

export const DRAFT_SYSTEM_INSTRUCTION =
  'あなたは有限会社MSTの提案書づくりを手伝う、事実に忠実で慎重なアシスタントです。与えられた情報にない事実は作らず、丁寧で落ち着いた日本語で書きます。';

const KIND_GUIDE: Record<ProposalKind, { p1: string; p3: string }> = {
  spot_build: {
    p1: '課題を絞り、必要な範囲だけを構築する進め方であること。',
    p3: '構築のスケジュール(ステップごとの内容と成果物)。',
  },
  retainer: {
    p1: '月次で継続して相談・改善を進める進め方であること。',
    p3: 'フェーズごとの重点テーマ(各フェーズで何に取り組むか)。',
  },
  hybrid: {
    p1: '最初に必要な範囲を構築し、その後は継続して伴走する進め方であること。',
    p3: '構築の期間から、伴走への移行までの流れ。',
  },
};

const RULES = `【守ること】
・与えられた情報にない事実は書かない。足りない点は、そのまま「【○○: 要入力】」の形で残す(例: 【期間: 要入力】)。
・サービス名は、与えられたものだけを使う。与えられていなければ「【サービス名: 要入力】」と書く。
・金額、期間(○か月・○週間・日付)、回数、削減できる時間、割合などの数値は書かない。必要な場所は「【金額: 要入力】」「【期間: 要入力】」のように残す。
・効果は断定しない。「〜をめざします」「〜が考えられます」と書く。
・出力は、本文の文章だけ(前置き・結びの挨拶・見出し・Markdownの記号は付けない)。改行と「・」の箇条書きは使ってよい。`;

function section(label: string, value?: string): string {
  const v = (value ?? '').trim();
  return v ? `■ ${label}\n${v}\n` : '';
}

/** 章ごとのプロンプトを組み立てる */
export function buildProposalDraftPrompt(chapter: DraftChapter, kind: ProposalKind, ctx: ProposalDraftContext): string {
  const kindLabel = PROPOSAL_KIND_LABELS[kind];
  const guide = KIND_GUIDE[kind];
  const task =
    chapter === 'P1'
      ? `提案書の「提案の型と方針」の本文の下書きを書いてください。提案の型は「${kindLabel}」です。${guide.p1}\n診断で分かったことを踏まえ、なぜこの進め方を提案するのかを、300字前後で書きます。`
      : `提案書の「ロードマップ」の本文の下書きを書いてください。提案の型は「${kindLabel}」です。内容は、${guide.p3}\n3〜5つのステップに分け、各ステップに「取り組むこと」と「できあがるもの」を書きます。期間と回数は書かず、「【期間: 要入力】」と残します。`;

  const info = [
    section('宛先', ctx.companyName),
    section('診断の結論サマリー', ctx.diagnosis?.d0),
    section('診断の現状整理', ctx.diagnosis?.d2),
    section('特定された急所と根拠', ctx.diagnosis?.d3),
    section('診断の改善の方向性', ctx.diagnosis?.d5),
    section('商談でお聞きした内容(担当者のメモ)', ctx.meetingNotes),
    section('サービス名', ctx.serviceName),
    section('成果物の一覧', ctx.deliverables),
    section('月次の支援内容', ctx.monthlySupport),
    chapter === 'P3' ? section('決まった提案の方針', ctx.policy) : '',
  ].join('\n');

  return `${task}\n\n${RULES}\n\n【参考にする情報】\n${info.trim() || '(情報がありません。決まっていない項目は「要入力」と残してください)'}\n`;
}

// ─── 出力の確認 ─────────────────────────────────────────────

const PLACEHOLDER = /【[^】]*要入力[^】]*】/g;

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: '金額', pattern: /[¥￥]\s*\d|\d[\d,，]*\s*(?:万円|円)/ },
  { label: '期間・回数・時間', pattern: /\d+\s*(?:か月|ヶ月|カ月|ケ月|週間|日間|営業日|時間|回)/ },
  { label: '割合・倍率', pattern: /\d+(?:\.\d+)?\s*(?:%|％|倍|割)/ },
  { label: '日付', pattern: /(?:20\d{2}年|\d{1,2}月\d{1,2}日)/ },
  { label: 'Phase の固定文', pattern: /Phase\s*\d/i },
];

/**
 * 出力に、AI が決めてはいけない数値が混ざっていないかを調べる。
 * 「【期間: 要入力】」のような印の中は対象外。見つかった種類の一覧を返す(空なら問題なし)。
 */
export function scanDraftForForbidden(text: string): string[] {
  const body = String(text ?? '').replace(PLACEHOLDER, '');
  return FORBIDDEN.filter((f) => f.pattern.test(body)).map((f) => f.label);
}

export interface CleanedDraft {
  text: string;
  warnings: string[];
  /** 「要入力」の印の数(担当者が埋める箇所) */
  placeholders: number;
}

/** AI の出力を、書類の入力欄に入れられる形に整える */
export function cleanDraftOutput(raw: string): CleanedDraft {
  const text = markdownToPlainText(String(raw ?? '')).trim();
  const warnings = scanDraftForForbidden(text).map((label) => `AIの下書きに「${label}」らしき記載があります。商談で決めた内容か確認し、違えば直してください。`);
  return { text, warnings, placeholders: (text.match(PLACEHOLDER) || []).length };
}
