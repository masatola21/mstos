import assert from 'node:assert';
import {
  isTimeRexEmail,
  isHostOrSystemEmail,
  extractGuestEmailFromText,
  classifyTimeRexEmailAction,
  parseTimeRexEmail,
  diagnoseTimeRexParseFailure,
  parseTimeRexCalendarEvent,
  syncTimeRexBookingToCrm,
  isMeetingOverdueForCompletionCheck,
  checkOverdueMeetingCompletionReminders,
  type TimeRexBookingInfo,
} from '../server/timerexSyncService.js';

console.log('=== Running Round 2-8-7 TimeRex Pattern A Sync Tests ===\n');

// Test 1: isTimeRexEmail & host exclusion
console.log('Test 1: isTimeRexEmail & host email exclusion');
assert(
  isTimeRexEmail('no-reply@timerex.net', '【TimeRex】日程調整が完了しました', '大橋様 予定が確定しました'),
  'Should detect official TimeRex email'
);
assert(
  isTimeRexEmail('mst.shikumikaizen@gmail.com', 'Fwd: 【TimeRex】[30分面談] 山田太郎 様', 'TimeRexで予定が確定しました。ゲスト: yamada@test.com'),
  'Should detect forwarded TimeRex email'
);
assert(
  isTimeRexEmail('noreply@timerex.net', '【TimeRex】予定がキャンセルされました', 'ゲスト予定キャンセル'),
  'Should detect TimeRex cancellation email'
);
assert(
  isTimeRexEmail('noreply@timerex.net', '【TimeRex】日程が変更されました', '予定が変更されました'),
  'Should detect TimeRex reschedule email'
);
assert(
  !isTimeRexEmail('client@example.com', 'お見積書の件について', 'お世話になっております。見積もりをお願いします。'),
  'Should not false-positive on regular client email'
);
assert(isHostOrSystemEmail('ohashi@mstcorp.info'), 'Should exclude @mstcorp.info domain emails');
assert(isHostOrSystemEmail('contact@mstcorp.info'), 'Should exclude contact@mstcorp.info');
assert(isHostOrSystemEmail('mst.shikumikaizen@gmail.com'), 'Should exclude legacy host gmail');
assert(!isHostOrSystemEmail('guest@client-corp.jp'), 'Should accept guest email');

const hostFirstText = `
ホスト: ohashi@mstcorp.info
主催者メール: info@mstcorp.info
メールアドレス: guest.client@example.co.jp
`;
assert.strictEqual(
  extractGuestEmailFromText(hostFirstText),
  'guest.client@example.co.jp',
  'Should ignore @mstcorp.info host emails even when listed before guest email'
);
console.log('  ✓ isTimeRexEmail & host exclusion passed');

// Test 2: parseTimeRexEmail parsing (confirmed, rescheduled, cancelled, reminder)
console.log('Test 2: parseTimeRexEmail & classifyTimeRexEmailAction');
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
assert.strictEqual(parsed.bookingAction, 'confirmed');
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

const cancelParsed = parseTimeRexEmail(
  '【TimeRex】予定がキャンセルされました',
  '大橋様\n以下の予定がキャンセルされました。\nゲスト: 山田太郎 (yamada.taro@example.co.jp)\n日時: 2026年11月20日(金) 14:00 - 14:30'
);
assert(cancelParsed !== null, 'Cancel email should be parsed');
assert.strictEqual(cancelParsed.bookingAction, 'cancelled');
assert.strictEqual(cancelParsed.guestEmail, 'yamada.taro@example.co.jp');

const reschedParsed = parseTimeRexEmail(
  '【TimeRex】日程が変更されました',
  '変更後の日時: 2026年11月28日(土) 11:00 - 11:30\nメールアドレス: yamada.taro@example.co.jp\n氏名: 山田 太郎'
);
assert(reschedParsed !== null, 'Reschedule email should be parsed');
assert.strictEqual(reschedParsed.bookingAction, 'rescheduled');
assert.strictEqual(reschedParsed.meetingDate, '2026-11-28');
assert.strictEqual(reschedParsed.meetingStartTime, '11:00');

