// @ts-nocheck
/**
 * ユニットテスト: 提案書のAI下書き(server/proposalDraftBuilder.ts)
 * - プロンプトが、サービス名・金額・期間・数値をAIに決めさせない指示を含むこと
 * - 型ごとに指示が切り替わり、与えられた情報だけが入ること
 * - 出力に金額・期間・割合・日付が混ざったら警告すること(「要入力」の印の中は対象外)
 * - 画面の入力欄・APIの定義が、下書きの対象(P1・P3)と合っていること
 */

import { readFileSync } from 'node:fs';
import {
  DRAFT_CHAPTERS,
  buildProposalDraftPrompt,
  sanitizeDraftContext,
  scanDraftForForbidden,
  cleanDraftOutput,
} from '../server/proposalDraftBuilder.js';
import { PROPOSAL_VARIABLES, MULTILINE_KEYS, DRAFTABLE_KEYS } from '../src/components/matrix/proposalTemplate.js';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }
const eq = (a: unknown, b: unknown, m: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} (actual: ${JSON.stringify(a)})`);

eq([...DRAFT_CHAPTERS], ['P1', 'P3'], '下書きの対象はP1とP3だけ');

// プロンプト
const ctx = {
  companyName: '株式会社テスト',
  diagnosis: { d0: '要点です', d2: '現状です', d3: '急所です', d5: '方向性です' },
  serviceName: 'テストサービス',
  meetingNotes: '請求書の二重入力を減らしたい',
  policy: '絞って構築します',
};
const p1 = buildProposalDraftPrompt('P1', 'spot_build', ctx);
const p3 = buildProposalDraftPrompt('P3', 'hybrid', ctx);
for (const [name, p] of [['P1', p1], ['P3', p3]]) {
  assert(p.includes('金額、期間'), `${name}: 金額・期間を書かせない指示`);
  assert(p.includes('【期間: 要入力】') || p.includes('「【期間: 要入力】」'), `${name}: 要入力の印の指示`);
  assert(p.includes('サービス名は、与えられたものだけ'), `${name}: サービス名を作らせない`);
  assert(p.includes('効果は断定しない'), `${name}: 効果を断定させない`);
  assert(p.includes('株式会社テスト') && p.includes('請求書の二重入力を減らしたい'), `${name}: 与えた情報が入る`);
  assert(!/Phase|月20時間/.test(p), `${name}: Phase・時間の例を含まない`);
}
assert(p1.includes('「構築」') && p3.includes('「構築+伴走」'), '型の呼び名が入る');
assert(p1.includes('提案の型と方針') && p3.includes('ロードマップ'), '章ごとの指示');
assert(!p1.includes('決まった提案の方針'), 'P1 には方針を渡さない');
assert(p3.includes('決まった提案の方針') && p3.includes('絞って構築します'), 'P3 には決まった方針を渡す');
assert(p3.includes('構築の期間から、伴走への移行'), '構築+伴走のP3の指示');
assert(buildProposalDraftPrompt('P3', 'retainer', ctx).includes('フェーズごとの重点テーマ'), '伴走のP3の指示');
assert(buildProposalDraftPrompt('P3', 'spot_build', ctx).includes('構築のスケジュール'), '構築のP3の指示');
const empty = buildProposalDraftPrompt('P1', 'retainer', {});
assert(empty.includes('情報がありません') && !empty.includes('■ サービス名'), '情報が無い項目は見出しごと省く');

// 入力の整形
const s = sanitizeDraftContext({ companyName: 'a'.repeat(500), serviceName: 123, meetingNotes: 'x'.repeat(10000), diagnosis: null, evil: '<script>' });
assert(s.companyName.length === 200, '会社名は200字まで');
eq(s.serviceName, '123', '文字列に直す');
assert(s.meetingNotes.length === 3000, 'メモは3000字まで');
eq(s.diagnosis, { d0: '', d2: '', d3: '', d5: '' }, '診断が無くても落ちない');
assert(!('evil' in s), '想定外の項目は捨てる');
eq(sanitizeDraftContext(undefined).policy, '', 'undefined でも落ちない');

// 出力の確認
for (const [text, label] of [
  ['初期費用は300,000円です', '金額'], ['費用は¥50000', '金額'], ['約3か月で完了', '期間・回数・時間'], ['週2回の定例', '期間・回数・時間'],
  ['月20時間削減', '期間・回数・時間'], ['利益が20%向上', '割合・倍率'], ['2026年12月に開始', '日付'], ['Phase 1 で着手', 'Phase の固定文'],
]) {
  assert(scanDraftForForbidden(text).includes(label), `警告: ${text} → ${label}`);
}
eq(scanDraftForForbidden('【期間: 要入力】で、【金額: 要入力】を確認します。ステップ1で整理します。'), [], '要入力の印と「ステップ1」は警告しない');
eq(scanDraftForForbidden(''), [], '空は警告なし');
eq(scanDraftForForbidden(null as any), [], 'null は警告なし');

const cleaned = cleanDraftOutput('## 方針\n**絞って**構築します。\n- 一つ目【期間: 要入力】\n- 二つ目【金額: 要入力】');
assert(!cleaned.text.includes('##') && !cleaned.text.includes('**'), 'Markdown の記号を取り除く');
eq(cleaned.placeholders, 2, '要入力の数');
eq(cleaned.warnings, [], '警告なし');
const bad = cleanDraftOutput('月20時間を削減します');
assert(bad.warnings.length === 1 && bad.warnings[0].includes('期間・回数・時間'), '警告の文面');
eq(cleanDraftOutput('').text, '', '空の出力');

// 画面・APIとの整合
const keys = new Set(PROPOSAL_VARIABLES.map((v) => v.key));
for (const k of MULTILINE_KEYS) assert(keys.has(k), `複数行の欄が定義済み: ${k}`);
for (const [k, ch] of Object.entries(DRAFTABLE_KEYS)) { assert(keys.has(k), `下書きの欄が定義済み: ${k}`); assert(DRAFT_CHAPTERS.includes(ch), `下書きの章: ${ch}`); }
assert(keys.has('p_meeting_notes'), '商談メモの欄がある');
const html = readFileSync(new URL('../src/components/matrix/proposalTemplate.ts', import.meta.url), 'utf-8');
assert(!html.includes('{{p_meeting_notes}}'), '商談メモは書類に載せない');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf-8');
assert(/app\.post\('\/api\/proposals\/draft-chapter', requireAuth/.test(server), 'APIはログイン必須');
assert(server.includes("getKillSwitchStatus('ai')"), 'AIの緊急停止に従う');

console.log('proposalDraft.test.ts: all assertions passed');
