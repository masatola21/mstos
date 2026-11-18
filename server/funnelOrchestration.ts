import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyScenarioFunnelPhase,
  getSupersededPhasesOnEvent,
  resolvePreferredDeliveryChannels,
} from '../src/utils/followupStarterScenarios.js';

export interface ContactLineEmailEligibility {
  hasLineDeliverable: boolean;
  hasEmail: boolean;
  preferredChannels: ('line' | 'email')[];
}

/**
 * LINE友だちが現在配信可能（ブロック・フォロー解除・配信停止でない）かを確認する。
 */
export async function isLineFriendDeliverable(
  db: SupabaseClient,
  contact: { id?: string | null; line_user_id?: string | null }
): Promise<boolean> {
  const lineUserId = String(contact?.line_user_id || '').trim();
  if (!lineUserId) return false;
  try {
    const { data: friend, error } = await db
      .from('line_friends')
      .select('status, consent_status')
      .eq('line_user_id', lineUserId)
      .maybeSingle();
    if (error || !friend) return false;
    return friend.status === 'active' && friend.consent_status === 'opted_in';
  } catch {
    return false;
  }
}

/**
 * チャネル設定 ('line' | 'email' | 'both') に基づき、LINE優先・未連携時メールフォールバックの配信チャネルを解決する。
 */
export async function resolveContactDeliveryChannels(
  db: SupabaseClient,
  contact: { id?: string | null; line_user_id?: string | null; email?: string | null; email_consent_status?: string | null },
  channelSetting?: string | null
): Promise<ContactLineEmailEligibility> {
  const email = String(contact?.email || '').trim();
  const hasEmail = Boolean(email) && contact?.email_consent_status !== 'opted_out';
  const hasLineDeliverable = await isLineFriendDeliverable(db, contact);
  const preferredChannels = resolvePreferredDeliveryChannels({
    channelSetting,
    hasLineDeliverable,
    hasEmail,
  });
  return { hasLineDeliverable, hasEmail, preferredChannels };
}

/**
 * 連絡先が現在保持しているLINE分岐タグ・予約/診断/資料タグを取得する。
 */
export async function getContactBranchTags(
  db: SupabaseClient,
  contact: { id?: string | null; line_user_id?: string | null }
): Promise<string[]> {
  const tags = new Set<string>();
  try {
    if (contact?.id) {
      const { data: cTags } = await db
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contact.id);
      for (const row of cTags || []) {
        if (typeof row.tag_id === 'string' && row.tag_id.trim()) {
          tags.add(row.tag_id.trim());
        }
      }
    }

    let lineFriendId: string | null = null;
    if (contact?.line_user_id) {
      const { data: lf } = await db
        .from('line_friends')
        .select('id')
        .eq('line_user_id', contact.line_user_id)
        .maybeSingle();
      lineFriendId = lf?.id || null;
    } else if (contact?.id) {
      const { data: lf } = await db
        .from('line_friends')
        .select('id')
        .eq('contact_id', contact.id)
        .maybeSingle();
      lineFriendId = lf?.id || null;
    }

    if (lineFriendId) {
      const { data: friendTags } = await db
        .from('line_friend_tags')
        .select('tag_id, line_tags(name)')
        .eq('line_friend_id', lineFriendId);
      for (const row of friendTags || []) {
        const joined = (row as any).line_tags;
        const name = Array.isArray(joined) ? joined[0]?.name : joined?.name;
        if (typeof name === 'string' && name.trim()) {
          tags.add(name.trim());
        }
      }
    }
  } catch (err) {
    console.warn('[FunnelOrchestration] getContactBranchTags warning:', err);
  }
  return Array.from(tags);
}

/**
 * すでに診断回答済み・資料請求済み・面談予約済み・商談進行中/成約済みの連絡先に対して、
 * LINE登録時の汎用ナーチャリング（教育ステップ／A1）を後から誤って開始しないための判定。
 */
