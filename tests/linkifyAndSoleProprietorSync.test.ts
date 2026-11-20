import assert from 'node:assert';
import {
  splitTextWithUrls,
  htmlToReadableTextPreservingLinks,
  extractQuickActionUrls,
} from '../src/utils/linkify.js';
import {
  parseTimeRexEmail,
  syncTimeRexBookingToCrm,
} from '../server/timerexSyncService.js';

console.log('=== Running Linkify & Sole Proprietor TimeRex Sync Tests ===\n');

// 1. URL splitting and punctuation trimming
{
  const segs = splitTextWithUrls(
    '会議URLはこちら（https://meet.google.com/abc-defg-hij）。詳細: https://us06web.zoom.us/j/123456?pwd=xyz, 参考(https://example.com/test_(1))。'
  );
  const urls = segs.filter((s) => s.type === 'url').map((s) => s.href);
  assert.deepStrictEqual(urls, [
    'https://meet.google.com/abc-defg-hij',
    'https://us06web.zoom.us/j/123456?pwd=xyz',
    'https://example.com/test_(1)',
  ]);
  console.log('  ✓ splitTextWithUrls passed');
}

// 2. HTML link preservation & quick-action extraction
{
  const html = `
    <html><head><style>.btn{color:red}</style></head>
    <body>
      <p>以下のリンクよりご参加ください。</p>
      <p><a href="https://meet.google.com/xyz-uvwx-rst">Google Meetに参加</a></p>
      <p><a href="https://timerex.net/s/mst/booking/123">日程変更はこちら</a></p>
    </body></html>
  `;
  const readable = htmlToReadableTextPreservingLinks(html);
  assert.ok(!readable.includes('.btn{color:red}'), 'CSS style content should be stripped');
  assert.ok(readable.includes('https://meet.google.com/xyz-uvwx-rst'), 'Anchor href Meet URL must be preserved');
  assert.ok(readable.includes('https://timerex.net/s/mst/booking/123'), 'Anchor href TimeRex URL must be preserved');

  const quick = extractQuickActionUrls('', html);
  assert.strictEqual(quick.length, 2);
  assert.strictEqual(quick[0].label, 'Google Meetに参加');
  assert.strictEqual(quick[1].label, 'TimeRexリンクを開く');
  console.log('  ✓ htmlToReadableTextPreservingLinks & extractQuickActionUrls passed');
}

// 3. parseTimeRexEmail extracts Meet URL even when present only in <a href> of HTML body
{
  const htmlOnly = `
    <div>
      <p>日時: 2026年12月01日(火) 10:00 - 10:30</p>
      <p>氏名: 個人 花子</p>
      <p>メールアドレス: kojin.hanako@gmail.com</p>
      <p>会社名: なし</p>
      <p><a href="https://meet.google.com/han-ako-meet">Web会議に参加する</a></p>
    </div>
  `;
  const parsed = parseTimeRexEmail('【TimeRex】日程調整が完了しました', '', htmlOnly);
  assert(parsed !== null, 'HTML-only TimeRex email must parse');
  assert.strictEqual(parsed.guestName, '個人 花子');
  assert.strictEqual(parsed.guestEmail, 'kojin.hanako@gmail.com');
  assert.strictEqual(parsed.meetUrl, 'https://meet.google.com/han-ako-meet');
  console.log('  ✓ parseTimeRexEmail HTML <a href> extraction passed');
}

