import React from 'react';
import { TableKey, TABLE_CONFIGS } from '../types/database';
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
  FileText
} from 'lucide-react';
import { TransitionType } from './StageTransitionModal';

interface RecordDetailModalProps {
  tableKey: TableKey;
  record: any | null;
  onClose: () => void;
  onEdit: (record: any) => void;
  onTransitionStage?: (type: TransitionType, record: any) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination: 'documents' | 'operations' | 'diagnoses' | 'forms' | 'send', recordContext?: { tableKey: TableKey; recordId: string; leadId?: string; contactId?: string }) => void;
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

  const formatFieldValue = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-500 italic">未設定</span>;
    }
    if (typeof val === 'boolean') {
      return val ? '有効' : '無効';
    }
    if (typeof val === 'object') {
      return <pre className="text-[11px] font-mono bg-slate-950 p-2 rounded">{JSON.stringify(val, null, 2)}</pre>;
    }
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{config.label} 詳細</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  ID: {record.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">テーブル: {tableKey}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200">
          {/* Stage Progression Action Banner */}
          {['prospects', 'leads', 'deals'].includes(tableKey) && onTransitionStage && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800/90 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {tableKey === 'prospects' && '次の営業ステップ：リードへ進める'}
                    {tableKey === 'leads' && '次の営業ステップ：商談を作成する'}
                    {tableKey === 'deals' && '次の営業ステップ：顧客として登録する'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
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
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 flex items-center gap-1.5 transition-colors shrink-0"
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
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>商談を作成</span>
                </button>
              )}

              {tableKey === 'deals' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTransitionStage('deal_to_customer', record);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30 flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>顧客として登録</span>
                </button>
              )}
            </div>
          )}

          {/* Main Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.fields.map((field) => {
              const rawValue = record[field.key];

              // 会社リレーション表示の特別扱い
              if (field.type === 'fk_company') {
                const linkedComp = record.company;
                return (
                  <div key={field.key} className="sm:col-span-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-blue-300">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px]">会社ID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedComp ? (
                      <div className="pt-1 text-white font-bold text-base flex items-center justify-between">
                        <span>{linkedComp.company_name}</span>
                        {linkedComp.industry && (
                          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
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
                  <div key={field.key} className="sm:col-span-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-purple-300">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px]">商品ID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedProd ? (
                      <div className="pt-1 text-white font-bold flex items-center justify-between">
                        <span>{linkedProd.product_name}</span>
                        <span className="text-xs font-mono font-medium text-emerald-400">
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
                  <div key={field.key} className="sm:col-span-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-cyan-300">{field.label} ({field.key})</span>
                      <span className="font-mono text-[11px]">リードID: {rawValue || '未設定'}</span>
                    </div>
                    {linkedLead ? (
                      <div className="pt-1 text-white text-xs space-y-0.5">
                        <div className="font-bold">
                          {linkedLead.service_type || linkedLead.source ? `${linkedLead.service_type || linkedLead.source} (${linkedLead.status || 'ステータス未設定'})` : `リード ID: ${linkedLead.id}`}
                        </div>
                        {linkedLead.priority_channel && (
                          <div className="text-slate-400 text-[11px]">優先チャネル: {linkedLead.priority_channel}</div>
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
                  className={`bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 space-y-1 ${
                    isFullWidth ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>{field.label}</span>
                    <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                  </div>
                  <div className="font-medium text-white break-words">
                    {field.key === 'ai_score' && rawValue !== null && rawValue !== undefined ? (
                      <span className="font-mono text-blue-300 font-bold">
                        {rawValue} 点
                      </span>
                    ) : field.type === 'number' && typeof rawValue === 'number' ? (
                      <span className="font-mono text-emerald-300">
                        ¥{rawValue.toLocaleString()}
                      </span>
                    ) : field.type === 'url' && rawValue ? (
                      <a 
                        href={rawValue} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 hover:underline flex items-center gap-1 inline-flex"
                      >
                        <span>{rawValue}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      formatFieldValue(rawValue)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timestamps */}
          {(record.created_at || record.updated_at) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
              {record.created_at && (
                <div>
                  <span className="text-slate-500">作成日時 (created_at): </span>
                  <span className="text-slate-300">{new Date(record.created_at).toLocaleString('ja-JP')}</span>
                </div>
              )}
              {record.updated_at && (
                <div>
                  <span className="text-slate-500">更新日時 (updated_at): </span>
                  <span className="text-slate-300">{new Date(record.updated_at).toLocaleString('ja-JP')}</span>
                </div>
              )}
            </div>
          )}

          {/* Additional Columns from live DB */}
          {extraFields.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Info className="w-4 h-4 text-blue-400" />
                <span>その他の追加列 (データベースの実スキーマより検出)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extraFields.map((key) => (
                  <div key={key} className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="font-mono text-slate-400 text-[10px]">{key}</div>
                    <div className="text-slate-200">{formatFieldValue(record[key])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - STRICTLY NO DELETE BUTTON */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            ※ 社内ポリシーによりデータの削除機能は提供されていません。
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {['leads', 'deals', 'customers'].includes(tableKey) && onOpenCustomerWorkspace && record.company_id && (
              <>
                <button
                  onClick={() => { onClose(); onOpenCustomerWorkspace(String(record.company_id), 'documents', { tableKey, recordId: String(record.id), leadId: record.lead_id ? String(record.lead_id) : undefined, contactId: record.contact_id ? String(record.contact_id) : undefined }); }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-cyan-200 hover:bg-cyan-950/40 border border-cyan-800 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{tableKey === 'customers' ? '顧客書類' : '関連書類'}</span>
                </button>
                <button
                  onClick={() => { onClose(); onOpenCustomerWorkspace(String(record.company_id), 'diagnoses', { tableKey, recordId: String(record.id), leadId: record.lead_id ? String(record.lead_id) : undefined }); }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-indigo-200 hover:bg-indigo-950/40 border border-indigo-800 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>診断レポート</span>
                </button>
                <button
                  onClick={() => { onClose(); onOpenCustomerWorkspace(String(record.company_id), 'forms', { tableKey, recordId: String(record.id), leadId: record.lead_id ? String(record.lead_id) : undefined }); }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-sky-200 hover:bg-sky-950/40 border border-sky-800 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>フォーム回答</span>
                </button>
                {tableKey === 'customers' && <button
                  onClick={() => { onClose(); onOpenCustomerWorkspace(String(record.company_id), 'operations', { tableKey, recordId: String(record.id) }); }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-emerald-200 hover:bg-emerald-950/40 border border-emerald-800 transition-colors flex items-center gap-1.5"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>契約・請求・支援</span>
                </button>}
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>このレコードを編集</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
