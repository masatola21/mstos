import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisFormsWorkspace } from './DiagnosisFormsWorkspace';
import { getSupabase, getAuthHeaders } from '../lib/supabaseClient';
import { Diagnosis, DiagnosisStatus, Company, Lead, AiReport } from '../types/database';
import { 
  fetchDiagnosesList, 
  fetchDiagnosisById, 
  createDiagnosis, 
  saveDiagnosisAnswers, 
  fetchCompaniesList, 
  fetchLeadsList, 
  fetchAiReportsByDiagnosisId,
  updateDiagnosisStatus,
  DataFetchError 
} from '../services/dataService';
import { QUESTIONNAIRE_V1, calculateScores, QuestionCategory } from '../constants/questionnaire';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  FileText, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Layers, 
  ChevronRight, 
  Lock, 
Save, 
Sparkles, 
  X, 
  Info, 
  Check, 
  Calendar,
  Award,
  BarChart3,
  ExternalLink,
  Sliders,
  Inbox,
  ArrowRight,
  Square
} from 'lucide-react';

interface DiagnosisManagerProps {
  onOpenCreateTrigger?: boolean;
  onOpenRls?: () => void;
  initialLeadId?: string;
  initialCompanyId?: string;
  initialSection?: 'forms' | 'diagnoses' | 'answers' | 'materials';
  onOpenSendCenter?: (formId: string, url: string, kind: 'form'|'diagnosis') => void;
  initialDiagnosisId?: string;
  onNavigateTab?: (tab: string) => void;
}

const STATUS_LABELS: Record<DiagnosisStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  received: {
    label: '未確認',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />
  },
  completed: {
    label: '回答完了',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
  },
  generating: {
    label: 'AI生成中',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-spin" />
  },
  reported: {
    label: 'レポート発行済',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: <Award className="w-3.5 h-3.5 text-indigo-500" />
  }
};

const DIAGNOSIS_TYPE_LABELS: Record<string, string> = {
  standard: 'AI経営診断（標準）',
  comprehensive: '総合AI導入診断',
  quick: 'クイック簡易診断'
};

