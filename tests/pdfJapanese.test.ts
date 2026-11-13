// @ts-nocheck
/** PDFに日本語フォントが埋め込まれ、全重要書類のHTMLレイアウト・住所表記が正しく生成されること */
import { generateDocumentPdf, parseHtmlToBlocks } from '../server/pdfService.js';
import { renderDiagnosisReportHtml } from '../server/diagnosisReportBuilder.js';
import {
  getEstimateHtml,
  getContractHtml,
  getInvoiceHtml,
  getMonthlyReportHtml,
  getProposalReportHtml,
  getTemplateDefaultValues,
} from '../src/components/matrix/documentGenerators.js';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

const fill = (html: string, vals: Record<string, string>) => {
  let out = html;
  for (const [k, v] of Object.entries(vals)) out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  return out;
};

// 1. 簡易HTML（フォールバックヘッダ使用時）でも旧丸の内住所が出ず、大垣市桧町127番地が使われること
const simpleHtml = '<p>ご案内事項</p><table><tr><th>項目</th><th>金額</th></tr><tr><td>初期構築費用</td><td>300,000</td></tr></table>';
const simpleBuf = await generateDocumentPdf({ id: 'abcdef12-0000', title: '請求書 INV-1', document_type: 'invoice', body_html: simpleHtml, created_at: '2026-11-11T00:00:00Z' }, '株式会社テスト');
assert(simpleBuf.length > 1000 && simpleBuf.subarray(0, 4).toString() === '%PDF', 'PDFができる');
assert(simpleBuf.toString('latin1').includes('NotoSansJP'), '日本語フォントが埋め込まれる');

// 2. ネストしたdiv・tableが parseHtmlToBlocks で壊れず抽出できること
const estVals = getTemplateDefaultValues('tpl-unified-estimate', '2026-11-13', 'hybrid_setup_retainer', 'hybrid_setup_retainer');
const estHtml = fill(getEstimateHtml('hybrid_setup_retainer'), estVals);
const estBlocks = parseHtmlToBlocks(estHtml);
assert(estBlocks.some((b) => b.type === 'h1' && b.text?.includes('御 見 積 書')), 'ネストしたdiv内のh1が抽出できる');
assert(estBlocks.some((b) => b.type === 'table' && (b.rows?.length || 0) >= 3), '見積テーブルの全行が抽出できる');

// 3. 5大重要書類＋診断レポートすべてが例外なくPDF生成でき、NotoSansJP が埋め込まれること
const docs = [
  { type: 'estimate', title: '御見積書', html: estHtml },
  {
    type: 'contract',
    title: '業務委託基本契約書',
    html: fill(getContractHtml('hybrid_setup_retainer'), getTemplateDefaultValues('tpl-unified-contract', '2026-11-13', 'hybrid_setup_retainer', 'hybrid_setup_retainer')),
  },
  {
    type: 'invoice',
    title: '御請求書',
    html: fill(getInvoiceHtml('hybrid_setup_retainer'), getTemplateDefaultValues('tpl-unified-invoice', '2026-11-13', 'hybrid_setup_retainer', 'hybrid_setup_retainer')),
  },
  {
    type: 'proposal',
    title: '経営・業務改善 ご提案書',
    html: fill(getProposalReportHtml('hybrid'), getTemplateDefaultValues('tpl-proposal-report', '2026-11-13', 'hybrid_setup_retainer', 'hybrid_setup_retainer')),
  },
  {
    type: 'monthly_report',
    title: '月次業務報告書',
    html: fill(getMonthlyReportHtml(), getTemplateDefaultValues('tpl-monthly-report-01', '2026-11-13', 'retainer', 'retainer')),
  },
  {
    type: 'diagnosis_report',
    title: '経営診断レポート',
    html: renderDiagnosisReportHtml('株式会社テスト', '## D0 結論サマリー\n**最重要の結論**を簡潔に整理しました。\n\n## D3 特定された急所と根拠\n**請求処理の二重入力**が主なボトルネックです。\n\n## D5 改善の方向性\n進め方の整理'),
  },
];

for (const d of docs) {
  const buf = await generateDocumentPdf(
    { id: '11111111-2222-3333-4444-555555555555', title: d.title, document_type: d.type, body_html: d.html, created_at: '2026-11-13T00:00:00Z' },
    '株式会社テスト',
  );
  assert(buf.length > 2000 && buf.subarray(0, 4).toString() === '%PDF', `${d.type} のPDFが生成できる`);
  assert(buf.toString('latin1').includes('NotoSansJP'), `${d.type} に日本語フォントが埋め込まれる`);
}

// 4. ソースコード上の発行者情報に丸の内の旧住所が残っていないこと
const pdfSvcSrc = fs.readFileSync(path.join(process.cwd(), 'server', 'pdfService.ts'), 'utf8');
assert(!pdfSvcSrc.includes('100-0005') && !pdfSvcSrc.includes('千代田区丸の内'), '旧住所(丸の内)が pdfService.ts に残っていない');
assert(pdfSvcSrc.includes('〒503-0981 岐阜県大垣市桧町127番地'), '正しい所在地(岐阜県大垣市桧町127番地)が設定されている');

const f = path.join(os.tmpdir(), `pdfjp-${process.pid}.pdf`);
fs.writeFileSync(f, simpleBuf);
try {
  const text = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' });
  assert(text.includes('初期構築費用') && text.includes('株式会社テスト 御中') && text.includes('大垣市桧町127番地'), '日本語・正しい住所が文字として読み取れる');
} catch (e) {
  if (e?.code === 'ENOENT') console.log('pdftotext がないため、文字の読み取り確認は省略');
  else throw e;
} finally { fs.rmSync(f, { force: true }); }
console.log('pdfJapanese.test.ts: all assertions passed');
