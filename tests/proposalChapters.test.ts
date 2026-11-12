// @ts-nocheck
/**
 * ユニットテスト: 診断・提案書の章の定義(src/constants/proposalChapters.ts)
 * - 呼び名(構築 / 伴走 / 構築+伴走)と、型→支払い方式の対応
 * - 章の一覧(D0〜D6、P1〜P7)と、D6 がお客様版に載らないこと
 * - 診断レポートの章分割(新形式・旧形式・順序・重複・空)
 */

import {
  PROPOSAL_KIND_LABELS,
  PAYMENT_MODES_BY_KIND,
  defaultPaymentModeFor,
  isPaymentModeAllowed,
  CHAPTERS,
  DIAGNOSIS_CHAPTER_IDS,
  PROPOSAL_CHAPTER_IDS,
  customerVisibleChapters,
  parseDiagnosisReport,
  diagnosisChaptersForDisplay,
} from '../src/constants/proposalChapters.js';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function eq(a: unknown, b: unknown, message: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${message} (actual: ${JSON.stringify(a)})`);
}

// 呼び名
eq(PROPOSAL_KIND_LABELS, { spot_build: '構築', retainer: '伴走', hybrid: '構築+伴走', undecided: '未定' }, '呼び名');

// 型 → 支払い方式(DB の chk_proposal_drafts_kind_payment と同じ組み合わせ)
eq(defaultPaymentModeFor('spot_build'), 'lump_sum', '構築の初期値は一括');
eq(defaultPaymentModeFor('retainer'), 'retainer', '伴走の初期値');
eq(defaultPaymentModeFor('hybrid'), 'hybrid_setup_retainer', '構築+伴走の初期値');
eq(defaultPaymentModeFor('undecided'), null, '未定は初期値なし');
assert(isPaymentModeAllowed('spot_build', 'milestone'), '構築はマイルストーン可');
assert(!isPaymentModeAllowed('retainer', 'lump_sum'), '伴走に一括は不可');
assert(!isPaymentModeAllowed('hybrid', 'installments_3'), '構築+伴走に分割は不可');
assert(!isPaymentModeAllowed('undecided', 'lump_sum'), '未定は不可');
eq(Object.keys(PAYMENT_MODES_BY_KIND).sort(), ['hybrid', 'retainer', 'spot_build'], '型の一覧');

// 章の一覧
eq(DIAGNOSIS_CHAPTER_IDS, ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'], '診断パートの章');
eq(PROPOSAL_CHAPTER_IDS, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'], '提案パートの章');
assert(new Set(CHAPTERS.map((c) => c.id)).size === CHAPTERS.length, '章IDが重複していない');
assert(!customerVisibleChapters().some((c) => c.id === 'D6'), 'D6 はお客様版に載せない');
assert(customerVisibleChapters().some((c) => c.id === 'D5'), 'D5 は載せる');
// 承認不可になる章は仕様書の通り(P1/P2/P3/P4/P6)
eq(CHAPTERS.filter((c) => c.blocksApproval).map((c) => c.id), ['P1', 'P2', 'P3', 'P4', 'P6'], '承認条件に入る章');
// AI だけで埋める章に、金額・費用の章がないこと
assert(
  CHAPTERS.filter((c) => c.sources.length === 1 && c.sources[0] === 'ai').every((c) => c.part === 'diagnosis'),
  'AI だけで埋める章は診断パートのみ',
);
assert(!CHAPTERS.find((c) => c.id === 'P4').sources.includes('ai'), 'P4(費用)に AI を使わない');
assert(!CHAPTERS.find((c) => c.id === 'P6').sources.includes('ai'), 'P6(支払い条件)に AI を使わない');

// 章分割: 新形式
const md = [
  '前置き',
  '## D0 結論サマリー',
  '要点です。',
  '## D2. 現状整理',
  '回答より: ...',
  '',
  '## D1 診断の前提',
  '業種: 未回答',
  '### D3：特定された急所',
  '二重入力が多い。',
].join('\n');
const p = parseDiagnosisReport(md);
assert(!p.legacy, '新形式は legacy でない');
eq(p.chapters.map((c) => c.id), ['D0', 'D1', 'D2', 'D3'], '章は D0→D6 の順に並ぶ');
eq(p.chapters.find((c) => c.id === 'D2').body, '回答より: ...', '本文の前後の空白は除く');
eq(p.chapters.find((c) => c.id === 'D3').title, '特定された急所', '全角コロンの見出し');
eq(p.preamble, '前置き', '章の前の文');

// 章分割: 旧形式(固定4見出し)は legacy
const legacy = parseDiagnosisReport('1. ■ 診断サマリーと最優先ボトルネックの特定\n本文\n2. ■ 会社と経営者の未来');
assert(legacy.legacy && legacy.chapters.length === 0, '旧形式は legacy');
assert(legacy.preamble.includes('本文'), '旧形式の本文は preamble に残る');

// 章分割: 空・null
assert(parseDiagnosisReport('').legacy, '空は legacy');
assert(parseDiagnosisReport(null as any).legacy, 'null は legacy');

// 重複した章は本文を足す(捨てない)
const dup = parseDiagnosisReport('## D0 A\nx\n## D0 A\ny');
eq(dup.chapters.length, 1, '重複は1章にまとめる');
assert(dup.chapters[0].body.includes('x') && dup.chapters[0].body.includes('y'), '本文を両方残す');

// "D10" や文中の D1 を章と誤認しない
const noise = parseDiagnosisReport('## D10 その他\n本文\nD1 は文中');
assert(noise.legacy, 'D10 や文中の D1 は章ではない');

// 表示用: 足りない章は missing、お客様版は D6 を除く
const disp = diagnosisChaptersForDisplay(p);
eq(disp.map((d) => d.def.id), ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'], '社内版は7章');
eq(disp.filter((d) => d.missing).map((d) => d.def.id), ['D4', 'D5', 'D6'], '未生成の章');
eq(diagnosisChaptersForDisplay(p, { forCustomer: true }).map((d) => d.def.id), ['D0', 'D1', 'D2', 'D3', 'D4', 'D5'], 'お客様版は D6 なし');

console.log('proposalChapters.test.ts: all assertions passed');
