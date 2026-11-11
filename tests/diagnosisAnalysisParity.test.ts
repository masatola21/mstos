import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// tests/diagnosisAnalysisParity.test.ts
// 診断・訴求テキスト整合性および禁止表現パリティ検査

const rootDir = process.cwd();

function extractUrgentActions(content: string): string[] {
  const matches = [...content.matchAll(/urgentAction:\s*['"`]([\s\S]*?)['"`]/g)];
  return matches.map((m) => m[1]);
}

describe('Diagnosis and Analysis Content Parity Tests', () => {
  // 1. 次のファイルに、下の語が含まれていないこと。
  // 対象: hp/src/pages/index.astro、hp/src/pages/services/strategy.astro、
  //       hp/src/pages/services/system.astro、hp/src/components/DiagnosisForm.tsx
  // 語: 「40h削減」「数十時間」「根絶」「ゼロ化」「ゼロにする」「手作業・二重転記ゼロ」
  //     「確実に」「大幅に増える」「最大化」「確立します」「検証済み」
  describe('1. 禁止表現が含まれていないことの検査', () => {
    const targetFiles = [
      'hp/src/pages/index.astro',
      'hp/src/pages/services/strategy.astro',
      'hp/src/pages/services/system.astro',
      'hp/src/components/DiagnosisForm.tsx',
    ];

    const prohibitedWords = [
      '40h削減',
      '数十時間',
      '根絶',
      'ゼロ化',
      'ゼロにする',
      '手作業・二重転記ゼロ',
      '確実に',
      '大幅に増える',
      '最大化',
      '確立します',
      '検証済み',
    ];

    for (const relPath of targetFiles) {
      it(`${relPath} に禁止語が含まれていないこと`, () => {
        const fullPath = path.resolve(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `対象ファイルが存在すること: ${relPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');

        const foundWords: string[] = [];
        for (const word of prohibitedWords) {
          if (content.includes(word)) {
            foundWords.push(word);
          }
        }

        assert.equal(
          foundWords.length,
          0,
          `${relPath} に禁止語が検出されました: [${foundWords.join(', ')}]`
        );
      });
    }
  });

  // 2. hp/src/lib/supabase.ts と src/components/PublicIntakeForm.tsx の
  // urgentAction の文字列に「真っ先に創出」「確実に定着」が含まれていないこと。
  // (supabase.ts のコードコメントに「確実に」があるため、ファイル全体ではなく
  // urgentAction の文字列に限って検査すること)
  describe('2. urgentAction 文字列の禁止表現検査', () => {
    const targets = [
      { name: 'HP (hp/src/lib/supabase.ts)', relPath: 'hp/src/lib/supabase.ts' },
      { name: 'OS (src/components/PublicIntakeForm.tsx)', relPath: 'src/components/PublicIntakeForm.tsx' },
    ];

    const prohibitedUrgentWords = ['真っ先に創出', '確実に定着'];

    for (const target of targets) {
      it(`${target.name} の urgentAction に「真っ先に創出」「確実に定着」が含まれていないこと`, () => {
        const fullPath = path.resolve(rootDir, target.relPath);
        assert.ok(fs.existsSync(fullPath), `対象ファイルが存在すること: ${target.relPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const actions = extractUrgentActions(content);

        assert.ok(actions.length > 0, `${target.relPath} から urgentAction が抽出できること`);

        const violations: string[] = [];
        for (const action of actions) {
          for (const word of prohibitedUrgentWords) {
            if (action.includes(word)) {
              violations.push(`語「${word}」を含む urgentAction: "${action}"`);
            }
          }
        }

        assert.equal(
          violations.length,
          0,
          `${target.name} の urgentAction に禁止語が見つかりました:\n${violations.join('\n')}`
        );
      });
    }
  });

  // 3. HP と OS の urgentAction が、4タイプとも同一文字列であること。
  describe('3. HP と OS の urgentAction 4タイプ完全一致検査', () => {
    it('HP と OS の urgentAction が、4タイプとも同一文字列であること', () => {
      const hpPath = path.resolve(rootDir, 'hp/src/lib/supabase.ts');
      const osPath = path.resolve(rootDir, 'src/components/PublicIntakeForm.tsx');

      assert.ok(fs.existsSync(hpPath), 'hp/src/lib/supabase.ts が存在すること');
      assert.ok(fs.existsSync(osPath), 'src/components/PublicIntakeForm.tsx が存在すること');

      const hpContent = fs.readFileSync(hpPath, 'utf-8');
      const osContent = fs.readFileSync(osPath, 'utf-8');

      const hpActions = extractUrgentActions(hpContent);
      const osActions = extractUrgentActions(osContent);

      assert.equal(hpActions.length, 4, `HP側の urgentAction は4タイプ定義されていること (実際: ${hpActions.length})`);
      assert.equal(osActions.length, 4, `OS側の urgentAction は4タイプ定義されていること (実際: ${osActions.length})`);

      for (let i = 0; i < 4; i++) {
        assert.equal(
          hpActions[i],
          osActions[i],
          `タイプ ${i + 1} の urgentAction が一致しません。\nHP: "${hpActions[i]}"\nOS: "${osActions[i]}"`
        );
      }
    });
  });
});
