import assert from 'node:assert';
import {
  isTimeRexEmail,
  parseTimeRexEmail,
  parseTimeRexCalendarEvent,
  syncTimeRexBookingToCrm,
  type TimeRexBookingInfo,
} from '../server/timerexSyncService.js';

console.log('=== Running Round 2-8-7 TimeRex Pattern A Sync Tests ===\n');

// Test 1: isTimeRexEmail detection
console.log('Test 1: isTimeRexEmail');
assert(
  isTimeRexEmail('no-reply@timerex.net', '【TimeRex】日程調整が完了しました', '大橋様 予定が確定しました'),
  'Should detect official TimeRex email'
);
assert(
  isTimeRexEmail('mst.shikumikaizen@gmail.com', 'Fwd: 【TimeRex】[30分面談] 山田太郎 様', 'TimeRexで予定が確定しました。ゲスト: yamada@test.com'),
  'Should detect forwarded TimeRex email'
);
assert(
  !isTimeRexEmail('client@example.com', 'お見積書の件について', 'お世話になっております。見積もりをお願いします。'),
  'Should not false-positive on regular client email'
);
console.log('  ✓ isTimeRexEmail passed');

// Test 2: parseTimeRexEmail parsing
console.log('Test 2: parseTimeRexEmail');
const sampleEmailBody = `
大橋真人 様

TimeRexをご利用いただきありがとうございます。
以下の日程で予定が確定しました。

■ 予定
【30分】無料個別相談

■ 日時
2026年11月20日(金) 14:00 - 14:30

■ ゲスト
氏名: 山田 太郎
メールアドレス: yamada.taro@example.co.jp
会社名: 株式会社山田実業
電話番号: 090-1234-5678

■ Web会議
Google Meet: https://meet.google.com/abc-defg-hij

■ コメント
経営効率化とITツールの導入について相談したいです。
`;

const parsed = parseTimeRexEmail('【TimeRex】日程調整が完了しました', sampleEmailBody);
assert(parsed !== null, 'Email should be parsed successfully');
assert.strictEqual(parsed.guestName, '山田 太郎');
assert.strictEqual(parsed.guestEmail, 'yamada.taro@example.co.jp');
assert.strictEqual(parsed.meetingDate, '2026-11-20');
assert.strictEqual(parsed.meetingStartTime, '14:00');
assert.strictEqual(parsed.meetingEndTime, '14:30');
assert.strictEqual(parsed.companyName, '株式会社山田実業');
assert.strictEqual(parsed.phone, '090-1234-5678');
assert.strictEqual(parsed.meetUrl, 'https://meet.google.com/abc-defg-hij');
assert.strictEqual(parsed.eventName, '【30分】無料個別相談');
assert.ok(parsed.memo?.includes('経営効率化'), 'Memo should contain comment');
console.log('  ✓ parseTimeRexEmail passed');

// Test 3: parseTimeRexCalendarEvent parsing
console.log('Test 3: parseTimeRexCalendarEvent');
const sampleCalEvent = {
  title: '【TimeRex】佐藤花子 様',
  date: '2026-11-22',
  startTime: '10:00',
  endTime: '10:30',
  meetUrl: 'https://meet.google.com/xyz-uvwx-rst',
  notes: 'ゲスト: 佐藤 花子 (sato.hanako@example.com)\nコメント: 介護保険外サービスの開業について',
};

const calParsed = parseTimeRexCalendarEvent(sampleCalEvent);
assert(calParsed !== null, 'Calendar event should be parsed successfully');
assert.strictEqual(calParsed.guestName, '佐藤花子');
assert.strictEqual(calParsed.guestEmail, 'sato.hanako@example.com');
assert.strictEqual(calParsed.meetingDate, '2026-11-22');
assert.strictEqual(calParsed.meetingStartTime, '10:00');
assert.strictEqual(calParsed.meetUrl, 'https://meet.google.com/xyz-uvwx-rst');
console.log('  ✓ parseTimeRexCalendarEvent passed');