assert.strictEqual(
  classifyTimeRexEmailAction('【TimeRex】まもなく開始の予定があります', 'リマインド通知です'),
  'reminder',
  'Should classify reminder email'
);
console.log('  ✓ parseTimeRexEmail & classifyTimeRexEmailAction passed');

// Test 3: parseTimeRexCalendarEvent parsing & cancellation status
console.log('Test 3: parseTimeRexCalendarEvent');
const sampleCalEvent = {
  title: '【TimeRex】佐藤花子 様',
  date: '2026-11-22',
  startTime: '10:00',
  endTime: '10:30',
  meetUrl: 'https://meet.google.com/xyz-uvwx-rst',
  notes: '主催: ohashi@mstcorp.info\nゲスト: 佐藤 花子 (sato.hanako@example.com)\nコメント: 介護保険外サービスの開業について',
};

const calParsed = parseTimeRexCalendarEvent(sampleCalEvent);
assert(calParsed !== null, 'Calendar event should be parsed successfully');
assert.strictEqual(calParsed.guestName, '佐藤花子');
assert.strictEqual(calParsed.guestEmail, 'sato.hanako@example.com');
assert.strictEqual(calParsed.meetingDate, '2026-11-22');
assert.strictEqual(calParsed.meetingStartTime, '10:00');
assert.strictEqual(calParsed.meetUrl, 'https://meet.google.com/xyz-uvwx-rst');
assert.strictEqual(calParsed.bookingAction, 'confirmed');

const calCancelled = parseTimeRexCalendarEvent({ ...sampleCalEvent, status: 'CANCELLED' });
assert(calCancelled !== null);
assert.strictEqual(calCancelled.bookingAction, 'cancelled');
console.log('  ✓ parseTimeRexCalendarEvent passed');

