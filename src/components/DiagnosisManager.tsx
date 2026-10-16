import React, { useState, useEffect } from 'react';
import { DiagnosisFormsWorkspace } from './DiagnosisFormsWorkspace';
import { getSupabase } from '../lib/supabaseClient';
import { Diagnosis, DiagnosisStatus, Company, Lead, AiReport } from '../types/database';
import { 
  fetchDiagnosesList, 
  fetchDiagnosisById, 
  createDiagnosis, 
  saveDiagnosisAnswers, 
  updateDiagnosisStatus,
  fetchCompaniesList, 
  fetchLeadsList, 
  fetchAiReportsByDiagnosisId,
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
  Sliders
} from 'lucide-react';

interface DiagnosisManagerProps {
  onOpenCreateTrigger?: boolean;
  onOpenRls?: () => void;
  initialLeadId?: string;
  initialCompanyId?: string;
  initialSection?: 'forms' | 'diagnoses';
}

const STATUS_LABELS: Record<DiagnosisStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  received: {
    label: '未確認',
    color: 'text-amber-300',
    bg: 'bg-amber-950/60',
    border: 'border-amber-700/50',
    icon: <Clock className="w-3.5 h-3.5 text-amber-400" />
  },
  completed: {
    label: '回答完了',
    color: 'text-emerald-300',
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-700/50',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
  },
  generating: {
    label: 'AI生成中',
    color: 'text-purple-300',
    bg: 'bg-purple-950/60',
    border: 'border-purple-700/50',
    icon: <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
  },
  reported: {
    label: 'レポート発行済',
    color: 'text-indigo-300',
    bg: 'bg-indigo-950/60',
    border: 'border-indigo-700/50',
    icon: <Award className="w-3.5 h-3.5 text-indigo-400" />
  }
};

const DIAGNOSIS_TYPE_LABELS: Record<string, string> = {
  standard: 'AI経営診断（標準）',
  comprehensive: '総合AI導入診断',
  quick: 'クイック簡易診断'
};