const DiagnosisRecordsView: React.FC<DiagnosisManagerProps> = ({ onOpenRls, initialLeadId, initialCompanyId, initialDiagnosisId }) => {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DataFetchError | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeDiagnosisId, setActiveDiagnosisId] = useState<string | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Master data for select
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [diagRes, compRes, leadRes] = await Promise.all([
        fetchDiagnosesList(),
        fetchCompaniesList(),
        fetchLeadsList(),
      ]);

      if (diagRes.error) {
        setError(diagRes.error);
      } else {
        setDiagnoses(diagRes.data);
      }
      setCompanies(compRes);
      setLeads(leadRes);
    } catch (err: any) {
      setError({
        type: 'UNKNOWN',
        message: err.message || '診断データの読み込みに失敗しました。'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 詳細・回答モーダルを開く
  const handleOpenDetail = async (id: string) => {
    setActiveDiagnosisId(id);
    setDetailLoading(true);
    try {
      const res = await fetchDiagnosisById(id);
      if (res.data) {
        setSelectedDiagnosis(res.data);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (initialDiagnosisId) void handleOpenDetail(initialDiagnosisId);
  }, [initialDiagnosisId]);

  // フィルタ処理
  const filteredDiagnoses = diagnoses.filter(d => {
    if (initialLeadId && d.lead_id !== initialLeadId) return false;
    if (!initialLeadId && initialCompanyId && d.company_id !== initialCompanyId) return false;
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const compName = d.company?.company_name?.toLowerCase() || '';
    const compId = d.company_id?.toLowerCase() || '';
    const diagType = (DIAGNOSIS_TYPE_LABELS[d.diagnosis_type] || d.diagnosis_type).toLowerCase();
    const memo = (d.memo || '').toLowerCase();
    return compName.includes(q) || compId.includes(q) || diagType.includes(q) || memo.includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">
          受付フォーム・診断設計
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規診断を起票</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
            title="再読み込み"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 安全ガード告知バナー */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm">
          <p className="font-semibold text-amber-900">
            【安全ガード作動中】設問定義・必須設問IDが未確定のため、完了（completed）への確定遷移は安全のため意図的にロックされています
          </p>
          <p className="text-amber-800/90 leading-relaxed text-xs">
            送信済みフォーム回答は「未確認」として診断に引き継がれます。内容を確認して必要な修正を保存してください。
          </p>
        </div>
      </div>

      {/* 成功バナー */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-semibold">{error.message}</p>
            {error.type === 'PERMISSION_DENIED' && onOpenRls && (
              <button
                onClick={onOpenRls}
                className="text-xs text-rose-700 underline font-medium hover:text-rose-900"
              >
                RLSポリシーの設定手順を確認する
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 検索・ステータスフィルタ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="対象会社名・ID・種別・メモで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {(['ALL', 'received', 'completed', 'generating', 'reported'] as const).map((st) => {
            const isActive = statusFilter === st;
            const label = st === 'ALL' ? 'すべて' : STATUS_LABELS[st as DiagnosisStatus]?.label || st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 診断一覧テーブル */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3.5 px-4 font-semibold">ステータス</th>
                <th className="py-3.5 px-4 font-semibold">対象会社</th>
                <th className="py-3.5 px-4 font-semibold">紐づくリード</th>
                <th className="py-3.5 px-4 font-semibold">診断種別 / 設問版</th>
                <th className="py-3.5 px-4 font-semibold">回答状況 / スコア</th>
                <th className="py-3.5 px-4 font-semibold">実施 / 起票日</th>
                <th className="py-3.5 px-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                      <span>診断データを読み込み中...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDiagnoses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardList className="w-8 h-8 text-slate-400" />
                      <p className="font-medium text-slate-600">該当する診断レコードがありません</p>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> 新しい診断を作成する
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDiagnoses.map((diag) => {
                  const statusInfo = STATUS_LABELS[diag.status] || STATUS_LABELS.received;
                  const answersCount = Object.keys(diag.answers || {}).filter((key) => key !== '_intake').length;
                  const { totalQuestions } = calculateScores(diag.answers || {});

                  return (
                    <tr
                      key={diag.id}
                      onClick={() => handleOpenDetail(diag.id)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      {/* ステータス */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* 対象会社 */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">
                          {diag.company?.company_name || diag.company_id}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Building2 className="w-3 h-3" />
                          <span>{diag.company_id}</span>
                        </div>
                      </td>

                      {/* 紐づくリード */}
                      <td className="py-3.5 px-4">
                        {diag.lead ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-purple-700 font-medium">
                              <Layers className="w-3 h-3 text-purple-500" />
                              <span>{diag.lead.service_type || 'リードあり'}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                              {diag.lead_id}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* 診断種別 / 設問版 */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {DIAGNOSIS_TYPE_LABELS[diag.diagnosis_type] || diag.diagnosis_type}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {diag.questionnaire_version}
                        </span>
                      </td>

                      {/* 回答状況 / スコア */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {diag.score !== null && diag.score !== undefined ? (
                            <span className="font-bold text-emerald-600 text-sm">
                              {diag.score}点
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">未算出</span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            ({answersCount}問 回答済)
                          </span>
                        </div>
                      </td>

                      {/* 実施 / 起票日 */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        <div>
                          {diag.conducted_at 
                            ? new Date(diag.conducted_at).toLocaleDateString('ja-JP') 
                            : '未実施'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          起票: {diag.created_at ? new Date(diag.created_at).toLocaleDateString('ja-JP') : '-'}
                        </div>
                      </td>

                      {/* 操作 */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(diag.id)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-colors inline-flex items-center gap-1 group-hover:border-purple-300"
                        >
                          <span>回答・詳細</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新規診断作成モーダル */}
      {isCreateOpen && (
        <DiagnosisCreateModal
          isOpen={isCreateOpen}
          companies={companies}
          leads={leads}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(newId) => {
            setIsCreateOpen(false);
            setSuccessBanner('新規診断を作成しました。設問への回答を開始できます。');
            loadData();
            handleOpenDetail(newId);
          }}
        />
      )}

      {/* 診断詳細・回答入力エディタモーダル */}
      {activeDiagnosisId && (
        <DiagnosisDetailModal
          diagnosisId={activeDiagnosisId}
          initialDiagnosis={selectedDiagnosis}
          isLoading={detailLoading}
          onClose={() => {
            setActiveDiagnosisId(null);
            setSelectedDiagnosis(null);
          }}
          onUpdated={() => {
            loadData();
            if (activeDiagnosisId) handleOpenDetail(activeDiagnosisId);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// 新規診断作成モーダル
// ============================================================================
interface DiagnosisCreateModalProps {
  isOpen: boolean;
  companies: Company[];
  leads: Lead[];
  onClose: () => void;
  onSuccess: (newDiagnosisId: string) => void;
}

const DiagnosisCreateModal: React.FC<DiagnosisCreateModalProps> = ({
  isOpen,
  companies,
  leads,
  onClose,
  onSuccess,
}) => {
  const [companyId, setCompanyId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [diagnosisType, setDiagnosisType] = useState('standard');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 選択した会社に一致するリードにフィルタリング（整合性トリガー check_diagnosis_company_lead_match に適合させるため）
  const matchingLeads = leads.filter(l => !companyId || String(l.company_id) === companyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      setErrorMsg('対象会社を選択してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createDiagnosis({
        company_id: companyId,
        lead_id: leadId ? leadId : null,
        diagnosis_type: diagnosisType,
        questionnaire_version: 'v1.0',
        memo: memo ? memo : null,
      });

      if (res.error) {
        setErrorMsg(res.error.message);
      } else if (res.data) {
        onSuccess(res.data.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '作成中に予期せぬエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">新規診断の起票</h3>
              <p className="text-xs text-slate-500">対象企業を選択し診断レコードを開始します</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 対象会社 (必須) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>対象会社 <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-slate-400">companies テーブル参照</span>
            </label>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setLeadId(''); // 会社変更時はリード選択をリセット
              }}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
            >
              <option value="">対象会社を選択してください</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.id})
                </option>
              ))}
            </select>
          </div>

          {/* 紐づくリード (任意) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>紐づくリード（任意）</span>
              <span className="text-[10px] text-slate-400">整合性トリガーにより同社リードのみ選択可</span>
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={!companyId}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-colors"
            >
              <option value="">なし（会社単体での診断）</option>
              {matchingLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.service_type || 'リード'} (ID: {l.id.substring(0, 8)}...)
                </option>
              ))}
            </select>
            {companyId && matchingLeads.length === 0 && (
              <p className="text-[11px] text-slate-400">※ この会社に紐づくリードは現在ありません</p>
            )}
          </div>

          {/* 診断種別 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">診断種別</label>
            <select
              value={diagnosisType}
              onChange={(e) => setDiagnosisType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
            >
              <option value="standard">AI経営診断（標準プラン・5カテゴリ）</option>
              <option value="comprehensive">総合AI導入診断（詳細プラン）</option>
              <option value="quick">簡易クイック診断（スピード評価）</option>
            </select>
          </div>

          {/* 社内メモ */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">社内メモ・備考（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="診断の目的や商談背景、ヒアリング担当者など"
              rows={3}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="text-slate-800 font-semibold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-purple-600" />
              起票時のステータスについて
            </p>
            <p>
              診断はデータベース権限制約（列レベル権限保護）に基づき、初期ステータス <strong>「未確認」</strong> で作成されます。
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !companyId}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>作成中...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>起票して回答を開始</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 診断詳細＆回答入力エディタモーダル
// ============================================================================
interface DiagnosisDetailModalProps {
  diagnosisId: string;
  initialDiagnosis: Diagnosis | null;
  isLoading: boolean;
  onClose: () => void;
  onUpdated: () => void;
  questionLabels?: Record<string, string>;
}

const DiagnosisDetailModal: React.FC<DiagnosisDetailModalProps> = ({
  diagnosisId,
  initialDiagnosis,
  isLoading,
  onClose,
  onUpdated,
  questionLabels,
}) => {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(initialDiagnosis);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [memo, setMemo] = useState('');
  const [diagnosisType, setDiagnosisType] = useState('standard');
  const [saving, setSaving] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ステータス差し戻し状態
  const [generatingReport, setGeneratingReport] = useState(false);
  const reportAbortControllerRef = useRef<AbortController | null>(null);

  const handleCancelGenerateReportDraft = () => {
    if (reportAbortControllerRef.current) {
      reportAbortControllerRef.current.abort();
      reportAbortControllerRef.current = null;
    }
    setGeneratingReport(false);
  };

  const [reportDraft, setReportDraft] = useState<{ text: string; modelName: string; recommendedProductId: string | null } | null>(null);
  const [savingReport, setSavingReport] = useState(false);

  // 関連レポート一覧
  const [reports, setReports] = useState<AiReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    if (initialDiagnosis) {
      setDiagnosis(initialDiagnosis);
      setAnswers(initialDiagnosis.answers || {});
      setMemo(initialDiagnosis.memo || '');
      setDiagnosisType(initialDiagnosis.diagnosis_type || 'standard');
    }
  }, [initialDiagnosis]);

  // レポート一覧のロード
  useEffect(() => {
    if (diagnosisId) {
      setReportsLoading(true);
      fetchAiReportsByDiagnosisId(diagnosisId).then((res) => {
        setReports(res.data);
        setReportsLoading(false);
      });
    }
  }, [diagnosisId]);

  // リアルタイムスコア算出
  const currentScores = calculateScores(answers);

  // 診断の編集可否判定
  // - completed, generating, reported は回答直接編集がDBトリガーで禁止されている
  const isLockedForDirectEdit = diagnosis?.status === 'completed' || diagnosis?.status === 'generating' || diagnosis?.status === 'reported';

  // 回答入力変更ハンドラ
  const handleAnswerChange = (questionId: string, value: unknown) => {
    if (isLockedForDirectEdit) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // 回答内容・社内メモを保存します。診断状態は「未確認」のまま維持します。
  const handleSaveAnswers = async () => {
    if (!diagnosis) return;
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      const saveRes = await saveDiagnosisAnswers(diagnosis.id, answers, {
        memo,
        diagnosis_type: diagnosisType,
        ...(isFormDiagnosis ? {} : { score: currentScores.totalScore, category_scores: currentScores.categoryScores }),
      });
      if (saveRes.error) {
        setErrorMsg(saveRes.error.message);
        return;
      }
      setSaveSuccessMsg('回答内容を保存しました。');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || '保存中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

    // 内容を確認して「回答完了」にする（未保存の修正は先に保存します）
  const handleCompleteDiagnosis = async () => {
    if (!diagnosis) return;
    if (!window.confirm('内容を確認済みとして「回答完了」にします。完了後は回答を直接編集できません（「未確認に戻す」で編集に戻せます）。よろしいですか？')) return;
    setChangingStatus(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      const isFormType = diagnosis.questionnaire_version.startsWith('form-');
      const saveRes = await saveDiagnosisAnswers(diagnosis.id, answers, {
        memo,
        diagnosis_type: diagnosisType,
        ...(isFormType ? {} : { score: currentScores.totalScore, category_scores: currentScores.categoryScores }),
      });
      if (saveRes.error) {
        setErrorMsg(saveRes.error.message);
        return;
      }
      const res = await updateDiagnosisStatus(diagnosis.id, 'completed');
      if (!res.success) {
        setErrorMsg(res.error?.message || '回答完了にできませんでした。');
        return;
      }
      setSaveSuccessMsg('診断を「回答完了」にしました。');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || '回答完了への変更中にエラーが発生しました。');
    } finally {
      setChangingStatus(false);
    }
  };

  // 「回答完了」を「未確認」に戻して、回答を編集できる状態にする
  const handleReopenDiagnosis = async () => {
    if (!diagnosis) return;
    if (!window.confirm('「未確認」に戻します。診断スコアはいったんクリアされ、回答を編集できるようになります。よろしいですか？')) return;
    setChangingStatus(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    try {
      const res = await updateDiagnosisStatus(diagnosis.id, 'received');
      if (!res.success) {
        setErrorMsg(res.error?.message || '未確認に戻せませんでした。');
        return;
      }
      setSaveSuccessMsg('診断を「未確認」に戻しました。');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || '未確認への変更中にエラーが発生しました。');
    } finally {
      setChangingStatus(false);
    }
  };
  const handleGenerateReportDraft = async () => {
    if (!diagnosis) return;
    const supabase = getSupabase();
    if (!supabase) {
      setErrorMsg('データベースに接続できません。設定を確認してください。');
      return;
    }
    const answerEntries = Object.entries(answers).filter(([key, value]) => key !== '_intake' && value !== null && value !== undefined && String(value).trim() !== '');
    if (answerEntries.length === 0) {
      setErrorMsg('診断回答がありません。フォーム回答を確認してください。');
      return;
    }

    setGeneratingReport(true);
    setErrorMsg(null);
    setReportDraft(null);
    const controller = new AbortController();
    reportAbortControllerRef.current = controller;
    try {
      const [{ data: company }, { data: lead }, { data: deal }] = await Promise.all([
        supabase.from('companies').select('company_name, industry, website').eq('id', diagnosis.company_id).maybeSingle(),
        diagnosis.lead_id
          ? supabase.from('leads').select('source, service_type, status, notes, interested_product_id').eq('id', diagnosis.lead_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('deals').select('proposal_plan_name, proposal_status, proposal_type, total_amount, initial_fee, monthly_fee, product_id, memo').eq('company_id', diagnosis.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const context = {
        company: {
          company_name: company?.company_name || diagnosis.company?.company_name,
          industry: company?.industry || diagnosis.company?.industry,
          website: company?.website || diagnosis.company?.website,
        },
        lead,
        latestDeal: deal,
        diagnosis: {
          type: diagnosis.diagnosis_type,
          questionnaireVersion: diagnosis.questionnaire_version,
          answers: Object.fromEntries(answerEntries),
          score: diagnosis.questionnaire_version.startsWith('form-') ? null : diagnosis.score ?? currentScores.totalScore,
          categoryScores: diagnosis.questionnaire_version.startsWith('form-') ? null : diagnosis.category_scores ?? currentScores.categoryScores,
        },
      };
      const prompt = `あなたは有限会社MSTの「経営の仕組み化 × 利益改善」専門の経営診断レポート作成パートナーです。
以下の社内CRM情報と診断回答をもとに、経営者の心に響く「最優先ボトルネックの特定」「会社と経営者の未来像（Before/After）」「ボトルネック連鎖ロードマップ（継続改善サイクル）」を提示するレポート草案を作成してください。

【MSTのコアメッセージ】
・会社の可能性を広げ、経営者が次の一手を打てる経営へ。
・単なる業務効率化ではなく、会社の利益と経営者の選択肢を増やすこと。
・日々の業務に追われる経営から、次の一手を選べる経営へ。

【レポート構成（必須）】
1. ■ 診断サマリーと最優先ボトルネックの特定
   - 回答から読み取れる、現在会社の成長と利益を最も止めている「最大の急所（ボトルネック）」をズバリ明示。
   - そのボトルネックがもたらしている経営上の損失（時間、機会損失、経営者の負担）。

2. ■ 会社と経営者が手に入れる「未来」（Before & After）
   - 【会社の未来】: 現状の手作業・属人化・利益が残らない状態から、仕組みで業務が回り利益が残る会社へ。
   - 【経営者の未来】: 現場の火消しや業務処理から解放され、本来向き合うべき「経営判断・成長戦略・次の一手」に時間を使える状態へ。

3. ■ ボトルネック連鎖の解消ロードマップ（継続改善サイクル）
   ※「1つのボトルネックを解消すると、次はここが詰まるので、継続して改善を回していく必然性」を提示。
   - Phase 1（まず着手）: 最優先ボトルネックの解消（手作業の二重入力削減・即座の時間創出）
   - Phase 2（次の展開）: 集客〜商談〜顧客フォローがつながる売上の流れの構築
   - Phase 3（完成形）: 経営顧問による自走組織と新規事業への展開

4. ■ 推奨される最初の一歩（MSTサービス体系からの処方箋）
   - 経営戦略・利益改善顧問、業務改善・IT・DX顧問、システム構築・業務自動化、マーケティング集客導線から、貴社に最も適した組み合わせをご提案。

Markdown見出しを使い、前置きは付けず本文だけ出力してください。

【社内データ】
${JSON.stringify(context, null, 2)}`;

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          character: { name: '経営診断レポート作成AI', role: '診断レポート作成専門AI', personality: '事実に忠実で慎重', tone: '明確で丁寧' },
          stream: false,
        }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.text !== 'string' || !result.text.trim()) {
        throw new Error(result.error || '診断レポートを生成できませんでした。');
      }
      setReportDraft({
        text: result.text.trim(),
        modelName: [result.provider, result.model].filter(Boolean).join('/') || 'configured-model',
        recommendedProductId: lead?.interested_product_id || deal?.product_id || null,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setErrorMsg(error.message || '診断レポートの生成に失敗しました。');
    } finally {
      setGeneratingReport(false);
      reportAbortControllerRef.current = null;
    }
  };

  const handleSaveGeneratedReport = async () => {
    if (!diagnosis || !reportDraft) return;
    setSavingReport(true);
    setErrorMsg(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/diagnoses/${encodeURIComponent(diagnosis.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          text: reportDraft.text,
          modelName: reportDraft.modelName,
          recommendedProductId: reportDraft.recommendedProductId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.report) {
        throw new Error(result.error || '診断レポートを保存できませんでした。');
      }
      const refreshed = await fetchAiReportsByDiagnosisId(diagnosis.id);
      setReports(refreshed.data);
      setReportDraft(null);
      setSaveSuccessMsg(
        result.documentSynced
          ? '診断レポートを保存しました。顧客書類（承認待ち）にも登録しました。'
          : '診断レポートを保存しました。（顧客書類への登録だけ失敗しました）'
      );
      onUpdated();
    } catch (error: any) {
      setErrorMsg(error.message || '診断レポートを保存できませんでした。');
    } finally {
      setSavingReport(false);
    }
  };

  const [approvingAndSendingReport, setApprovingAndSendingReport] = useState(false);

  const handleApproveAndSendReport = async (reportToUse?: AiReport | null) => {
    const targetReport = reportToUse || reports[0];
    if (!targetReport || !diagnosis) return;

    const supabase = getSupabase();
    if (!supabase) {
      setErrorMsg('Supabaseに接続されていません。');
      return;
    }

    setApprovingAndSendingReport(true);
    setErrorMsg(null);

    try {
      // 1. サーバーでレポートを承認済みにする（診断・顧客書類の状態も同期）
      const approveHeaders = await getAuthHeaders();
      const approveResponse = await fetch(`/api/ai-reports/${encodeURIComponent(targetReport.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...approveHeaders },
      });
      const approveResult = await approveResponse.json().catch(() => ({}));
      if (!approveResponse.ok) {
        throw new Error(approveResult.error || 'レポートを承認できませんでした。');
      }
      const refreshedReports = await fetchAiReportsByDiagnosisId(diagnosis.id);
      setReports(refreshedReports.data);

      // 3. 会社紐づきの連絡先を取得
      let contact: any = null;
      if (diagnosis.lead_id) {
        const { data: leadData } = await supabase.from('leads').select('contact_id').eq('id', diagnosis.lead_id).maybeSingle();
        if (leadData?.contact_id) {
          const { data: cData } = await supabase.from('contacts').select('*').eq('id', leadData.contact_id).maybeSingle();
          contact = cData;
        }
      }
      if (!contact && diagnosis.company_id) {
        const { data: cData } = await supabase.from('contacts').select('*').eq('company_id', diagnosis.company_id).limit(1).maybeSingle();
        contact = cData;
      }

      const reportText = targetReport.full_report_text || targetReport.summary || '';
      const companyName = diagnosis.company?.company_name || '御社';

      if (contact?.line_user_id) {
        // LINE送信
        const linePayload = {
          type: 'text',
          text: `【MST】${companyName}様 経営診断レポートのご送付\n\n${contact.full_name || 'ご担当者'} 様\n大変お待たせいたしました。先般ご回答いただきました診断内容をもとに作成したレポートをお届けします。\n\n───────────────\n${reportText.slice(0, 4000)}\n───────────────\n\n詳細な改善施策や導入支援のご相談は、本LINEにそのままご返信いただくか、個別相談をお申し付けください。`,
        };
        const { data: outbox } = await supabase.from('communication_outbox').insert({
          channel: 'line',
          recipient_contact_id: contact.id,
          recipient_address: contact.line_user_id,
          body_text: linePayload.text,
          line_message_payload: linePayload,
          company_id: diagnosis.company_id,
          source_type: 'diagnosis_report',
          source_id: targetReport.id,
          status: 'queued',
          consent_confirmed_at: new Date().toISOString(),
          consent_basis: 'transactional_intake',
        }).select('id').maybeSingle();

        if (outbox?.id) {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            await fetch('/api/communications/send', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ outboxId: outbox.id }),
            }).catch(() => {});
          }
        }
        setSaveSuccessMsg(`✅ 診断レポートを承認し、${contact.full_name || '担当者'}様（LINE公式）へ送信完了しました！`);
      } else if (contact?.email) {
        // メール送信
        const subject = `【MST】${companyName}様 経営診断・改善レポートのご送付`;
        const bodyText = `${contact.full_name || 'ご担当者'} 様\n\n有限会社MST代表の大橋真人です。\n先般は経営診断にご回答いただき誠にありがとうございました。\n\n診断結果を取りまとめた個別レポートをお届けいたします。\n\n--------------------------------------------------\n${reportText}\n--------------------------------------------------\n\nレポート内容に関するご質問や、具体的な改善施策のご相談はお気軽にご連絡ください。\n\n--------------------------------------------------\n有限会社MST\n代表取締役: 大橋真人\n〒503-0981 岐阜県大垣市桧町127番地\n--------------------------------------------------`;

        const { data: outbox } = await supabase.from('communication_outbox').insert({
          channel: 'email',
          recipient_contact_id: contact.id,
          recipient_address: contact.email,
          subject,
          body_text: bodyText,
          company_id: diagnosis.company_id,
          source_type: 'diagnosis_report',
          source_id: targetReport.id,
          status: 'queued',
          consent_confirmed_at: new Date().toISOString(),
          consent_basis: 'transactional_intake',
        }).select('id').maybeSingle();

        if (outbox?.id) {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            await fetch('/api/communications/send', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ outboxId: outbox.id }),
            }).catch(() => {});
          }
        }
        setSaveSuccessMsg(`✅ 診断レポートを承認し、${contact.full_name || '担当者'}様（${contact.email}）へ送信完了しました！`);
      } else {
        setSaveSuccessMsg('✅ 診断レポートを「承認済（approved）」にし、診断ステータスを「レポート発行済」に更新しました。（※連絡先アドレス未登録のため送信待ちは保留）');
      }

      onUpdated();
    } catch (err: any) {
      setErrorMsg(`レポート承認送信エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setApprovingAndSendingReport(false);
    }
  };

  if (isLoading || !diagnosis) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center justify-center space-y-3 shadow-xl">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <p className="text-sm font-semibold text-slate-700">診断詳細を読み込み中...</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[diagnosis.status] || STATUS_LABELS.received;
  const isFormDiagnosis = diagnosis.questionnaire_version.startsWith('form-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{diagnosis.company?.company_name || diagnosis.company_id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {DIAGNOSIS_TYPE_LABELS[diagnosis.diagnosis_type] || diagnosis.diagnosis_type}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                ID: {diagnosis.id} / 設問版: {diagnosis.questionnaire_version}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 通知メッセージ */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isFormDiagnosis ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              送信済みのフォーム回答を受け付けました。内容を確認してから、診断結果やレポートを作成できます。
            </div>
          ) : (
          <>
          {/* スコア・進捗サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-500">総合スコア（リアルタイム）</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  {currentScores.totalScore}
                </span>
                <span className="text-xs text-slate-400">/ 100点</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-500">回答進捗状況</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600">
                  {currentScores.answeredCount}
                </span>
                <span className="text-xs text-slate-400">/ {currentScores.totalQuestions} 問回答済</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-500">AIレポート発行状況</span>
              <div className="flex items-center gap-1.5 pt-1">
                {reports.length > 0 ? (
                  <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-purple-600" />
                    <span>最新レポートあり (v{reports[0].version})</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">レポート未発行</span>
                )}
              </div>
            </div>
          </div>

          {reports[0] && (
            <details className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-purple-900">
                最新のAI診断レポートを確認（v{reports[0].version}）
              </summary>
              <div className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-white border border-purple-100 p-4 text-sm leading-7 text-slate-800">
                {reports[0].full_report_text || reports[0].summary || 'レポート本文はまだ作成されていません。'}
              </div>
            </details>
          )}
          </>
          )}

          <section className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">診断レポート</h3>
                <p className="mt-1 text-xs text-slate-500">フォーム回答と社内CRM情報から草案を生成します。内容を確認・修正して保存すると、顧客書類にレポート（承認待ち）が登録されます。提案書は「提案書・レポート作成」から作れます。</p>
              </div>
              <p className="text-xs text-slate-500">診断回答と会社名・業種などをAIサービスに送信します。個人の連絡先と社内メモは送信しません。</p>
              <div className="flex items-center gap-2">
                {generatingReport ? (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600/70 px-4 py-2 text-xs font-semibold text-white cursor-not-allowed shadow-sm"
                    >
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      草案を生成中…
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelGenerateReportDraft}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                      title="生成を中断して元の状態に戻します"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      中断
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateReportDraft}
                    disabled={savingReport}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    AIで草案を生成
                  </button>
                )}
              </div>
            </div>
            {reportDraft && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <label className="block text-xs font-medium text-slate-700">草案（保存前に編集できます）</label>
                <textarea value={reportDraft.text} onChange={(event) => setReportDraft({ ...reportDraft, text: event.target.value })} rows={16} className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => setReportDraft(null)} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors">破棄</button>
                  <button type="button" onClick={handleSaveGeneratedReport} disabled={savingReport || !reportDraft.text.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">
                    {savingReport && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    顧客書類に保存
                  </button>
                </div>
              </div>
            )}
            {reports[0] && !reportDraft && (
              <div className="rounded-xl border border-purple-200 bg-white p-3 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">
                      最新レポート v{reports[0].version} ({reports[0].status === 'approved' ? '承認済' : '承認待ち'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApproveAndSendReport(reports[0])}
                    disabled={approvingAndSendingReport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {approvingAndSendingReport ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>承認・送信処理中…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-purple-200" />
                        <span>1クリック承認＆レポート送信</span>
                      </>
                    )}
                  </button>
                </div>
                <details className="rounded-lg border border-slate-200 bg-slate-50 p-3" open>
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">レポート本文を確認</summary>
                  <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white border border-slate-200 p-3 text-sm leading-6 text-slate-800">
                    {reports[0].full_report_text || reports[0].summary || 'レポート本文がありません。'}
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* 設問回答フォーム（カテゴリ別） */}
          {diagnosis.questionnaire_version.startsWith('form-') ? (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-bold text-slate-800">フォーム回答（送信済み）</h3>
              <dl className="space-y-2">
                {Object.entries(answers).filter(([key]) => key !== '_intake').map(([key, value]) => (
                  <div key={key} className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] shadow-sm">
                    <dt className="text-xs font-medium text-slate-600 break-words">{questionLabels?.[key] || key}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm text-slate-800">
                      {typeof value === 'string' ? value : Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? (value ? 'はい' : 'いいえ') : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              {Boolean(answers._intake) && <details className="text-xs text-slate-500"><summary className="cursor-pointer">受付情報</summary><pre className="mt-2 whitespace-pre-wrap bg-white border border-slate-200 p-2 rounded-lg text-slate-700">{JSON.stringify(answers._intake, null, 2)}</pre></details>}
            </section>
          ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>診断設問への回答入力（バージョン: {diagnosis.questionnaire_version}）</span>
              </h3>
              <span className="text-xs text-slate-500">各設問 1〜5段階評価</span>
            </div>

            {QUESTIONNAIRE_V1.map((cat: QuestionCategory) => {
              const catScore = currentScores.categoryScores[cat.key] || 0;
              return (
                <div key={cat.key} className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">{cat.name}</h4>
                      <p className="text-[11px] text-slate-500">{cat.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{catScore}点</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {cat.questions.map((q) => {
                      const currentVal = answers[q.id];
                      return (
                        <div key={q.id} className="space-y-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                          <div className="space-y-0.5">
                            <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                              <span>{q.label}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {q.id}</span>
                            </label>
                            <p className="text-[11px] text-slate-500">{q.description}</p>
                          </div>

                          {/* 5段階評価ボタン */}
                          <div className="flex items-center gap-2 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = Number(currentVal) === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  disabled={isLockedForDirectEdit}
                                  onClick={() => handleAnswerChange(q.id, val)}
                                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                    isSelected
                                      ? 'bg-purple-600 text-white shadow-sm scale-[1.02]'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                  } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

// 診断レポートの作成画面を開く。診断IDか、フォーム回答IDのどちらかを渡す。
// 回答IDの場合は、診断が未作成ならサーバーで作成してから開く。
export const DiagnosisDetailLoader: React.FC<{
  diagnosisId?: string;
  submissionId?: string;
  questionLabels?: Record<string, string>;
  onClose: () => void;
  onUpdated?: () => void;
}> = ({ diagnosisId: diagnosisIdProp, submissionId, questionLabels, onClose, onUpdated }) => {
  const [diagnosisId, setDiagnosisId] = useState<string | null>(diagnosisIdProp || null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const loadDiagnosis = async (id: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchDiagnosisById(id);
      if (res.data) {
        setDiagnosis(res.data);
      } else if (!silent) {
        setFailure(res.error?.message || '診断データを取得できませんでした。');
      }
    } catch (err: any) {
      if (!silent) setFailure(err?.message || '診断データを取得できませんでした。');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setFailure(null);
      if (diagnosisIdProp) {
        setDiagnosisId(diagnosisIdProp);
        await loadDiagnosis(diagnosisIdProp);
        return;
      }
      if (!submissionId) {
        setFailure('対象の回答が指定されていません。');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/diagnosis-submissions/${encodeURIComponent(submissionId)}/diagnosis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
        });
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !result.diagnosisId) {
          setFailure(result.error || '診断を準備できませんでした。');
          setLoading(false);
          return;
        }
        setDiagnosisId(String(result.diagnosisId));
        await loadDiagnosis(String(result.diagnosisId));
        if (result.created) onUpdated?.();
      } catch (err: any) {
        if (!cancelled) {
          setFailure(err?.message || '診断を準備できませんでした。');
          setLoading(false);
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [diagnosisIdProp, submissionId]);

  if (failure) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
        <div className="max-w-md rounded-xl bg-white p-6 text-sm text-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="font-semibold text-slate-900">診断レポートを開けませんでした</p>
          <p className="mt-2 text-rose-700">{failure}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <DiagnosisDetailModal
      diagnosisId={diagnosisId || ''}
      initialDiagnosis={diagnosis}
      isLoading={loading || !diagnosisId}
      questionLabels={questionLabels}
      onClose={onClose}
      onUpdated={() => {
        onUpdated?.();
        if (diagnosisId) void loadDiagnosis(diagnosisId, true);
      }}
    />
  );
};

export const DiagnosisManager: React.FC<DiagnosisManagerProps> = (props) => {
  const [openDiagnosisId, setOpenDiagnosisId] = useState<string | null>(props.initialDiagnosisId || null);
  const [section, setSection] = useState<'forms' | 'materials'>(
    props.initialSection === 'materials' ? 'materials' : 'forms'
  );

  useEffect(() => {
    if (props.initialSection === 'forms' || props.initialSection === 'materials') {
      setSection(props.initialSection);
    } else if (props.initialSection === 'answers') {
      setSection('forms');
    }
  }, [props.initialSection]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">受付フォーム・公式配布資料管理</h1>
            <p className="mt-0.5 text-xs text-slate-500">HP・LINE向けの反響受付フォームや診断設問の設計、公式配布PDF資料の並び替え・公開管理を行えます。</p>
          </div>
          <div className="flex items-center gap-2">
            {props.onNavigateTab && (
              <>
                <button
                  onClick={() => props.onNavigateTab?.('document_templates')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
                  title="重要書類・見積・契約でレポートや提案書を直接AI作成"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>重要書類・見積・契約を開く</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
                <button
                  onClick={() => props.onNavigateTab?.('inbox_hub')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                >
                  <Inbox className="w-3.5 h-3.5 text-slate-500" />
                  <span>受信トレイで回答確認</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-200 pt-2 gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSection('forms')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              section === 'forms'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>フォーム設問・公開管理</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('materials')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              section === 'materials'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>公式配布資料・PDFマスタ管理</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-800 border border-sky-200 font-medium">HP自動連動</span>
          </button>
        </div>
      </div>
      <DiagnosisFormsWorkspace
        key={section}
        initialLeadId={props.initialLeadId}
        initialCompanyId={props.initialCompanyId}
        initialSection={section}
        activeSection={section}
        onSectionChange={(next) => setSection(next === 'materials' ? 'materials' : 'forms')}
        showHeader={false}
        onOpenDiagnosis={setOpenDiagnosisId}
        onOpenSendCenter={props.onOpenSendCenter}
      />
      {openDiagnosisId && (
        <DiagnosisDetailLoader
          diagnosisId={openDiagnosisId}
          onClose={() => setOpenDiagnosisId(null)}
        />
      )}
    </div>
  );
};
