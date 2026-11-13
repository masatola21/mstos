// @ts-nocheck
/** ユニットテスト: ヒアリングシート定数・面談メモ整理・商談用の表示 */
import {
  sanitizeCoreAnswers, sanitizeExtraQuestions, customerIntentFrom, answeredCount, composeMeetingMemo,
  emptyCoreAnswers, SUMMARY_KEY, MAX_EXTRA_QUESTIONS,
} from '../src/constants/hearingSheet.js';
import {
  parseOrganizedNotes, parseExtraQuestions, buildOrganizePrompt, extractJsonObject, MeetingNotesFormatError,
} from '../server/meetingNotes.js';
import { renderMeetingShareHtml } from '../src/utils/meetingShare.js';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

// sanitize
const a = sanitizeCoreAnswers({ q02: ' 請求 ', t01: 'bogus', t02: 'single', evil: 'x', q03: 5 });
assert(a.q02 === '請求' && a.t01 === '' && a.t02 === 'single' && a.q03 === '5' && !('evil' in a), 'sanitize');
assert(customerIntentFrom(sanitizeCoreAnswers({ t01: 'retainer' })) === 'retainer', 'intent');
assert(customerIntentFrom(emptyCoreAnswers()) === null, 'intent null');
assert(answeredCount(sanitizeCoreAnswers({ q02: 'a', q03: 'b' })) === 2, 'count');
const ex = sanitizeExtraQuestions(Array.from({ length: 8 }, (_, i) => ({ q: `q${i}`, a: '' })).concat([{ q: '', a: 'x' }]));
assert(ex.length === MAX_EXTRA_QUESTIONS, 'extra max 5');
const memo = composeMeetingMemo(sanitizeCoreAnswers({ q02: '請求書作成', t01: 'hybrid', [SUMMARY_KEY]: '要約です' }));
assert(memo.includes('請求書作成') && memo.includes('構築+伴走') && memo.includes('要約です') && !memo.includes('q05'), 'memo');

// organize
const json = '前置き ```json\n{"summary":"s","decisions":["d"],"todos":["t"],"answers":{"q02":"請求","t01":"nope","zzz":"x"}}\n```';
const n = parseOrganizedNotes(json, 'sales');
assert(n.answers.q02 === '請求' && n.answers.t01 === '' && !('zzz' in n.answers), 'organize sales');
assert(parseOrganizedNotes(json, 'support').answers === null, 'support has no answers');
let threw = false;
try { parseOrganizedNotes('{"summary":"","decisions":[],"todos":[]}', 'support'); } catch (e) { threw = e instanceof MeetingNotesFormatError; }
assert(threw, 'empty rejected');
threw = false;
try { extractJsonObject('not json'); } catch (e) { threw = e instanceof MeetingNotesFormatError; }
assert(threw, 'bad json rejected');
assert(buildOrganizePrompt('sales', 'TRANSCRIPT').includes('TRANSCRIPT') && buildOrganizePrompt('sales', 'x').includes('"q10"'), 'prompt');

// extra questions
const qs = parseExtraQuestions('{"questions":["1. 請求業務の流れを教えてください","請求業務の流れを教えてください","短い","a質問その3です、お願いします","b質問その4です、お願いします","c質問その5です、お願いします","d質問その6です、お願いします"]}');
assert(qs.length === 5 && new Set(qs).size === 5 && !qs.includes('短い'), 'extra parse');

// share: D6 / memo never included
const report = '## D0 結論サマリー\n結論です\n## D3 急所\n<script>x</script>\n## D6 商談で確認すること\n内部メモSECRET';
const html = renderMeetingShareHtml(report, 'A社');
assert(html.includes('結論です') && !html.includes('SECRET') && !html.includes('<script>x'), 'share safe');
assert(renderMeetingShareHtml('旧形式の本文', '').includes('旧形式の本文'), 'legacy whole');

console.log('hearingSession.test.ts: all assertions passed');
