import React, { useEffect, useState, useMemo } from 'react';
import { TableKey, TABLE_CONFIGS, DiagnosisStatus } from '../types/database';
import { fetchTableCounts, fetchDiagnosisCounts, DataFetchError, fetchCompaniesList } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { getStatusBadgeClass } from '../utils/statusBadges';
import { todayJst } from '../utils/date';
import type { TaskItem, Priority } from '../types';
import type { ManagedContract, ManagedInvoice } from '../types/matrix';
import { 
  Building2, 
  Target, 
  TrendingUp, 
  ArrowUpRight, 
  RefreshCw, 
  AlertCircle, 
  FileCode2, 
  DollarSign, 
  Layers, 
  ChevronRight, 
  Users, 
  Calendar, 
  Globe, 
  CheckCircle2, 
  Sparkles, 
  MessageSquare, 
  ShieldAlert, 
  Play, 
  Pause, 
  X, 
  Plus, 
  CheckSquare, 
  Square, 
  Flame, 
  PhoneCall, 
  Mail, 
  Receipt, 
  Clock, 
  ExternalLink,
  Briefcase,
  Inbox,
  FileText,
  Send,
  Zap,
  HelpCircle
} from 'lucide-react';

export interface DashboardProps {
  onNavigateTab: (tab: any, options?: any) => void;
  onOpenCreate: (tab: TableKey) => void;
  onOpenRls: () => void;
  onStageTransitionTask?: (event: {
    transitionType: 'prospect_to_lead' | 'lead_to_deal' | 'deal_to_customer';
    sourceRecord: any;
    targetTable: 'leads' | 'deals' | 'customers';
    targetRecordId?: string | number;
  }) => void;
  tasks?: TaskItem[];
  onCreateTask?: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask?: (task: TaskItem) => void;
  contracts?: ManagedContract[];
  invoices?: ManagedInvoice[];
  onOpenCustomerWorkspace?: (
    companyId: string, 
    destination: 'documents' | 'operations' | 'diagnoses' | 'forms' | 'send' | 'deals',
    recordContext?: any
  ) => void;
  onOpenSendCenter?: (params: { kind?: any; companyId?: string; contactId?: string; formId?: string }) => void;
}

