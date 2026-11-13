// @ts-nocheck
/**
 * ユニットテスト: 診断レポートの組み立て(server/diagnosisReportBuilder.ts, server/diagnosisAnalysis.ts)
 * - 急所の判定が4タイプに振り分けられること
 * - 保存する本文は D0〜D5 だけで、D6(社内用)が入らないこと
 * - D1 と急所はコードが作り、AI が書いた D1 / D6 は捨てること
 * - 欠けた章の扱い(D0/D5 はエラー、D2/D3 は「要ヒアリング」、D4 は省略)
 * - プロンプトに、サービス名・金額・Phase の直書きがないこと
 */

import { classifyBottleneck } from '../server/diagnosisAnalysis.js';
import {
  buildDiagnosisReportMarkdown,
  buildPremiseChapter,
  DiagnosisReportFormatError,
  DIAGNOSIS_REPORT_PROMPT_V2,
  renderDiagnosisReportHtml,
} from '../server/diagnosisReportBuilder.js';
import { parseDiagnosisReport } from '../src/constants/proposalChapters.js';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

// 急所の判定
assert(classifyBottleneck({ q_ops_bottleneck: '請求書の二重入力が多い' }).badge === '業務・手作業の急所', 'ops');
assert(classifyBottleneck({ q_profit_bottleneck: '利益が残りにくい' }).badge === '売上・利益の急所', 'profit');
assert(classifyBottleneck({ q_delay_reason: '日々の火消しで後回し' }).badge === '改善実行の急所', 'delay');
assert(classifyBottleneck({}).badge === '事業成長ステージ', 'default');
assert(classifyBottleneck({ q_ops_bottleneck: '二重入力', q_profit_bottleneck: '単価' }).badge === '業務・手作業の急所', 'ops が先に優先される');

const bottleneck = classifyBottleneck({ q_ops_bottleneck: '請求書の二重入力' });
const premise = { conductedOn: '2026年11月12日', answeredLabels: ['業種', '従業員数'], industry: '建設業', employeeCount: null };

const ai = [
  '## D0 結論サマリー', '要点', '',
  '## D1 診断の前提', 'AIが書いたD1(捨てる)', '',
  '## D2 現状整理', '「請求書の二重入力」とのご回答でした。', '',
  '## D3 特定された急所と根拠', '回答から読み取れます。', '',
  '## D4 放置した場合の影響', '時間が奪われ続ける可能性があります。', '',
  '## D5 改善の方向性', '構築と伴走の両方の可能性があります。', '',
  '## D6 商談で確認すること', '社内用の質問(捨てる)',
].join('\n');

const out = buildDiagnosisReportMarkdown(ai, bottleneck, premise);
const parsed = parseDiagnosisReport(out);
assert(parsed.chapters.map((c) => c.id).join() === 'D0,D1,D2,D3,D4,D5', `章は D0〜D5 のみ: ${parsed.chapters.map((c) => c.id)}`);
assert(!out.includes('社内用の質問'), 'D6 は本文に入らない');
assert(!out.includes('AIが書いたD1'), 'AI の D1 は捨てる');
assert(out.includes('実施日: 2026年11月12日') && out.includes('業種: 建設業'), 'D1 はコードが作る');
assert(out.includes('従業員数: 未回答'), '未入力は「未回答」');
assert(out.includes(`**${bottleneck.typeTitle}**`), 'D3 の急所はコードの判定');

// 欠けた章
const noD0 = ai.replace('## D0 結論サマリー\n要点\n\n', '');
let threw = false;
try { buildDiagnosisReportMarkdown(noD0, bottleneck, premise); } catch (e) { threw = e instanceof DiagnosisReportFormatError; }
assert(threw, 'D0 が無ければエラー');
threw = false;
try { buildDiagnosisReportMarkdown('旧形式の本文だけ', bottleneck, premise); } catch (e) { threw = e instanceof DiagnosisReportFormatError; }
assert(threw, '見出しが無ければエラー');
const min = buildDiagnosisReportMarkdown('## D0 結論サマリー\nA\n## D5 改善の方向性\nB', bottleneck, premise);
assert(min.includes('## D2 現状整理\n要ヒアリング'), 'D2 が空なら要ヒアリング');
assert(min.includes('要ヒアリング') && !min.includes('## D4'), 'D4 は省略');