// 4. syncTimeRexBookingToCrm handles sole proprietors (no company / 'なし' / '個人事業主') smoothly
(async () => {
  const state: Record<string, any[]> = {
    contacts: [],
    companies: [],
    leads: [],
    deals: [],
    contact_tags: [],
    tasks: [],
  };

  const makeQuery = (table: string) => {
    const filters: Array<(r: any) => boolean> = [];
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => { filters.push((r) => r[col] === val); return builder; },
      ilike: (col: string, val: string) => {
        const needle = val.replace(/%/g, '').toLowerCase();
        filters.push((r) => String(r[col] || '').toLowerCase() === needle);
        return builder;
      },
      or: (cond: string) => {
        const m = cond.match(/contact_id\.eq\.([^\s,]+)/);
        if (m) filters.push((r) => r.contact_id === m[1]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: (state[table] || []).find((r) => filters.every((f) => f(r))) || null,
        error: null,
      }),
      single: async () => ({
        data: (state[table] || []).find((r) => filters.every((f) => f(r))) || null,
        error: null,
      }),
      insert: (payload: any) => {
        // Simulate deals.company_id NOT NULL constraint on un-migrated prod DB
        if (table === 'deals' && !payload.company_id) {
          return {
            select: () => ({
              single: async () => ({ data: null, error: { code: '23502', message: 'null value in column "company_id" violates not-null constraint' } }),
            }),
          };
        }
        const row = { id: `${table}-${state[table].length + 1}`, ...payload };
        state[table].push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
      update: (payload: any) => ({
        eq: async (col: string, val: any) => {
          state[table].filter((r) => r[col] === val).forEach((r) => Object.assign(r, payload));
          return { data: null, error: null };
        },
      }),
      then: (resolve: any) => {
        resolve({ data: (state[table] || []).filter((r) => filters.every((f) => f(r))), error: null });
      },
    };
    return builder;
  };

  const mockDb = { from: (t: string) => makeQuery(t) };

  const res1 = await syncTimeRexBookingToCrm(
    {
      guestName: 'フリー 太郎',
      guestEmail: 'free.taro@gmail.com',
      companyName: 'なし',
      meetingDate: '2026-12-05',
      meetingStartTime: '11:00',
      sourceType: 'email',
    },
    mockDb,
    'owner-1'
  );
  assert.strictEqual(res1.success, true, 'Sole proprietor booking with companyName="なし" must succeed even with NOT NULL constraint');
  assert(res1.dealId, 'Deal must be created');
  assert.strictEqual(state.companies[0].company_name, 'フリー 太郎様（個人）');

  const res2 = await syncTimeRexBookingToCrm(
    {
      guestName: '独立 次郎',
      guestEmail: 'jiro.solo@yahoo.co.jp',
      companyName: '個人事業主',
      meetingDate: '2026-12-06',
      meetingStartTime: '14:00',
      sourceType: 'email',
    },
    mockDb,
    'owner-1'
  );
  assert.strictEqual(res2.success, true, 'Sole proprietor booking with companyName="個人事業主" must succeed');
  assert(res2.dealId, 'Second deal must be created');
  assert.strictEqual(state.companies[1].company_name, '独立 次郎様（個人事業主）');

  console.log('  ✓ syncTimeRexBookingToCrm sole proprietor handling passed');

  // 5. Strict schema check: contacts/companies/leads/deals do NOT have owner_id column in PostgreSQL
  {
    const strictColumns: Record<string, Set<string>> = {
      contacts: new Set(['id', 'company_id', 'full_name', 'email', 'phone', 'source', 'created_at']),
      companies: new Set(['id', 'company_name', 'contact_name', 'email', 'phone', 'created_at']),
      leads: new Set(['id', 'company_id', 'contact_id', 'source', 'status', 'meeting_date', 'meeting_start_time', 'notes', 'priority_channel', 'first_registered_at', 'last_contacted_at', 'created_at']),
      deals: new Set(['id', 'company_id', 'lead_id', 'proposal_plan_name', 'proposal_type', 'proposal_status', 'meeting_date', 'memo', 'created_at', 'updated_at']),
      tasks: new Set(['id', 'owner_id', 'title', 'description', 'status', 'priority', 'due_date', 'created_at']),
      contact_tags: new Set(['id', 'contact_id', 'tag_id', 'owner_id', 'created_at']),
      marketing_automation_jobs: new Set(['id', 'contact_id', 'status', 'scenario_id', 'error_message', 'updated_at']),
    };
    const strictState: Record<string, any[]> = {
      contacts: [],
      companies: [],
      leads: [],
      deals: [],
      tasks: [],
      contact_tags: [],
      marketing_automation_jobs: [],
    };
    const validateCols = (table: string, cols: string[]) => {
      const allowed = strictColumns[table];
      if (!allowed) return null;
      for (const c of cols) {
        if (!allowed.has(c)) {
          return { message: `column ${table}.${c} does not exist` };
        }
      }
      return null;
    };
    const makeStrictQuery = (table: string) => {
      const filters: Array<(r: any) => boolean> = [];
      let selectError: any = null;
      const builder: any = {
        select: (cols: string) => {
          const parsedCols = cols.split(',').map((s) => s.trim()).filter((s) => s && s !== '*');
          selectError = validateCols(table, parsedCols);
          return builder;
        },
        eq: (col: string, val: any) => { filters.push((r) => r[col] === val); return builder; },
        ilike: (col: string, val: string) => {
          const needle = val.replace(/%/g, '').toLowerCase();
          filters.push((r) => String(r[col] || '').toLowerCase() === needle);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => selectError ? { data: null, error: selectError } : { data: (strictState[table] || []).find((r) => filters.every((f) => f(r))) || null, error: null },
        single: async () => selectError ? { data: null, error: selectError } : { data: (strictState[table] || []).find((r) => filters.every((f) => f(r))) || null, error: null },
        insert: (payload: any) => {
          const err = validateCols(table, Object.keys(payload));
          if (!err && !payload.id && (table === 'companies' || table === 'deals')) {
            // Simulate missing auto-ID trigger too
            const missingIdErr = { code: '23502', message: `null value in column "id" of relation "${table}"` };
            return {
              select: () => ({ single: async () => ({ data: null, error: missingIdErr }) }),
              then: (resolve: any) => resolve({ data: null, error: missingIdErr }),
            };
          }
          if (err) {
            return {
              select: () => ({ single: async () => ({ data: null, error: err }) }),
              then: (resolve: any) => resolve({ data: null, error: err }),
            };
          }
          const row = { id: payload.id || `${table}-${strictState[table].length + 1}`, ...payload };
          strictState[table].push(row);
          return {
            select: () => ({ single: async () => ({ data: row, error: null }) }),
            then: (resolve: any) => resolve({ data: row, error: null }),
          };
        },
        update: (payload: any) => ({
          eq: async (col: string, val: any) => {
            const err = validateCols(table, Object.keys(payload));
            if (err) return { data: null, error: err };
            strictState[table].filter((r) => r[col] === val).forEach((r) => Object.assign(r, payload));
            return { data: null, error: null };
          },
        }),
        then: (resolve: any) => {
          if (selectError) return resolve({ data: null, error: selectError });
          resolve({ data: (strictState[table] || []).filter((r) => filters.every((f) => f(r))), error: null });
        },
      };
      return builder;
    };

    const strictEmailBody = `
      予定が確定しました。
      ■ 日時
      2026年12月10日（木） 13:30 - 14:00
      ■ ゲスト
      氏名: 個人 花子
      メールアドレス: hanako.personal@example.com
      会社名:
      電話番号: 090-1111-2222
    `;
    const parsedStrict = parseTimeRexEmail('【TimeRex】日程調整が完了しました', strictEmailBody);
    assert(parsedStrict !== null, 'Email with full-width (木) and empty 会社名: must parse');
    assert.strictEqual(parsedStrict.companyName, undefined, 'Empty 会社名: line must not bleed into 電話番号');
    assert.strictEqual(parsedStrict.meetingDate, '2026-12-10');
    assert.strictEqual(parsedStrict.meetingStartTime, '13:30');

    const strictRes = await syncTimeRexBookingToCrm(parsedStrict, { from: makeStrictQuery }, 'user-uuid-123');
    assert.strictEqual(strictRes.success, true, 'Strict schema CRM sync must succeed without owner_id errors');
    assert(strictRes.dealId, 'Deal must be created under strict schema');
    assert.strictEqual(strictState.companies.length, 1);
    assert.strictEqual(strictState.companies[0].company_name, '個人 花子様（個人）');
    assert.strictEqual(strictState.deals.length, 1);
    assert.strictEqual(strictState.deals[0].proposal_plan_name, '【面談予約】個人 花子 様');
    assert.strictEqual(strictState.tasks.length, 1, 'Task must be created in tasks table');
    assert.strictEqual(strictState.tasks[0].owner_id, 'user-uuid-123');
    console.log('  ✓ strict schema TimeRex personal-name sync (deal + task) passed');
  }

  console.log('\n=== All Linkify & Sole Proprietor Tests Passed! ===\n');
})();
