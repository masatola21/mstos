/**
 * ユニットテスト: ラウンド5「SNS運用の整理（作成・承認・書き出しに絞る）」
 * - SSRF対策バリデーション (Webhook URL)
 * - UTMトラッキングURL生成
 * - CSV書き出しフォーマット
 * - DM営業メモのタスク連携データ構造
 * - 受信トレイのフォールバック動作
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 1. SSRF安全チェックロジック (server.ts の isSafePublicHttpsUrl と同一仕様)
function isSafePublicHttpsUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();

    // Loopback / localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    // Private IPv4 ranges
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    // Link-local / Cloud metadata (AWS, GCP, Azure 169.254.169.254)
    if (hostname.startsWith('169.254.') || hostname.includes('metadata.google.internal')) {
      return false;
    }
    // IPv6 link-local or loopback brackets
    if (hostname.startsWith('[fe80:') || hostname.startsWith('[::1]')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 2. UTMリンク生成ロジック
function buildUtmLink(destUrl: string, platformKey: string, campaignSlug: string = 'sns'): string {
  if (!destUrl) return '';
  try {
    const url = new URL(destUrl);
    url.searchParams.set('utm_source', platformKey);
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', campaignSlug || 'sns');
    return url.toString();
  } catch {
    const sep = destUrl.includes('?') ? '&' : '?';
    return `${destUrl}${sep}utm_source=${encodeURIComponent(platformKey)}&utm_medium=social&utm_campaign=${encodeURIComponent(campaignSlug || 'sns')}`;
  }
}

// 3. CSVフォーマット生成
interface SocialPostCsvRow {
  scheduledAt: string;
  platform: string;
  body: string;
  hashtags: string[];
  imageUrl: string;
  link: string;
}

function generateSocialPostsCsv(rows: SocialPostCsvRow[]): string {
  const headers = ['投稿予定日時', 'プラットフォーム', '本文', 'ハッシュタグ', '画像URL', 'リンク'];
  const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(r =>
      [
        escapeCell(r.scheduledAt),
        escapeCell(r.platform),
        escapeCell(r.body),
        escapeCell(r.hashtags.join(' ')),
        escapeCell(r.imageUrl),
        escapeCell(r.link),
      ].join(',')
    ),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

// 4. DM営業メモの次アクション日タスク生成ロジック
function createDmActionTask(dm: {
  id: string;
  contactName: string;
  platform: string;
  nextActionDate: string;
  content: string;
  status: string;
}) {
  return {
    id: `dm-task-${dm.id}`,
    title: `【DMフォロー】${dm.contactName}様（${dm.platform}）`,
    description: `ステータス: ${dm.status}\n最終内容: ${dm.content.slice(0, 80)}`,
    status: 'todo',
    priority: 'medium',
    dueDate: dm.nextActionDate,
    projectId: '',
    completionCriteria: '相手への返信またはフォロー記録の完了',
    workArea: 'sales_customer',
    sourceCategory: 'sales_customer',
  };
}

// 5. 受信トレイのチャンネルフォールバックロジック
function resolveInboxChannel(storedChannel: string | null): 'line' | 'email' | 'forms' {
  if (storedChannel === 'line' || storedChannel === 'email' || storedChannel === 'forms') {
    return storedChannel;
  }
  return 'line'; // social_dm や未知の値は line に安全にフォールバック
}

async function runTests() {
  console.log('=== Running Round 5 SNS Operations Unit Tests ===\n');

  // Test 1: SSRF Validation
  console.log('Test 1: SSRF Webhook Validation');
  {
    // Valid public webhooks
    assert(isSafePublicHttpsUrl('https://hooks.zapier.com/hooks/catch/123/abc') === true, 'Zapier HTTPS should pass');
    assert(isSafePublicHttpsUrl('https://hook.eu1.make.com/xyz123') === true, 'Make HTTPS should pass');
    assert(isSafePublicHttpsUrl('https://api.bufferapp.com/1/updates/create.json') === true, 'Buffer HTTPS should pass');

    // Insecure HTTP
    assert(isSafePublicHttpsUrl('http://hooks.zapier.com/webhook') === false, 'HTTP must be rejected');
    assert(isSafePublicHttpsUrl('ftp://example.com/webhook') === false, 'Non-HTTP must be rejected');

    // Localhost / Loopback
    assert(isSafePublicHttpsUrl('https://localhost/webhook') === false, 'localhost must be rejected');
    assert(isSafePublicHttpsUrl('https://127.0.0.1:8080/webhook') === false, '127.0.0.1 must be rejected');
    assert(isSafePublicHttpsUrl('https://::1/webhook') === false, '::1 must be rejected');

    // Private IPv4
    assert(isSafePublicHttpsUrl('https://10.0.1.50/webhook') === false, '10.x.x.x must be rejected');
    assert(isSafePublicHttpsUrl('https://192.168.1.10/webhook') === false, '192.168.x.x must be rejected');
    assert(isSafePublicHttpsUrl('https://172.20.0.1/webhook') === false, '172.16-31.x.x must be rejected');

    // Cloud Metadata
    assert(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data') === false, '169.254.169.254 must be rejected');
    assert(isSafePublicHttpsUrl('https://metadata.google.internal/computeMetadata/v1') === false, 'metadata.google.internal must be rejected');

    // Malformed
    assert(isSafePublicHttpsUrl('not-a-valid-url') === false, 'Malformed URL must be rejected');
    console.log('  ✓ SSRF Webhook Validation passed');
  }

  // Test 2: UTM tracking URL generation
  console.log('Test 2: UTM Link Generation');
  {
    const linkThreads = buildUtmLink('https://example.com/diagnosis', 'threads', 'dx_campaign');
    assert(linkThreads.includes('utm_source=threads'), 'Must include utm_source=threads');
    assert(linkThreads.includes('utm_medium=social'), 'Must include utm_medium=social');
    assert(linkThreads.includes('utm_campaign=dx_campaign'), 'Must include utm_campaign=dx_campaign');

    const linkX = buildUtmLink('https://example.com/page?ref=nav', 'x');
    assert(linkX.includes('ref=nav'), 'Must preserve existing query parameters');
    assert(linkX.includes('utm_source=x'), 'Must add utm_source=x');
    assert(linkX.includes('utm_medium=social'), 'Must add utm_medium=social');
    console.log('  ✓ UTM Link Generation passed');
  }

  // Test 3: CSV formatting
  console.log('Test 3: CSV Formatting');
  {
    const rows: SocialPostCsvRow[] = [
      {
        scheduledAt: '2026-11-15 10:00',
        platform: 'Threads',
        body: '業務自動化の最新事例です。\n詳しくはこちら。',
        hashtags: ['#業務改善', '#DX推進'],
        imageUrl: 'https://example.com/asset.jpg',
        link: 'https://example.com/care-package?utm_source=threads&utm_medium=social',
      },
    ];

    const csv = generateSocialPostsCsv(rows);
    assert(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Excel compatibility');
    assert(csv.includes('"投稿予定日時","プラットフォーム","本文","ハッシュタグ","画像URL","リンク"'), 'Headers must match required format');
    assert(csv.includes('"Threads"'), 'Platform must be quoted');
    assert(csv.includes('"#業務改善 #DX推進"'), 'Hashtags must be space-separated and quoted');
    assert(csv.includes('業務自動化の最新事例です。\n詳しくはこちら。'), 'Newlines in body must be preserved inside quotes');
    console.log('  ✓ CSV Formatting passed');
  }

  // Test 4: DM Action Task Creation
  console.log('Test 4: DM Action Task Creation');
  {
    const task = createDmActionTask({
      id: 'dm-123',
      contactName: '佐藤 一郎',
      platform: 'LinkedIn',
      nextActionDate: '2026-11-12',
      content: 'ご挨拶のDMをお送りしました。',
      status: 'replied',
    });

    assert(task.id === 'dm-task-dm-123', 'Task ID should follow prefix convention');
    assert(task.title === '【DMフォロー】佐藤 一郎様（LinkedIn）', 'Task title must contain recipient and platform');
    assert(task.dueDate === '2026-11-12', 'Task dueDate must match nextActionDate');
    assert(task.workArea === 'sales_customer', 'Task workArea must be sales_customer');
    assert(task.sourceCategory === 'sales_customer', 'Task sourceCategory must be sales_customer');
    assert(task.priority === 'medium', 'Task priority must be medium');
    console.log('  ✓ DM Action Task Creation passed');
  }

  // Test 5: Inbox Channel Fallback
  console.log('Test 5: Inbox Channel Fallback');
  {
    assert(resolveInboxChannel('line') === 'line', 'line channel should be kept');
    assert(resolveInboxChannel('email') === 'email', 'email channel should be kept');
    assert(resolveInboxChannel('forms') === 'forms', 'forms channel should be kept');
    assert(resolveInboxChannel('social_dm') === 'line', 'social_dm must fall back to line');
    assert(resolveInboxChannel('unknown_channel') === 'line', 'Unknown channel must fall back to line');
    assert(resolveInboxChannel(null) === 'line', 'Null must fall back to line');
    console.log('  ✓ Inbox Channel Fallback passed');
  }

  console.log('\n=== All Round 5 SNS Operations Unit Tests Passed! ===');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