// D1 単体
assert(buildPremiseChapter({ conductedOn: null, answeredLabels: [], industry: null, employeeCount: null }).includes('回答のあった項目: 未回答'), '空の D1');

// プロンプトの禁止事項(仕様書 §4)
for (const bad of ['Phase 1', 'Phase 2', 'システム構築・業務自動化', '経営戦略・利益改善顧問', '月20時間']) {
  assert(!DIAGNOSIS_REPORT_PROMPT_V2.includes(bad), `プロンプトに「${bad}」を直書きしない`);
}
assert(!/\d+\s*(円|万円|時間|か月|ヶ月)/.test(DIAGNOSIS_REPORT_PROMPT_V2), 'プロンプトに具体的な数値を例示しない');
assert(DIAGNOSIS_REPORT_PROMPT_V2.includes('600〜900字') && DIAGNOSIS_REPORT_PROMPT_V2.includes('**〜**'), '分量目安と強調の指示が含まれる');
assert(DIAGNOSIS_REPORT_PROMPT_V2.includes('要ヒアリング'), '要ヒアリングの指示');
assert(DIAGNOSIS_REPORT_PROMPT_V2.includes('決め直したり'), '急所を決め直さない指示');
for (const h of ['## D0', '## D2', '## D3', '## D4', '## D5']) assert(DIAGNOSIS_REPORT_PROMPT_V2.includes(h), `プロンプトに ${h}`);
assert(!DIAGNOSIS_REPORT_PROMPT_V2.includes('## D1') && !DIAGNOSIS_REPORT_PROMPT_V2.includes('## D6'), 'AI に D1/D6 を書かせない');

// 顧客書類のHTML(章見出しつき)
const aiHighlighted = ai.replace('要点', '**最優先の結論<x>** です');
const outHighlighted = buildDiagnosisReportMarkdown(aiHighlighted, bottleneck, premise);
const html = renderDiagnosisReportHtml('株式会社<テスト>', outHighlighted);
const order = ['結論サマリー', '診断の前提', '現状整理', '特定された急所と根拠', '放置した場合の影響', '改善の方向性'];
let last = -1;
for (const t of order) {
  const i = html.indexOf(`>${t}</h2>`);
  assert(i > last, `書類に「${t}」の見出しが順序どおりにある`);
  last = i;
}
assert(html.includes('株式会社&lt;テスト&gt; 経営診断レポート'), '会社名はエスケープされる');
assert(html.includes('<strong ') && html.includes('最優先の結論&lt;x&gt;</strong>'), '**...** がHTMLエスケープ付きで強調タグになる');
assert(html.includes('#eff6ff') && html.includes('#f8fafc'), 'D0とD3に背景ハイライトカードが付く');
assert(!html.includes('社内用の質問') && !html.includes('商談で確認すること'), '書類に D6 は載らない');
assert(!html.includes('## ') && !html.includes('**'), 'Markdown の記号が残らない');
// D6 が混ざった本文を渡しても、お客様向けの書類には出ない
const withD6 = renderDiagnosisReportHtml('A社', ai);
assert(!withD6.includes('社内用の質問'), 'D6 入りの本文でも書類に出さない');
// 旧形式・自由な文章は全文を残す(内容を落とさない)
const legacyHtml = renderDiagnosisReportHtml('A社', '1. ■ 診断サマリー\n本文<b>');
assert(legacyHtml.includes('1. ■ 診断サマリー') && legacyHtml.includes('本文&lt;b&gt;'), '旧形式は全文を出し、HTMLはエスケープ');

console.log('diagnosisReportBuilder.test.ts: all assertions passed');

