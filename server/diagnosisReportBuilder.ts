/**
 * 診断レポート(ai_reports.full_report_text)の組み立て。
 *
 * full_report_text には「お客様に出してよい章」(D0〜D5)だけを入れる。
 * D6(商談で確認すること)は社内用なので本文に入れない(LINE・メール送信や、
 * 書類の自動作成が本文をそのまま使うため)。
 *
 * - D1(診断の前提)と D3 の急所はコードで作る。AI が書いた D1 / D6 は捨てる。
 * - AI が書くのは D0 / D2 / D3の説明 / D4 / D5。
 */

import { CHAPTERS, parseDiagnosisReport } from '../src/constants/proposalChapters.js';
import type { BottleneckSummary } from './diagnosisAnalysis.js';

export const DIAGNOSIS_REPORT_HEADINGS = [
  '## D0 結論サマリー',
  '## D2 現状整理',
  '## D3 特定された急所と根拠',
  '## D4 放置した場合の影響',
  '## D5 改善の方向性',
] as const;

export interface DiagnosisPremise {
  /** 診断の実施日(表示用の文字列。例 2026年11月12日) */
  conductedOn: string | null;
  /** 回答のあった項目名 */
  answeredLabels: string[];
  industry: string | null;
  employeeCount: string | null;
}

const MISSING = '未回答';
export const NEEDS_HEARING = '要ヒアリング';

const LIMITS_TEXT =
  'この内容は、診断フォームへの回答だけをもとにした暫定的なものです。回答に書かれていない事実は含めておらず、実際の状況は商談で確認のうえ、見直します。';

/** D1: コードだけで作る(AIを使わない) */
export function buildPremiseChapter(p: DiagnosisPremise): string {
  const lines = [
    `- 実施日: ${p.conductedOn || MISSING}`,
    `- 業種: ${p.industry?.trim() || MISSING}`,
    `- 従業員数: ${p.employeeCount?.trim() || MISSING}`,
    `- 回答のあった項目: ${p.answeredLabels.length ? p.answeredLabels.join('、') : MISSING}`,
    `- 情報の限界: ${LIMITS_TEXT}`,
  ];
  return ['## D1 診断の前提', ...lines].join('\n');
}

export class DiagnosisReportFormatError extends Error {}

/**
 * AI の出力と、コードで決めた情報から、保存用の本文(D0〜D5)を組み立てる。
 * D0 / D5 が欠けているときは作り直しを求めるエラーにする(「再生成」の扱い)。
 * D2 / D3 が空のときは「要ヒアリング」、D4 は省略可。
 */
export function buildDiagnosisReportMarkdown(
  aiText: string,
  bottleneck: BottleneckSummary,
  premise: DiagnosisPremise,
): string {
  const parsed = parseDiagnosisReport(aiText);
  if (parsed.legacy) {
    throw new DiagnosisReportFormatError('AIの出力に章の見出し(## D0 など)がありませんでした。もう一度作成してください。');
  }
  const body = (id: string) => parsed.chapters.find((c) => c.id === id)?.body ?? '';
  const titleOf = (id: string) => CHAPTERS.find((c) => c.id === id)!.title;

  for (const id of ['D0', 'D5']) {
    if (!body(id)) throw new DiagnosisReportFormatError(`AIの出力に ${id}(${titleOf(id)})がありませんでした。もう一度作成してください。`);
  }

  const parts: string[] = [];
  parts.push(`## D0 ${titleOf('D0')}\n${body('D0')}`);
  parts.push(buildPremiseChapter(premise));
  parts.push(`## D2 ${titleOf('D2')}\n${body('D2') || NEEDS_HEARING}`);
  // 急所はコードの判定結果。AI の文は説明と根拠の引用だけ。
  parts.push(
    `## D3 ${titleOf('D3')}\n**${bottleneck.typeTitle}**(${bottleneck.badge})\n${bottleneck.summary}\n\n${body('D3') || NEEDS_HEARING}`,
  );
  if (body('D4')) parts.push(`## D4 ${titleOf('D4')}\n${body('D4')}`);
  parts.push(`## D5 ${titleOf('D5')}\n${body('D5')}`);
  return parts.join('\n\n');
}

/** AI に渡す指示。サービス名・金額・期間・Phase・数値を書かせない。 */
export const DIAGNOSIS_REPORT_PROMPT_V2 = `あなたは有限会社MSTの経営診断レポート作成パートナーです。
以下の「診断回答」と「確定した急所」をもとに、レポートの下書きを作成してください。このレポートは、商談で画面共有しながらお客様と一緒に確認する資料です。

【守ること】
・回答に書かれていない事実は書かない。わからない点は「要ヒアリング」と書く。
・「確定した急所」はシステムが判定済みです。急所を決め直したり、別の急所を挙げたりしない。
・数値(削減できる時間、金額、割合、期間など)は書かない。時間の試算は、商談で業務時間をお聞きしてから別に行う。
・サービス名、料金、契約形態、導入の段階(Phase)は書かない。提案の型は商談で決めるため、断定しない。
・効果は断定せず、「〜の可能性があります」「〜と考えられます」と書く。
・経営者に寄り添う、丁寧で落ち着いた日本語で書く。前置きや結びの挨拶は付けない。

【出力する章(この見出しの通りに、Markdownの「## 」で書く。ほかの章は書かない)】
## D0 結論サマリー
(1ページに収まる量。確定した急所を踏まえた、現状の要点と、商談で一緒に確認したいこと)

## D2 現状整理
(回答の内容を整理する。根拠となる回答は「」で引用する。引用できる回答がなければ「要ヒアリング」)

## D3 特定された急所と根拠
(確定した急所について、なぜそう考えられるかを、回答の引用つきで説明する。根拠がなければ「要ヒアリング」。急所の名前や判定は繰り返さなくてよい)

## D4 放置した場合の影響
(定性的に。数値は入れない。書けなければこの章ごと省略してよい)

## D5 改善の方向性
(「ポイントで絞って構築する進め方」と「継続的に伴走して改善する進め方」の両方の可能性を並べる。どちらがよいかは断定しない。サービス名は書かない)

【診断回答と確定した急所(JSON)】
`;
