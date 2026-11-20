import type { MarketingScenario, MarketingTrigger } from '../types/marketing';

/**
 * 面談実施後〜提案フェーズの自動フォロー対象トリガー。
 * これらは「予約済み」や「リードステータス=商談化」の段階では止まらず、
 * 「成約・受注・失注・返信」になった時だけ自動停止する。
 */
export const POST_MEETING_TRIGGERS: readonly MarketingTrigger[] = [
  'meeting_completed',
  'report_approved',
  'report_sent',
  'proposal_approved',
  'proposal_sent',
  'report_or_proposal_sent',
] as const;

export const BRANCH_EDUCATION_DELAY_DAYS = {
  line_registered: 0,
  '選択:個別相談': 5,
  '介護保険外開業': 5,
  '選択:診断': 3,
  diagnosis_completed: 9,
  material_requested: 9,
  public_form_consultation: 3,
  consultation_human_reply: 2,
} as const;

export function getEducationStartDayForShift(shiftDays: number): number {
  return 2 + Math.max(0, Math.round(shiftDays));
}

export function isPostDealStageTrigger(trigger: string): boolean {
  return (POST_MEETING_TRIGGERS as readonly string[]).includes(String(trigger || '').trim());
}

const CLOSED_DEAL_STATUSES = ['成約', '受注', 'won', 'closed_won', '失注', '見送り', 'lost'];
const PRE_MEETING_STOP_LEAD_STATUSES = ['商談化', '成約', '受注', '失注', '見送り', '失注・対象外'];
const POST_MEETING_STOP_LEAD_STATUSES = ['成約', '受注', '失注', '見送り', '失注・対象外'];

/**
 * stopOnDeal が有効なシナリオを停止すべきかを判定する。
 * - 資料請求後・診断後・営業メール等の「商談前」フォロー: 商談化/成約/受注で停止
 * - 面談後・レポート送付後・提案書送付後の「商談後」フォロー: 成約/受注/失注/見送りでのみ停止（「商談化」では止めない）
 */
export function shouldStopScenarioForDeal(params: {
  trigger: string;
  dealProposalStatus?: string | null;
  leadStatus?: string | null;
}): { stop: boolean; reason: string } {
  const dealStatus = String(params.dealProposalStatus || '').trim();
  const leadStatus = String(params.leadStatus || '').trim();
  const isPostMeeting = isPostDealStageTrigger(params.trigger);

  if (dealStatus && CLOSED_DEAL_STATUSES.includes(dealStatus)) {
    return {
      stop: true,
      reason: `成約・終了済みのため停止（商談ステータス: ${dealStatus}）`,
    };
  }

  const targetLeadStatuses = isPostMeeting ? POST_MEETING_STOP_LEAD_STATUSES : PRE_MEETING_STOP_LEAD_STATUSES;
  if (leadStatus && targetLeadStatuses.includes(leadStatus)) {
    return {
      stop: true,
      reason: `${isPostMeeting ? '成約・終了' : '商談化'}のため停止（リードステータス: ${leadStatus}）`,
    };
  }

  return { stop: false, reason: '' };
}

// ---------------------------------------------------------------------------
// 0. 全導線の自動連動・配信制御ルール（UI説明とサーバー実行ロジックの単一正本）
// ---------------------------------------------------------------------------
export type FunnelPhase =
  | 'line_welcome_branch'
  | 'education_nurturing'
  | 'diagnosis_followup'
  | 'material_followup'
  | 'booking_confirm'
  | 'post_meeting'
  | 'post_contract'
  | 'sales_outreach'
  | 'other';

export interface FunnelOrchestrationRuleSummary {
  id: string;
  title: string;
  badge: string;
  description: string;
}

export const FUNNEL_ORCHESTRATION_RULES: readonly FunnelOrchestrationRuleSummary[] = [
  {
    id: 'line_first_email_fallback',
    title: 'LINE優先・未連携時のみメール（二重配信ゼロ）',
    badge: 'チャネル最適化',
    description:
      '「LINE＋メール」設定のシナリオは、有効なLINE友だち（ブロック解除なし・配信同意あり）にはLINEのみを配信し、LINE未連携・ブロック時は自動でメールへ切り替えます。同一ステップを同じ相手へLINE・メール同時に二重送信しません。',
  },
  {
    id: 'plan_a_long_term_nurturing',
    title: 'A案（長期育成型）：分岐・Web経由は直後フォロー完了後に教育7話へ合流',
    badge: '教育7話 長期育成',
    description:
      'ウェルカム無反応は2日後から教育7話を開始。一方、個別相談への人の返信から4日反応がない方（4日後〜）、分岐B/C（7日後〜）、診断・資料請求後（11日後〜）、未対応Web相談フォーム（5日後〜）の未予約・未返信の方には直後フォロー完了後に教育7話を自動配信します（LINE未連携時はメール補完）。',
  },
  {
    id: 'unified_post_meeting_followup',
    title: 'レポート＆提案書 送付後フォロー（3日・7日）の統合・重複防止',
    badge: '商談後フォロー統合',
    description:
      '「詳細診断レポート」と「ご提案書」を別々または一体で送付しても、送付後3日・7日のフォローは統合ステップ1系統のみを配信し、同じ相手へ2通重複して送らない設計に統一しています。',
  },
  {
    id: 'stage_handoff_cancellation',
    title: '次の段階へ進んだら手前の追客を自動停止',
    badge: 'ステージ進行連動',
    description:
      '診断完了・資料請求・TimeRex/フォーム面談予約・面談完了・提案送付・Web契約締結のイベント発生時、手前フェーズの未送信ジョブを自動停止して次フェーズのフォローだけを残します。',
  },
  {
    id: 'cross_channel_reply_stop',
    title: 'LINE・メールどちらへの返信でも即停止',
    badge: '全チャネル返信検知',
    description:
      '顧客がLINEトークまたはメールのどちらかに返信した時点で、予約待ちの教育・追客ジョブ（LINE・メール両方）を即座に自動停止し、有人対応へ切り替えます。',
  },
] as const;

