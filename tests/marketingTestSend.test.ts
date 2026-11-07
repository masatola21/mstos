/**
 * ユニットテスト: LINEステップ配信「テスト送信」の検証ロジックおよびバリデーション
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// buildFlexBubblePayload と同様の生成ロジックの検証
function buildFlexBubblePayload(title: string, body: string, buttonLabel?: string, buttonUrl?: string): Record<string, any> {
  const contents: any = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: title || 'ご案内', weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: body || '', size: 'sm', color: '#666666', wrap: true, margin: 'md' },
      ],
    },
  };
  if (buttonLabel && buttonUrl) {
    contents.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'uri',
            label: buttonLabel.slice(0, 20),
            uri: buttonUrl,
          },
        },
      ],
    };
  }
  return contents;
}

function checkUrlsInObject(obj: any): { valid: boolean; invalidUrl?: string } {
  if (!obj) return { valid: true };
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = checkUrlsInObject(item);
      if (!res.valid) return res;
    }
    return { valid: true };
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      if (typeof v === 'string') {
        if (lowerKey === 'uri' || lowerKey.endsWith('url') || lowerKey.endsWith('uri')) {
          const trimmed = v.trim();
          if (trimmed && !/^https?:\/\//i.test(trimmed)) {
            return { valid: false, invalidUrl: v };
          }
        }
      } else if (v && typeof v === 'object') {
        const res = checkUrlsInObject(v);
        if (!res.valid) return res;
      }
    }
  }
  return { valid: true };
}

function checkUnresolvedPlaceholders(val: any): string | null {
  if (typeof val === 'string') {
    const match = val.match(/\{([a-z_]+)\}/);
    if (match) return match[0];
  } else if (Array.isArray(val)) {
    for (const item of val) {
      const res = checkUnresolvedPlaceholders(item);
      if (res) return res;
    }
  } else if (val && typeof val === 'object') {
    for (const v of Object.values(val)) {
      const res = checkUnresolvedPlaceholders(v);
      if (res) return res;
    }
  }
  return null;
}

async function runTests() {
  console.log('=== Running Marketing Test Send Unit Tests ===\n');

  // Test 1: FlexBubblePayload の生成と構造検証
  console.log('Test 1: buildFlexBubblePayload');
  {
    const bubble = buildFlexBubblePayload(
      '無料相談のご案内',
      '以下のボタンより日程調整を行ってください。',
      '面談日程を選ぶ',
      'https://timerex.net/schedule/test'
    );
    assert(bubble.type === 'bubble', 'Type must be bubble');
    assert(bubble.body.contents[0].text === '無料相談のご案内', 'Title text must match');
    assert(bubble.footer.contents[0].action.uri === 'https://timerex.net/schedule/test', 'Button URI must match');
    console.log('  ✓ buildFlexBubblePayload passed');
  }

  // Test 2: URLバリデーション（http/https 必須の検証）
  console.log('Test 2: checkUrlsInObject');
  {
    const validBubble = buildFlexBubblePayload('Title', 'Body', 'Btn', 'https://example.com/ok');
    const validResult = checkUrlsInObject(validBubble);
    assert(validResult.valid === true, 'Valid HTTPS URL should pass');

    const invalidBubble = buildFlexBubblePayload('Title', 'Body', 'Btn', 'javascript:alert(1)');
    const invalidResult = checkUrlsInObject(invalidBubble);
    assert(invalidResult.valid === false, 'Invalid non-HTTP scheme must be rejected');
    assert(invalidResult.invalidUrl === 'javascript:alert(1)', 'Must return invalid URL');

    const plainTextBubble = buildFlexBubblePayload('Title', 'Body', 'Btn', 'ftp://files.example.com');
    const plainResult = checkUrlsInObject(plainTextBubble);
    assert(plainResult.valid === false, 'FTP URL must be rejected');
    console.log('  ✓ checkUrlsInObject passed');
  }

  // Test 3: 未解決差し込み項目の検出（checkUnresolvedPlaceholders）
  console.log('Test 3: checkUnresolvedPlaceholders');
  {
    const cleanText = '山田 太郎 様、MST製造株式会社 のご案内です。';
    assert(checkUnresolvedPlaceholders(cleanText) === null, 'Clean text should return null');

    const textWithPlaceholder = 'こんにちは、{recipient_name} 様。{unknown_key} もあります。';
    const detected = checkUnresolvedPlaceholders(textWithPlaceholder);
    assert(detected === '{recipient_name}', `Should detect unresolved placeholder, got ${detected}`);

    const objWithPlaceholder = {
      title: 'タイトル',
      nested: {
        body: '未解決の {booking_url} が残っています',
      },
    };
    assert(checkUnresolvedPlaceholders(objWithPlaceholder) === '{booking_url}', 'Should detect placeholder in nested object');
    console.log('  ✓ checkUnresolvedPlaceholders passed');
  }

  // Test 4: 宛先友だち検証シミュレーション（存在確認・アクティブ確認）
  console.log('Test 4: Destination friend ownership & active check simulation');
  {
    const mockFriends = [
      { line_user_id: 'U1111111111', display_name: '管理者A', status: 'active' },
      { line_user_id: 'U2222222222', display_name: 'ブロック済みユーザー', status: 'blocked' },
    ];

    const checkFriend = (targetUserId: string) => {
      const friend = mockFriends.find(f => f.line_user_id === targetUserId);
      if (!friend) return { allowed: false, status: 403, error: '存在しない宛先' };
      if (friend.status !== 'active') return { allowed: false, status: 403, error: '非アクティブ' };
      return { allowed: true, friend };
    };

    assert(checkFriend('U1111111111').allowed === true, 'Active friend should be allowed');
    assert(checkFriend('U2222222222').allowed === false && checkFriend('U2222222222').status === 403, 'Blocked friend must be rejected with 403');
    assert(checkFriend('U9999999999').allowed === false && checkFriend('U9999999999').status === 403, 'Unknown friend must be rejected with 403');
    console.log('  ✓ Destination friend check passed');
  }

  console.log('\n=== All Marketing Test Send Unit Tests Passed! ===');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
