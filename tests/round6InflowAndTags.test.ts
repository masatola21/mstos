/**
 * ユニットテスト: ラウンド6「UTM正規化・流入タグ自動付与・追跡リンク簡素化」
 * - UTM正規化関数 (normalizeUtmParams) の各種エッジケース検証
 * - 流入ラベル対応表 (getInflowLabel) の検証
 * - 追跡媒体リストのマイグレーション (migrateTrackingMediaList)
 * - 媒体プリセット5件の構成検証
 * - タグマスターの流入タグ定義
 */

import { normalizeUtmParams, getInflowLabel, INFLOW_SOURCE_LABELS } from '../server.js';
import { migrateTrackingMediaList, ROUND6_DEFAULT_PRESET_IDS } from '../src/utils/marketingStorage.js';
import { TRACKING_MEDIA_PRESETS } from '../src/components/marketing/MarketingQuickLinksHub.js';
import { UNIFIED_TAG_MASTER } from '../src/constants/tagMaster.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running Round 6 Inflow & Tags Unit Tests ===\n');

  // Test 1: UTM正規化 - utm_source の優先とサニタイズ
  console.log('Test 1: normalizeUtmParams basic & priority');
  {
    // utm_source 優先
    const res1 = normalizeUtmParams({ utm_source: 'sns', source: 'corporate_website' });
    assert(res1.source === 'sns', `Expected 'sns', got '${res1.source}'`);

    // 大文字混じり・記号混じりのサニタイズ (英数字・アンダースコア・ハイフンのみ、小文字化)
    const res2 = normalizeUtmParams({ utm_source: '  SNS_Campaign-2026!@#$  ' });
    assert(res2.source === 'sns_campaign-2026', `Expected 'sns_campaign-2026', got '${res2.source}'`);

    // 40文字制限
    const longSource = 'a'.repeat(60);
    const res3 = normalizeUtmParams({ utm_source: longSource });
    assert(res3.source.length === 40, `Expected 40 chars max, got ${res3.source.length}`);
    assert(res3.source === 'a'.repeat(40), 'Should truncate to 40 characters');

    // utm_source が無く source がある場合
    const res4 = normalizeUtmParams({ source: 'email' });
    assert(res4.source === 'email', `Expected 'email', got '${res4.source}'`);

    // 空オブジェクト・null
    const resEmpty = normalizeUtmParams(null);
    assert(resEmpty.source === '', 'Null input should return empty source');
    console.log('  ✓ normalizeUtmParams basic & priority passed');
  }

  // Test 2: UTM正規化 - 特殊値の扱い (corporate_website と line_broadcast)
  console.log('Test 2: normalizeUtmParams special source rules');
  {
    // source = 'corporate_website' は「HP直接」として流入元なし (空文字)
    const hpDirect1 = normalizeUtmParams({ source: 'corporate_website' });
    assert(hpDirect1.source === '', `corporate_website source should become empty, got '${hpDirect1.source}'`);

    const hpDirect2 = normalizeUtmParams({ utm_source: 'corporate_website' });
    assert(hpDirect2.source === '', `corporate_website utm_source should become empty, got '${hpDirect2.source}'`);

    // line_broadcast は line に正規化（互換性担保）
    const lineCompat = normalizeUtmParams({ utm_source: 'line_broadcast' });
    assert(lineCompat.source === 'line', `line_broadcast should be normalized to line, got '${lineCompat.source}'`);
    console.log('  ✓ normalizeUtmParams special source rules passed');
  }

  // Test 3: 流入ラベル対応表 (getInflowLabel)
  console.log('Test 3: getInflowLabel mapping');
  {
    assert(getInflowLabel('sns') === 'SNS', 'sns -> SNS');
    assert(getInflowLabel('hp_blog') === 'HPブログ', 'hp_blog -> HPブログ');
    assert(getInflowLabel('line') === 'LINE', 'line -> LINE');
    assert(getInflowLabel('email') === 'メール', 'email -> メール');
    assert(getInflowLabel('material') === '資料', 'material -> 資料');
    assert(getInflowLabel('instagram') === 'Instagram', 'instagram -> Instagram');
    assert(getInflowLabel('threads') === 'Threads', 'threads -> Threads');
    assert(getInflowLabel('facebook') === 'Facebook', 'facebook -> Facebook');
    assert(getInflowLabel('linkedin') === 'LinkedIn', 'linkedin -> LinkedIn');
    assert(getInflowLabel('x') === 'X', 'x -> X');

    // 未知の値はそのまま表示
    assert(getInflowLabel('external_pr_2026') === 'external_pr_2026', 'Unknown key returned as-is');
    console.log('  ✓ getInflowLabel mapping passed');
  }

  // Test 4: 媒体プリセット 5件の構成検証
  console.log('Test 4: TRACKING_MEDIA_PRESETS count & IDs');
  {
    assert(TRACKING_MEDIA_PRESETS.length === 5, `Must have exactly 5 presets, got ${TRACKING_MEDIA_PRESETS.length}`);
    const presetIds = TRACKING_MEDIA_PRESETS.map((p) => p.id);
    const expectedIds = ['hp_blog', 'sns', 'line', 'email', 'material'];
    assert(
      JSON.stringify(presetIds) === JSON.stringify(expectedIds),
      `Preset IDs must match expected 5 IDs. Got: ${JSON.stringify(presetIds)}`
    );
    console.log('  ✓ TRACKING_MEDIA_PRESETS count & IDs passed');
  }

  // Test 5: 媒体リストのマイグレーション (migrateTrackingMediaList)
  console.log('Test 5: migrateTrackingMediaList');
  {
    const oldStoredList = [
      { id: 'note', name: 'note', utmSource: 'note' },
      { id: 'x_twitter', name: 'X / Twitter', utmSource: 'x_twitter' },
      { id: 'line_broadcast', name: 'LINE公式アカウント配信', utmSource: 'line_broadcast' },
      { id: 'custom_seminar', name: '自社セミナー案内', utmSource: 'seminar', isCustom: true },
    ];

    const migrated = migrateTrackingMediaList(oldStoredList, TRACKING_MEDIA_PRESETS);

    // 旧デフォルト群が新5プリセットに置き換わり、isCustom は維持される
    assert(migrated.length === 6, `Migrated should have 5 defaults + 1 custom = 6, got ${migrated.length}`);
    const ids = migrated.map((m) => m.id);
    assert(ids.includes('hp_blog'), 'Should include hp_blog');
    assert(ids.includes('sns'), 'Should include sns');
    assert(ids.includes('line'), 'Should include line');
    assert(ids.includes('email'), 'Should include email');
    assert(ids.includes('material'), 'Should include material');
    assert(ids.includes('custom_seminar'), 'Should retain custom item');

    // line_broadcast 単体のリネーム確認
    const singleLineBroadcast = [{ id: 'line_broadcast', name: 'LINE公式', utmSource: 'line_broadcast' }];
    const migratedSingle = migrateTrackingMediaList(singleLineBroadcast);
    assert(migratedSingle[0].id === 'line', 'line_broadcast id should become line');
    assert(migratedSingle[0].utmSource === 'line', 'line_broadcast utmSource should become line');
    console.log('  ✓ migrateTrackingMediaList passed');
  }

  // Test 6: タグマスターの inflow 定義検証
  console.log('Test 6: UNIFIED_TAG_MASTER inflow definitions');
  {
    const inflowTags = UNIFIED_TAG_MASTER.filter((t) => t.category === 'inflow');
    assert(inflowTags.length >= 8, `Should have at least 8 inflow tags, found ${inflowTags.length}`);
    const snsTag = inflowTags.find((t) => t.name === '流入:SNS');
    assert(!!snsTag, '流入:SNS tag must exist');
    assert(snsTag!.description.includes('自動付与'), '流入:SNS description must note automatic assignment');

    const bookingTag = UNIFIED_TAG_MASTER.find((t) => t.name === '個別相談予約済み');
    assert(!!bookingTag, '個別相談予約済み tag must exist');
    assert(
      bookingTag!.description.includes('手動') || bookingTag!.description.includes('手動付与'),
      '個別相談予約済み description must explicitly state manual assignment'
    );
    console.log('  ✓ UNIFIED_TAG_MASTER inflow definitions passed');
  }

  console.log('\n=== All Round 6 Inflow & Tags Unit Tests Passed! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
