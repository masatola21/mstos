import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyScenarioFunnelPhase,
  getSupersededPhasesOnEvent,
  isConsultationLeadEligibleForHumanReplyEducation,
  isEligibleSourceTypeForConsultationHumanReply,
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
 * すでに「個別相談予約済み」「面談実施/予約日あり」「商談進行・成約・失注済み」の連絡先に対してのみ
 * 教育ステップ（7話）および未回答リマインドを停止する。
 * ※ A案（長期育成型）に基づき、診断完了・資料請求・相談フォーム送信のみでは停止せず、
 *    各直後フォロー完了後（+4日後〜）から長期教育へ合流させる。
 */
export async function hasContactAlreadyProgressedBeyondNurturing(
  db: SupabaseClient,
  contactId: string,
  companyId?: string | null
): Promise<{ progressed: boolean; reason: string }> {
  try {
    const [leadRes, tagRes, branchTags] = await Promise.all([
      db
        .from('leads')
        .select('id, status, meeting_date')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1),
      db
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId)
        .eq('tag_id', '個別相談予約済み')
        .limit(1),
      getContactBranchTags(db, { id: contactId }),
    ]);

    if ((tagRes.data && tagRes.data.length > 0) || branchTags.includes('個別相談予約済み')) {
      return { progressed: true, reason: '既に個別相談予約済みのため長期教育ステップをスキップ' };
    }

    const latestLead = (leadRes.data || [])[0] as any;
    const progressedLead = latestLead && (
      Boolean(latestLead.meeting_date) ||
      ['面談予約済', '面談実施済', 'ヒアリング済', '商談化', '成約', '受注', '失注', '見送り', '失注・対象外'].includes(
        String(latestLead.status || '').trim()
      )
    )
      ? latestLead
      : null;
    if (progressedLead) {
      return {
        progressed: true,
        reason: `予約済み・商談進行中（${progressedLead.status || progressedLead.meeting_date}）のため教育ステップをスキップ`,
      };
    }

    if (companyId) {
      const { data: comp } = await db
        .from('companies')
        .select('company_name')
        .eq('id', companyId)
        .maybeSingle();
      const compName = String(comp?.company_name || '').trim();
      const isSyntheticPersonalCompany =
        !compName ||
        compName.endsWith('様（個人）') ||
        compName === '新規反響企業（フォーム経由）';

      if (!isSyntheticPersonalCompany) {
        const [{ data: deals }, { data: meetings }] = await Promise.all([
          db
            .from('deals')
            .select('id, proposal_status, meeting_date')
            .eq('company_id', companyId)
            .limit(5),
          db
            .from('customer_service_meetings')
            .select('id')
            .eq('company_id', companyId)
            .limit(1),
        ]);
        if (meetings && meetings.length > 0) {
          return {
            progressed: true,
            reason: '既に面談記録があるため教育ステップをスキップ',
          };
        }
        const progressedDeal = (deals || []).find(
          (d: any) =>
            Boolean(d.meeting_date) ||
            [
              '日程確定',
              '初回面談',
              '面談完了',
              '要件提案',
              '商談中',
              '提案中',
              '見積提示',
              '見積提出',
              '最終交渉',
              '成約',
              '受注',
              '失注',
              '見送り',
              'won',
              'lost',
            ].includes(String(d.proposal_status || '').trim())
        );
        if (progressedDeal) {
          return {
            progressed: true,
            reason: `商談ステージ進行済み（${progressedDeal.proposal_status || progressedDeal.meeting_date}）のため教育ステップをスキップ`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[FunnelOrchestration] hasContactAlreadyProgressedBeyondNurturing warning:', err);
  }
  return { progressed: false, reason: '' };
}

/**
 * A案（長期育成型）に基づき、LINE登録または分岐到達時点で連絡先が既に入っているルートを判定し、
 * 教育7話の開始シフト日数（基準2日後への加算日数）を返す。
 * - ウェルカム無反応: +0日（2日後〜）
 * - 分岐B/C（個別相談 / 介護保険外開業）: +5日（7日後〜）
 * - 分岐A未回答 / Web相談フォーム: +3日（5日後〜）
 * - 診断完了 / 資料請求完了: +9日（11日後〜）
 */
export async function computeContactEducationDelayShiftDays(
  db: SupabaseClient,
  contact: { id?: string | null; line_user_id?: string | null }
): Promise<number> {
  if (!contact?.id) return 0;
  try {
    const [branchTags, diagRes, leadRes] = await Promise.all([
      getContactBranchTags(db, contact),
      db.from('diagnosis_submissions').select('id, form_id').eq('contact_id', contact.id).limit(5),
      db.from('leads').select('status, source').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(5),
    ]);

    let hasActualDiagnosis = branchTags.includes('診断受検済み');
    let hasMaterialSubmission = branchTags.includes('資料請求');

    if (diagRes.data && diagRes.data.length > 0) {
      const formIds = Array.from(new Set(diagRes.data.map((r: any) => r.form_id).filter(Boolean)));
      if (formIds.length > 0) {
        const { data: forms } = await db
          .from('diagnosis_forms')
          .select('id, public_slug, form_type, name')
          .in('id', formIds);
        for (const f of forms || []) {
          const slug = String(f.public_slug || '');
          const fname = String(f.name || '');
          if (slug === 'material-download' || (slug !== 'contact-inquiry' && slug !== 'business-diagnosis' && fname.includes('資料'))) {
            hasMaterialSubmission = true;
          } else if (
            slug === 'business-diagnosis' ||
            (f.form_type === 'diagnosis' && !['contact-inquiry', 'material-download', 'care-package-inquiry'].includes(slug))
          ) {
            hasActualDiagnosis = true;
          }
        }
      }
    }

    const latestLeadStatus = String(leadRes.data?.[0]?.status || '').trim();
    if (latestLeadStatus === '資料請求') hasMaterialSubmission = true;
    if (latestLeadStatus === '診断申込') hasActualDiagnosis = true;

    if (hasActualDiagnosis || hasMaterialSubmission) return 9;
    if (branchTags.includes('選択:個別相談') || branchTags.includes('介護保険外開業')) return 5;
    if (branchTags.includes('選択:診断') || latestLeadStatus === '相談申込') return 3;
  } catch (err) {
    console.warn('[FunnelOrchestration] computeContactEducationDelayShiftDays warning:', err);
  }
  return 0;
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

/**
 * Web/LINE個別相談のリードへ人が手動返信（1対1送信）を送った際、
 * 「人の返信から4日後に反応がない方だけ教育7話を開始」の対象になるかを判定する。
 */
export async function checkConsultationHumanReplyEligibility(
  db: SupabaseClient,
  params: {
    contactId: string;
    companyId?: string | null;
    sourceType?: string | null;
    documentId?: string | null;
  }
): Promise<{ eligible: boolean; reason: string }> {
  if (!params.contactId) {
    return { eligible: false, reason: '連絡先IDが未指定のため除外' };
  }
  if (params.documentId) {
    return { eligible: false, reason: '重要書類送信のため個別相談返信トリガーから除外' };
  }
  if (!isEligibleSourceTypeForConsultationHumanReply(params.sourceType)) {
    return { eligible: false, reason: `対象外の送信種別(${params.sourceType || 'unknown'})` };
  }

  try {
    const [progression, branchTags, leadRes, customerRes] = await Promise.all([
      hasContactAlreadyProgressedBeyondNurturing(db, params.contactId, params.companyId),
      getContactBranchTags(db, { id: params.contactId }),
      db
        .from('leads')
        .select('status, source, company_id')
        .eq('contact_id', params.contactId)
        .order('created_at', { ascending: false })
        .limit(5),
      params.companyId
        ? db.from('customers').select('id').eq('company_id', params.companyId).limit(1)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const latestLead = leadRes.data?.[0];
    let isExistingCustomer = Boolean(customerRes.data && customerRes.data.length > 0);
    if (!isExistingCustomer && latestLead?.company_id && latestLead.company_id !== params.companyId) {
      const { data: leadCust } = await db
        .from('customers')
        .select('id')
        .eq('company_id', latestLead.company_id)
        .limit(1);
      isExistingCustomer = Boolean(leadCust && leadCust.length > 0);
    }

    const eligible = isConsultationLeadEligibleForHumanReplyEducation({
      hasProgressedBeyondNurturing: progression.progressed,
      isExistingCustomer,
      latestLeadStatus: latestLead?.status,
      latestLeadSource: latestLead?.source,
      branchTags,
    });

    if (!eligible) {
      return {
        eligible: false,
        reason: progression.progressed
          ? progression.reason
          : isExistingCustomer
          ? '既存顧客のため教育ステップ対象外'
          : `リードステータス(${latestLead?.status || 'なし'})が個別相談返信フォロー対象外`,
      };
    }
    return { eligible: true, reason: '個別相談リードへの有人返信を確認（4日後から教育7話へ合流）' };
  } catch (err) {
    console.warn('[FunnelOrchestration] checkConsultationHumanReplyEligibility warning:', err);
    return { eligible: false, reason: '判定中にエラーが発生したためスキップ' };
  }
}
