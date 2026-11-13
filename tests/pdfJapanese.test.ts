// @ts-nocheck
/** PDFに日本語フォントが埋め込まれ、日本語が文字として入ること(文字化け防止) */
import { generateDocumentPdf } from '../server/pdfService.js';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

const html = '<h1>ご請求書</h1><p>大橋商事 御中 お支払い期限: 2026年12月31日</p><table><tr><th>項目</th><th>金額</th></tr><tr><td>初期構築費用</td><td>300,000</td></tr></table>';
const buf = await generateDocumentPdf({ id: 'abcdef12-0000', title: '請求書 INV-1', document_type: 'invoice', body_html: html, created_at: '2026-11-11T00:00:00Z' }, '株式会社テスト');
assert(buf.length > 1000 && buf.subarray(0, 4).toString() === '%PDF', 'PDFができる');
assert(buf.toString('latin1').includes('NotoSansJP'), '日本語フォントが埋め込まれる');
const f = path.join(os.tmpdir(), `pdfjp-${process.pid}.pdf`);
fs.writeFileSync(f, buf);
try {
  const text = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' });
  assert(text.includes('ご請求書') && text.includes('初期構築費用') && text.includes('株式会社テスト 御中'), '日本語が文字として読み取れる');
} catch (e) {
  if (e?.code === 'ENOENT') console.log('pdftotext がないため、文字の読み取り確認は省略');
  else throw e;
} finally { fs.rmSync(f, { force: true }); }
console.log('pdfJapanese.test.ts: all assertions passed');
