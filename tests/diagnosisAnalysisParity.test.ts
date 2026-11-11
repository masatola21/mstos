// @ts-nocheck
/**
 * ユニットテスト: 診断結果（簡易診断）の文面パリティ ＆ 時間数値の完全排除
 * - HP (hp/src/lib/supabase.ts) と OS (src/components/PublicIntakeForm.tsx) で
 *   全4タイプの typeTitle / summary / firstStep が同一文字列で存在すること
 * - 両ファイルおよび HP 診断フォームに「月」+数字+「時間」の形が残っていないこと
 */

import { readFileSync } from 'node:fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const EXPECTED_TYPES = [
  {
    typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
    summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が取りにくくなっている可能性が高い状態です。',
    firstStep: '最初の候補は、請求・見積・顧客情報など、複数の場所に同じ内容を入力している作業の見直しです。商談で、どの作業から着手するのが良いかを一緒に絞り込みます。',
  },
  {
    typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
    summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
    firstStep: '最初の候補は、集客から問い合わせ・商談・フォローまでのつながりと、案件ごとの利益の見え方を整理することです。商談で、どこで途切れているかをお伺いします。',
  },
  {
    typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
    summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
    firstStep: '最初の候補は、改善テーマを1つに絞り、小さく着手して定着させることです。商談で、いま一番優先したいテーマをお伺いします。',
  },
  {
    typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
    summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
    firstStep: '最初の候補は、経営者の方に集まっている判断や作業を洗い出し、任せられる形に整えることです。商談で、次に力を入れたい方向をお伺いします。',
  },
];

async function runTests() {
  console.log('=== Running Diagnosis Analysis Parity Unit Tests ===\n');

  const hpSource = readFileSync(new URL('../hp/src/lib/supabase.ts', import.meta.url), 'utf-8');
  const osSource = readFileSync(new URL('../src/components/PublicIntakeForm.tsx', import.meta.url), 'utf-8');
  const hpFormSource = readFileSync(new URL('../hp/src/components/DiagnosisForm.tsx', import.meta.url), 'utf-8');

  // Test 1: HPとOSで4タイプのtypeTitle, summary, firstStepが同一の文字列で入っていること
  console.log('Test 1: HP and OS definitions contain identical typeTitle, summary, and firstStep for all 4 types');
  for (const expected of EXPECTED_TYPES) {
    // HP
    assert(hpSource.includes(expected.typeTitle), `HP missing typeTitle: ${expected.typeTitle}`);
    assert(hpSource.includes(expected.summary), `HP missing summary for: ${expected.typeTitle}`);
    assert(hpSource.includes(expected.firstStep), `HP missing firstStep for: ${expected.typeTitle}`);

    // OS
    assert(osSource.includes(expected.typeTitle), `OS missing typeTitle: ${expected.typeTitle}`);
    assert(osSource.includes(expected.summary), `OS missing summary for: ${expected.typeTitle}`);
    assert(osSource.includes(expected.firstStep), `OS missing firstStep for: ${expected.typeTitle}`);
  }
  console.log('  ✓ All 4 types verified with identical strings in HP and OS');

  // Test 2: 「月」+数字+「時間」の形がファイルに残っていないこと（例: 月35〜55時間、月20〜30時間）
  console.log('Test 2: No ungrounded time savings (月XX時間) pattern in HP or OS diagnosis files');
  const hoursPattern = /月\s*\d+[^"\n\r]*時間/;

  // hp/src/lib/supabase.ts の analyzeBottleneck 周辺
  const hpAnalyzeIdx = hpSource.indexOf('function analyzeBottleneck');
  const hpAnalyzeChunk = hpSource.slice(hpAnalyzeIdx, hpAnalyzeIdx + 3000);
  assert(!hoursPattern.test(hpAnalyzeChunk), `Found ungrounded time pattern in hp/src/lib/supabase.ts: ${hpAnalyzeChunk.match(hoursPattern)?.[0]}`);

  // src/components/PublicIntakeForm.tsx の analyzeBottleneck 周辺
  const osAnalyzeIdx = osSource.indexOf('function analyzeBottleneck');
  const osAnalyzeChunk = osSource.slice(osAnalyzeIdx, osAnalyzeIdx + 2000);
  assert(!hoursPattern.test(osAnalyzeChunk), `Found ungrounded time pattern in src/components/PublicIntakeForm.tsx: ${osAnalyzeChunk.match(hoursPattern)?.[0]}`);

  // hp/src/components/DiagnosisForm.tsx
  assert(!hoursPattern.test(hpFormSource), `Found ungrounded time pattern in hp/src/components/DiagnosisForm.tsx: ${hpFormSource.match(hoursPattern)?.[0]}`);
  assert(!hpFormSource.includes('想定削減可能時間'), 'DiagnosisForm.tsx must not contain "想定削減可能時間"');
  assert(hpFormSource.includes('最初に着手したい候補'), 'DiagnosisForm.tsx must contain "最初に着手したい候補"');
  assert(hpFormSource.includes('result.firstStep'), 'DiagnosisForm.tsx must display "result.firstStep"');
  console.log('  ✓ Verified no hours pattern exists in any diagnosis file');

  // Test 3: Wording cleanup verification
  // - DiagnosisForm.tsx と index.astro に「想定削減」「月 数字〜数字 時間」「ヶ月目」「半年後」「最大利益」「最も効果が出やすい」が含まれていない
  console.log('Test 3: DiagnosisForm.tsx and index.astro contain no ungrounded efficacy wording');
  const indexSource = readFileSync(new URL('../hp/src/pages/index.astro', import.meta.url), 'utf-8');
  const monthRangeHoursPattern = /月\s*\d+\s*[〜~-]\s*\d+\s*時間/;
  const forbiddenPhrases = [
    '想定削減',
    'ヶ月目',
    '半年後',
    '最大利益',
    '最も効果が出やすい',
  ];

  for (const phrase of forbiddenPhrases) {
    assert(!hpFormSource.includes(phrase), `DiagnosisForm.tsx must not contain "${phrase}"`);
    assert(!indexSource.includes(phrase), `index.astro must not contain "${phrase}"`);
  }
  assert(!monthRangeHoursPattern.test(hpFormSource), 'DiagnosisForm.tsx must not contain "月 数字〜数字 時間"');
  assert(!monthRangeHoursPattern.test(indexSource), 'index.astro must not contain "月 数字〜数字 時間"');
  console.log('  ✓ Verified forbidden efficacy wording completely removed from DiagnosisForm.tsx and index.astro');

  // Test 4: supabase.ts に automationScore と timeframe が含まれていない
  console.log('Test 4: supabase.ts contains no automationScore or timeframe');
  assert(!hpSource.includes('automationScore'), 'supabase.ts must not contain "automationScore"');
  assert(!hpSource.includes('timeframe'), 'supabase.ts must not contain "timeframe"');
  console.log('  ✓ Verified automationScore and timeframe completely removed from supabase.ts');

  console.log('\nAll diagnosis analysis parity tests passed.');
}

runTests().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
