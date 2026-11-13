import assert from 'node:assert/strict';
import {
  RICH_MENU_WIDTH,
  RICH_MENU_HEIGHT,
  RICH_MENU_LAYOUTS,
  DEFAULT_MST_HP_URL,
  DEFAULT_MST_DIAGNOSIS_URL,
  DEFAULT_MST_BOOKING_URL,
  DEFAULT_MST_CARE_LP_URL,
  getRichMenuLayoutConfig,
  getRichMenuLayoutAreas,
  getRichMenuCellStylePercent,
  createMstRecommendedRichMenuPreset,
} from '../src/utils/lineRichMenuLayouts';

console.log('=== Running LINE Rich Menu Layouts & MST Preset Tests ===');

// Test 1: Every layout covers 2500 x 1686 exactly with zero overlaps
for (const layout of RICH_MENU_LAYOUTS) {
  const config = getRichMenuLayoutConfig(layout.id);
  assert.ok(config, `Layout ${layout.id} should resolve`);
  const areas = getRichMenuLayoutAreas(layout.id);
  assert.equal(areas.length, layout.cellCount, `${layout.id} area count mismatch`);

  let totalArea = 0;
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    assert.ok(a.x >= 0 && a.y >= 0, `${layout.id}[${i}] origin must be >= 0`);
    assert.ok(a.width > 0 && a.height > 0, `${layout.id}[${i}] size must be > 0`);
    assert.ok(a.x + a.width <= RICH_MENU_WIDTH, `${layout.id}[${i}] exceeds width`);
    assert.ok(a.y + a.height <= RICH_MENU_HEIGHT, `${layout.id}[${i}] exceeds height`);
    totalArea += a.width * a.height;

    for (let j = i + 1; j < areas.length; j++) {
      const b = areas[j];
      const overlaps =
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      assert.equal(overlaps, false, `${layout.id}[${i}] and [${j}] must not overlap`);
    }
  }
  assert.equal(
    totalArea,
    RICH_MENU_WIDTH * RICH_MENU_HEIGHT,
    `${layout.id} total covered area must equal ${RICH_MENU_WIDTH * RICH_MENU_HEIGHT}`
  );
}
console.log('  ✓ All 10 layouts cover 2500x1686 cleanly without gaps or overlaps');

// Test 2: Exact dimensions for 5-split (上2:1・下3)
const split213 = getRichMenuLayoutAreas('split-2-1-3');
assert.deepEqual(split213[0], { x: 0, y: 0, width: 1667, height: 843 });
assert.deepEqual(split213[1], { x: 1667, y: 0, width: 833, height: 843 });
assert.deepEqual(split213[2], { x: 0, y: 843, width: 833, height: 843 });
assert.deepEqual(split213[3], { x: 833, y: 843, width: 834, height: 843 });
assert.deepEqual(split213[4], { x: 1667, y: 843, width: 833, height: 843 });
console.log('  ✓ split-2-1-3 matches exact 1667x843 hero + 833x843 grid bounds');

// Test 3: Exact dimensions for 5-split (上2・下3 均等)
const split23 = getRichMenuLayoutAreas('split-2-3');
assert.deepEqual(split23[0], { x: 0, y: 0, width: 1250, height: 843 });
assert.deepEqual(split23[1], { x: 1250, y: 0, width: 1250, height: 843 });
assert.deepEqual(split23[2], { x: 0, y: 843, width: 833, height: 843 });
assert.deepEqual(split23[3], { x: 833, y: 843, width: 834, height: 843 });
assert.deepEqual(split23[4], { x: 1667, y: 843, width: 833, height: 843 });
console.log('  ✓ split-2-3 matches exact 1250x843 top + 833x843 bottom bounds');

// Test 4: Percentage helper & MST preset URLs / label limits
const heroPercent = getRichMenuCellStylePercent(split213[0]);
assert.equal(heroPercent.left, '0%');
assert.equal(heroPercent.top, '0%');
assert.equal(heroPercent.height, '50%');

const preset = createMstRecommendedRichMenuPreset();
assert.equal(preset.layout, 'split-2-1-3');
assert.equal(preset.actions.length, 5);
assert.equal(preset.actions[0].type, 'uri');
assert.equal(preset.actions[0].value, DEFAULT_MST_DIAGNOSIS_URL);
assert.equal(preset.actions[1].type, 'uri');
assert.equal(preset.actions[1].value, DEFAULT_MST_BOOKING_URL);
assert.equal(preset.actions[2].type, 'uri');
assert.equal(preset.actions[2].value, DEFAULT_MST_CARE_LP_URL);
assert.equal(preset.actions[3].type, 'uri');
assert.equal(preset.actions[3].value, DEFAULT_MST_HP_URL);
assert.equal(preset.actions[4].type, 'message');
assert.equal(preset.actions[4].value, '【LINEで相談したい】');
for (const action of preset.actions) {
  assert.ok(action.label.length > 0 && action.label.length <= 20, `Label length invalid: ${action.label}`);
}
console.log('  ✓ MST recommended 5-split preset URLs, message trigger, and labels verified');
console.log('=== All LINE Rich Menu Layouts & MST Preset Tests Passed! ===');
