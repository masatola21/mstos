// @ts-nocheck
/**
 * ユニットテスト: 提案書のひな型(src/components/matrix/proposalTemplate.ts ほか)
 * - タイトル(「経営・業務改善 ご提案書」)と、旧ひな型の問題(自動化・診断レポート表記、数値、Phase、固定の金額)が無いこと
 * - 章の構成(D0〜D5 → P1〜P7)と、D6 が載らないこと
 * - 型(構築 / 伴走 / 構築+伴走)で P2〜P6 が切り替わること
 * - 初期値が空(サンプルの会社名・金額を入れない)、有効期限は発行日から30日
 * - 費用の計算(切り捨て)と、日付・文字列の補助関数
 */

import {
  getProposalReportHtml,
  PROPOSAL_VARIABLES,
  PROPOSAL_DOCUMENT_TITLE,
  requiredKeysFor,
  proposalEmptyText,
  PROPOSAL_MISSING_MARK,
  defaultPaymentTermsFor,
  placeholdersIn,
} from '../src/components/matrix/proposalTemplate.js';
import {
  CORE_TEMPLATES,
  getDynamicTemplateHtml,
  getTemplateDefaultValues,
  normalizeTemplateId,
} from '../src/components/matrix/documentGenerators.js';
import {
  addDaysToIsoDate,
  kindFromPaymentMode,
  markdownToPlainText,
  PROPOSAL_VALID_DAYS,
  PAYMENT_MODES_BY_KIND,
} from '../src/constants/proposalChapters.js';
import { calcProposalFees, parseYen, formatYen } from '../src/utils/proposalFees.js';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }
const eq = (a: unknown, b: unknown, m: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} (actual: ${JSON.stringify(a)})`);

const KINDS = ['spot_build', 'retainer', 'hybrid'] as const;
const html = Object.fromEntries(KINDS.map((k) => [k, getProposalReportHtml(k)]));

// タイトル
eq(PROPOSAL_DOCUMENT_TITLE, '経営・業務改善 ご提案書', 'タイトル');
for (const k of KINDS) {
  const h = html[k];
  assert(h.includes(`>${PROPOSAL_DOCUMENT_TITLE}</h1>`), `${k}: h1 がタイトル`);
  assert(/<h1[^>]*white-space:\s*nowrap/.test(h), `${k}: タイトルは途中で折り返さない`);
  for (const bad of ['自動化', '診断レポート）', '（診断レポート', 'Phase', '月20', '時間以上', '385,000', '150,000', '200,000', '毎月末日締め翌月末日振込（一括・分割・手付相談可）', '発行日より1ヶ月間']) {
    assert(!h.includes(bad), `${k}: 「${bad}」を含まない`);
  }
}
const tpl = CORE_TEMPLATES.find((t) => t.id === 'tpl-proposal-report');
assert(tpl && tpl.title === PROPOSAL_DOCUMENT_TITLE, 'カードのタイトルも同じ');
assert(!/自動化|診断レポート/.test(tpl.title + tpl.subtitle + tpl.description + tpl.badge), 'カードの文言に旧表記がない');
eq(normalizeTemplateId('tpl-proposal-report'), 'tpl-proposal-report', 'ID は変わらない');

// 章の構成と順序
for (const k of KINDS) {
  const h = html[k];
  const titles = ['結論サマリー', '診断の前提', '現状整理', '特定された急所と根拠', '放置した場合の影響', '改善の方向性',
    '提案の型と方針', '提供内容・成果物', 'ロードマップ', '費用', 'お客様にお願いすること・前提・対象外', 'お支払い条件・契約期間', '次のステップ・お申し込み'];
  let last = -1;
  for (const t of titles) {
    const i = h.indexOf(`>${t}</h3>`);
    assert(i > last, `${k}: 「${t}」が順序どおりにある`);
    last = i;
  }
  assert(!h.includes('商談で確認すること'), `${k}: D6(社内用)は載せない`);
  assert(h.includes('web-apply-box') && h.includes('{{apply_url}}'), `${k}: お申し込みボタンを含む`);
}

// すべての変数が定義済み
const defined = new Set([...PROPOSAL_VARIABLES.map((v) => v.key), 'apply_url']);
for (const k of KINDS) {
  const missing = placeholdersIn(html[k]).filter((p) => !defined.has(p));
  eq(missing, [], `${k}: 未定義の変数がない`);
}

// 型による切り替え
assert(html.spot_build.includes('{{p2_deliverables}}') && !html.spot_build.includes('{{p2_monthly_support}}'), '構築: 成果物のみ');
assert(!html.retainer.includes('{{p2_deliverables}}') && html.retainer.includes('{{p2_monthly_support}}'), '伴走: 月次の支援のみ');
assert(html.hybrid.includes('{{p2_deliverables}}') && html.hybrid.includes('{{p2_monthly_support}}'), '構築+伴走: 両方');
assert(html.spot_build.includes('{{p4_initial_fee}}') && !html.spot_build.includes('{{p4_monthly_fee}}'), '構築: 初期費用のみ');
assert(!html.retainer.includes('{{p4_initial_fee}}') && html.retainer.includes('{{p4_monthly_fee}}'), '伴走: 月額のみ');
assert(html.hybrid.includes('{{p4_initial_fee}}') && html.hybrid.includes('{{p4_monthly_fee}}'), '構築+伴走: 初期費用+月額');
assert(!html.spot_build.includes('{{p6_contract_period}}') && html.retainer.includes('{{p6_contract_period}}') && html.hybrid.includes('{{p6_contract_period}}'), '契約期間は伴走・構築+伴走だけ');
assert(html.spot_build.includes('構築のスケジュール') && html.retainer.includes('フェーズごとの重点テーマ') && html.hybrid.includes('構築期間から伴走への移行'), 'P3 の見出し');
assert(html.spot_build.includes('ご提案(構築)') && html.hybrid.includes('ご提案(構築+伴走)'), '型の呼び名が章タイトルに出る');
eq(getDynamicTemplateHtml('tpl-proposal-report', 'retainer', 'lump_sum'), html.retainer, '支払い方式 retainer → 伴走');
eq(getDynamicTemplateHtml('tpl-proposal-report', 'hybrid_setup_retainer', 'lump_sum'), html.hybrid, '支払い方式 hybrid → 構築+伴走');
for (const m of PAYMENT_MODES_BY_KIND.spot_build) eq(getDynamicTemplateHtml('tpl-proposal-report', m, 'lump_sum'), html.spot_build, `${m} → 構築`);

// 必須項目と空のときの表示
for (const k of KINDS) for (const key of requiredKeysFor(k)) assert(defined.has(key), `${k}: 必須キー ${key} は定義済み`);
assert(requiredKeysFor('spot_build').includes('p4_initial_fee') && !requiredKeysFor('spot_build').includes('p4_monthly_fee'), '構築の必須金額');
assert(requiredKeysFor('retainer').includes('p6_contract_period'), '伴走は契約期間が必須');
assert(!requiredKeysFor('spot_build').includes('p6_contract_period'), '構築は契約期間が不要');
eq(proposalEmptyText('p3_roadmap', 'spot_build'), PROPOSAL_MISSING_MARK, '必須が空 → 【未入力】');
eq(proposalEmptyText('d2_current', 'spot_build'), '要ヒアリング', 'D2 が空 → 要ヒアリング');
eq(proposalEmptyText('d3_bottleneck', 'retainer'), '要ヒアリング', 'D3 が空 → 要ヒアリング');
eq(proposalEmptyText('d1_premise', 'retainer'), '未回答', 'D1 が空 → 未回答');
eq(proposalEmptyText('p5_exclusions', 'retainer'), '（個別の記載はありません）', 'P5 は空でも可(見出しだけ残らない)');
assert(!requiredKeysFor('hybrid').some((k) => k.startsWith('p5_')), 'P5 は必須でない');

// 初期値
const d = getTemplateDefaultValues('tpl-proposal-report', '2026-11-12', 'lump_sum', 'lump_sum');
for (const key of ['client_company', 'client_name', 'proposal_title', 'p2_service_name', 'p4_initial_fee', 'p4_monthly_fee', 'p4_subtotal', 'p4_tax', 'p4_total', 'p3_roadmap', 'd0_summary']) {
  eq(d[key], '', `初期値は空: ${key}`);
}
eq(d.issue_date, '2026年11月12日', '発行日');
eq(d.due_date, '2026年12月12日', '有効期限は発行日から30日(11/12 + 30日)');
eq(d.p6_payment_terms, defaultPaymentTermsFor('lump_sum'), 'お支払い条件の初期文');
eq(getTemplateDefaultValues('tpl-proposal-report', '2026-11-12', 'retainer', 'lump_sum').p6_payment_terms, defaultPaymentTermsFor('retainer'), '伴走の初期文');
assert(!Object.values(d).some((v) => /月\s*\d+\s*[〜~-]?\s*\d*\s*時間/.test(String(v))), '初期値に「月○時間」がない');
eq(PROPOSAL_VALID_DAYS, 30, '有効日数は30');

// 日付
eq(addDaysToIsoDate('2026-11-12', 30), '2026-12-12', '+30日');
eq(addDaysToIsoDate('2026-12-20', 30), '2027-01-19', '年またぎ');
eq(addDaysToIsoDate('2028-02-28', 2), '2028-03-01', 'うるう年');
eq(addDaysToIsoDate('invalid', 30), '', '不正な日付は空');

// 型
eq(kindFromPaymentMode('lump_sum'), 'spot_build', 'lump_sum');
eq(kindFromPaymentMode('milestone'), 'spot_build', 'milestone');
eq(kindFromPaymentMode('installments_6'), 'spot_build', 'installments_6');
eq(kindFromPaymentMode('retainer'), 'retainer', 'retainer');
eq(kindFromPaymentMode('hybrid_setup_retainer'), 'hybrid', 'hybrid');

// 費用(税率10%、切り捨て。小計+税=合計)
eq(calcProposalFees({ initialFee: 300000, monthlyFee: 100000, discount: 0 }), { subtotal: 400000, tax: 40000, total: 440000 }, '構築+伴走の既存の例と同じ');
eq(calcProposalFees({ initialFee: 12345, monthlyFee: 0, discount: 0 }), { subtotal: 12345, tax: 1234, total: 13579 }, '端数は切り捨て');
eq(calcProposalFees({ initialFee: 100000, monthlyFee: 0, discount: 30000 }), { subtotal: 70000, tax: 7000, total: 77000 }, '値引き');
eq(calcProposalFees({ initialFee: 1000, monthlyFee: 0, discount: 5000 }), { subtotal: 0, tax: 0, total: 0 }, '値引きで0未満にならない');
eq(calcProposalFees({ initialFee: NaN, monthlyFee: -5, discount: 0 }), { subtotal: 0, tax: 0, total: 0 }, '不正な値は0');
for (const [i, m, dsc] of [[1, 1, 0], [99999, 33333, 1], [1234567, 89, 7]]) {
  const f = calcProposalFees({ initialFee: i, monthlyFee: m, discount: dsc });
  assert(f.subtotal + f.tax === f.total, `小計+税=合計 (${i},${m},${dsc})`);
}
eq(parseYen('￥300,000円'), 300000, 'parseYen');
eq(parseYen(''), 0, 'parseYen 空');
eq(formatYen(1234567), '1,234,567', 'formatYen');

// Markdown → プレーンテキスト
eq(markdownToPlainText('**急所**(業務)\n- 一つ目\n* 二つ目\n\n\n\n## 見出し'), '急所(業務)\n・一つ目\n・二つ目\n\n見出し', 'Markdown を取り除く');

console.log('proposalTemplate.test.ts: all assertions passed');
