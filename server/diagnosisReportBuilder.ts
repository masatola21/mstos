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

import { CHAPTERS, parseDiagnosisReport, markdownToPlainText } from '../src/constants/proposalChapters.js';
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

【分量と読みやすさの目安】
・全体でA4で1〜1.5枚（合計600〜900字程度）に収まるよう、要点を絞って簡潔に書く。
・1文は40〜60字程度を目安に短くし、同じ内容の重複説明は避ける。
・経営者が一目で要点を把握できるよう、各章で「結論の核心」「ボトルネックの要諦」「回答の重要な引用語句」を1〜3箇所だけ **〜** で強調する（多用せず、短いフレーズに絞る）。

【出力する章(この見出しの通りに、Markdownの「## 」で書く。ほかの章は書かない)】
## D0 結論サマリー
(120〜160字目安・2〜3文。確定した急所を踏まえた現状の要点と、商談で一緒に確認したいこと1点)

## D2 現状整理
(150〜200字目安・箇条書き3〜4点以内。回答の内容を端的に整理する。根拠となる回答は「」で引用する。引用できる回答がなければ「要ヒアリング」)

## D3 特定された急所と根拠
(150〜200字目安・2〜3文。確定した急所について、なぜそう考えられるかを回答の引用つきで説明する。根拠がなければ「要ヒアリング」。急所の名前や判定は繰り返さなくてよい)

## D4 放置した場合の影響
(100〜150字目安・箇条書き2〜3点以内。定性的に書く。数値は入れない。書けなければこの章ごと省略してよい)

## D5 改善の方向性
(150〜200字目安。「ポイントで絞って構築する進め方」と「継続的に伴走して改善する進め方」の両方の可能性を簡潔に並べる。どちらがよいかは断定しない。サービス名は書かない)

【診断回答と確定した急所(JSON)】
`;

// ─── 顧客書類(customer_documents.body_html)への変換 ─────────────

const escapeHtml = (value: string) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 強調(**...**)と箇条書き(- / *)を保ったまま安全なHTMLに変換する。
 * HTMLエスケープを先に通し、**〜** は強調span、残った未対応の ** や見出し記号は取り除く。
 */
function formatDiagnosisBodyHtml(text: string): string {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[ \t]*[-*]\s+/gm, '・')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const escaped = escapeHtml(normalized);
  return escaped
    .replace(
      /\*\*([^*\n]+?)\*\*/g,
      '<strong style="color: #1e3a8a; font-weight: 700; background: #fef9c3; padding: 0 3px; border-radius: 3px;">$1</strong>',
    )
    .replace(/\*\*/g, '');
}

/**
 * 診断レポートの書類(承認待ち)の本文HTML。D0〜D5 を章の見出しつきで並べる。
 * 章の見出しが無い旧形式・自由な文章は、全文を1つの塊で出す(内容は落とさない)。
 */
export function renderDiagnosisReportHtml(companyName: string, markdown: string): string {
  const parsed = parseDiagnosisReport(markdown);
  const wrap = (inner: string) =>
    `<div style="font-family: sans-serif; line-height: 1.8; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; line-height: 1.4; color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin: 0 0 20px 0;">${escapeHtml(companyName)} 経営診断レポート</h1>
${inner}
</div>`;
  const textBlock = (text: string) =>
    `<div style="white-space: pre-wrap; font-size: 14px; color: #334155;">${formatDiagnosisBodyHtml(text)}</div>`;

  if (parsed.legacy) return wrap(textBlock(markdown));

  const sections = parsed.chapters
    // D6(社内用)は、お客様に出る書類には載せない
    .filter((c) => CHAPTERS.find((d) => d.id === c.id)?.customerVisible)
    .map((c) => {
      const title = CHAPTERS.find((d) => d.id === c.id)!.title;
      const bodyHtml =
        c.id === 'D0'
          ? `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px;">${textBlock(c.body)}</div>`
          : c.id === 'D3'
            ? `<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">${textBlock(c.body)}</div>`
            : textBlock(c.body);
      return `  <div style="margin-bottom: 22px;">
    <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #1e3a8a; border-left: 4px solid #2563eb; padding-left: 8px;">${escapeHtml(title)}</h2>
    ${bodyHtml}
  </div>`;
    });
  return wrap(sections.join('\n'));
}