export function classifyScenarioFunnelPhase(cfg: {
  trigger?: string | null;
  targetTag?: string | null;
  name?: string | null;
}): FunnelPhase {
  const trigger = String(cfg.trigger || '').trim();
  const targetTag = String(cfg.targetTag || '').trim();
  const name = String(cfg.name || '').trim();

  if (trigger === 'line_registered') {
    return 'education_nurturing';
  }
  if (trigger === 'diagnosis_completed' || (trigger === 'tag_added' && targetTag === '選択:診断')) {
    return 'diagnosis_followup';
  }
  if (trigger === 'material_requested') {
    return 'material_followup';
  }
  if (trigger === 'tag_added' && (targetTag === '選択:個別相談' || targetTag === '介護保険外開業')) {
    return 'line_welcome_branch';
  }
  if (trigger === 'booking_created') {
    return 'booking_confirm';
  }
  if (isPostDealStageTrigger(trigger)) {
    return 'post_meeting';
  }
  if (trigger === 'contract_signed' || trigger === 'contract_sent' || trigger === 'deal_won') {
    return 'post_contract';
  }
  if (trigger === 'outreach_first_sent' || trigger === 'prospect_selected' || trigger === 'lead_created') {
    return 'sales_outreach';
  }
  if (name.includes('【第') && name.includes('話')) {
    return 'education_nurturing';
  }
  return 'other';
}

export function getSupersededPhasesOnEvent(event: {
  trigger: string;
  tagName?: string | null;
}): {
  cancelPhases: FunnelPhase[];
  cancelSpecificTargets?: Array<{ trigger: string; targetTag?: string }>;
  excludeTargetTags?: string[];
  reason: string;
} {
  const trigger = String(event.trigger || '').trim();
  const tagName = String(event.tagName || '').trim();

  if (trigger === 'contract_signed' || trigger === 'deal_won') {
    return {
      cancelPhases: [
        'line_welcome_branch',
        'education_nurturing',
        'diagnosis_followup',
        'material_followup',
        'booking_confirm',
        'post_meeting',
        'sales_outreach',
      ],
      reason: 'ご契約締結・成約のため、商談前および商談後の自動フォローを停止',
    };
  }

  if (isPostDealStageTrigger(trigger)) {
    return {
      cancelPhases: [
        'line_welcome_branch',
        'education_nurturing',
        'diagnosis_followup',
        'material_followup',
        'booking_confirm',
        'sales_outreach',
      ],
      reason: '面談・商談フェーズへ進行したため、商談前の自動フォローを停止',
    };
  }

  if (trigger === 'booking_created' || (trigger === 'tag_added' && tagName === '個別相談予約済み')) {
    return {
      cancelPhases: [
        'line_welcome_branch',
        'education_nurturing',
        'diagnosis_followup',
        'material_followup',
        'sales_outreach',
      ],
      reason: '面談日程の予約が確定したため、商談前の教育・追客フォローを自動停止',
    };
  }

  if (trigger === 'diagnosis_completed') {
    return {
      cancelPhases: ['education_nurturing', 'sales_outreach'],
      cancelSpecificTargets: [{ trigger: 'tag_added', targetTag: '選択:診断' }],
      reason: '無料経営診断の回答が完了したため、未回答リマインド・従来の短期教育・営業追客を停止し、診断後フォロー（1〜7日目）＋長期教育（11日目〜）へ切替',
    };
  }

  if (trigger === 'material_requested') {
    return {
      cancelPhases: ['education_nurturing', 'sales_outreach'],
      reason: '資料請求フォームを受信したため、一般短期教育・営業追客を停止し、資料請求後フォロー（1〜7日目）＋長期教育（11日目〜）へ切替',
    };
  }

  if (trigger === 'tag_added' && ['選択:診断', '選択:個別相談', '介護保険外開業'].includes(tagName)) {
    const otherBranches = ['選択:診断', '選択:個別相談', '介護保険外開業'].filter((t) => t !== tagName);
    return {
      cancelPhases: ['education_nurturing'],
      cancelSpecificTargets: otherBranches.map((t) => ({ trigger: 'tag_added', targetTag: t })),
      reason: `LINE分岐「${tagName}」を選択したため、別分岐および分岐前スケジュールの未送信ジョブを整理`,
    };
  }

  if (trigger === 'consultation_human_replied') {
    return {
      cancelPhases: ['education_nurturing'],
      reason: '人の返信送信に伴い、未送信の教育ステップを「返信4日後〜」へ再スケジュールするため整理',
    };
  }

  return { cancelPhases: [], reason: '' };
}

/**
 * LINE分岐ルート（選択:個別相談 / 介護保険外開業 / 選択:診断）に入った連絡先に対して、
 * 1日後・3日後の分岐フォローと重なる教育ステップ第1話（2日後）のみをスキップし、
 * 5日目の第2話以降は配信できるようにする。
 */
export function isOverlappingEducationStepForBranch(
  cfg: { trigger?: string | null; name?: string | null; waitMinutes?: number | null },
  activeBranchTags: readonly string[]
): boolean {
  if (classifyScenarioFunnelPhase(cfg) !== 'education_nurturing') return false;
  const hasBranch = activeBranchTags.some((t) =>
    t === '選択:個別相談' || t === '介護保険外開業' || t === '選択:診断'
  );
  if (!hasBranch) return false;
  const waitMinutes = Number(cfg.waitMinutes || 0);
  const name = String(cfg.name || '');
  return waitMinutes === 2880 || name.includes('【第1話】') || name.includes('第1話');
}

/**
 * 配信チャネルの決定（LINE優先・未連携時はメール／二重送信を行わない）
 */