// Test 4: syncTimeRexBookingToCrm mock execution
console.log('Test 4: syncTimeRexBookingToCrm');
(async () => {
  const mockDbState: {
    contacts: any[];
    leads: any[];
    deals: any[];
    contact_tags: any[];
    tasks: any[];
    companies: any[];
  } = {
    contacts: [
      { id: 'cnt-1', full_name: '既存リード客', email: 'lead.customer@example.com', company_id: 'comp-1' },
    ],
    leads: [
      { id: 'lead-1', contact_id: 'cnt-1', company_id: 'comp-1', status: '資料請求', notes: '資料請求を受付' },
    ],
    deals: [],
    contact_tags: [],
    tasks: [],
    companies: [
      { id: 'comp-1', company_name: '既存株式会社' },
    ],
  };

  const createMockQuery = (table: string) => {
    let selectedCols = '*';
    const filters: Array<(row: any) => boolean> = [];
    let isSingle = false;
    let limitCount: number | null = null;
    let orderCol: string | null = null;
    let orderAsc = true;

    const builder: any = {
      select: (cols: string) => { selectedCols = cols; return builder; },
      eq: (col: string, val: any) => { filters.push((r) => r[col] === val); return builder; },
      ilike: (col: string, val: string) => { filters.push((r) => String(r[col] || '').toLowerCase() === val.toLowerCase()); return builder; },
      or: (condition: string) => {
        // Simple mock for contact_id eq
        const match = condition.match(/contact_id\.eq\.([^\s,]+)/);
        if (match) {
          const cid = match[1];
          filters.push((r) => r.contact_id === cid);
        }
        return builder;
      },
      order: (col: string, opt?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = opt?.ascending ?? true;
        return builder;
      },
      limit: (n: number) => { limitCount = n; return builder; },
      maybeSingle: async () => {
        const rows = (mockDbState as any)[table].filter((r: any) => filters.every((f) => f(r)));
        return { data: rows[0] || null, error: null };
      },
      single: async () => {
        const rows = (mockDbState as any)[table].filter((r: any) => filters.every((f) => f(r)));
        return { data: rows[0] || null, error: null };
      },
      insert: (payload: any) => {
        const row = { id: `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ...payload };
        (mockDbState as any)[table].push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
      update: (payload: any) => {
        return {
          eq: async (col: string, val: any) => {
            const rows = (mockDbState as any)[table].filter((r: any) => r[col] === val);
            rows.forEach((r: any) => Object.assign(r, payload));
            return { data: rows, error: null };
          },
        };
      },
      then: (resolve: any) => {
        let rows = (mockDbState as any)[table].filter((r: any) => filters.every((f) => f(r)));
        if (limitCount) rows = rows.slice(0, limitCount);
        resolve({ data: rows, error: null });
      },
    };
    return builder;
  };

  const mockDb = {
    from: (table: string) => createMockQuery(table),
  };

  const bookingToSync: TimeRexBookingInfo = {
    guestName: '既存リード客',
    guestEmail: 'lead.customer@example.com',
    meetingDate: '2026-11-25',
    meetingStartTime: '15:00',
    meetUrl: 'https://meet.google.com/test-meet',
    eventName: '経営改善相談',
    sourceType: 'email',
  };

  const syncResult = await syncTimeRexBookingToCrm(bookingToSync, mockDb, 'user-owner-1');
  assert(syncResult.success, 'Sync must succeed');
  assert.strictEqual(syncResult.leadId, 'lead-1');
  assert(syncResult.dealId, 'Deal ID must be created');

  // Verify Lead was updated to '面談予約済'
  const updatedLead = mockDbState.leads.find((l) => l.id === 'lead-1');
  assert.strictEqual(updatedLead.status, '面談予約済', 'Lead status must become 面談予約済');
  assert.strictEqual(updatedLead.meeting_date, '2026-11-25', 'Lead meeting date must match');

  // Verify Deal was created in pipeline
  const createdDeal = mockDbState.deals.find((d) => d.id === syncResult.dealId);
  assert(createdDeal, 'Deal must exist in deals table');
  assert.strictEqual(createdDeal.proposal_status, '日程確定', 'Deal proposal_status must be 日程確定');
  assert.strictEqual(createdDeal.meeting_date, '2026-11-25', 'Deal meeting_date must match');
  assert.strictEqual(createdDeal.lead_id, 'lead-1', 'Deal must link to lead_id');

  // Verify Tag was applied
  const tag = mockDbState.contact_tags.find((t) => t.contact_id === 'cnt-1' && t.tag_id === '個別相談予約済み');
  assert(tag, '個別相談予約済み tag must be attached');

  // Verify Task was created
  const task = mockDbState.tasks.find((t) => t.title.includes('TimeRex面談予約'));
  assert(task, 'Staff task must be created');

  console.log('  ✓ syncTimeRexBookingToCrm passed');
  console.log('\n=== All Round 2-8-7 TimeRex Pattern A Sync Tests Passed! ===\n');
})();
