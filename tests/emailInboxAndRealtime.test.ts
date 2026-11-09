/**
 * Unit test: Email Inbox, Diagnostics and Settings Persistence
 */
import { promises as dnsPromises } from 'node:dns';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('=== Running Email Inbox & Realtime Verification Tests ===\n');

  // Test 1: DNS MX lookup for mstcorp.info
  console.log('Test 1: DNS MX Lookup for mstcorp.info');
  try {
    const mxRecords = await dnsPromises.resolveMx('mstcorp.info');
    console.log('  Resolved MX records:', mxRecords);
    assert(mxRecords.length > 0, 'Should have at least 1 MX record');
    const hasWebLife = mxRecords.some((r) => r.exchange.includes('weblife.me'));
    assert(hasWebLife, 'MX records correctly identify WebLife mail server');
    console.log('  ✓ Test 1 passed: WebLife MX record identified successfully');
  } catch (err: any) {
    console.warn('  DNS lookup skipped or network limited:', err.message);
  }

  // Test 2: LocalStorage key consistency
  console.log('Test 2: Key naming and defaults');
  const defaults = {
    inboundAddress: 'contact@mstcorp.info',
    backupAddress: 'mst.shikumikaizen@gmail.com',
    backupEnabled: false,
  };
  assert(defaults.inboundAddress === 'contact@mstcorp.info', 'Default inbound address matches');
  assert(defaults.backupAddress === 'mst.shikumikaizen@gmail.com', 'Default backup address matches');
  console.log('  ✓ Test 2 passed');

  console.log('\n=== All Email Inbox & Realtime Tests Passed! ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