export function resolvePreferredDeliveryChannels(params: {
  channelSetting?: string | null;
  hasLineDeliverable: boolean;
  hasEmail: boolean;
}): ('line' | 'email')[] {
  const mode = String(params.channelSetting || 'both').trim();
  if (mode === 'line') {
    return params.hasLineDeliverable ? ['line'] : [];
  }
  if (mode === 'email') {
    return params.hasEmail ? ['email'] : [];
  }
  // 'both': LINEが届く相手にはLINEのみを送り、LINE不可（未登録・ブロック・オプトアウト）の相手にはメールを送る
  if (params.hasLineDeliverable) {
    return ['line'];
  }
  if (params.hasEmail) {
    return ['email'];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 全ステップ一覧・導線管理 共通分類・表示・ソートユーティリティ
// ---------------------------------------------------------------------------
export type ScenarioTrackCategory =
  | 'branch_diagnosis'
  | 'branch_consult'
  | 'branch_care'
  | 'story_nurturing'
  | 'material_followup'
  | 'post_meeting'
  | 'sales_outreach'
  | 'other';

export interface ScenarioTrackMeta {
  id: ScenarioTrackCategory;
  order: number;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  headerBgClass: string;
}

export const SCENARIO_TRACK_ORDER: readonly ScenarioTrackCategory[] = [
  'branch_diagnosis',
  'branch_consult',
  'branch_care',
  'story_nurturing',
  'material_followup',
  'post_meeting',
  'sales_outreach',
  'other',
] as const;

export const SCENARIO_TRACK_META: Record<ScenarioTrackCategory, ScenarioTrackMeta> = {
  branch_diagnosis: {
    id: 'branch_diagnosis',
    order: 1,
    label: '① 分岐A：3分無料経営診断',
    shortLabel: '分岐A：診断',
    description: '診断未回答リマインド・HP診断完了後の教育〜商談案内（1〜7日後）',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBgClass: 'bg-emerald-50/70 border-emerald-200',
  },
  branch_consult: {
    id: 'branch_consult',
    order: 2,
    label: '② 分岐B：個別相談',
    shortLabel: '分岐B：相談',
    description: 'LINE「個別相談」選択後の親身フォロー・商談案内（1・3日後）',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    headerBgClass: 'bg-sky-50/70 border-sky-200',
  },
  branch_care: {
    id: 'branch_care',
    order: 3,
    label: '③ 分岐C：介護保険外開業',
    shortLabel: '分岐C：介護',
    description: '「介護保険外開業」選択後の専門教育・作戦会議案内（1・3日後）',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    headerBgClass: 'bg-violet-50/70 border-violet-200',
  },
  story_nurturing: {
    id: 'story_nurturing',
    order: 4,
    label: '④ 共通教育：大橋ストーリー（全7話）',
    shortLabel: '教育7話',
    description: 'A案：無反応は2日後〜／分岐・診断・資料・Web相談は直後フォロー完了後に合流',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    headerBgClass: 'bg-indigo-50/70 border-indigo-200',
  },
  material_followup: {
    id: 'material_followup',
    order: 5,
    label: '⑤ 資料請求後フォロー',
    shortLabel: '資料請求後',
    description: '資料ダウンロード後の自動追客（1・3・7日後／LINE優先・メール補完）',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    headerBgClass: 'bg-teal-50/70 border-teal-200',
  },
  post_meeting: {
    id: 'post_meeting',
    order: 6,
    label: '⑥ 面談後・ご提案書送付後フォロー',
    shortLabel: '面談・提案後',
    description: '面談完了2時間後のお礼＋ご提案書送付後3日・7日後の統合フォロー（重複防止）',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    headerBgClass: 'bg-amber-50/70 border-amber-200',
  },
  sales_outreach: {
    id: 'sales_outreach',
    order: 7,
    label: '⑦ 営業メール（新規開拓）',
    shortLabel: '営業メール',
    description: '一発直球（手動）＋第1〜5通フォロー（3日おき・返信/予約で自動停止）',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBgClass: 'bg-blue-50/70 border-blue-200',
  },
  other: {
    id: 'other',
    order: 99,
    label: '⑧ その他・カスタムシナリオ',
    shortLabel: 'その他',
    description: '個別に作成されたカスタム配信シナリオ',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    headerBgClass: 'bg-slate-50 border-slate-200',
  },
};

export const SCENARIO_TRIGGER_LABELS: Record<string, string> = {
  prospect_selected: '営業対象選定時',
  lead_created: '見込み客登録時',
  material_requested: '資料請求送信時',
  outreach_first_sent: '営業第1通送信時',
  line_registered: 'LINE登録された時 ＋ フォロー4日後',
  diagnosis_invited: '診断案内送信時',
  diagnosis_completed: '無料診断完了時',
  report_or_proposal_sent: 'ご提案書・レポート送付時（統合）',
  report_approved: '診断レポート承認時',
  report_sent: '診断レポート送付時',
  meeting_completed: '面談完了時',
  tag_added: '指定タグ付与時',
  booking_created: '面談予約時',
  deal_stage_changed: '商談ステージ変更時',
  deal_won: '商談成約時',
  proposal_approved: '提案書承認時',
  proposal_sent: '提案書送付時',
  contract_sent: '契約書送付時',
  contract_signed: '契約締結時',
  invoice_due: '請求予定日到達時',
  invoice_overdue: '請求期日超過時',
  retainer_period: '顧問サポート時期',
  project_milestone: '構築節目到達時',
  manual: '手動送信',
};

export function formatScenarioTriggerLabel(trigger: string, targetTag?: string | null): string {
  const key = String(trigger || '').trim();
  if (key === 'tag_added' && targetTag && targetTag.trim()) {
    return `タグ「${targetTag.trim()}」`;
  }
  return SCENARIO_TRIGGER_LABELS[key] || key || '未設定';
}

export function formatScenarioWaitMinutes(waitMinutes?: number | null): string {
  const mins = Number(waitMinutes || 0);
  if (!Number.isFinite(mins) || mins <= 0) return '即時';
  if (mins < 60) return `${Math.round(mins)}分後`;
  if (mins < 1440) return `${Math.round(mins / 60)}時間後`;
  return `${Math.round(mins / 1440)}日後`;
}

export function formatScenarioStopCondition(cfg: {
  trigger?: string | null;
  stopOnBooking?: boolean;
  stopOnDeal?: boolean;
}): string {
  const isPostMeeting = isPostDealStageTrigger(String(cfg.trigger || ''));
  if (isPostMeeting) {
    return cfg.stopOnDeal ? '返信・成約・終了で停止' : '返信で自動停止';
  }
  if (cfg.stopOnBooking && cfg.stopOnDeal) return '返信・予約・成約で停止';
  if (cfg.stopOnBooking) return '返信・予約で停止';
  if (cfg.stopOnDeal) return '返信・成約で停止';
  return '返信で自動停止';
}

export function classifyScenarioTrack(
  s: Pick<MarketingScenario, 'name' | 'trigger' | 'targetTag' | 'channel'> & { id?: string }
): ScenarioTrackCategory {
  const name = (s.name || '').trim();
  const trigger = String(s.trigger || '').trim();
  const targetTag = String(s.targetTag || '').trim();

  if (
    isPostDealStageTrigger(trigger) ||
    name.includes('【面談後') ||
    name.includes('【提案書送付後') ||
    isLegacyPostMeetingScenarioName(name)
  ) {
    return 'post_meeting';
  }
  if (trigger === 'material_requested' || name.includes('【資料請求')) {
    return 'material_followup';
  }
  if (
    s.id === 'prospect-one-shot' ||
    name.includes('一発直球') ||
    trigger === 'outreach_first_sent' ||
    name.includes('営業メール') ||
    name.includes('【営業') ||
    /^【第\d+通/.test(name) ||
    (s.channel === 'email' && trigger === 'lead_created') ||
    (trigger === 'manual' && /^【第\d+通/.test(name))
  ) {
    return 'sales_outreach';
  }
  if (
    trigger === 'diagnosis_completed' ||
    trigger === 'diagnosis_invited' ||
    (trigger === 'tag_added' && targetTag === '選択:診断') ||
    name.includes('【A') ||
    isLegacyBranchAScenarioName(name) ||
    (name.includes('診断') && !name.includes('【第'))
  ) {
    return 'branch_diagnosis';
  }
  if (
    (trigger === 'tag_added' && targetTag === '選択:個別相談') ||
    name.includes('【B') ||
    (name.includes('個別相談') && !name.includes('介護') && !name.includes('【第')) ||
    name.includes('直相談')
  ) {
    return 'branch_consult';
  }
  if (
    (trigger === 'tag_added' && targetTag === '介護保険外開業') ||
    name.includes('【C') ||
    name.includes('介護') ||
    name.includes('保険外')
  ) {
    return 'branch_care';
  }
  if (
    trigger === 'line_registered' ||
    name.includes('ストーリー') ||
    name.includes('大橋') ||
    name.includes('ナーチャリング') ||
    name.includes('話】')
  ) {
    return 'story_nurturing';
  }
  return 'other';
}

const CIRCLED_DIGIT_MAP: Record<string, string> = {
  '①': '1',
  '②': '2',
  '③': '3',
  '④': '4',
  '⑤': '5',
  '⑥': '6',
  '⑦': '7',
  '⑧': '8',
  '⑨': '9',
};

function normalizeCircledDigits(text: string): string {
  return text.replace(/[①②③④⑤⑥⑦⑧⑨]/g, (ch) => CIRCLED_DIGIT_MAP[ch] || ch);
}

export function getScenarioSortKey(scenario: MarketingScenario): {
  categoryOrder: number;
  stepNumber: number;
  waitMinutes: number;
  name: string;
} {
  const name = scenario.name || '';
  const track = classifyScenarioTrack(scenario);
  const categoryOrder = SCENARIO_TRACK_META[track].order;

  const normalized = normalizeCircledDigits(name);
  const numMatch =
    normalized.match(/[【［\[第ABCステップ]*\s*(\d+)/) || normalized.match(/(\d+)/);
  let stepNumber = numMatch ? parseInt(numMatch[1], 10) : 999;

  if (track === 'sales_outreach' && (scenario.id === 'prospect-one-shot' || name.includes('一発直球'))) {
    stepNumber = 0;
  } else if (track === 'post_meeting') {
    const baseSubStep = numMatch ? parseInt(numMatch[1], 10) : 1;
    if (scenario.trigger === 'meeting_completed') {
      stepNumber = baseSubStep;
    } else if (scenario.trigger === 'report_or_proposal_sent') {
      stepNumber = 10 + baseSubStep;
    } else {
      stepNumber = 100 + baseSubStep;
    }
  } else if (track === 'branch_diagnosis' && isLegacyBranchAScenarioName(name)) {
    // 旧数字パターン（1〜5）や旧A1〜A5は現行A1〜A4の後ろにまとめて表示し、交互混在を防ぐ
    stepNumber += 100;
  }

  return {
    categoryOrder,
    stepNumber,
    waitMinutes: scenario.waitMinutes ?? 0,
    name,
  };
}

export function sortScenarios(scenarios: MarketingScenario[]): MarketingScenario[] {
  return [...scenarios].sort((a, b) => {
    const keyA = getScenarioSortKey(a);
    const keyB = getScenarioSortKey(b);

    if (keyA.categoryOrder !== keyB.categoryOrder) {
      return keyA.categoryOrder - keyB.categoryOrder;
    }
    if (keyA.stepNumber !== keyB.stepNumber) {
      return keyA.stepNumber - keyB.stepNumber;
    }
    if (keyA.waitMinutes !== keyB.waitMinutes) {
      return keyA.waitMinutes - keyB.waitMinutes;
    }
    return keyA.name.localeCompare(keyB.name, 'ja');
  });
}

// ---------------------------------------------------------------------------
// 1. 分岐A: 3分無料経営診断 フォロー（LINE + メール両対応）
// ---------------------------------------------------------------------------
export const MST_DIAGNOSIS_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【A1・未回答教育】1日後：まだお済みでない方へ（その場で簡易診断結果が出ます）',
    trigger: 'tag_added',
    targetTag: '選択:診断',
    channel: 'line',
    audience: '「選択:診断」タグ（HP診断未送信者のみ）',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n昨日は無料経営診断をお選びいただきありがとうございました！\n多くの企業様で課題となる「人手不足・利益が残らない悩み」は、実は人ではなく【業務の配管（仕組み）の詰まり】が原因であることがほとんどです。\n\nホームページの選択式チェック（約3分）にご回答いただくと、送信直後にその場で【簡易診断結果（ボトルネック傾向・最初の一手）】をご確認いただけますので、お時間のある際にぜひお試しください。\n\n▼ 3分無料経営診断はこちら（その場で速報判定）\n{link_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【3分無料診断】回答直後に簡易診断結果をご確認いただけます',
    flexTitle: '📊 3分で「簡易診断結果」を即時表示',
    flexBody:
      '{recipient_name} 様\n業務や利益のボトルネック傾向が約3分で分かり、回答直後にホームページ上で【簡易診断結果】をご確認いただけます（無料）。',
    flexButtonLabel: '3分簡易診断を始める',
    flexButtonUrl: '{link_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE診断ルート選択時の配信同意に基づく',
  },
  {
    name: '【A2・簡易結果の解説】1日後：簡易診断結果の見方と最初の急所',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 1440,
    emailSubject: '【MST】先日の無料経営診断：結果の見方と「最初に着手すべき急所」について',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日は「3分無料経営診断」にご回答いただき誠にありがとうございました。\n画面上に表示された【簡易診断結果】はご覧いただけましたでしょうか。\n\n簡易診断では「いま御社の業務・利益のどこに詰まりが出やすいか」の傾向を整理しています。\nもし結果をご覧になって「自社の場合は具体的にどこから手を付けるのが一番効果的か」が気になられましたら、30分の無料オンライン商談をご活用ください。\n\nなお、より踏み込んだ【詳細診断レポート】および【改善提案書】は、机上の空論を避けるため、30分商談で直接状況をお伺いした方限定で商談後に作成・進呈しております。\n\n▼ 30分無料オンライン商談の日程を選ぶ\n{booking_url}\n\n本メールへのご返信でもご相談を承っております。どうぞお気軽にご連絡ください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日は「3分無料経営診断」へのご回答ありがとうございました！ホームページ上に表示された【簡易診断結果】はご覧いただけましたでしょうか？\n\n簡易診断では「いまどこに詰まりが出やすいか」の傾向を整理しています。\nなお、御社の実情に合わせた【詳細な診断レポート・改善提案書】は、直接お話を伺った上で「30分のオンライン商談を実施された方限定」で商談後に作成・お渡ししております。\n\n▼ 無料オンライン商談（30分）の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【簡易診断結果の解説】最初の改善候補と詳細レポートのご案内',
    flexTitle: '🔎 簡易診断結果の活かし方',
    flexBody:
      '{recipient_name} 様\nHP上の簡易診断結果で把握した傾向をもとに、どこから着手すべきかを30分の無料商談で一緒に整理しませんか？（詳細な診断レポート・提案書は商談後に作成・進呈しております）',
    flexButtonLabel: '30分商談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A3・事例教育×商談案内】3日後：仕組み化事例 ＆ 詳細レポート付き商談',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 4320,
    emailSubject: '【MST改善事例】簡易診断から小さく始めて「利益が残る仕組み」を整えた事例',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日の経営診断に続き、同規模の企業様がどのように改善を進められているか事例を1つ共有いたします。\n\n多くの企業様では、最初から大きなシステムを入れるのではなく、\n・見積・請求・顧客情報の二重入力の整理\n・問い合わせ〜商談予約までの自動導線化\nなど「一番効果が出やすい1点」から小さく着手することで、現場に負担をかけずに利益が残る体制を整えられています。\n\n30分のオンライン商談では、先日の簡易診断結果をベースに「御社が最初に直すならここ」を一緒に絞り込み、商談後に御社専用の【詳細診断レポート・改善提案書】をお渡ししております。\n\n▼ 30分オンライン商談（改善作戦会議）の日程を選ぶ\n{booking_url}\n\n情報収集の一環としてもお気軽にご活用ください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日の簡易診断に続き、同規模の企業様が「請求・見積・顧客情報の二重入力の解消」や「集客〜商談の導線接続」から小さく着手し、手元に利益が残る体制を整えた改善事例をご案内しております。\n\n30分のオンライン商談では、簡易診断の結果をベースに「御社が最初に直すべき1点」を絞り込み、商談後に御社専用の【詳細診断レポート・改善提案書】を進呈しております。\n\n▼ 個別商談の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【改善事例】簡易診断から仕組み化に着手した事例＆詳細レポートのご案内',
    flexTitle: '💡 仕組み化の事例 ＆ 個別商談',
    flexBody:
      '{recipient_name} 様\n簡易診断で見えたボトルネックを現場に負担なく解消した他社事例をご紹介。商談を実施された方限定で、商談後に「詳細診断レポート＆改善提案書」をお渡ししています。',
    flexButtonLabel: '詳細レポート付き商談を予約',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A4・最終商談案内】7日後：簡易診断後1週間・30分無料個別相談のご案内',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 10080,
    emailSubject: '【MST】無料診断から1週間：30分オンライン作戦会議のご案内',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n無料経営診断にご回答いただいてから1週間が経ちました。\n「診断結果を見て気になっているが、日々の業務に追われてなかなか進められていない」というご相談もよくいただきます。\n\nもしよろしければ、30分の無料オンライン商談にて現状の優先順位を一緒に整理させてください。整理した内容をもとに、商談後には御社専用の【詳細診断レポート・改善提案書】をお送りいたします。\n\n▼ 相談枠の確認・ご予約はこちら\n{booking_url}\n\n※なお、ご希望がございましたら本メールへの一言ご返信でも結構です。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n簡易診断をご回答いただいてから1週間が経ちました。もし「結果を見て気になっているが、日々の対応に追われて進められていない」という場合は、30分の無料オンライン相談をご活用ください。\n\n現状の優先順位を整理した上で、商談後に御社専用の【詳細診断レポート・改善提案書】をお届けいたします。\n\n▼ 相談枠の確認・ご予約はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【最終案内】簡易診断後の30分無料個別相談（詳細レポート進呈）',
    flexTitle: '🗓️ 30分無料・個別作戦会議のご案内',
    flexBody:
      '{recipient_name} 様\n簡易診断から1週間が経過しました。まずは30分のオンライン商談で改善の優先順位を整理しませんか？（詳細診断レポート・提案書は商談実施後に進呈）',
    flexButtonLabel: '今月の相談枠を確認する',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
];

// ---------------------------------------------------------------------------
// 2. 資料請求後の自動追客ステップ（1日後・3日後・7日後）
// ---------------------------------------------------------------------------
export const MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【資料請求①】1日後：資料をご覧いただけましたか？（ポイント解説）',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（LINE・メール両対応／返信・予約で停止）',
    waitMinutes: 1440,
    emailSubject: '【MST】先日は資料をご請求いただきありがとうございました（読みどころのご案内）',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n昨日は弊社資料をご請求いただき、誠にありがとうございました。\n\n資料は無事お手元でご覧いただけましたでしょうか。\nお忙しい中かと思いますので、特に経営者様から「参考になった」とよくいただくポイントを1点だけお伝えします。\n\nそれは「現場の属人化や利益の漏れを直すときは、ツールを足す前に“いま詰まっている1箇所の業務フロー”を見極めるだけで大きく変わる」という点です。\n\nもし「自社だとどこが詰まっているか、まずは手軽に確認してみたい」という場合は、3分で結果が分かる無料経営診断もご活用いただけます。\n\n▼ 資料の再確認・ダウンロードはこちら\n{material_url}\n\n▼ 3分無料経営診断はこちら\n{link_url}\n\n▼ 個別のご相談・30分オンライン相談（TimeRex面談予約）はこちら\n{booking_url}\n\n資料内容についてご質問がございましたら、このままご返信いただければすぐにお答えいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n昨日は資料をご請求いただきありがとうございました！無事ご覧いただけましたでしょうか？\n\n「自社の場合はどこから改善するのが一番効果的か整理したい」という場合は、約3分で簡易診断結果が出る無料診断や、30分の個別オンライン相談もお気軽にご活用ください。\n\n▼ 資料のダウンロード・確認はこちら\n{material_url}\n\n▼ 3分無料経営診断はこちら\n{link_url}\n\n▼ 30分無料オンライン相談（面談予約）はこちら\n{booking_url}\n\n※資料に関するご質問も、このままLINEにご返信ください！',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料請求フォロー】資料はご覧いただけましたか？（無料診断・相談案内）',
    flexTitle: '📘 資料のご確認ありがとうございます',
    flexBody:
      '{recipient_name} 様\n先日の資料はご覧いただけましたでしょうか？「自社ならどこから改善できるか」を手軽に把握できる3分無料診断もご用意しています。',
    flexButtonLabel: '3分無料診断を試す',
    flexButtonUrl: '{link_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
  {
    name: '【資料請求②】3日後：同規模企業様の改善事例 ＆ 30分無料相談のご案内',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（商談未予約者／返信・予約で停止）',
    waitMinutes: 4320,
    emailSubject: '【MST改善事例】資料の活用例と「30分無料・個別作戦会議」のご案内',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日の資料に続けて、実際に仕組み化に取り組まれた企業様の変化を1つご紹介いたします。\n\n「日々の見積・請求・顧客管理に追われて本来やりたい事業に時間が割けない」とお悩みだった企業様でも、業務の流れを棚卸しして不要な二重作業を整理したことで、社長や現場の負担を大きく減らすことができました。\n\n資料の内容を「自社に当てはめるとどうなるか」を30分の無料オンライン相談で一緒に整理することも可能ですので、ご都合のよろしいタイミングでご活用ください。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}\n\nもちろん売り込みなどは一切いたしませんので、現状の壁打ちとしてお気軽にお使いください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n資料でお伝えしている仕組み化について、「自社に当てはめるとどこから取り組むのが良いか」を30分の無料オンライン相談で一緒に整理することも可能です。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}\n\nまだ具体的な検討段階でない場合も、壁打ちとしてお気軽にご活用ください。',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料活用】自社に当てはめて整理できる30分無料オンライン相談のご案内',
    flexTitle: '💡 30分無料・改善作戦会議のご案内',
    flexBody:
      '{recipient_name} 様\n資料の内容を「御社ならどこから着手すべきか」に落とし込む30分の無料オンライン相談をご案内しております。',
    flexButtonLabel: '30分相談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
  {
    name: '【資料請求③】7日後：もしお困りの点があれば一言ご返信ください',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（最終フォロー／返信・予約で停止）',
    waitMinutes: 10080,
    emailSubject: '【MST】資料請求から1週間：お困りごとやご相談はございませんか？',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n資料をご請求いただいてから1週間が経過いたしました。\nその後、社内でのお取り組みやご検討状況はいかがでしょうか。\n\nもし「資料を読んで気になる点があった」「具体的な事例や費用感について少し聞いてみたい」ということがございましたら、本メールへ一言ご返信いただくか、下記より個別相談をご利用ください。\n\n▼ 30分無料オンライン相談のご予約\n{booking_url}\n\nまたお役に立てることがございましたら、いつでもお声がけください。今後ともよろしくお願いいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n資料をご請求いただいてから1週間が経ちました。資料の内容や今後の進め方について気になる点がございましたら、いつでも一言LINEでお送りください。\n\n▼ 30分無料オンライン相談のご予約はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料請求1週間フォロー】ご不明点・個別相談のご案内',
    flexTitle: '📅 資料に関するご質問・個別相談',
    flexBody:
      '{recipient_name} 様\n資料請求から1週間が経過しました。気になる点のご質問や個別相談のご希望があれば、いつでもお気軽にご連絡ください。',
    flexButtonLabel: '相談枠を確認する',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
];

// ---------------------------------------------------------------------------
// 3. 面談後・レポート＆提案書送付後の自動フォロー（stopOnBooking: false / stopOnDeal: true）
// ---------------------------------------------------------------------------
export const MST_POST_MEETING_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【面談後①】2時間後：本日はお時間をいただきありがとうございました（お礼＆次回案内）',
    trigger: 'meeting_completed',
    channel: 'both',
    audience: '個別面談を完了したお客様（返信・成約で自動停止）',
    waitMinutes: 120,
    emailSubject: '個別面談のお礼と今後のご案内｜有限会社MST',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\nこのたびはお忙しい中、オンラインでの個別面談にお時間をいただき誠にありがとうございました。\n\nお打ち合わせにてお伺いいたしました現場の状況や課題感をもとに、現在ご提案内容を整理しております。\nお約束しておりました資料・ご提案の準備が整い次第、改めてお送りいたしますので、今しばらくお待ちくださいませ。\n\nなお、面談後に「これも補足しておきたい」「社内でこんな話が出た」という点がございましたら、このまま本メールへのご返信にてお気軽にお知らせください。\n\n引き続き、どうぞよろしくお願い申し上げます。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\nこのたびはお忙しい中、お打ち合わせのお時間をいただき誠にありがとうございました！\n\nお伺いした内容をもとに整理・準備を進めておりますので、まとまり次第またご連絡いたします。\n補足やご質問などございましたら、いつでもこのままLINEへお送りください。',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-21:00',
    preferredSendTime: '',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: '商談・面談実施に伴う顧客フォロー（取引関連連絡）',
  },
  {
    name: '【提案書送付後①】3日後：ご確認状況 ＆ ご質問のお伺い',
    trigger: 'report_or_proposal_sent',
    channel: 'both',
    audience: 'ご提案書（診断結果を含む）を送付済みのお客様（両方トリガー時も重複せず1通のみ配信）',
    waitMinutes: 4320,
    emailSubject: '【ご確認のお伺い】先日のご提案書について｜有限会社MST',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n先日お送りいたしましたご提案書（診断結果および改善プラン）について、内容をご確認いただけましたでしょうか。\n\n内容をご確認いただく中で、\n・「ここをもう少し詳しく聞きたい」「自社の状況に合わせた優先順位を相談したい」\n・「支援内容やスケジュール・一部の範囲からスモールスタートする案を検討したい」\nといったご希望やご質問がございましたら、柔軟に調整いたしますのでご遠慮なくお申し付けください。\n\n本メールへのご返信、または下記の日程調整リンクよりお気軽にご連絡をお待ちしております。\n\n▼ 追加のお打ち合わせ・ご相談日程はこちら\n{booking_url}',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n先日お送りいたしましたご提案書はご覧いただけましたでしょうか？\n「一部の範囲から始めたい」「詳しく質問・相談したい」などございましたら、このままLINEまたは下記日程よりお気軽にお知らせください！\n\n▼ 追加相談の日程はこちら\n{booking_url}',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: 'ご提案書送付後の顧客フォロー',
  },
  {
    name: '【提案書送付後②】7日後：ご検討状況のお伺い（導入範囲や時期のご相談）',
    trigger: 'report_or_proposal_sent',
    channel: 'both',
    audience: 'ご提案書（診断結果を含む）を送付済みのお客様（返信・成約で自動停止）',
    waitMinutes: 10080,
    emailSubject: '【MST】ご提案内容のその後いかがでしょうか（導入範囲や時期のご相談）',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\nご提案書（診断結果および改善プラン）をお送りしてから1週間ほど経ちましたため、その後のご検討状況をお伺いしたくご連絡いたしました。\n\n社内でのご検討に際して、もし前提条件の見直しやご予算・開始時期に合わせたプラン再設計が必要でしたら、15〜30分ほどオンラインで整理し直すことも可能です。\n\n▼ 再調整のお打ち合わせ日程はこちら\n{booking_url}\n\n今回は時期を見送る場合も含め、現在のご状況を一言お知らせいただけますと大変助かります。どうぞよろしくお願いいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\nご提案書をお送りしてから1週間が経ちましたため、その後のご状況をお伺いいたしました。\n開始時期や範囲の調整をご希望の場合は、15〜30分のオンラインで再整理も可能ですので、下記またはご返信にてお知らせください。\n\n▼ 再打ち合わせ日程はこちら\n{booking_url}',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: 'ご提案書送付後の顧客フォロー',
  },
];

