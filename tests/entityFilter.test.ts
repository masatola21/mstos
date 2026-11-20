import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildEntityFilterOptions, matchesEntityFilter } from '../src/utils/entityFilter';

describe('Company & Contact Entity Filter Tests', () => {
  const sampleItems = [
    { companyName: '株式会社アルファ', personName: '佐藤 健太' },
    { companyName: '株式会社アルファ', personName: '佐藤 健太' },
    { companyName: '株式会社アルファ', personName: '鈴木 花子' },
    { companyName: ' 有限会社ベータ ', personName: '田中 一郎' },
    { companyName: null, personName: '高橋 次郎' },
    { companyName: 'フリーランス', personName: '山田 三郎' },
    { companyName: '個人事業主', personName: '伊藤 四郎' },
    { companyName: '未設定', personName: '高橋 次郎' },
    { companyName: '中村 五郎', personName: '中村 五郎' },
    { companyName: '合同会社ガンマ', personName: '連絡先不明' },
    { companyName: '', personName: null },
  ];

  it('builds a single flat sorted list with horizontal company / person labels and handles sole proprietors', () => {
    const options = buildEntityFilterOptions(sampleItems);
    const labels = options.map((o) => `${o.label} (${o.count})`);

    assert.ok(labels.includes('株式会社アルファ / 佐藤 健太 (2)'));
    assert.ok(labels.includes('株式会社アルファ / 鈴木 花子 (1)'));
    assert.ok(labels.includes('有限会社ベータ / 田中 一郎 (1)'));
    assert.ok(labels.includes('高橋 次郎（個人） (2)'));
    assert.ok(labels.includes('山田 三郎（個人） (1)'));
    assert.ok(labels.includes('伊藤 四郎（個人） (1)'));
    assert.ok(labels.includes('中村 五郎（個人） (1)'));
    assert.ok(labels.includes('合同会社ガンマ (1)'));
    assert.equal(options.length, 8);

    assert.deepEqual(
      options.map((o) => o.label).sort((a, b) => a.localeCompare(b, 'ja')),
      options.map((o) => o.label),
    );
  });

  it('matches all when filter is empty or all', () => {
    assert.equal(matchesEntityFilter('all', '株式会社アルファ', '佐藤 健太'), true);
    assert.equal(matchesEntityFilter('', null, null), true);
  });

  it('matches pair filter values accurately including individuals and trimmed whitespace', () => {
    const options = buildEntityFilterOptions(sampleItems);
    const alphaSato = options.find((o) => o.label === '株式会社アルファ / 佐藤 健太')!;
    const takahashi = options.find((o) => o.label === '高橋 次郎（個人）')!;
    const nakamura = options.find((o) => o.label === '中村 五郎（個人）')!;

    assert.equal(matchesEntityFilter(alphaSato.value, ' 株式会社アルファ ', '佐藤 健太'), true);
    assert.equal(matchesEntityFilter(alphaSato.value, '株式会社アルファ', '鈴木 花子'), false);
    assert.equal(matchesEntityFilter(takahashi.value, null, '高橋 次郎'), true);
    assert.equal(matchesEntityFilter(takahashi.value, '未設定', ' 高橋 次郎 '), true);
    assert.equal(matchesEntityFilter(takahashi.value, '有限会社ベータ', '高橋 次郎'), false);
    assert.equal(matchesEntityFilter(nakamura.value, '中村 五郎', '中村 五郎'), true);
  });

  it('retains compatibility with legacy company: and person: filters', () => {
    assert.equal(matchesEntityFilter('company:株式会社アルファ', ' 株式会社アルファ ', '佐藤 健太'), true);
    assert.equal(matchesEntityFilter('person:田中 一郎', '有限会社ベータ', ' 田中 一郎 '), true);
  });
});