// 優先アクションのデータ型
export interface PriorityActionItem {
  id: string;
  type: 'meeting' | 'urgent_lead' | 'deal_followup' | 'invoice_due' | 'sales_task';
  title: string;
  subtitle: string;
  urgency: 'critical' | 'high' | 'normal';
  timeLabel?: string;
  targetCompany?: string;
  companyId?: string;
  recordId?: string;
  amount?: number;
  completed: boolean;
  actionButtonLabel: string;
  onAction: () => void;
  onToggleComplete: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onOpenCreate,
  onOpenRls,
  onStageTransitionTask,
  tasks = [],
  onCreateTask,
  onUpdateTask,
  contracts = [],
  invoices = [],
  onOpenCustomerWorkspace,
  onOpenSendCenter,
}) => {
  const todayStr = useMemo(() => todayJst(), []);

  const [counts, setCounts] = useState<Record<TableKey, number>>({
    companies: 0,
    contacts: 0,
    prospects: 0,
    leads: 0,
    products: 0,
    deals: 0,
    customers: 0,
  });

  const [dealsList, setDealsList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [companiesMap, setCompaniesMap] = useState<Map<string, string>>(new Map());

  const [pipelineSummary, setPipelineSummary] = useState({ 
    amount: 0, 
    count: 0,
    wonAmount: 0,
    wonCount: 0,
    totalDeals: 0
  });

  const [inflowBreakdown, setInflowBreakdown] = useState<Array<{ source: string; count: number; percentage: number }>>([]);
  const [diagnosisStats, setDiagnosisStats] = useState<{ total: number; byStatus: Record<DiagnosisStatus, number> }>({
    total: 0,
    byStatus: { received: 0, completed: 0, generating: 0, reported: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<DataFetchError | null>(null);

  // 本日アクション用のローカル完了ステート（商談やリードの今日のアクション完了チェック用）
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`mst_completed_actions_${todayStr}`);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // 優先アクションのカテゴリフィルタ
  const [actionCategoryFilter, setActionCategoryFilter] = useState<'all' | 'meeting' | 'lead' | 'deal' | 'invoice' | 'task' | 'completed'>('all');

  // インライン・クイックタスク追加用の入力
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<Priority>('high');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // キルスイッチ管理
  const [automationControls, setAutomationControls] = useState<Array<{
    target: 'all' | 'ai' | 'send' | 'billing';
    paused: boolean;
    reason: string;
    updated_by?: string;
    updated_at?: string;
  }>>([
    { target: 'all', paused: false, reason: '' },
    { target: 'ai', paused: false, reason: '' },
    { target: 'send', paused: false, reason: '' },
    { target: 'billing', paused: false, reason: '' },
  ]);
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [selectedKillSwitchTarget, setSelectedKillSwitchTarget] = useState<'all' | 'ai' | 'send' | 'billing'>('all');
  const [killSwitchReasonInput, setKillSwitchReasonInput] = useState('');
  const [killSwitchUpdating, setKillSwitchUpdating] = useState(false);
  const [killSwitchMessage, setKillSwitchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleActionComplete = (id: string) => {
    setCompletedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(`mst_completed_actions_${todayStr}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const loadAutomationControls = async () => {
    try {
      const res = await fetch('/api/admin/automation-controls');
      if (res.ok) {
        const data = await res.json();
        if (data.controls && Array.isArray(data.controls)) {
          const map = new Map<string, any>();
          ['all', 'ai', 'send', 'billing'].forEach((t) => {
            map.set(t, { target: t, paused: false, reason: '' });
          });
          data.controls.forEach((c: any) => {
            if (map.has(c.target)) map.set(c.target, c);
          });
          setAutomationControls(Array.from(map.values()));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch automation controls:', err);
    }
  };

  const handleToggleKillSwitch = async (
    target: 'all' | 'ai' | 'send' | 'billing',
    nextPaused: boolean,
    customReason?: string
  ) => {
    setKillSwitchUpdating(true);
    setKillSwitchMessage(null);
    try {
      const supabase = getSupabase();
      let token = '';
      if (supabase) {
        const session = (await supabase.auth.getSession()).data.session;
        token = session?.access_token || '';
      }

      const reason = customReason !== undefined ? customReason : killSwitchReasonInput.trim();
      const res = await fetch('/api/admin/automation-controls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target,
          paused: nextPaused,
          reason: reason || (nextPaused ? '管理者による緊急停止' : '通常稼働に復旧'),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'キルスイッチの更新に失敗しました');
      }

      await loadAutomationControls();
      const targetLabel = target === 'all' ? '全体' : target === 'ai' ? 'AI機能' : target === 'send' ? '自動配信' : '請求自動化';
      setKillSwitchMessage({
        type: 'success',
        text: nextPaused ? `【緊急停止】${targetLabel}の自動処理を停止しました。` : `【稼働再開】${targetLabel}の自動処理を再開しました。`,
      });
      setKillSwitchReasonInput('');
    } catch (err: any) {
      setKillSwitchMessage({
        type: 'error',
        text: err.message || '更新中にエラーが発生しました。',
      });
    } finally {
      setKillSwitchUpdating(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    loadAutomationControls();
    try {
      const supabase = getSupabase();

      const [tableRes, diagRes, companiesData] = await Promise.all([
        fetchTableCounts(),
        fetchDiagnosisCounts(),
        fetchCompaniesList(),
      ]);

      if (tableRes.error) {
        setFetchError(tableRes.error);
      } else {
        setCounts(tableRes.counts);
      }

      if (diagRes) {
        setDiagnosisStats({ total: diagRes.total, byStatus: diagRes.byStatus });
      }

      const compMap = new Map<string, string>();
      companiesData.forEach((c) => {
        compMap.set(String(c.id), c.company_name);
      });
      setCompaniesMap(compMap);

      // 商談データの取得（詳細カラム付き・全社パイプライン集計）
      if (supabase) {
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id, company_id, lead_id, product_id, deal_name, proposal_plan_name, total_amount, amount, proposal_status, stage, status, close_date, meeting_date, next_followup_at, memo, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (dealsData) {
          const enriched = dealsData.map((d: any) => ({
            ...d,
            companyName: compMap.get(String(d.company_id)) || d.company_id || '未設定',
          }));
          setDealsList(enriched);

          // パイプライン集計
          let amount = 0;
          let count = 0;
          let wonAmount = 0;
          let wonCount = 0;
          let totalDeals = dealsData.length;

          dealsData.forEach((deal: any) => {
            const val = Number(deal.total_amount ?? deal.amount ?? 0) || 0;
            const status = deal.proposal_status || deal.stage || '';
            if (status === '受注') {
              wonAmount += val;
              wonCount += 1;
            } else if (status !== '失注') {
              amount += val;
              count += 1;
            }
          });

          setPipelineSummary({ amount, count, wonAmount, wonCount, totalDeals });
        }

        // リードデータの取得
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, company_id, contact_id, line_user_id, source, service_type, inquiry_type, status, priority_channel, meeting_date, meeting_start_time, next_action_at, notes, created_at')
          .order('created_at', { ascending: false })
          .limit(200);

        if (leadsData) {
          const enrichedLeads = leadsData.map((l: any) => ({
            ...l,
            companyName: compMap.get(String(l.company_id)) || '反響新規（会社未紐付け）',
          }));
          setLeadsList(enrichedLeads);

          // 流入経路集計
          const sourceMap = new Map<string, number>();
          leadsData.forEach((lead: any) => {
            const rawSource = lead.source?.trim() || lead.service_type?.trim() || '自社HP / 直接反響';
            sourceMap.set(rawSource, (sourceMap.get(rawSource) || 0) + 1);
          });
          const total = leadsData.length;
          const sorted = Array.from(sourceMap.entries())
            .map(([source, cnt]) => ({
              source,
              count: cnt,
              percentage: Math.round((cnt / (total || 1)) * 100),
            }))
            .sort((a, b) => b.count - a.count);
          setInflowBreakdown(sorted);
        }
      }
    } catch (err: any) {
      setFetchError({
        type: 'UNKNOWN',
        message: err.message || 'データ読み込み中にエラーが発生しました。'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 🎯 本日の最優先アクション (Priority Actions) の集約ロジック
  // ─────────────────────────────────────────────────────────────
  const priorityActionItems: PriorityActionItem[] = useMemo(() => {
    const items: PriorityActionItem[] = [];

    // 1. 本日予定されている商談・面談 (Deals with meeting_date === today)
    dealsList.forEach((deal) => {
      const isTodayMeeting = deal.meeting_date && String(deal.meeting_date).startsWith(todayStr);
      if (isTodayMeeting) {
        const isDone = completedItemIds.has(`deal_meeting_${deal.id}`);
        items.push({
          id: `deal_meeting_${deal.id}`,
          type: 'meeting',
          title: `商談面談: ${deal.proposal_plan_name || deal.deal_name || '商談'}`,
          subtitle: `相手先: ${deal.companyName} | 提案想定: ¥${Number(deal.total_amount ?? deal.amount ?? 0).toLocaleString()}`,
          urgency: 'critical',
          timeLabel: '本日商談',
          targetCompany: deal.companyName,
          companyId: deal.company_id,
          recordId: deal.id,
          amount: Number(deal.total_amount ?? deal.amount ?? 0),
          completed: isDone,
          actionButtonLabel: '商談詳細・準備',
          onAction: () => {
            if (onOpenCustomerWorkspace && deal.company_id) {
              onOpenCustomerWorkspace(deal.company_id, 'deals', { tableKey: 'deals', recordId: deal.id });
            } else {
              onNavigateTab('deals');
            }
          },
          onToggleComplete: () => toggleActionComplete(`deal_meeting_${deal.id}`),
        });
      }
    });

    // 2. 本日予定されているリード面談 (Leads with meeting_date === today)
    leadsList.forEach((lead) => {
      const isTodayMeeting = lead.meeting_date && String(lead.meeting_date).startsWith(todayStr);
      if (isTodayMeeting) {
        const isDone = completedItemIds.has(`lead_meeting_${lead.id}`);
        items.push({
          id: `lead_meeting_${lead.id}`,
          type: 'meeting',
          title: `リード初回面談: ${lead.companyName}`,
          subtitle: `時間: ${lead.meeting_start_time || '時間未設定'} | 経路: ${lead.source || '反響'}`,
          urgency: 'critical',
          timeLabel: lead.meeting_start_time ? `本日 ${lead.meeting_start_time}` : '本日面談',
          targetCompany: lead.companyName,
          companyId: lead.company_id,
          recordId: lead.id,
          completed: isDone,
          actionButtonLabel: 'リード確認',
          onAction: () => onNavigateTab('leads'),
          onToggleComplete: () => toggleActionComplete(`lead_meeting_${lead.id}`),
        });
      }
    });

    // 3. 未対応・新規の反響リード（至急初回連絡が必要）
    leadsList.forEach((lead) => {
      const isUncontacted = lead.status === '未対応' || lead.status === '新規' || !lead.status;
      if (isUncontacted) {
        const isDone = completedItemIds.has(`lead_uncontacted_${lead.id}`);
        items.push({
          id: `lead_uncontacted_${lead.id}`,
          type: 'urgent_lead',
          title: `反響即応: ${lead.companyName} からの新規問い合わせ`,
          subtitle: `希望内容: ${lead.service_type || lead.inquiry_type || '資料請求/相談'} | 優先手段: ${lead.priority_channel || 'LINE/メール'}`,
          urgency: 'critical',
          timeLabel: '要即時対応',
          targetCompany: lead.companyName,
          companyId: lead.company_id,
          recordId: lead.id,
          completed: isDone,
          actionButtonLabel: '返信・LINE送信',
          onAction: () => {
            if (onOpenSendCenter) {
              onOpenSendCenter({ kind: 'form', companyId: lead.company_id, contactId: lead.contact_id });
            } else {
              onNavigateTab('leads');
            }
          },
          onToggleComplete: () => toggleActionComplete(`lead_uncontacted_${lead.id}`),
        });
      }
    });

    // 4. 次回フォロー期日が本日または期限超過の商談 (next_followup_at <= today)
    dealsList.forEach((deal) => {
      const isFollowupDue = deal.next_followup_at && String(deal.next_followup_at).slice(0, 10) <= todayStr && deal.proposal_status !== '受注' && deal.proposal_status !== '失注';
      if (isFollowupDue) {
        const isDone = completedItemIds.has(`deal_followup_${deal.id}`);
        items.push({
          id: `deal_followup_${deal.id}`,
          type: 'deal_followup',
          title: `商談フォロー期日: ${deal.proposal_plan_name || deal.deal_name || '商談'}`,
          subtitle: `相手先: ${deal.companyName} | 状況: ${deal.proposal_status || '提案中'}`,
          urgency: 'high',
          timeLabel: '本日フォロー',
          targetCompany: deal.companyName,
          companyId: deal.company_id,
          recordId: deal.id,
          amount: Number(deal.total_amount ?? deal.amount ?? 0),
          completed: isDone,
          actionButtonLabel: '商談パイプラインへ',
          onAction: () => onNavigateTab('deals'),
          onToggleComplete: () => toggleActionComplete(`deal_followup_${deal.id}`),
        });
      }
    });

    // 5. 請求書：本日支払期日または期限超過の未回収アラート
    invoices.forEach((inv) => {
      const isDueOrOverdue = (inv.status === 'issued' || inv.status === 'overdue') && inv.dueDate && inv.dueDate <= todayStr;
      if (isDueOrOverdue) {
        const isDone = completedItemIds.has(`invoice_due_${inv.id}`);
        items.push({
          id: `invoice_due_${inv.id}`,
          type: 'invoice_due',
          title: `請求入金確認: ${inv.title || '請求書'} (¥${inv.amount.toLocaleString()})`,
          subtitle: `支払期限: ${inv.dueDate} | 状態: ${inv.status === 'overdue' ? '期限超過' : '入金待ち'}`,
          urgency: 'high',
          timeLabel: inv.status === 'overdue' ? '期日超過' : '本日期限',
          companyId: inv.companyId,
          recordId: inv.id,
          amount: inv.amount,
          completed: isDone,
          actionButtonLabel: '請求書詳細',
          onAction: () => {
            if (onOpenCustomerWorkspace && inv.companyId) {
              onOpenCustomerWorkspace(inv.companyId, 'operations');
            } else {
              onNavigateTab('customer_operations');
            }
          },
          onToggleComplete: () => toggleActionComplete(`invoice_due_${inv.id}`),
        });
      }
    });

    // 6. 営業関連タスク（本日締切、または未完了の最優先営業タスク）
    tasks.forEach((t) => {
      const isDueToday = t.dueDate && String(t.dueDate).slice(0, 10) <= todayStr;
      const isSalesRelated = t.workArea === 'sales_customer' || t.sourceCategory === 'sales_customer' || t.priority === 'high';
      const isTaskDone = t.status === 'completed' || completedItemIds.has(`task_${t.id}`);
      if (isDueToday || isSalesRelated) {
        items.push({
          id: `task_${t.id}`,
          type: 'sales_task',
          title: `営業タスク: ${t.title}`,
          subtitle: `担当: ${t.assignee?.name || '営業担当'} | 期限: ${t.dueDate || '本日'}`,
          urgency: t.priority === 'high' ? 'critical' : 'high',
          timeLabel: t.dueDate ? `期限: ${t.dueDate.slice(5)}` : '本日中',
          completed: isTaskDone,
          actionButtonLabel: 'タスク管理',
          onAction: () => onNavigateTab('ai_tasks'),
          onToggleComplete: () => {
            toggleActionComplete(`task_${t.id}`);
            if (onUpdateTask) {
              onUpdateTask({ ...t, status: t.status === 'completed' ? 'in_progress' : 'completed' });
            }
          },
        });
      }
    });

    return items;
  }, [dealsList, leadsList, completedItemIds, todayStr, invoices, tasks, onOpenCustomerWorkspace, onNavigateTab, onOpenSendCenter, onUpdateTask]);

  // フィルタ後のアクション一覧
  const filteredPriorityActions = useMemo(() => {
    return priorityActionItems.filter((item) => {
      if (actionCategoryFilter === 'completed') return item.completed;
      if (item.completed && actionCategoryFilter !== 'all') return false;

      if (actionCategoryFilter === 'all') return true;
      if (actionCategoryFilter === 'meeting') return item.type === 'meeting';
      if (actionCategoryFilter === 'lead') return item.type === 'urgent_lead';
      if (actionCategoryFilter === 'deal') return item.type === 'deal_followup';
      if (actionCategoryFilter === 'invoice') return item.type === 'invoice_due';
      if (actionCategoryFilter === 'task') return item.type === 'sales_task';
      return true;
    });
  }, [priorityActionItems, actionCategoryFilter]);

  const totalActionsCount = priorityActionItems.length;
  const completedActionsCount = priorityActionItems.filter((i) => i.completed).length;
  const uncompletedActionsCount = totalActionsCount - completedActionsCount;
  const progressPercent = totalActionsCount > 0 ? Math.round((completedActionsCount / totalActionsCount) * 100) : 100;

  // インライン・クイックタスク登録
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || isSubmittingTask) return;
    setIsSubmittingTask(true);
    try {
      if (onCreateTask) {
        onCreateTask({
          title: quickTaskTitle.trim(),
          description: '営業ダッシュボードの本日の最優先アクションから直接作成',
          projectId: '',
          completionCriteria: '営業アクションの完了確認',
          priority: quickTaskPriority,
          status: 'waiting',
          dueDate: todayStr,
          workArea: 'sales_customer',
          sourceCategory: 'sales_customer',
          assignee: { type: 'human', name: '営業担当' },
        });
        setQuickTaskTitle('');
      }
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // KPI計算
  const totalLeads = counts.leads || 0;
  const leadToDealRate = totalLeads > 0 && pipelineSummary.totalDeals > 0 
    ? ((pipelineSummary.totalDeals / totalLeads) * 100).toFixed(1)
    : '0';
  const dealToWonRate = pipelineSummary.totalDeals > 0 && pipelineSummary.wonCount > 0 
    ? ((pipelineSummary.wonCount / pipelineSummary.totalDeals) * 100).toFixed(1)
    : '0';

  // AI営業参謀のデイリーアドバイス生成
  const aiBriefingText = useMemo(() => {
    const meetingCount = priorityActionItems.filter((i) => i.type === 'meeting' && !i.completed).length;
    const urgentLeadCount = priorityActionItems.filter((i) => i.type === 'urgent_lead' && !i.completed).length;
    const dealFollowupCount = priorityActionItems.filter((i) => i.type === 'deal_followup' && !i.completed).length;

    if (uncompletedActionsCount === 0) {
      return '本日対応すべき最優先アクションはすべて完了しています。新規アプローチや明日の商談準備、ナレッジの更新を進めましょう。';
    }

    const points: string[] = [];
    if (meetingCount > 0) {
      points.push(`本日 ${meetingCount} 件の面談・商談があります。事前ヒアリング情報の確認と想定見積プランの準備を優先してください。`);
    }
    if (urgentLeadCount > 0) {
      points.push(`未対応の新規反響が ${urgentLeadCount} 件到着しています。初回連絡は受付後1時間以内が成約率最高となります。午前中の即時連絡をお勧めします。`);
    }
    if (dealFollowupCount > 0) {
      points.push(`次回フォロー期日を迎えた商談が ${dealFollowupCount} 件あります。検討状況の確認連絡を入れて成約確度を高めましょう。`);
    }
    return points.join(' ') || '本日予定されているアクションを上から順に対応し、営業パイプラインを前進させましょう。';
  }, [priorityActionItems, uncompletedActionsCount]);

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* ─── 1. Header: 営業Dashboard ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <span>営業Dashboard</span>
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
              メイン統括
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>本日やること・反響即応・商談パイプライン・売上進捗を1枚で統括</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono font-medium text-slate-600">{todayStr} (JST)</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 新規商談・案件登録 */}
          <button
            type="button"
            onClick={() => onOpenCreate('deals')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="新しい商談案件を登録"
          >
            <Plus className="w-4 h-4" />
            <span>商談を新規登録</span>
          </button>

          {/* 予定カレンダーへ */}
          <button
            type="button"
            onClick={() => onNavigateTab('unified_calendar')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="予定カレンダー（Google同期・全社面談）"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>カレンダー</span>
          </button>

          {/* AI社長室へ直結 */}
          <button
            type="button"
            onClick={() => onNavigateTab('ai_chat')}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="AI社長に営業戦略・提案を相談"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">AI営業参謀</span>
          </button>

          {/* 緊急停止（キルスイッチ）ボタン */}
          {(() => {
            const pausedItems = automationControls.filter((c) => c.paused);
            const isAnyPaused = pausedItems.length > 0;
            const targetMap: Record<string, string> = { all: '全体', ai: 'AI', send: '配信', billing: '請求' };
            return (
              <button
                type="button"
                onClick={() => {
                  setIsKillSwitchModalOpen(true);
                  setKillSwitchMessage(null);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAnyPaused
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs ring-2 ring-rose-400/50 animate-pulse'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
                title="AI・配信・請求自動化の緊急停止"
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${isAnyPaused ? 'text-white' : 'text-rose-500'}`} />
                <span>{isAnyPaused ? `🚨 緊急停止中 (${pausedItems.map((p) => targetMap[p.target] || p.target).join('/')})` : '緊急停止'}</span>
              </button>
            );
          })()}

          {/* 再読み込み */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
            title="最新データを再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* RLS / Permission Notice if detected */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-900">
                {fetchError.type === 'PERMISSION_DENIED' ? 'データベース権限（RLS）の確認が必要です' : 'データ取得エラー'}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">{fetchError.message}</p>
            </div>
          </div>
          {fetchError.type === 'PERMISSION_DENIED' && (
            <button
              onClick={onOpenRls}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>RLS推奨SQLを確認</span>
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          🔥 2. 最上部表示: 今日やることの最優先営業アクション
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-slate-50/60 rounded-3xl border-2 border-amber-400/80 shadow-md p-5 sm:p-6 space-y-4 ring-4 ring-amber-400/10">
        {/* Top Header Row of Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30 shrink-0">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  本日の最優先営業アクション
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  要対応 {uncompletedActionsCount} 件
                </span>
                {completedActionsCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                    完了 {completedActionsCount} 件
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                本日面談・反響即応・商談フォロー・請求期日・営業タスクを自動集約
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">本日の進捗</span>
              <span className="text-sm font-black font-mono text-slate-900">
                {completedActionsCount} / {totalActionsCount} 件 ({progressPercent}%)
              </span>
            </div>
            <div className="w-24 sm:w-32 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* AI営業参謀からの本日のブリーフィング */}
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0 mt-0.5 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <span className="font-bold text-purple-900 block mb-0.5 flex items-center gap-1.5">
              <span>AI営業参謀 デイリーブリーフィング</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-purple-200 text-purple-800">推奨</span>
            </span>
            <p className="text-slate-700 leading-relaxed">{aiBriefingText}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('ai_chat')}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>AIと壁打ち</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Action Category Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
            {[
              { key: 'all', label: `すべて (${totalActionsCount})` },
              { key: 'meeting', label: `📅 本日の面談 (${priorityActionItems.filter((i) => i.type === 'meeting').length})` },
              { key: 'lead', label: `⚡ 反響即応 (${priorityActionItems.filter((i) => i.type === 'urgent_lead').length})` },
              { key: 'deal', label: `💼 提案フォロー (${priorityActionItems.filter((i) => i.type === 'deal_followup').length})` },
              { key: 'invoice', label: `🧾 請求期日 (${priorityActionItems.filter((i) => i.type === 'invoice_due').length})` },
              { key: 'task', label: `✅ 営業タスク (${priorityActionItems.filter((i) => i.type === 'sales_task').length})` },
              { key: 'completed', label: `🎉 完了済み (${completedActionsCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActionCategoryFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  actionCategoryFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority Actions List */}
        <div className="space-y-2.5">
          {filteredPriorityActions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">このカテゴリの優先アクションはありません</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {actionCategoryFilter === 'completed'
                  ? 'アクションのチェックボックスを押すと完了済みに移動します。'
                  : 'すべて完了しているか、現在予定されているアクションがありません。'}
              </p>
            </div>
          ) : (
            filteredPriorityActions.map((item) => {
              const urgencyColor = 
                item.urgency === 'critical' ? 'border-l-4 border-l-rose-500 bg-rose-50/20' :
                item.urgency === 'high' ? 'border-l-4 border-l-amber-500 bg-amber-50/20' :
                'border-l-4 border-l-blue-500 bg-white';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs transition-all hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${urgencyColor} ${
                    item.completed ? 'opacity-60 bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={item.onToggleComplete}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                      title={item.completed ? '未完了に戻す' : '完了にする'}
                    >
                      {item.completed ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.urgency === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          item.urgency === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {item.timeLabel || '要対応'}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          {item.type === 'meeting' ? '📅 商談面談' :
                           item.type === 'urgent_lead' ? '⚡ 反響即応' :
                           item.type === 'deal_followup' ? '💼 提案フォロー' :
                           item.type === 'invoice_due' ? '🧾 請求期日' : '📝 タスク'}
                        </span>

                        {item.targetCompany && (
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {item.targetCompany}
                          </span>
                        )}
                      </div>

                      <h3 className={`text-xs sm:text-sm font-bold text-slate-900 mt-1 truncate ${
                        item.completed ? 'line-through text-slate-400' : ''
                      }`}>
                        {item.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={item.onAction}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>{item.actionButtonLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add Action Item Bar */}
        <form onSubmit={handleQuickAddTask} className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              placeholder="+ 本日の営業やること・タスクを即時追加... (Enterで登録)"
              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={quickTaskPriority}
              onChange={(e) => setQuickTaskPriority(e.target.value as Priority)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="high">🟠 高優先</option>
              <option value="medium">🔵 通常</option>
              <option value="low">⚪ 低優先</option>
            </select>

            <button
              type="submit"
              disabled={!quickTaskTitle.trim() || isSubmittingTask}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>追加</span>
            </button>
          </div>
        </form>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          📊 3. 最重要5大営業KPI & 売上パイプライン進捗カード
          ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: 受注・確定売上総額 */}
        <div 
          onClick={() => onNavigateTab('customers')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-4 sm:p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600" />
              受注・確定売上総額
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              確定業績
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.wonAmount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>成約 / 顧客数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.wonCount} 件 / {counts.customers} 社</span>
          </div>
        </div>

        {/* KPI 2: 進行中 商談金額 */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-4 sm:p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              進行中 商談金額
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              商談中
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.amount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>商談中 案件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.count} 件</span>
          </div>
        </div>

        {/* KPI 3: 反響・総リード獲得 */}
        <div 
          onClick={() => onNavigateTab('leads')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-4 sm:p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              反響・総リード数
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
              集客成果
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : totalLeads.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">件</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>商談化率</span>
            <span className="font-bold text-purple-700">{leadToDealRate}%</span>
          </div>
        </div>

        {/* KPI 4: 商談成約率 */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-4 sm:p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              商談成約率 (受注率)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              営業効率
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `${dealToWonRate}%`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>成約件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.wonCount} 件</span>
          </div>
        </div>

        {/* KPI 5: 請求・回収健全性 */}
        <div 
          onClick={() => onNavigateTab('customer_operations')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-4 sm:p-5 rounded-2xl transition-all shadow-2xs group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-cyan-600" />
              請求・回収健全性
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
              入金管理
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {invoices.length} 件
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>期日超過アラート</span>
            <span className={`font-bold ${invoices.some((i) => i.status === 'overdue') ? 'text-rose-600' : 'text-slate-700'}`}>
              {invoices.filter((i) => i.status === 'overdue').length} 件
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          🪜 4. 営業パイプライン・ファネル進捗バー (1枚で俯瞰)
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">営業パイプライン・ファネル動向</h2>
          </div>
          <span className="text-xs text-slate-400">クリックで各フェーズへ直接遷移</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Step 1: 反響リード */}
          <div 
            onClick={() => onNavigateTab('leads')}
            className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 hover:bg-amber-50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">1. 反響リード</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-800 font-mono font-bold">Inflow</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-amber-950">{totalLeads}</span>
              <span className="text-[10px] text-amber-800">未対応: {leadsList.filter(l => l.status === '未対応' || l.status === '新規').length}件</span>
            </div>
            <div className="mt-1 text-[10px] text-amber-700">問い合わせ・診断回答</div>
          </div>

          {/* Step 2: 面談・ヒアリング */}
          <div 
            onClick={() => onNavigateTab('unified_calendar')}
            className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 hover:bg-indigo-50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">2. 面談・ヒアリング</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200/80 text-indigo-800 font-mono font-bold">Meeting</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-indigo-950">
                {dealsList.filter(d => d.meeting_date).length + leadsList.filter(l => l.meeting_date).length}
              </span>
              <span className="text-[10px] text-indigo-800">本日: {priorityActionItems.filter(i => i.type === 'meeting').length}件</span>
            </div>
            <div className="mt-1 text-[10px] text-indigo-700">予約日程・ヒアリング実施</div>
          </div>

          {/* Step 3: 提案・商談中 */}
          <div 
            onClick={() => onNavigateTab('deals')}
            className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80 hover:bg-purple-50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900">3. 提案・商談中</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-800 font-mono font-bold">Proposal</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-purple-950">{pipelineSummary.count}</span>
              <span className="text-[10px] text-purple-800 font-mono font-bold">¥{pipelineSummary.amount.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[10px] text-purple-700">プラン提示・見積検討</div>
          </div>

          {/* Step 4: 成約・支援開始 */}
          <div 
            onClick={() => onNavigateTab('customers')}
            className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 hover:bg-emerald-50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">4. 受注・支援開始</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-800 font-mono font-bold">Won</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-950">{pipelineSummary.wonCount}</span>
              <span className="text-[10px] text-emerald-800 font-mono font-bold">¥{pipelineSummary.wonAmount.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-700">契約締結・請求・顧問開始</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2カラム構成: 左(商談パイプライン & 本日商談) × 右(反響即応 & 流入分析)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側: 進行中 商談パイプライン (7カラム) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm text-slate-900">進行中の商談パイプライン</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold">
                  {dealsList.length} 件
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCreate('deals')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors cursor-pointer"
                >
                  + 新規商談
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('deals')}
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>全件</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                商談データを読み込み中...
              </div>
            ) : dealsList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">現在登録されている商談はありません。</p>
                <button
                  type="button"
                  onClick={() => onOpenCreate('deals')}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新規商談を登録する</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">提案プラン・商談名</th>
                      <th className="py-2.5 px-3">取引先会社</th>
                      <th className="py-2.5 px-3">ステータス</th>
                      <th className="py-2.5 px-3 text-right">想定総額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {dealsList.slice(0, 7).map((deal) => (
                      <tr 
                        key={deal.id}
                        onClick={() => {
                          if (onOpenCustomerWorkspace && deal.company_id) {
                            onOpenCustomerWorkspace(deal.company_id, 'deals', { tableKey: 'deals', recordId: deal.id });
                          } else {
                            onNavigateTab('deals');
                          }
                        }}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]">
                            {deal.proposal_plan_name || deal.deal_name || `商談 #${deal.id}`}
                          </div>
                          {deal.meeting_date && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              面談日: {String(deal.meeting_date).slice(0, 10)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-blue-700 block truncate max-w-[140px]">
                            {deal.companyName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border font-medium ${getStatusBadgeClass(deal.proposal_status || deal.stage)}`}>
                            {deal.proposal_status || deal.stage || '検討中'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {deal.total_amount !== undefined && deal.total_amount !== null
                            ? `¥${Number(deal.total_amount).toLocaleString()}`
                            : deal.amount
                            ? `¥${Number(deal.amount).toLocaleString()}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 右側: 反響即応キュー & 流入経路分析 (5カラム) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 未対応リード（要即応キュー） */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-sm text-slate-900">未対応・新着反響リード</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('leads')}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>リード台帳</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {leadsList.filter(l => l.status === '未対応' || l.status === '新規' || !l.status).length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs text-slate-600 font-medium">現在未対応の反響リードはありません</p>
                </div>
              ) : (
                leadsList
                  .filter(l => l.status === '未対応' || l.status === '新規' || !l.status)
                  .slice(0, 4)
                  .map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                            未対応
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {lead.companyName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {lead.service_type || lead.inquiry_type || lead.source || '反響問い合わせ'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenSendCenter) {
                            onOpenSendCenter({ kind: 'form', companyId: lead.company_id, contactId: lead.contact_id });
                          } else {
                            onNavigateTab('leads');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>連絡</span>
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* 流入経路内訳 */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                反響・流入チャネル内訳
              </span>
              <div className="space-y-2">
                {inflowBreakdown.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[180px]">{item.source}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{item.percentage}%</span>
                        <span className="text-slate-900 font-bold">{item.count}件</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 診断・受付フォーム受付ミニサマリー */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-500 block">診断フォーム総回答</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{diagnosisStats.total} 件</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 block">未確認回答</span>
                <span className="text-sm font-bold text-amber-700 font-mono">{diagnosisStats.byStatus.received} 件</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('mst_diagnoses')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                フォーム設計
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          🧾 5. 契約・請求 & 顧問支援 健全性モニタリング
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-600" />
            <h2 className="font-bold text-sm text-slate-900">契約・請求・顧客支援の健全性</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('customer_operations')}
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer"
          >
            <span>契約・請求・顧問支援を開く</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">締結済み契約件数</span>
            <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
              {contracts.filter(c => c.status === 'signed').length} / {contracts.length} 件
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              確認中: {contracts.filter(c => c.status === 'under_review').length} 件 / 下書き: {contracts.filter(c => c.status === 'draft').length} 件
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">今月発行請求書</span>
            <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
              ¥{invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              発行済み: {invoices.filter(i => i.status === 'issued').length} 件 / 入金済み: {invoices.filter(i => i.status === 'paid').length} 件
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">成約企業（顧客台帳）</span>
            <span className="text-xl font-black font-mono text-emerald-700 mt-1 block">
              {counts.customers} 社
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              全社台帳とリアルタイム連動中
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          🏛️ 6. 全社台帳クイックジャンプナビゲーター
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>全社台帳・マスタレコード一覧</span>
          </h2>
          <span className="text-[11px] text-slate-400">クリックで各台帳へ直接ジャンプ</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'companies', label: '会社台帳', count: counts.companies, tab: 'companies', color: 'text-blue-700' },
            { key: 'contacts', label: '連絡先・友だち', count: counts.contacts, tab: 'contacts', color: 'text-teal-700' },
            { key: 'prospects', label: '見込み企業', count: counts.prospects, tab: 'contacts', color: 'text-amber-700' },
            { key: 'leads', label: '反響リード', count: counts.leads, tab: 'leads', color: 'text-purple-700' },
            { key: 'deals', label: '商談案件', count: counts.deals, tab: 'deals', color: 'text-emerald-700' },
            { key: 'customers', label: '契約顧客', count: counts.customers, tab: 'customers', color: 'text-rose-700' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigateTab(item.tab)}
              className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all text-left cursor-pointer group"
            >
              <span className="text-[11px] font-medium text-slate-500 block">{item.label}</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-lg font-black font-mono ${item.color}`}>
                  {loading ? '...' : item.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">件</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── 緊急停止（キルスイッチ）管理モーダル ─── */}
      {isKillSwitchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">自動化緊急停止（キルスイッチ）</h3>
                  <p className="text-xs text-slate-500">
                    暴走防止・メンテナンス時の即時停止用スイッチ（DB連動・サーバーリアルタイム反映）
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKillSwitchModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification message */}
            {killSwitchMessage && (
              <div
                className={`mx-6 mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                  killSwitchMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span>{killSwitchMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setKillSwitchMessage(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Controls Content */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'all', title: '🚨 システム全体停止', desc: 'AI・配信・請求を含む全ての自動ジョブを停止', color: 'rose' },
                  { id: 'ai', title: '🤖 AI機能のみ停止', desc: 'AI診断生成・提案書自動作成・壁打ちジョブ', color: 'purple' },
                  { id: 'send', title: '📤 外部配信のみ停止', desc: 'LINE/メール配信・Webhook・送信ジョブ', color: 'amber' },
                  { id: 'billing', title: '💳 請求自動化のみ停止', desc: '毎月の定期請求書自動生成・入金消込処理', color: 'cyan' },
                ].map((item) => {
                  const ctrl = automationControls.find((c) => c.target === item.id) || { paused: false, reason: '' };
                  const isTargetUpdating = killSwitchUpdating && selectedKillSwitchTarget === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        ctrl.paused
                          ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/40'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{item.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            ctrl.paused
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ctrl.paused ? '停止中' : '稼働中'}
                        </span>
                      </div>

                      {ctrl.paused && ctrl.reason && (
                        <p className="mt-2 text-[11px] text-rose-700 bg-rose-100/60 px-2 py-1 rounded">
                          理由: {ctrl.reason}
                        </p>
                      )}

                      <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-end">
                        <button
                          type="button"
                          disabled={isTargetUpdating}
                          onClick={() => {
                            setSelectedKillSwitchTarget(item.id as any);
                            handleToggleKillSwitch(item.id as any, !ctrl.paused);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            ctrl.paused
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          }`}
                        >
                          {isTargetUpdating ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : ctrl.paused ? (
                            <Play className="w-3.5 h-3.5" />
                          ) : (
                            <Pause className="w-3.5 h-3.5" />
                          )}
                          <span>{ctrl.paused ? '稼働再開' : '今すぐ緊急停止'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stop reason input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  停止理由・メモ（監査ログに記録されます）
                </label>
                <input
                  type="text"
                  value={killSwitchReasonInput}
                  onChange={(e) => setKillSwitchReasonInput(e.target.value)}
                  placeholder="例: 送信先アドレスの検証のため一時停止、メンテナンス中 など"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>※ 停止設定はサーバー経由で即時バックグラウンドジョブに適用されます</span>
              <button
                type="button"
                onClick={() => setIsKillSwitchModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