export const LEGACY_BRANCH_A_PREFIXES = [
  '【1. 初回',
  '【2. 診断',
  '【3. レポート',
  '【4. 3日',
  '【5. 7日',
  '【A1・教育リマインド】',
  '【A2・診断直後】',
  '【A3・レポート送付】',
  '【A4・3日後教育】',
  '【A5・7日後商談案内】',
];

export const LEGACY_POST_MEETING_PREFIXES = [
  '【レポート後】',
  '【提案後①】',
  '【提案後②】',
  '【レポート＆提案書送付後①】',
  '【レポート＆提案書送付後②】',
];

export function isLegacyBranchAScenarioName(name: string): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  return (
    LEGACY_BRANCH_A_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ||
    /^【[1-5][\.．、・:\s]/.test(trimmed)
  );
}

export function isLegacyPostMeetingScenarioName(name: string): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  return LEGACY_POST_MEETING_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function isLegacyBranchBScenario(
  s: Pick<MarketingScenario, 'name' | 'trigger' | 'targetTag'>
): boolean {
  const name = (s.name || '').trim();
  const trigger = String(s.trigger || '').trim();
  if (!name) return false;
  if (name.includes('直相談')) return true;
  if (trigger === 'lead_created' && (name.includes('【B') || name.includes('個別相談'))) {
    return true;
  }
  return false;
}

