/**
 * 商談で画面共有するための「お客様に見せてよい表示」(D0〜D5のみ)。
 * - D6(商談で確認すること)・ヒアリングの回答・面談メモは絶対に含めない(入力はレポート本文だけ)。
 * - すべてエスケープする。旧形式のレポートは全文をそのまま出す。
 */

import { parseDiagnosisReport, diagnosisChaptersForDisplay, markdownToPlainText } from '../constants/proposalChapters';

export const escapeHtml = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const paragraphs = (text: string) =>
  markdownToPlainText(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

export function renderMeetingShareHtml(report: string, companyName = ''): string {
  const parsed = parseDiagnosisReport(report);
  const title = companyName ? `${escapeHtml(companyName)} 様 経営業務改善 診断レポート` : '経営業務改善 診断レポート';
  let nav = '';
  let body = '';
  if (parsed.legacy) {
    body = `<section>${paragraphs(parsed.preamble || report)}</section>`;
  } else {
    const chapters = diagnosisChaptersForDisplay(parsed, { forCustomer: true }).filter((c) => !c.missing);
    nav = chapters.map((c) => `<a href="#${c.def.id}">${c.def.id} ${escapeHtml(c.def.title)}</a>`).join('');
    body = chapters
      .map((c) => `<section id="${c.def.id}"><h2><span>${c.def.id}</span>${escapeHtml(c.def.title)}</h2>${paragraphs(c.body)}</section>`)
      .join('');
  }
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
body{margin:0;font-family:system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;font-size:22px;line-height:1.9;color:#1a1a1a;background:#fff}
header{padding:28px 48px;border-bottom:1px solid #ddd;position:sticky;top:0;background:#fff}
h1{margin:0 0 10px;font-size:28px}
nav a{display:inline-block;margin:0 14px 4px 0;font-size:16px;color:#0b5cad;text-decoration:none}
main{max-width:980px;margin:0 auto;padding:24px 48px 120px}
section{margin:44px 0}
h2{font-size:30px;margin:0 0 14px}h2 span{color:#0b5cad;margin-right:12px}
p{margin:0 0 14px}
</style></head><body><header><h1>${title}</h1><nav>${nav}</nav></header><main>${body}</main></body></html>`;
}