// Test 4+: syncTimeRexBookingToCrm mock execution
console.log('Test 4: syncTimeRexBookingToCrm (confirmed, dedup, non-downgrade, reschedule, cancel, reminder)');
(async () => {
  const mockDbState: {
    contacts: any[];
    leads: any[];
    deals: any[];
    contact_tags: any[];
    tasks: any[];
    companies: any[];
    marketing_automation_jobs: any[];
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
    marketing_automation_jobs: [],
  };

  const createMockQuery = (table: string) => {
    const filters: Array<(row: any) => boolean> = [];
    let limitCount: number | null = null;
    let isDelete = false;

    const builder: any = {
      select: (_cols: string) => builder,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      ilike: (col: string, val: string) => {
        const needle = val.replace(/%/g, '').toLowerCase();
        filters.push((r) => {
          const v = String(r[col] || '').toLowerCase();
          return val.includes('%') ? v.includes(needle) : v === needle;
        });
        return builder;
      },
      or: (condition: string) => {
        const match = condition.match(/contact_id\.eq\.([^\s,]+)/);
        if (match) {
          const cid = match[1];
          filters.push((r) => r.contact_id === cid);
        }
        return builder;
      },
      order: (_col: string, _opt?: { ascending?: boolean }) => builder,
      limit: (n: number) => {
        limitCount = n;
        return builder;
      },
      delete: () => {
        isDelete = true;
        return builder;
      },
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
      update: (payload: any) => ({
        eq: async (col: string, val: any) => {
          const rows = (mockDbState as any)[table].filter((r: any) => r[col] === val);
          rows.forEach((r: any) => Object.assign(r, payload));
          return { data: rows, error: null };
        },
        in: async (col: string, vals: any[]) => {
          const rows = (mockDbState as any)[table].filter((r: any) => vals.includes(r[col]));
          rows.forEach((r: any) => Object.assign(r, payload));
          return { data: rows, error: null };
        },
      }),
      then: (resolve: any) => {
        if (isDelete) {
          const arr = (mockDbState as any)[table] as any[];
          const kept = arr.filter((r) => !filters.every((f) => f(r)));
          (mockDbState as any)[table] = kept;
          resolve({ data: null, error: null });
          return;
        }
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

  // 4a. Initial booking confirmation
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
  assert.strictEqual(syncResult.action, 'updated_lead_and_created_deal');

  const updatedLead = mockDbState.leads.find((l) => l.id === 'lead-1');
  assert.strictEqual(updatedLead.status, '面談予約済', 'Lead status must become 面談予約済');
  assert.strictEqual(updatedLead.meeting_date, '2026-11-25', 'Lead meeting date must match');

  const createdDeal = mockDbState.deals.find((d) => d.id === syncResult.dealId);
  assert(createdDeal, 'Deal must exist in deals table');
  assert.strictEqual(createdDeal.proposal_status, '日程確定', 'Deal proposal_status must be 日程確定');
  assert.strictEqual(createdDeal.meeting_date, '2026-11-25', 'Deal meeting_date must match');

  const tag = mockDbState.contact_tags.find((t) => t.contact_id === 'cnt-1' && t.tag_id === '個別相談予約済み');
  assert(tag, '個別相談予約済み tag must be attached');
  assert.strictEqual(mockDbState.tasks.length, 1, 'One prep task should be created');

  // 4b. Re-running same booking sync must deduplicate task & return skipped_no_change
  const duplicateSync = await syncTimeRexBookingToCrm(bookingToSync, mockDb, 'user-owner-1');
  assert.strictEqual(duplicateSync.action, 'skipped_no_change', 'Repeat sync must not report changes');
  assert.strictEqual(mockDbState.tasks.length, 1, 'Duplicate prep task must not be created');

  // 4c. Reminder email must not modify progressed stage or add tasks
  updatedLead.status = '面談実施済';
  createdDeal.proposal_status = '見積提示';
  createdDeal.memo = '重要商談メモ（絶対に消えないこと）';
  const reminderResult = await syncTimeRexBookingToCrm(
    { ...bookingToSync, bookingAction: 'reminder' },
    mockDb,
    'user-owner-1'
  );
  assert.strictEqual(reminderResult.action, 'reminder_acknowledged');
  assert.strictEqual(updatedLead.status, '面談実施済');
  assert.strictEqual(createdDeal.proposal_status, '見積提示');
  assert.strictEqual(mockDbState.tasks.length, 1);

  // 4d. Non-downgrade protection: re-syncing confirmed booking must NOT overwrite 見積提示 / 面談実施済 or erase memo
  const repeatConfirmedResult = await syncTimeRexBookingToCrm(
    { ...bookingToSync, bookingAction: 'confirmed', sourceType: 'calendar' },
    mockDb,
    'user-owner-1'
  );
  assert(repeatConfirmedResult.success);
  assert.strictEqual(updatedLead.status, '面談実施済', 'Progressed lead status must NOT downgrade');
  assert.strictEqual(createdDeal.proposal_status, '見積提示', 'Progressed deal status must NOT downgrade');
  assert.ok(createdDeal.memo.includes('重要商談メモ（絶対に消えないこと）'), 'Existing deal memo must be preserved');

  // 4e. Reschedule updates date & creates reschedule task
  updatedLead.status = '面談予約済';
  createdDeal.proposal_status = '日程確定';
  const reschedResult = await syncTimeRexBookingToCrm(
    { ...bookingToSync, meetingDate: '2026-11-29', meetingStartTime: '16:30', bookingAction: 'rescheduled' },
    mockDb,
    'user-owner-1'
  );
  assert.strictEqual(reschedResult.action, 'rescheduled');
  assert.strictEqual(updatedLead.meeting_date, '2026-11-29');
  assert.strictEqual(createdDeal.meeting_date, '2026-11-29');
  assert.strictEqual(mockDbState.tasks.length, 2, 'Reschedule task for new date should be created');

  // 4f. Cancellation moves lead->再調整待ち, deal->日程再調整, deletes booking tag, creates cancel task
  const cancelResult = await syncTimeRexBookingToCrm(
    { ...bookingToSync, meetingDate: '2026-11-29', meetingStartTime: '16:30', bookingAction: 'cancelled' },
    mockDb,
    'user-owner-1'
  );
  assert.strictEqual(cancelResult.action, 'cancelled');
  assert.strictEqual(updatedLead.status, '再調整待ち', 'Cancelled booking must move lead to 再調整待ち');
  assert.strictEqual(updatedLead.meeting_date, null, 'Cancelled booking must clear lead meeting_date');
  assert.strictEqual(createdDeal.proposal_status, '日程再調整', 'Cancelled booking must move deal to 日程再調整');
  assert.strictEqual(createdDeal.meeting_date, null, 'Cancelled booking must clear deal meeting_date');
  assert.strictEqual(mockDbState.contact_tags.length, 0, '個別相談予約済み tag must be removed on cancel');
  assert.ok(
    mockDbState.tasks.some((t) => t.title.includes('【TimeRexキャンセル対応】')),
    'Cancellation task must be created'
  );

  console.log('  ✓ syncTimeRexBookingToCrm passed all assertions');

  // Test 5: isMeetingOverdueForCompletionCheck
  console.log('Test 5: isMeetingOverdueForCompletionCheck');
  const nowCheck = new Date('2026-11-20T15:30:00+09:00');
  assert(!isMeetingOverdueForCompletionCheck('2026-11-20', '15:00', nowCheck), 'Within 60m grace window -> false');
  assert(isMeetingOverdueForCompletionCheck('2026-11-20', '14:00', nowCheck), '90m past start -> true');
  assert(!isMeetingOverdueForCompletionCheck('2026-11-20', null, nowCheck), 'Missing time defaults to 18:00 JST -> false at 15:30');
  assert(
    isMeetingOverdueForCompletionCheck('2026-11-20', null, new Date('2026-11-20T19:30:00+09:00')),
    'Missing time at 19:30 JST -> true'
  );
  assert(!isMeetingOverdueForCompletionCheck('2026-11-01', '10:00', nowCheck), '> 14 days old stale meeting -> false');
  console.log('  ✓ isMeetingOverdueForCompletionCheck passed');

  // Test 6: checkOverdueMeetingCompletionReminders
  console.log('Test 6: checkOverdueMeetingCompletionReminders');
  mockDbState.tasks = [];
  mockDbState.leads = [
    {
      id: 'lead-overdue',
      owner_id: 'user-owner-1',
      contact_id: 'cnt-overdue',
      company_id: 'comp-overdue',
      status: '面談予約済',
      meeting_date: '2026-11-20',
      meeting_start_time: '13:00',
      company: { company_name: '遅延テスト株式会社' },
      contact: { full_name: '高橋 一郎' },
    },
    {
      id: 'lead-already-done',
      owner_id: 'user-owner-1',
      status: '面談実施済',
      meeting_date: '2026-11-20',
      meeting_start_time: '10:00',
      contact: { full_name: '完了済み太郎' },
    },
  ];
  mockDbState.deals = [
    {
      id: 'deal-linked',
      owner_id: 'user-owner-1',
      lead_id: 'lead-overdue',
      company_id: 'comp-overdue',
      proposal_status: '日程確定',
      meeting_date: '2026-11-20',
      company: { company_name: '遅延テスト株式会社' },
    },
    {
      id: 'deal-standalone',
      owner_id: 'user-owner-1',
      lead_id: null,
      company_id: 'comp-standalone',
      proposal_status: '初回面談',
      proposal_plan_name: '業務自動化提案',
      meeting_date: '2026-11-19',
      company: { company_name: '未完了商談有限会社' },
    },
  ];

  const reminderPass1 = await checkOverdueMeetingCompletionReminders(mockDb, nowCheck);
  assert.strictEqual(reminderPass1.created, 2, 'Should create 1 task for lead+linked deal and 1 for standalone deal');
  assert.ok(mockDbState.tasks.some((t) => t.title.includes('【面談完了確認】高橋 一郎 様（2026-11-20 13:00）')));
  assert.ok(mockDbState.tasks.some((t) => t.title.includes('【面談完了確認】未完了商談有限会社 様（2026-11-19）')));

  // Mark tasks done and re-run check -> must NOT recreate!
  mockDbState.tasks.forEach((t) => { t.status = 'done'; });
  const reminderPass2 = await checkOverdueMeetingCompletionReminders(mockDb, nowCheck);
  assert.strictEqual(reminderPass2.created, 0, 'Must NOT recreate completion check task even after marked done');
  console.log('  ✓ checkOverdueMeetingCompletionReminders passed');

  // Test 7: Real notifications@timerex.net format ("大橋真人さんが新しい予定..."), HTML table, self-test email, & diagnostics
  console.log('Test 7: notifications@timerex.net HTML table & owner self-test email');
  const realTimeRexHtml = `
    <html><body>
      <p>大橋真人さんが新しい予定「【30分】AI経営相談」を作成しました。</p>
      <table>
        <tr><th>日時</th><td>2026年11月20日(金)19:30〜20:00</td></tr>
        <tr><th>お名前</th><td>大橋真人</td></tr>
        <tr><th>メールアドレス</th><td>masato.la21@gmail.com</td></tr>
        <tr><th>会社名</th><td></td></tr>
        <tr><th>Web会議</th><td><a href="https://meet.google.com/real-test-meet">Google Meetに参加</a></td></tr>
      </table>
      <p>ホスト: contact@mstcorp.info</p>
    </body></html>
  `;
  const realParsed = parseTimeRexEmail(
    '大橋真人さんが新しい予定「【30分】AI経営相談」を作成しました',
    '大橋真人さんが新しい予定を作成しました。詳細は本文をご確認ください。',
    realTimeRexHtml,
    ['asistaogaki@gmail.com']
  );
  assert(realParsed !== null, 'Real TimeRex HTML table self-test booking should parse');
  assert.strictEqual(realParsed.guestName, '大橋真人');
  assert.strictEqual(realParsed.guestEmail, 'masato.la21@gmail.com');
  assert.strictEqual(realParsed.meetingDate, '2026-11-20');
  assert.strictEqual(realParsed.meetingStartTime, '19:30');
  assert.strictEqual(realParsed.meetingEndTime, '20:00');
  assert.strictEqual(realParsed.companyName, undefined);
  assert.strictEqual(realParsed.meetUrl, 'https://meet.google.com/real-test-meet');

  // Host-only notice with no guest email must STILL be rejected and produce clear diagnostic
  const hostOnlyBody = 'ホスト: ohashi@mstcorp.info\n日時: 2026年11月20日(金) 19:30';
  assert.strictEqual(parseTimeRexEmail('【TimeRex】お知らせ', hostOnlyBody), null);
  assert.ok(
    diagnoseTimeRexParseFailure('【TimeRex】お知らせ', hostOnlyBody).includes('メールアドレス'),
    'Diagnostic must explain missing guest email'
  );

  assert.strictEqual(
    classifyTimeRexEmailAction('大橋真人さんが予定をキャンセルしました', ''),
    'cancelled'
  );
  assert.strictEqual(
    classifyTimeRexEmailAction('大橋真人さんが予定の日時を変更しました', ''),
    'rescheduled'
  );

  // Sync the parsed self-test personal booking end-to-end
  mockDbState.contacts = [];
  mockDbState.companies = [];
  mockDbState.leads = [];
  mockDbState.deals = [];
  mockDbState.tasks = [];
  const realSyncRes = await syncTimeRexBookingToCrm(realParsed, mockDb, 'user-owner-1');
  assert.strictEqual(realSyncRes.success, true);
  assert.strictEqual(mockDbState.companies[0].company_name, '大橋真人様（個人）');
  assert.strictEqual(mockDbState.deals.length, 1);
  assert.strictEqual(mockDbState.deals[0].proposal_plan_name, '【面談予約】大橋真人 様');
  assert.strictEqual(mockDbState.tasks.length, 1);
  console.log('  ✓ notifications@timerex.net HTML table & owner self-test passed');

  console.log('\n=== All Round 2-8-7 TimeRex Pattern A Sync Tests Passed! ===\n');
})();
