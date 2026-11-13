// @ts-nocheck
/** ユニットテスト: ヒアリングシート定数・面談メモ整理・商談用の表示 */
import {
  sanitizeCoreAnswers, sanitizeExtraQuestions, customerIntentFrom, answeredCount, composeMeetingMemo,
  emptyCoreAnswers, SUMMARY_KEY, DECISIONS_KEY, MAX_EXTRA_QUESTIONS,
} from '../src/constants/hearingSheet.js';
import {
  parseOrganizedNotes, parseExtraQuestions, buildOrganizePrompt, buildSupportMeetingOrganizePrompt,
  parseSupportMeetingNotes, extractJsonObject, MeetingNotesFormatError,
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
const memo = composeMeetingMemo(sanitizeCoreAnswers({ q02: '請求書作成', t01: 'hybrid', [SUMMARY_KEY]: '要約です', [DECISIONS_KEY]: '・来月開始' }));
assert(memo.includes('請求書作成') && memo.includes('構築+伴走') && memo.includes('商談の要約') && memo.includes('要約です') && memo.includes('商談での合意事項') && memo.includes('来月開始') && !memo.includes('q05'), 'memo');

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
const salesPrompt = buildOrganizePrompt('sales', 'TRANSCRIPT');
assert(salesPrompt.includes('TRANSCRIPT') && salesPrompt.includes('"q10"') && !salesPrompt.includes('"todos"'), 'sales prompt omits todos');

// support meeting organize
const supportPrompt = buildSupportMeetingOrganizePrompt('定例文字起こし');
assert(supportPrompt.includes('定例文字起こし') && supportPrompt.includes('"client_homework"') && supportPrompt.includes('"mst_homework"'), 'support meeting prompt');
assert(buildOrganizePrompt('support_meeting', 'ABC').includes('ABC'), 'organize prompt delegates support_meeting');
const supportParsed = parseSupportMeetingNotes('{"purpose":"月次定例","topic":"請求自動化の確認","discussion":"連携状況をレビュー","decisions":["来週テスト実施"],"unresolved_items":[],"client_homework":["・CSVサンプル送付"],"mst_homework":["連携仕様書を更新"],"next_topic":"本番切替"}');
assert(
  supportParsed.topic === '請求自動化の確認' &&
  supportParsed.decisions === '・来週テスト実施' &&
  supportParsed.client_homework === '・CSVサンプル送付' &&
  supportParsed.mst_homework === '・連携仕様書を更新' &&
  supportParsed.next_topic === '本番切替',
  'support meeting parsed'
);
threw = false;
try { parseSupportMeetingNotes('{"topic":"","discussion":"","decisions":[]}'); } catch (e) { threw = e instanceof MeetingNotesFormatError; }
assert(threw, 'empty support meeting rejected');

// extra questions
const qs = parseExtraQuestions('{"questions":["1. 請求業務の流れを教えてください","請求業務の流れを教えてください","短い","a質問その3です、お願いします","b質問その4です、お願いします","c質問その5です、お願いします","d質問その6です、お願いします"]}');
assert(qs.length === 5 && new Set(qs).size === 5 && !qs.includes('短い'), 'extra parse');

// share: D6 / memo never included
const report = '## D0 結論サマリー\n結論です\n## D3 急所\n<script>x</script>\n## D6 商談で確認すること\n内部メモSECRET';
const html = renderMeetingShareHtml(report, 'A社');
assert(html.includes('結論です') && !html.includes('SECRET') && !html.includes('<script>x'), 'share safe');
assert(renderMeetingShareHtml('旧形式の本文', '').includes('旧形式の本文'), 'legacy whole');

console.log('hearingSession.test.ts: all assertions passed');