const ELIGIBLE_HUMAN_REPLY_SOURCE_TYPES = new Set([
  'announcement_announcement',
  'freeform_announcement',
  'deal_invitation',
  'form_announcement',
  'diagnosis_announcement',
  'line_reply',
]);

export function isEligibleSourceTypeForConsultationHumanReply(sourceType?: string | null): boolean {
  const normalized = String(sourceType || '').trim().toLowerCase();
  if (!normalized) return false;
  return ELIGIBLE_HUMAN_REPLY_SOURCE_TYPES.has(normalized);
}

const NON_CONSULTATION_HUMAN_REPLY_LEAD_STATUSES = new Set([
  '資料請求',
  '診断申込',
  '面談予約済',
  '面談実施済',
  'ヒアリング済',
  '商談化',
  '成約',
  '受注',
  '失注',
  '見送り',
  '失注・対象外',
]);

export function isConsultationLeadEligibleForHumanReplyEducation(params: {
  hasProgressedBeyondNurturing: boolean;
  isExistingCustomer: boolean;
  latestLeadStatus?: string | null;
  latestLeadSource?: string | null;
  branchTags?: readonly string[];
}): boolean {
  if (params.hasProgressedBeyondNurturing || params.isExistingCustomer) {
    return false;
  }
  const status = String(params.latestLeadStatus || '').trim();
  if (status && NON_CONSULTATION_HUMAN_REPLY_LEAD_STATUSES.has(status)) {
    return false;
  }
  const tags = params.branchTags || [];
  const hasConsultBranchTag = tags.includes('選択:個別相談') || tags.includes('介護保険外開業');
  if (status === '相談申込' || hasConsultBranchTag) {
    return true;
  }
  if (status === '未対応') {
    const src = String(params.latestLeadSource || '').trim();
    return src.includes('LINE') || src.includes('HP') || src.includes('フォーム') || src.includes('相談');
  }
  return false;
}