export async function hasContactAlreadyProgressedBeyondNurturing(
  db: SupabaseClient,
  contactId: string,
  companyId?: string | null
): Promise<{ progressed: boolean; reason: string }> {
  try {
    const [diagRes, leadRes, tagRes] = await Promise.all([
      db.from('diagnosis_submissions').select('id').eq('contact_id', contactId).limit(1),
      db
        .from('leads')
        .select('id, status, meeting_date')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(5),
      db
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId)
        .eq('tag_id', '個別相談予約済み')
        .limit(1),
    ]);

    if (tagRes.data && tagRes.data.length > 0) {
      return { progressed: true, reason: '既に個別相談予約済みのため汎用ナーチャリングをスキップ' };
    }
    if (diagRes.data && diagRes.data.length > 0) {
      return { progressed: true, reason: '既にフォーム（診断・資料・相談）送信済みのため汎用ナーチャリングをスキップ' };
    }
    const progressedLead = (leadRes.data || []).find(
      (l: any) =>
        Boolean(l.meeting_date) ||
        ['面談予約済', '商談化', '成約', '受注', '失注', '見送り', '資料請求', '診断申込'].includes(String(l.status || '').trim())
    );
    if (progressedLead) {
      return {
        progressed: true,
        reason: `リードが進行済み（${progressedLead.status || progressedLead.meeting_date}）のため汎用ナーチャリングをスキップ`,
      };
    }

    if (companyId) {
      const { data: deals } = await db
        .from('deals')
        .select('id, proposal_status, meeting_date')
        .eq('company_id', companyId)
        .limit(5);
      const progressedDeal = (deals || []).find(
        (d: any) =>
          Boolean(d.meeting_date) ||
          ['日程確定', '商談中', '提案中', '見積提示', '成約', '受注', '失注', '見送り', 'won', 'lost'].includes(
            String(d.proposal_status || '').trim()
          )
      );
      if (progressedDeal) {
        return {
          progressed: true,
          reason: `商談ステージ進行済み（${progressedDeal.proposal_status || progressedDeal.meeting_date}）のため汎用ナーチャリングをスキップ`,
        };
      }
    }
  } catch (err) {
    console.warn('[FunnelOrchestration] hasContactAlreadyProgressedBeyondNurturing warning:', err);
  }
  return { progressed: false, reason: '' };
}

/**
 * 上位フェーズへの進行イベント時に、手前フェーズの未送信（queued）ジョブを自動停止する。
 */
export async function cancelSupersededQueuedJobs(
  db: SupabaseClient,
  params: { contactId: string; trigger: string; tagName?: string | null }
): Promise<number> {
  if (!params.contactId || !params.trigger) return 0;
  const plan = getSupersededPhasesOnEvent({ trigger: params.trigger, tagName: params.tagName });
  if (plan.cancelPhases.length === 0 && (!plan.cancelSpecificTargets || plan.cancelSpecificTargets.length === 0)) {
    return 0;
  }

  try {
    const { data: queuedJobs, error: jobsErr } = await db
      .from('marketing_automation_jobs')
      .select('id, owner_id, scenario_id')
      .eq('contact_id', params.contactId)
      .eq('status', 'queued');
    if (jobsErr || !queuedJobs || queuedJobs.length === 0) return 0;

    const scenarioIds = Array.from(new Set(queuedJobs.map((j: any) => j.scenario_id).filter(Boolean)));
    if (scenarioIds.length === 0) return 0;

    const { data: scenarioRows, error: scenErr } = await db
      .from('marketing_automation_scenarios')
      .select('owner_id, scenario_id, config')
      .in('scenario_id', scenarioIds);
    if (scenErr || !scenarioRows) return 0;

    const cfgMap = new Map<string, any>();
    for (const r of scenarioRows) {
      cfgMap.set(`${r.owner_id}:${r.scenario_id}`, r.config || {});
      if (!cfgMap.has(r.scenario_id)) cfgMap.set(r.scenario_id, r.config || {});
    }

    const cancelPhaseSet = new Set(plan.cancelPhases);
    const jobIdsToCancel: string[] = [];

    for (const job of queuedJobs) {
      const cfg = cfgMap.get(`${job.owner_id}:${job.scenario_id}`) || cfgMap.get(job.scenario_id) || {};
      const phase = classifyScenarioFunnelPhase(cfg);
      const matchesPhase = cancelPhaseSet.has(phase);
      const matchesSpecific = (plan.cancelSpecificTargets || []).some(
        (t) => t.trigger === cfg.trigger && (!t.targetTag || t.targetTag === cfg.targetTag)
      );
      if (matchesPhase || matchesSpecific) {
        jobIdsToCancel.push(job.id);
      }
    }

    if (jobIdsToCancel.length === 0) return 0;

    const nowIso = new Date().toISOString();
    await db
      .from('marketing_automation_jobs')
      .update({
        status: 'skipped',
        error_message: plan.reason,
        updated_at: nowIso,
      })
      .in('id', jobIdsToCancel)
      .eq('status', 'queued');

    return jobIdsToCancel.length;
  } catch (err) {
    console.warn('[FunnelOrchestration] cancelSupersededQueuedJobs warning:', err);
    return 0;
  }
}