const DiagnosisRecordsView: React.FC<DiagnosisManagerProps> = ({ onOpenRls, initialLeadId, initialCompanyId }) => {
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Phase 1-C 診断＆AIレポート管理</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            診断管理（Diagnoses）
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            取引先企業のヒアリング回答収集、カテゴリ別スコア分析、AIレポート発行パイプライン
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新規診断を起票</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 安全ガード告知バナー */}
      <div className="bg-amber-950/40 border border-amber-600/30 rounded-2xl p-4 flex items-start gap-3 text-amber-200">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm">
          <p className="font-semibold text-amber-300">
            【安全ガード作動中】設問定義・必須設問IDが未確定のため、完了（completed）への確定遷移は安全のため意図的にロックされています
          </p>
          <p className="text-amber-200/80 leading-relaxed text-xs">
            回答の下書き保存（draft / in_progress）および回答変更は通常通り安全にご利用いただけます。設問ID一覧がDB上で確定されるまでは、1〜2問の途中回答で誤って完了化されることを防ぐため、二重の安全防壁で保護されています。
          </p>
        </div>
      </div>

      {/* 成功バナー */}
      {successBanner && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-semibold">{error.message}</p>
            {error.type === 'PERMISSION_DENIED' && onOpenRls && (
              <button
                onClick={onOpenRls}
                className="text-xs text-rose-200 underline hover:text-white"
              >
                RLSポリシーの設定手順を確認する
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 検索・ステータスフィルタ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="対象会社名・ID・種別・メモで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
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
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 診断一覧テーブル */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>診断データを読み込み中...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDiagnoses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardList className="w-8 h-8 text-slate-600" />
                      <p className="font-medium text-slate-400">該当する診断レコードがありません</p>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> 新しい診断を作成する
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDiagnoses.map((diag) => {
                  const statusInfo = STATUS_LABELS[diag.status] || STATUS_LABELS.received;
                  const answersCount = Object.keys(diag.answers || {}).length;
                  const { totalQuestions } = calculateScores(diag.answers || {});

                  return (
                    <tr
                      key={diag.id}
                      onClick={() => handleOpenDetail(diag.id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
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
                        <div className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                          {diag.company?.company_name || diag.company_id}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                          <Building2 className="w-3 h-3" />
                          <span>{diag.company_id}</span>
                        </div>
                      </td>

                      {/* 紐づくリード */}
                      <td className="py-3.5 px-4">
                        {diag.lead ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                              <Layers className="w-3 h-3 text-cyan-400" />
                              <span>{diag.lead.service_type || 'リードあり'}</span>
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                              {diag.lead_id}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>

                      {/* 診断種別 / 設問版 */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-200">
                          {DIAGNOSIS_TYPE_LABELS[diag.diagnosis_type] || diag.diagnosis_type}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          {diag.questionnaire_version}
                        </span>
                      </td>

                      {/* 回答状況 / スコア */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {diag.score !== null && diag.score !== undefined ? (
                            <span className="font-bold text-emerald-400 text-sm">
                              {diag.score}点
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">未算出</span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            ({answersCount}問 回答済)
                          </span>
                        </div>
                      </td>

                      {/* 実施 / 起票日 */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                        <div>
                          {diag.conducted_at 
                            ? new Date(diag.conducted_at).toLocaleDateString('ja-JP') 
                            : '未実施'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          起票: {diag.created_at ? new Date(diag.created_at).toLocaleDateString('ja-JP') : '-'}
                        </div>
                      </td>

                      {/* 操作 */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(diag.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1 group-hover:border-blue-500/50"
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
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">新規診断の起票</h3>
              <p className="text-xs text-slate-400">対象企業を選択し診断レコードを開始します</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 対象会社 (必須) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>対象会社 <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-slate-500">companies テーブル参照</span>
            </label>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setLeadId(''); // 会社変更時はリード選択をリセット
              }}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
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
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>紐づくリード（任意）</span>
              <span className="text-[10px] text-slate-500">整合性トリガーにより同社リードのみ選択可</span>
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={!companyId}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
            >
              <option value="">なし（会社単体での診断）</option>
              {matchingLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.service_type || 'リード'} (ID: {l.id.substring(0, 8)}...)
                </option>
              ))}
            </select>
            {companyId && matchingLeads.length === 0 && (
              <p className="text-[11px] text-slate-500">※ この会社に紐づくリードは現在ありません</p>
            )}
          </div>

          {/* 診断種別 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">診断種別</label>
            <select
              value={diagnosisType}
              onChange={(e) => setDiagnosisType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="standard">AI経営診断（標準プラン・5カテゴリ）</option>
              <option value="comprehensive">総合AI導入診断（詳細プラン）</option>
              <option value="quick">簡易クイック診断（スピード評価）</option>
            </select>
          </div>

          {/* 社内メモ */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">社内メモ・備考（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="診断の目的や商談背景、ヒアリング担当者など"
              rows={3}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="text-slate-300 font-semibold flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              起票時のステータスについて
            </p>
            <p>
              診断はデータベース権限制約（列レベル権限保護）に基づき、初期ステータス <strong>「未確認」</strong> で作成されます。
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !companyId}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
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
}

const DiagnosisDetailModal: React.FC<DiagnosisDetailModalProps> = ({
  diagnosisId,
  initialDiagnosis,
  isLoading,
  onClose,
  onUpdated,
}) => {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(initialDiagnosis);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [memo, setMemo] = useState('');
  const [diagnosisType, setDiagnosisType] = useState('standard');
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ステータス差し戻し状態
  const [generatingReport, setGeneratingReport] = useState(false);

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
        score: currentScores.totalScore,
        category_scores: currentScores.categoryScores,
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

  if (isLoading || !diagnosis) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center justify-center space-y-3 shadow-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold text-slate-300">診断詳細を読み込み中...</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[diagnosis.status] || STATUS_LABELS.received;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{diagnosis.company?.company_name || diagnosis.company_id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {DIAGNOSIS_TYPE_LABELS[diagnosis.diagnosis_type] || diagnosis.diagnosis_type}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                ID: {diagnosis.id} / 設問版: {diagnosis.questionnaire_version}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 通知メッセージ */}
          {saveSuccessMsg && (
            <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 安全ガード説明バナー */}
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-amber-200 space-y-1">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>必須設問に回答すると診断を完了できます</span>
            </div>
            <p className="text-xs text-amber-200/80 leading-relaxed pl-6">
              送信済みのフォーム回答を「未確認」として引き継ぎます。内容を確認して必要な修正を保存してください。
            </p>
          </div>

          {/* 編集ロック通知（completed / reported の場合） */}
          {isLockedForDirectEdit && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-slate-200">
                    回答内容は現在ロックされています（ステータス: {statusInfo.label}）
                  </p>
                  <p className="text-slate-400">
                    完了済み・レポート発行済みの回答の直接編集はDBトリガーにより安全に遮断されています。
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* スコア・進捗サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400">総合スコア（リアルタイム）</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {currentScores.totalScore}
                </span>
                <span className="text-xs text-slate-500">/ 100点</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400">回答進捗状況</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-400">
                  {currentScores.answeredCount}
                </span>
                <span className="text-xs text-slate-500">/ {currentScores.totalQuestions} 問回答済</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400">AIレポート発行状況</span>
              <div className="flex items-center gap-1.5 pt-1">
                {reports.length > 0 ? (
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-400" />
                    <span>最新レポートあり (v{reports[0].version})</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">レポート未発行</span>
                )}
              </div>
            </div>
          </div>

          {reports[0] && (
            <details className="rounded-2xl border border-indigo-800/70 bg-indigo-950/20 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-100">
                最新のAI診断レポートを確認（v{reports[0].version}）
              </summary>
              <div className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-4 text-sm leading-7 text-slate-200">
                {reports[0].full_report_text || reports[0].summary || 'レポート本文はまだ作成されていません。'}
              </div>
            </details>
          )}

          {/* 設問回答フォーム（カテゴリ別） */}
          {diagnosis.questionnaire_version.startsWith('form-') ? (
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h3 className="text-sm font-bold text-slate-200">フォーム回答（送信済み）</h3>
              <dl className="space-y-2">
                {Object.entries(answers).filter(([key]) => key !== '_intake').map(([key, value]) => (
                  <div key={key} className="grid gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                    <dt className="text-xs font-medium text-slate-400">{key}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                  </div>
                ))}
              </dl>
              {Boolean(answers._intake) && <details className="text-xs text-slate-500"><summary className="cursor-pointer">受付情報</summary><pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(answers._intake, null, 2)}</pre></details>}
            </section>
          ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>診断設問への回答入力（バージョン: {diagnosis.questionnaire_version}）</span>
              </h3>
              <span className="text-xs text-slate-400">各設問 1〜5段階評価</span>
            </div>

            {QUESTIONNAIRE_V1.map((cat: QuestionCategory) => {
              const catScore = currentScores.categoryScores[cat.key] || 0;
              return (
                <div key={cat.key} className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">{cat.name}</h4>
                      <p className="text-[11px] text-slate-400">{cat.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-emerald-400">{catScore}点</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {cat.questions.map((q) => {
                      const currentVal = answers[q.id];
                      return (
                        <div key={q.id} className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/40">
                          <div className="space-y-0.5">
                            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                              <span>{q.label}</span>
                              <span className="text-[10px] text-slate-500 font-mono">ID: {q.id}</span>
                            </label>
                            <p className="text-[11px] text-slate-400">{q.description}</p>
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
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
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

          {/* 社内メモの編集 */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>社内メモ・診断総括（memo）</span>
              <span className="text-[10px] text-slate-500">※完了後も随時追記可能</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="経営課題や商談でのやり取り、提案方針など"
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-500" />
            <span>回答変更時はスコアが自動更新されます</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              閉じる
            </button>

            <button type="button" disabled={saving || isLockedForDirectEdit} onClick={() => handleSaveAnswers()} className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-blue-700 hover:bg-blue-600 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"><Save className="w-3.5 h-3.5 text-blue-200" /><span>回答を保存</span></button>

            {/* 診断完了ボタン（安全ガードによりロック・ツールチップ案内） */}
            <div className="relative group">
              <button
                type="button"
                disabled={true}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed flex items-center gap-1.5"
                title="設問仕様の必須キー一覧が確定するまで完了化は安全にロックされています"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500/80" />
                <span>診断完了（ロック中）</span>
              </button>
              <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-amber-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                ⚠️ 設問バージョン {diagnosis.questionnaire_version} の必須設問IDが未確定のため、completed への完了確定は安全のため現在ロックされています。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export const DiagnosisManager: React.FC<DiagnosisManagerProps> = (props) => {
  const [section, setSection] = useState<'forms' | 'diagnoses'>(() => props.initialSection || (props.initialLeadId || props.initialCompanyId ? 'diagnoses' : 'forms'));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div>
          <h1 className="text-lg font-bold text-white">フォーム・診断</h1>
          <p className="text-xs text-slate-400">フォーム設定・受付回答と、社内診断・レポートを一つの管理領域にまとめます。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSection('forms')} className={`rounded-lg px-3 py-2 text-sm ${section === 'forms' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>フォーム・回答</button>
          <button onClick={() => setSection('diagnoses')} className={`rounded-lg px-3 py-2 text-sm ${section === 'diagnoses' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>診断・レポート</button>
        </div>
      </div>
      {section === 'forms' ? <DiagnosisFormsWorkspace initialLeadId={props.initialLeadId} initialCompanyId={props.initialCompanyId} initialSection={props.initialLeadId || props.initialCompanyId ? 'answers' : undefined} /> : <DiagnosisRecordsView {...props} />}
    </div>
  );
};
