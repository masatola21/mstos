import React, { useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { TableKey, TABLE_CONFIGS } from '../types/database';
import { formatJapaneseDate, formatJapaneseDateTime } from '../utils/date';
import { 
  X, 
  Edit3, 
  Building2, 
  Calendar, 
  DollarSign, 
  Tag, 
  Mail, 
  Phone, 
  ExternalLink,
  Layers,
  Info,
  ArrowRight,
  Briefcase,
  UserCheck,
  FileText,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { TransitionType } from './StageTransitionModal';
import { MeetingSessionView } from './meeting/MeetingSessionView';

interface RecordDetailModalProps {
  tableKey: TableKey;
  record: any | null;
  onClose: () => void;
  onEdit: (record: any) => void;
  onTransitionStage?: (type: TransitionType, record: any) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination: 'documents' | 'operations' | 'support_meetings' | 'diagnoses' | 'forms' | 'send', recordContext?: { tableKey: TableKey; recordId: string; leadId?: string; contactId?: string }) => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  tableKey,
  record,
  onClose,
  onEdit,
  onTransitionStage,
  onOpenCustomerWorkspace,
}) => {
  if (!record) return null;
  const config = TABLE_CONFIGS[tableKey];

  const [commHistory, setCommHistory] = useState<any[]>([]);
  const [loadingComm, setLoadingComm] = useState(false);
  const [linkedMeetingCtx, setLinkedMeetingCtx] = useState<{
    diagnosisId: string;
    companyId: string | null;
    companyName: string;
    formAnswers: Record<string, unknown>;
  } | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);

  const fetchCommunicationHistory = async () => {
    if (!record) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setLoadingComm(true);
    try {
      const contactId = record.contact_id || (tableKey === 'contacts' ? record.id : undefined);
      const email = record.email || record.contact?.email;
      const dealId = tableKey === 'deals' ? record.id : record.deal_id;

      let query = supabase.from('communication_outbox').select('*').order('created_at', { ascending: false }).limit(30);

      const orClauses: string[] = [];
      if (contactId) orClauses.push(`recipient_contact_id.eq.${contactId}`);
      if (email) orClauses.push(`recipient_address.eq.${email}`);
      if (dealId) orClauses.push(`deal_id.eq.${dealId}`);

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','));
        const { data, error } = await query;
        if (!error && data) {
          setCommHistory(data);
        }
      } else {
        setCommHistory([]);
      }
    } catch (err) {
      console.warn('Failed to load communication history:', err);
    } finally {
      setLoadingComm(false);
    }
  };

  useEffect(() => {
    if (['leads', 'deals', 'customers', 'contacts', 'prospects'].includes(tableKey)) {
      void fetchCommunicationHistory();
    }
  }, [record?.id, record?.contact_id, record?.email, tableKey]);

  useEffect(() => {
    let cancelled = false;
    setLinkedMeetingCtx(null);
    setMeetingModalOpen(false);
    if (!['leads', 'deals', 'customers'].includes(tableKey)) return () => { cancelled = true; };
    const supabase = getSupabase();
    if (!supabase) return () => { cancelled = true; };
    const resolvedLeadId = tableKey === 'leads' ? String(record.id) : record.lead_id ? String(record.lead_id) : undefined;
    const resolvedCompanyId = record.company_id ? String(record.company_id) : undefined;
    if (!resolvedLeadId && !resolvedCompanyId) return () => { cancelled = true; };

    void (async () => {
      try {
        let diagQuery = supabase.from('diagnoses').select('id,company_id,lead_id,answers').order('created_at', { ascending: false }).limit(1);
        diagQuery = resolvedLeadId ? diagQuery.eq('lead_id', resolvedLeadId) : diagQuery.eq('company_id', resolvedCompanyId!);
        let { data: diag } = await diagQuery.maybeSingle();
        if (!diag && resolvedLeadId && resolvedCompanyId) {
          const fallback = await supabase.from('diagnoses').select('id,company_id,lead_id,answers').eq('company_id', resolvedCompanyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          diag = fallback.data;
        }
        if (cancelled || !diag?.id) return;
        let formAnswers = (diag.answers || {}) as Record<string, unknown>;
        if (!Object.keys(formAnswers).length) {
          const subRes = await supabase.from('diagnosis_submissions').select('answers').eq('diagnosis_id', diag.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
          if (subRes.data?.answers) formAnswers = subRes.data.answers as Record<string, unknown>;
        }
        if (cancelled) return;
        const companyName = String(record.company?.company_name || record.company_name || '');
        setLinkedMeetingCtx({
          diagnosisId: String(diag.id),
          companyId: (diag.company_id || resolvedCompanyId || null) as string | null,
          companyName,
          formAnswers,
        });
      } catch {
        // non-blocking lookup
      }
    })();
    return () => { cancelled = true; };
  }, [record?.id, record?.company_id, record?.lead_id, tableKey]);

  // 標準フィールド一覧のキー
  const knownFieldKeys = new Set(config.fields.map(f => f.key));
  knownFieldKeys.add('id');
  knownFieldKeys.add('created_at');
  knownFieldKeys.add('updated_at');
  knownFieldKeys.add('company');
  knownFieldKeys.add('product');
  knownFieldKeys.add('lead');

  // 未定義の追加カラムを抽出
  const extraFields = Object.keys(record).filter(k => !knownFieldKeys.has(k));

  const formatFieldValue = (val: any, fieldKey?: string) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400 italic">未設定</span>;
    }
    if (typeof val === 'boolean') {
      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
          {val ? '有効' : '無効'}
        </span>
      );
    }
    if (typeof val === 'object') {
      return <pre className="text-[11px] font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>;
    }

    const strVal = String(val);
    // 日付・日時の自動判定
    if (fieldKey && (fieldKey.endsWith('_at') || fieldKey.endsWith('_date') || fieldKey.includes('date') || fieldKey.includes('time'))) {
      if (strVal.includes('T') || (strVal.includes(' ') && strVal.includes(':'))) {
        return (
          <span className="inline-flex items-center gap-1.5 font-mono text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="font-semibold">{formatJapaneseDateTime(strVal)}</span>
          </span>
        );
      }
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(strVal)) {
        return (
          <span className="inline-flex items-center gap-1.5 font-mono text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="font-semibold">{formatJapaneseDate(strVal)}</span>
          </span>
        );
      }
    }

    return strVal;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white border-l border-slate-200 w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{config.label} 詳細ドロワー</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                  ID: {record.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">テーブル: {tableKey}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Stage Progression Action Banner */}
          {['prospects', 'leads', 'deals'].includes(tableKey) && onTransitionStage && (
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                  <span>
                    {tableKey === 'prospects' && '次の営業ステップ：リードへ進める'}
                    {tableKey === 'leads' && '次の営業ステップ：商談を作成する'}
                    {tableKey === 'deals' && '次の営業ステップ：顧客として登録する'}
                  </span>
                </div>
                <p className="text-[11px] text-purple-800/80">
                  {tableKey === 'prospects' && 'この見込み企業の会社情報・アプローチ履歴を引き継いで案件リードを起票します。'}
                  {tableKey === 'leads' && 'このリードに紐づく商談パイプラインレコードを作成し、具体的な提案に入ります。'}
                  {tableKey === 'deals' && 'この商談の受注・合意に伴い、契約会社としての顧客レコードを登録します。'}
                </p>
              </div>

              {tableKey === 'prospects' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTransitionStage('prospect_to_lead', record);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>リードへ進める</span>
                </button>
              )}

              {tableKey === 'leads' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTransitionStage('lead_to_deal', record);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>商談を作成</span>
                </button>
              )}

              {tableKey === 'deals' && (
                <>
                  {record.company_id && onOpenCustomerWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomerWorkspace(String(record.company_id), 'documents', { tableKey, recordId: String(record.id), leadId: record.lead_id ? String(record.lead_id) : undefined });
                      }}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>見積・契約書を作成</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTransitionStage('deal_to_customer', record);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>顧客として登録</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* 面談予定日時のハイライトカード（面談日がある場合） */}
          {record.meeting_date && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-purple-900">📅 面談予定日時</div>
                  <div className="text-base font-bold text-slate-900">
                    {formatJapaneseDateTime(record.meeting_date, { fallbackTime: record.meeting_start_time })}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-purple-700 border border-purple-200">
                面談確定
              </span>
            </div>
          )}

          {/* 希望内容のハイライトカード（リード等の場合） */}
          {(record.inquiry_type || record.service_type) && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-amber-800">希望内容（反響・問合せ種別）</div>
                  <div className="text-sm font-bold text-slate-900">
                    {record.inquiry_type || record.service_type}
                  </div>
                </div>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300 font-semibold">
                顧客希望
              </span>
            </div>
          )}

          {/* 専用：相談メモ・ヒアリング詳細カード（リード・商談・見込みのメモを分かりやすく大きく表示） */}
          {(record.notes || record.memo) && (
            <div className="rounded-xl border border-purple-200 bg-slate-50/70 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span>
                    {tableKey === 'leads' && '📝 相談メモ・ヒアリング詳細'}
                    {tableKey === 'deals' && '📝 商談メモ・ヒアリング記録'}
                    {tableKey === 'prospects' && '📝 アプローチメモ・ヒアリング記録'}
                    {tableKey === 'customers' && '📝 顧客契約・支援メモ'}
                    {!['leads', 'deals', 'prospects', 'customers'].includes(tableKey) && '📝 メモ・特記事項'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {record.notes ? 'notes' : 'memo'}
                </span>
              </div>
              <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-sans bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                {record.notes || record.memo}
              </div>
            </div>
          )}

          {/* Main Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.fields
              .filter((field) => field.key !== 'notes' && field.key !== 'memo') // メモは上で独立表示
              .map((field) => {
              const rawValue = record[field.key];

              // 会社リレーション表示の特別扱い
              if (field.type === 'fk_company') {
                const linkedComp = record.company;
                return (
                  <div key={field.key} className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-purple-700">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px] text-slate-400">会社ID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedComp ? (
                      <div className="pt-1 text-slate-900 font-bold text-base flex items-center justify-between">
                        <span>{linkedComp.company_name}</span>
                        {linkedComp.industry && (
                          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {linkedComp.industry}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-mono">{rawValue || '未設定'}</div>
                    )}
                  </div>
                );
              }

              // 商品リレーション表示
              if (field.type === 'fk_product') {
                const linkedProd = record.product;
                return (
                  <div key={field.key} className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-purple-700">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px] text-slate-400">商品ID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedProd ? (
                      <div className="pt-1 text-slate-900 font-bold flex items-center justify-between">
                        <span>{linkedProd.product_name}</span>
                        <span className="text-xs font-mono font-medium text-emerald-700">
                          月額: ¥{Number(linkedProd.monthly_fee || 0).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-mono">{rawValue || '未設定'}</div>
                    )}
                  </div>
                );
              }

              // リードリレーション表示
              if (field.type === 'fk_lead') {
                const linkedLead = record.lead;
                return (
                  <div key={field.key} className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-purple-700">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px] text-slate-400">リードID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedLead ? (
                      <div className="pt-1 text-slate-900 text-xs space-y-0.5">
                        <div className="font-bold">
                          {linkedLead.service_type || linkedLead.source ? `${linkedLead.service_type || linkedLead.source} (${linkedLead.status || 'ステータス未設定'})` : `リード ID: ${linkedLead.id}`}
                        </div>
                        {linkedLead.priority_channel && (
                          <div className="text-slate-500 text-[11px]">優先チャネル: {linkedLead.priority_channel}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-mono">{rawValue || '未設定'}</div>
                    )}
                  </div>
                );
              }

              // 通常フィールド表示
              const isFullWidth = field.type === 'textarea' || field.key === 'company_name' || field.key === 'proposal_plan_name';

              return (
                <div 
                  key={field.key} 
                  className={`bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-1 ${
                    isFullWidth ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                    <span>{field.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{field.key}</span>
                  </div>
                  <div className="font-medium text-slate-900 break-words">
                    {field.key === 'ai_score' && rawValue !== null && rawValue !== undefined ? (
                      <span className="font-mono text-purple-700 font-bold">
                        {rawValue} 点
                      </span>
                    ) : field.type === 'number' && typeof rawValue === 'number' ? (
                      <span className="font-mono text-slate-900 font-semibold">
                        ¥{rawValue.toLocaleString()}
                      </span>
                    ) : field.type === 'url' && rawValue ? (
                      <a 
                        href={rawValue} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-purple-700 hover:underline flex items-center gap-1 inline-flex"
                      >
                        <span>{rawValue}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      formatFieldValue(rawValue, field.key)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ==============================================================
              Communication Outbox Timeline Section (メール・LINE送信履歴)
             ============================================================== */}
          {['leads', 'deals', 'customers', 'contacts', 'prospects'].includes(tableKey) && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-xs text-slate-900">
                    ✉️ メール・LINE送信・配信履歴 ({commHistory.length}件)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void fetchCommunicationHistory()}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="送信履歴を再読み込み"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingComm ? 'animate-spin text-purple-600' : ''}`} />
                  </button>
                  {onOpenCustomerWorkspace && record.company_id && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomerWorkspace(
                          String(record.company_id),
                          'send',
                          {
                            tableKey,
                            recordId: String(record.id),
                            leadId: record.lead_id ? String(record.lead_id) : undefined,
                            contactId: record.contact_id ? String(record.contact_id) : undefined,
                          }
                        );
                      }}
                      className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>新規メッセージ送信</span>
                    </button>
                  )}
                </div>
              </div>

              {loadingComm ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2 bg-slate-50 rounded-xl border border-slate-100">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span>送信履歴を照会中…</span>
                </div>
              ) : commHistory.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                  <p>この顧客・リードへの送信履歴はまだありません。</p>
                  <p className="text-[11px] text-slate-400">
                    フォーム受付時のサンクスメールや送信ドロワーからのメッセージが自動記録されます。
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {commHistory.map((item) => {
                    const isLine = item.channel === 'line';
                    const isSent = item.status === 'sent';
                    const isFailed = item.status === 'failed';
                    const isSending = item.status === 'sending';
                    const sentDate = item.sent_at || item.created_at;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                          isFailed
                            ? 'bg-rose-50/70 border-rose-200'
                            : isSent
                            ? 'bg-white border-slate-200 hover:border-purple-300'
                            : 'bg-amber-50/50 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                isLine
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isLine ? (
                                <>
                                  <MessageSquare className="w-2.5 h-2.5" /> LINE
                                </>
                              ) : (
                                <>
                                  <Mail className="w-2.5 h-2.5" /> メール
                                </>
                              )}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isSent
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isFailed
                                  ? 'bg-rose-100 text-rose-700'
                                  : isSending
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isSent ? '送信完了' : isFailed ? '送信失敗' : isSending ? '送信中' : '予約中'}
                            </span>
                            <span className="font-semibold text-slate-800 line-clamp-1">
                              {item.subject || (isLine ? 'LINEメッセージ' : '件名なし')}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {sentDate ? new Date(sentDate).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        {item.body_text && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg font-mono">
                            {item.body_text}
                          </p>
                        )}

                        {isFailed && item.error_message && (
                          <div className="text-[10px] text-rose-600 flex items-center gap-1 bg-rose-100/80 px-2 py-1 rounded font-mono">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>エラー: {item.error_message}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          {(record.created_at || record.updated_at) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs text-slate-500 font-mono">
              {record.created_at && (
                <div>
                  <span className="text-slate-400">作成日時 (created_at): </span>
                  <span className="text-slate-700 font-semibold">{new Date(record.created_at).toLocaleString('ja-JP')}</span>
                </div>
              )}
              {record.updated_at && (
                <div>
                  <span className="text-slate-400">更新日時 (updated_at): </span>
                  <span className="text-slate-700 font-semibold">{new Date(record.updated_at).toLocaleString('ja-JP')}</span>
                </div>
              )}
            </div>
          )}

          {/* Additional Columns from live DB */}
          {extraFields.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Info className="w-4 h-4 text-purple-600" />
                <span>その他の追加列 (データベースの実スキーマより検出)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extraFields.map((key) => (
                  <div key={key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="font-mono text-slate-400 text-[10px]">{key}</div>
                    <div className="text-slate-800">{formatFieldValue(record[key], key)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - STRICTLY NO DELETE BUTTON */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            ※ 社内ポリシーによりデータの削除機能は提供されていません。
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {['leads', 'deals', 'customers'].includes(tableKey) && onOpenCustomerWorkspace && record.company_id && (() => {
              const resolvedLeadId = tableKey === 'leads' ? String(record.id) : record.lead_id ? String(record.lead_id) : undefined;
              const resolvedContactId = record.contact_id ? String(record.contact_id) : undefined;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomerWorkspace(String(record.company_id), 'documents', {
                        tableKey,
                        recordId: String(record.id),
                        leadId: resolvedLeadId,
                        contactId: resolvedContactId,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title={tableKey === 'deals' ? 'この商談の見積・契約書を作成・確認' : tableKey === 'customers' ? '顧客台帳に紐づく請求書・契約書を確認' : '見積書・提案書を作成・確認'}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{tableKey === 'customers' ? '顧客書類' : tableKey === 'deals' ? '見積・契約書' : '見積・書類作成'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomerWorkspace(String(record.company_id), 'diagnoses', {
                        tableKey,
                        recordId: String(record.id),
                        leadId: resolvedLeadId,
                        contactId: resolvedContactId,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="この企業の提案書（経営改善・業務自動化 診断レポート）を作成・確認"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>診断レポート</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomerWorkspace(String(record.company_id), 'forms', {
                        tableKey,
                        recordId: String(record.id),
                        leadId: resolvedLeadId,
                        contactId: resolvedContactId,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="このリード・企業のWebフォーム回答内容一覧を確認"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>フォーム回答</span>
                  </button>

                  {tableKey === 'customers' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomerWorkspace(String(record.company_id), 'operations', {
                            tableKey,
                            recordId: String(record.id),
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>契約・請求・支援</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomerWorkspace(String(record.company_id), 'support_meetings', {
                            tableKey,
                            recordId: String(record.id),
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="既存顧客との定例打ち合わせ履歴・AI議事整理を開く"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>定例打ち合わせ</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomerWorkspace(String(record.company_id), 'send', {
                        tableKey,
                        recordId: String(record.id),
                        leadId: resolvedLeadId,
                        contactId: resolvedContactId,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="詳細モーダルを閉じて右側の送信ドロワーを開きます"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>送信ドロワー</span>
                  </button>
                </>
              );
            })()}
            {linkedMeetingCtx && (
              <button
                type="button"
                onClick={() => setMeetingModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="診断に紐づく商談ヒアリングシートと共有用画面を開きます"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>商談シートを開く</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 border border-slate-200 transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>このレコードを編集</span>
            </button>
          </div>
        </div>
      </div>

      {meetingModalOpen && linkedMeetingCtx && (
        <MeetingSessionView
          diagnosisId={linkedMeetingCtx.diagnosisId}
          companyId={linkedMeetingCtx.companyId}
          companyName={linkedMeetingCtx.companyName}
          formAnswers={linkedMeetingCtx.formAnswers}
          onClose={() => setMeetingModalOpen(false)}
        />
      )}
    </div>
  );
};
