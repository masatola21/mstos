/**
 * 提案書の章のAI下書き(P1 提案の方針 / P3 ロードマップ)。
 *
 * AI は文章の下書きだけを担当する。サービス名・金額・期間・回数・数値の効果は決めさせない。
 * 決まっていない項目は「【○○: 要入力】」の印で残させ、担当者が埋める。
 * 出力に金額・期間・数値の効果が混ざっていないかは、scanDraftForForbidden で確認して警告を出す。
 */

import { PROPOSAL_KIND_LABELS, markdownToPlainText, type ProposalKind } from '../src/constants/proposalChapters.js';

export type DraftChapter = 'P1' | 'P3' | 'P3_METRICS' | 'P5_REQUESTS' | 'P5_PREREQUISITES' | 'P5_EXCLUSIONS';
export const DRAFT_CHAPTERS: readonly DraftChapter[] = [
  'P1',
  'P3',
  'P3_METRICS',
  'P5_REQUESTS',
  'P5_PREREQUISITES',
  'P5_EXCLUSIONS',
];

export interface ProposalDraftContext {
  companyName?: string;
  /** 診断パート(D0〜D5)の本文 */
  diagnosis?: { d0?: string; d2?: string; d3?: string; d5?: string };
  serviceName?: string;
  deliverables?: string;
  monthlySupport?: string;
  /** P3 の下書きでは、決まった P1 の方針も渡す */
  policy?: string;
  /** 確認指標やP5の下書きでは、P3のロードマップも参照できる */
  roadmap?: string;
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
    roadmap: clip(raw?.roadmap),
    meetingNotes: clip(raw?.meetingNotes),
  };
}

export const DRAFT_SYSTEM_INSTRUCTION =
  'あなたは有限会社MST（「経営の仕組み化 × 利益改善」を軸に、自社で実践・検証してきた仕組みをもとに経営者と一緒に会社を成長させていく伴走パートナー）の提案書づくりを手伝う、事実に忠実で慎重なアシスタントです。与えられた情報にない事実は作らず、結論から簡潔に、熱意と誠実さのある落ち着いた日本語で書きます。';

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
・結論から簡潔に書く。冒頭の1文目で結論を端的に述べ、前置きや重複説明を省いて要点を整理する。
・与えられた情報にない事実は書かない。足りない点は、そのまま「【○○: 要入力】」の形で残す(例: 【期間: 要入力】)。
・サービス名は、与えられたものだけを使う。与えられていなければ「【サービス名: 要入力】」と書く。
・金額、期間(○か月・○週間・日付)、回数、削減できる時間、割合などの数値は書かない。必要な場所は「【金額: 要入力】」「【期間: 要入力】」のように残す。
・効果は断定しない。「〜をめざします」「〜が考えられます」と書く。
・出力は、本文の文章だけ(前置き・結びの挨拶・見出し・Markdownの記号は付けない)。改行と「・」の箇条書きは使ってよい。`;

function section(label: string, value?: string): string {
  const v = (value ?? '').trim();
  return v ? `■ ${label}\n${v}\n` : '';
}

function taskPromptFor(chapter: DraftChapter, kind: ProposalKind): string {
  const kindLabel = PROPOSAL_KIND_LABELS[kind];
  const guide = KIND_GUIDE[kind];
  switch (chapter) {
    case 'P1':
      return `提案書の「提案の型と方針」の本文の下書きを結論から簡潔に書いてください。提案の型は「${kindLabel}」です。${guide.p1}\n診断パートとの重複説明や前置きは省き、1文目で方針の結論を述べたうえで、理由・要点を箇条書き（2〜3点）で合計150〜220字程度に簡潔にまとめてください。`;
    case 'P3':
      return `提案書の「ロードマップ」の本文の下書きを結論から簡潔に書いてください。提案の型は「${kindLabel}」です。内容は、${guide.p3}\n最初に全体の進め方の結論を1文で短く示し、3〜4つのステップに分けて、各ステップを「ステップ名（【期間: 要入力】）：取り組むこと ／ できあがるもの」の1〜2行（各40〜70字目安・全体250〜350字程度）で簡潔に書きます。期間と回数は書かず、「【期間: 要入力】」と残します。`;
    case 'P3_METRICS':
      return `提案書の「P3 確認指標」の下書きを書いてください。提案の型は「${kindLabel}」です。\n商談メモにある「3〜6か月後の理想・ゴール」や「手放したい業務」、診断の「急所（D3）」、ロードマップをもとに、導入・改善がうまく進んでいるかを一緒に確認する指標（KPI）を「・指標名：何を見てどう判断するか」の箇条書き（3〜4点・合計150〜250字程度）で提案してください。具体的な数値目標（「○時間削減」など）は作らず、計測・確認する観点だけを書きます。`;
    case 'P5_REQUESTS':
      return `提案書の「P5 お客様にお願いすること」の下書きを書いてください。提案の型は「${kindLabel}」です。\n商談メモにある「今使っているツール」「社内担当者」「対象業務」や「成果物・支援内容」をもとに、導入・運用を進めるうえで貴社へご協力いただきたい事項を「・〇〇のご共有／ご協力」の箇条書き（3〜4点・合計120〜220字程度）で簡潔に整理してください。`;
    case 'P5_PREREQUISITES':
      return `提案書の「P5 前提・条件」の下書きを書いてください。提案の型は「${kindLabel}」です。\n商談メモにある「希望時期・予算感・支払方法・決裁／判断時期」「合意事項」「使用ツール」および提案の型（${kindLabel}）を踏まえ、本提案が成立する前提・条件を箇条書き（3〜4点・合計150〜250字程度）で簡潔に書いてください。確定していない期間や金額は書かず、必要なら「【○○: 要入力】」として残してください。`;
    case 'P5_EXCLUSIONS':
      return `提案書の「P5 対象外」の下書きを書いてください。提案の型は「${kindLabel}」です。\n商談メモにある「対象外にしたい範囲」「合意事項」や「P2 提供内容・成果物」をもとに、今回あえて対象外とする範囲（別途見積り・次フェーズ扱いとなる範囲）を箇条書き（2〜4点・合計120〜220字程度）で誤解のないように明確に書いてください。商談メモに対象外の明記がない場合は、提案内容に照らして一般的な範囲外の例（既存基幹の改修、他部署展開など）を補ってください。`;
  }
}

/** 章ごとのプロンプトを組み立てる */
export function buildProposalDraftPrompt(chapter: DraftChapter, kind: ProposalKind, ctx: ProposalDraftContext): string {
  const task = taskPromptFor(chapter, kind);

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
    chapter !== 'P1' ? section('決まった提案の方針', ctx.policy) : '',
    chapter !== 'P1' && chapter !== 'P3' ? section('ロードマップ', ctx.roadmap) : '',
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
