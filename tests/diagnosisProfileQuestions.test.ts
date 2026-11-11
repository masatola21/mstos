// @ts-nocheck
/**
 * ユニットテスト: 診断フォームの「業種・従業員数」「今一番のお悩み」設問
 * - 既存フォーム定義への追加が冪等であること（何度実行しても同じ）
 * - 管理画面で付け替えた設問文を上書きしないこと
 * - HP(hp/src/lib/supabase.ts)・OS管理画面(DiagnosisFormsWorkspace.tsx)・サーバー定義の選択肢が一致していること
 */

import { readFileSync } from 'node:fs';
import {
  DIAGNOSIS_COMPANY_PROFILE_QUESTIONS,
  DIAGNOSIS_FREE_NOTES_LABEL,
  ensureDiagnosisProfileQuestions,
} from '../server.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function sameList(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// ソースの配列リテラルを取り出す（HPは import.meta.env を使うため、直接 import せず文字列から読む）
function extractArrayLiteral(source: string, startMarker: string): string[] {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  const open = source.indexOf('[', start + startMarker.length);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth += 1;
    if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return new Function(`return ${source.slice(open, end + 1)}`)() as string[];
}

async function runTests() {
  console.log('=== Running Diagnosis Profile Questions Unit Tests ===\n');

  const seedLegacy = () => [
    { id: 'q_ops_bottleneck', label: '業務・手作業の急所', type: 'radio', required: true },
    { id: 'q_free_notes', label: '自由相談メモ', type: 'textarea', required: false },
    { id: 'q_hear_about', label: 'どこで知りましたか？（認知経路）', type: 'select', required: false },
  ];

  // Test 1: 旧定義に追加される（認知経路の手前に入る）＋自由記述の設問文が更新される
  console.log('Test 1: legacy definition gets profile questions before q_hear_about');
  {
    const result = ensureDiagnosisProfileQuestions(seedLegacy());
    const ids = result.questions.map((q: any) => q.id);
    assert(result.changed === true, 'changed should be true');
    assert(
      sameList(ids, ['q_ops_bottleneck', 'q_free_notes', 'q_industry', 'q_employee_count', 'q_hear_about']),
      `unexpected order: ${ids.join(',')}`,
    );
    const notes = result.questions.find((q: any) => q.id === 'q_free_notes');
    assert(notes.label === DIAGNOSIS_FREE_NOTES_LABEL, 'free notes label should be updated');
    const industry = result.questions.find((q: any) => q.id === 'q_industry');
    assert(industry.required === false, 'q_industry must stay optional');
    assert(
      result.questions.find((q: any) => q.id === 'q_employee_count').required === false,
      'q_employee_count must stay optional',
    );
  }

  // Test 2: 冪等（2回目は変更なし）
  console.log('Test 2: idempotent on the second run');
  {
    const first = ensureDiagnosisProfileQuestions(seedLegacy());
    const second = ensureDiagnosisProfileQuestions(first.questions);
    assert(second.changed === false, 'second run should not change anything');
    assert(JSON.stringify(second.questions) === JSON.stringify(first.questions), 'second run must keep the same questions');
  }

  // Test 3: 管理画面で付け替えた設問文は上書きしない
  console.log('Test 3: custom free notes label is preserved');
  {
    const custom = seedLegacy().map((q) => (q.id === 'q_free_notes' ? { ...q, label: '独自の設問文' } : q));
    const result = ensureDiagnosisProfileQuestions(custom);
    assert(result.questions.find((q: any) => q.id === 'q_free_notes').label === '独自の設問文', 'custom label must stay');
  }

  // Test 4: 認知経路が無い定義では末尾に追加される
  console.log('Test 4: appended at the end when q_hear_about is absent');
  {
    const result = ensureDiagnosisProfileQuestions([{ id: 'q_ops_bottleneck', label: 'x', type: 'radio', required: true }]);
    const ids = result.questions.map((q: any) => q.id);
    assert(sameList(ids, ['q_ops_bottleneck', 'q_industry', 'q_employee_count']), `unexpected: ${ids.join(',')}`);
  }

  // Test 5: 入力配列を破壊しない／定数の選択肢を共有しない
  console.log('Test 5: does not mutate inputs or share option arrays');
  {
    const input = seedLegacy();
    const snapshot = JSON.stringify(input);
    const result = ensureDiagnosisProfileQuestions(input);
    assert(JSON.stringify(input) === snapshot, 'input must not be mutated');
    const added = result.questions.find((q: any) => q.id === 'q_industry');
    added.options.push('テスト');
    assert(
      !DIAGNOSIS_COMPANY_PROFILE_QUESTIONS[0].options.includes('テスト'),
      'constant options must not be shared with the output',
    );
  }

  // Test 6: HP・OS管理画面・サーバーの選択肢が一致している
  console.log('Test 6: HP / OS preset / server options stay in sync');
  {
    const serverIndustry = DIAGNOSIS_COMPANY_PROFILE_QUESTIONS.find((q) => q.id === 'q_industry')!.options as string[];
    const serverEmployee = DIAGNOSIS_COMPANY_PROFILE_QUESTIONS.find((q) => q.id === 'q_employee_count')!.options as string[];

    const hpSource = readFileSync(new URL('../hp/src/lib/supabase.ts', import.meta.url), 'utf-8');
    const hpIndustry = extractArrayLiteral(hpSource, 'export const MST_INDUSTRY_OPTIONS: string[] =');
    const hpEmployee = extractArrayLiteral(hpSource, 'export const MST_EMPLOYEE_COUNT_OPTIONS: string[] =');
    assert(sameList(hpIndustry, serverIndustry), 'HP industry options differ from server');
    assert(sameList(hpEmployee, serverEmployee), 'HP employee options differ from server');

    const wsSource = readFileSync(new URL('../src/components/DiagnosisFormsWorkspace.tsx', import.meta.url), 'utf-8');
    const wsIndustry = extractArrayLiteral(wsSource.slice(wsSource.indexOf("id: 'q_industry'")), 'options:');
    const wsEmployee = extractArrayLiteral(wsSource.slice(wsSource.indexOf("id: 'q_employee_count'")), 'options:');
    assert(sameList(wsIndustry, serverIndustry), 'OS preset industry options differ from server');
    assert(sameList(wsEmployee, serverEmployee), 'OS preset employee options differ from server');

    // 設問文（自由記述）もそろえる
    assert(hpSource.includes(DIAGNOSIS_FREE_NOTES_LABEL), 'HP free notes label differs from server');
    assert(wsSource.includes(DIAGNOSIS_FREE_NOTES_LABEL), 'OS preset free notes label differs from server');
  }

  console.log('\nAll diagnosis profile question tests passed.');
}

runTests().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
