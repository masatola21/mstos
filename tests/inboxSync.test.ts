/**
 * Unit test: inbox sync helpers (差分判定・追加・削除)
 * 目的: 内容が変わらないとき「同じ配列参照」を返し、React の無駄な再描画を防げていることを確認する。
 */
import {
  isSameMessageList,
  newestReceivedAt,
  removeMessages,
  replaceMessagesIfChanged,
  sortByReceivedAtDesc,
  upsertMessages,
} from '../src/utils/inboxSync';

type Msg = { id: string; received_at: string; status: string };
const KEYS = ['status'] as const;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

const m = (id: string, receivedAt: string, status = 'received'): Msg => ({ id, received_at: receivedAt, status });

function run() {
  console.log('=== Running Inbox Sync Helper Tests ===\n');

  const a = m('a', '2026-11-10T01:00:00Z');
  const b = m('b', '2026-11-10T02:00:00Z');
  const c = m('c', '2026-11-10T03:00:00Z');

  // Test 1: sort
  console.log('Test 1: sortByReceivedAtDesc');
  const sorted = sortByReceivedAtDesc([a, c, b]);
  assert(sorted.map((x) => x.id).join('') === 'cba', 'sorted newest first');
  assert(sortByReceivedAtDesc([m('x', 'invalid'), a]).map((x) => x.id).join('') === 'ax', 'invalid dates go last');
  console.log('  ✓ passed');

  // Test 2: isSameMessageList
  console.log('Test 2: isSameMessageList');
  const list = [c, b, a];
  assert(isSameMessageList(list, list, KEYS), 'same reference is same');
  assert(isSameMessageList(list, [c, b, a], KEYS), 'same content is same');
  assert(!isSameMessageList(list, [c, b], KEYS), 'different length differs');
  assert(!isSameMessageList(list, [b, c, a], KEYS), 'different order differs');
  assert(!isSameMessageList(list, [c, b, m('a', a.received_at, 'replied')], KEYS), 'changed key differs');
  assert(isSameMessageList(list, [c, b, { ...a, received_at: 'other' }], KEYS), 'untracked key change is ignored');
  console.log('  ✓ passed');

  // Test 3: upsertMessages keeps reference when nothing changed
  console.log('Test 3: upsertMessages');
  const base = [c, b, a];
  assert(upsertMessages(base, [], KEYS) === base, 'empty incoming returns prev');
  assert(upsertMessages(base, [{ ...b }], KEYS) === base, 'identical row returns prev (no re-render)');
  const added = upsertMessages(base, [m('d', '2026-11-10T04:00:00Z')], KEYS);
  assert(added !== base && added.map((x) => x.id).join('') === 'dcba', 'new row is added on top');
  const updated = upsertMessages(base, [m('b', b.received_at, 'replied')], KEYS);
  assert(updated.length === 3 && updated.find((x) => x.id === 'b')?.status === 'replied', 'existing row is replaced');
  const trimmed = upsertMessages(base, [m('d', '2026-11-10T04:00:00Z')], KEYS, 3);
  assert(trimmed.length === 3 && trimmed.map((x) => x.id).join('') === 'dcb', 'limit drops the oldest');
  console.log('  ✓ passed');

  // Test 4: removeMessages
  console.log('Test 4: removeMessages');
  assert(removeMessages(base, []) === base, 'no ids returns prev');
  assert(removeMessages(base, ['zzz']) === base, 'unknown id returns prev');
  assert(removeMessages(base, ['b']).map((x) => x.id).join('') === 'ca', 'id is removed');
  console.log('  ✓ passed');

  // Test 5: replaceMessagesIfChanged
  console.log('Test 5: replaceMessagesIfChanged');
  assert(replaceMessagesIfChanged(base, [c, b, a], KEYS) === base, 'same content keeps prev reference');
  const replacement = [c, b];
  assert(replaceMessagesIfChanged(base, replacement, KEYS) === replacement, 'changed content uses next');
  console.log('  ✓ passed');

  // Test 6: newestReceivedAt
  console.log('Test 6: newestReceivedAt');
  assert(newestReceivedAt([]) === null, 'empty list returns null');
  assert(newestReceivedAt([a, c, b]) === c.received_at, 'returns the newest regardless of order');
  assert(newestReceivedAt([m('x', 'invalid'), a]) === a.received_at, 'invalid dates are ignored');
  console.log('  ✓ passed');

  console.log('\n=== All Inbox Sync Helper Tests Passed! ===');
}

run();