export function mergeStarterScenarioBatch(
  existingScenarios: MarketingScenario[],
  presets: Omit<MarketingScenario, 'id' | 'updatedAt'>[],
  options?: {
    replaceLegacyBranchA?: boolean;
    replaceLegacyBranchB?: boolean;
    replaceLegacyPostMeeting?: boolean;
    nowMs?: number;
  }
): { merged: MarketingScenario[]; addedCount: number; updatedCount: number } {
  const now = options?.nowMs ?? Date.now();
  const shouldReplacePostMeeting =
    options?.replaceLegacyPostMeeting ??
    presets.some((p) => p.trigger === 'report_or_proposal_sent');
  const shouldReplaceBranchB =
    options?.replaceLegacyBranchB ??
    presets.some((p) => p.trigger === 'tag_added' && p.targetTag === '選択:個別相談');
  const extractStoryEp = (s: { name?: string; trigger?: string }) => {
    if (s.trigger !== 'line_registered') return null;
    const m = /^【第([1-7])話(?:[・\s]*最終話)?】/.exec((s.name || '').trim());
    return m ? parseInt(m[1], 10) : null;
  };
  const presetStoryEpisodes = new Set(
    presets.map(extractStoryEp).filter((ep): ep is number => ep !== null)
  );
  const presetNames = new Set(presets.map((p) => p.name.trim()));
  const baseList = existingScenarios.filter((s) => {
    const nm = (s.name || '').trim();
    if (options?.replaceLegacyBranchA && isLegacyBranchAScenarioName(nm)) return false;
    if (shouldReplaceBranchB && isLegacyBranchBScenario(s) && !presetNames.has(nm)) return false;
    if (shouldReplacePostMeeting && isLegacyPostMeetingScenarioName(nm)) return false;
    const ep = extractStoryEp(s);
    if (ep !== null && presetStoryEpisodes.has(ep) && !presetNames.has(nm)) {
      return false;
    }
    return true;
  });

  const existingByName = new Map<string, MarketingScenario>();
  baseList.forEach((s) => existingByName.set(s.name.trim(), s));

  let addedCount = 0;
  let updatedCount = 0;
  const updatedList = [...baseList];

  presets.forEach((preset, index) => {
    const pName = preset.name.trim();
    const existing = existingByName.get(pName);
    if (existing) {
      const targetIndex = updatedList.findIndex((s) => s.id === existing.id || s.name.trim() === pName);
      if (targetIndex !== -1) {
        updatedList[targetIndex] = {
          ...existing,
          ...preset,
          updatedAt: now,
        };
        updatedCount++;
      }
    } else {
      let hash = 0;
      for (let i = 0; i < pName.length; i++) hash = ((hash << 5) - hash) + pName.charCodeAt(i);
      const stableId = `starter-${preset.channel}-${Math.abs(hash).toString(36)}-${index}`;

      const newScenario: MarketingScenario = {
        ...preset,
        id: stableId,
        updatedAt: now + index * 10,
      };
      updatedList.unshift(newScenario);
      existingByName.set(pName, newScenario);
      addedCount++;
    }
  });

  // Deduplicate by name preserving latest updatedAt
  const dedupMap = new Map<string, MarketingScenario>();
  for (const s of updatedList) {
    const key = (s.name || '').trim();
    if (!key) continue;
    const prev = dedupMap.get(key);
    if (!prev || (s.updatedAt || 0) >= (prev.updatedAt || 0)) {
      dedupMap.set(key, s);
    }
  }

  return { merged: Array.from(dedupMap.values()), addedCount, updatedCount };
}
