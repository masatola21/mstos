import React, { useState, useEffect } from 'react';
import { TableKey, TABLE_CONFIGS, Company, Product, Lead } from '../types/database';
import { 
  fetchCompaniesList, 
  fetchProductsList, 
  fetchLeadsList, 
  insertRecord, 
  updateRecord 
} from '../services/dataService';
import { ProposalPlanTemplatePicker } from './ProposalPlanTemplatePicker';
import type { ProposalPlanTemplate } from './ProposalPlanTemplatePicker';
import { todayJst } from '../utils/date';

const buildSharedProposalDescription = (product: Product): string => [
  `【商品名】${product.product_name}`,
  `【説明】${product.description?.trim() || '商品説明未登録'}`,
  `【価格】初期費用 ¥${Number(product.initial_fee || 0).toLocaleString('ja-JP')} / 月額費用 ¥${Number(product.monthly_fee || 0).toLocaleString('ja-JP')}`,
  `【フェーズ】${product.phase?.trim() || '未設定（商品マスタで設定してください）'}`,
].join('\\n');
import { 
  X, 
  Check, 
  AlertCircle, 
  Loader2, 
  PlusCircle, 
  Edit3, 
  HelpCircle,
  Building2
} from 'lucide-react';

interface RecordFormModalProps {
  isOpen: boolean;
  tableKey: TableKey;
  editRecord: any | null; // nullなら新規作成
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  tableKey,
  editRecord,
  onClose,
  onSuccess,
}) => {
  const config = TABLE_CONFIGS[tableKey];
  const isEditing = !!editRecord;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 外部キー候補リスト
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [leadProductChoice, setLeadProductChoice] = useState('');
  const [proposalPlanTemplateId, setProposalPlanTemplateId] = useState('');

  // 初期化
  useEffect(() => {
    if (!isOpen) return;

    setSubmitError(null);
    setFormErrors({});

    // 候補データの取得
    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const [comps, prods, lds] = await Promise.all([
          fetchCompaniesList(),
          fetchProductsList(),
          fetchLeadsList(),
        ]);
        setCompanies(comps);
        setProducts(prods);
        setLeads(lds);
        if (tableKey === 'leads') {
          const selected = prods.find((product) => product.id === editRecord?.interested_product_id)
            || prods.find((product) => product.product_name === editRecord?.service_type);
          setLeadProductChoice(selected?.id || (editRecord?.service_type ? '__custom' : ''));
        }
      } catch (err) {
        console.warn('Failed to load foreign lookups', err);
      } finally {
        setLoadingLookups(false);
      }
    };

    loadLookups();

    if (editRecord) {
      // 編集時: 既存レコードの値をセット
      const initial: Record<string, any> = {};
      const customValues: Record<string, string> = {};
      config.fields.forEach((f) => {
        const existingValue = editRecord[f.key] !== undefined && editRecord[f.key] !== null ? editRecord[f.key] : '';
        const isKnownChoice = f.options?.some((option) => option.value === String(existingValue));
        if (f.allowCustom && existingValue !== '' && !isKnownChoice) {
          initial[f.key] = '__custom';
          customValues[f.key] = String(existingValue);
        } else {
          initial[f.key] = existingValue;
        }
      });
      setCustomFieldValues(customValues);
      if (editRecord.id !== undefined) {
        initial.id = editRecord.id;
      }
      setFormData(initial);
      setProposalPlanTemplateId(editRecord.proposal_plan_template_id || '');
    } else {
      setLeadProductChoice('');
      setProposalPlanTemplateId('');
      // 新規登録時: デフォルト値
      const initial: Record<string, any> = {};
      setCustomFieldValues({});
      config.fields.forEach((f) => {
        if (f.type === 'select' && f.options && f.options.length > 0) {
          initial[f.key] = f.options[0].value;
        } else if (['registered_at', 'first_registered_at'].includes(f.key)) {
          initial[f.key] = todayJst();
        } else {
          initial[f.key] = '';
        }
      });
      setFormData(initial);
    }
  }, [isOpen, tableKey, editRecord]);

  if (!isOpen) return null;

  const handleInputChange = (fieldKey: string, value: any) => {
    if (tableKey === 'deals' && fieldKey === 'product_id' && value !== formData.product_id) {
      setProposalPlanTemplateId('');
      const product = products.find((item) => item.id === value);
      setFormData((prev) => ({
        ...prev,
        [fieldKey]: value,
        initial_fee: product?.initial_fee ?? '',
        monthly_fee: product?.monthly_fee ?? '',
        total_amount: product ? Number(product.initial_fee || 0) + Number(product.monthly_fee || 0) : '',
        proposal_plan_name: product?.product_name || '',
        memo: product ? buildSharedProposalDescription(product) : '',
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
    if (formErrors[fieldKey]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldKey];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    config.fields.forEach((field) => {
      const val = formData[field.key];

      // 必須チェック
      if (field.required && !(field.key === 'id' && !isEditing && ['companies', 'deals', 'products'].includes(tableKey)) && (val === undefined || val === null || String(val).trim() === '')) {
        errors[field.key] = `${field.label}は必須項目です。`;
        return;
      }

      // メールチェック
      if (field.type === 'email' && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val).trim())) {
          errors[field.key] = '有効なメールアドレス形式を入力してください。';
          return;
        }
      }

      // 数値チェック
      if (field.type === 'number' && val !== '' && val !== undefined && val !== null) {
        const num = Number(val);
        if (isNaN(num)) {
          errors[field.key] = '有効な数値を入力してください。';
          return;
        }
        if (num < 0) {
          errors[field.key] = '0以上の数値を入力してください。';
          return;
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    // 送信ペイロードのクリーンアップ（数値の型変換、未入力項目の適切な処理）
    const payload: Record<string, any> = {};
    config.fields.forEach((field) => {
      let val = formData[field.key];
      if (field.allowCustom && val === '__custom') {
        val = customFieldValues[field.key]?.trim() || '';
      }
      // ブール型セレクトボックスの変換
      if (['target_flag', 'reply_flag', 'proposal_created'].includes(field.key)) {
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === '' || val === undefined) val = null;
      }

      if (field.type === 'number') {
        if (val !== '' && val !== null && val !== undefined) {
          payload[field.key] = Number(val);
        } else if (isEditing) {
          payload[field.key] = null;
        }
      } else if (val === '' || val === undefined) {
        if (isEditing) {
          payload[field.key] = null;
        }
      } else {
        payload[field.key] = val;
      }
    });

    if (tableKey === 'companies' && formData.id) {
      payload.id = formData.id.trim();
    }
    if (tableKey === 'products' && formData.id) {
      payload.id = formData.id.trim();
    }
    if (tableKey === 'deals' && formData.id) {
      payload.id = formData.id.trim();
    }
    if (tableKey === 'leads') {
      payload.interested_product_id = leadProductChoice && leadProductChoice !== '__custom' ? leadProductChoice : null;
    }
    if (tableKey === 'deals') {
      payload.proposal_plan_template_id = proposalPlanTemplateId || null;
    }

    try {
      let result;
      if (isEditing) {
        result = await updateRecord(tableKey, editRecord.id, payload);
      } else {
        result = await insertRecord(tableKey, payload);
      }

      if (result.error) {
        setSubmitError(result.error.message);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'データ保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sharedProposalTemplate = (() => {
    const product = products.find((item) => item.id === String(formData.product_id || ''));
    if (!product) return null;
    return {
      id: '',
      product_id: product.id,
      name: product.product_name,
      description: buildSharedProposalDescription(product),
      initial_fee: product.initial_fee ?? null,
      monthly_fee: product.monthly_fee ?? null,
      total_amount: Number(product.initial_fee || 0) + Number(product.monthly_fee || 0),
    } satisfies ProposalPlanTemplate;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `${config.label} 編集` : `${config.label} 新規登録`}
              </h2>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-200">
            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.fields.map((field) => {
                const value = formData[field.key] ?? '';
                const error = formErrors[field.key];
                const isFullWidth = field.type === 'textarea' || field.key === 'company_name' || field.key === 'deal_name';

                // 会社ID・商談ID・商品コードはDBで採番する。編集時のみ参照用に表示する。
                if (field.key === 'id' && !isEditing && ['companies', 'deals', 'products'].includes(tableKey)) {
                  return null;
                }

                // 主キー (編集時は編集不可にする)
                if (field.key === 'id' && isEditing) {
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-medium text-slate-400">
                        {field.label} (主キー: 変更不可)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={value}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 text-xs font-mono cursor-not-allowed"
                      />
                    </div>
                  );
                }

                // 会社リレーション（プルダウン）
                if (field.type === 'fk_company') {
                  return (
                    <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                      </label>

                      {loadingLookups ? (
                        <div className="text-xs text-slate-400 flex items-center gap-2 p-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          会社一覧を読み込み中...
                        </div>
                      ) : (
                        <select
                          value={value}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                            error ? 'border-rose-500' : 'border-slate-700/80'
                          } text-slate-200 text-xs outline-none focus:border-blue-500`}
                        >
                          <option value="">-- 対象会社を選択してください --</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.company_name} ({c.id}) {c.industry ? `- ${c.industry}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                if (tableKey === 'leads' && field.key === 'service_type') {
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">検討サービス種別</label>
                      <select
                        value={leadProductChoice}
                        onChange={(e) => {
                          const choice = e.target.value;
                          setLeadProductChoice(choice);
                          const product = products.find((item) => item.id === choice);
                          handleInputChange('interested_product_id', product?.id || '');
                          handleInputChange('service_type', product?.product_name || '');
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-200 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="">商品を選択（未定）</option>
                        {products.filter((product) => product.status !== 'inactive' || product.id === leadProductChoice).map((product) => <option key={product.id} value={product.id}>{product.product_name}{product.status === 'inactive' ? '（取扱停止・既存記録）' : ''}</option>)}
                        <option value="__custom">その他（自由入力）</option>
                      </select>
                      {leadProductChoice === '__custom' && (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleInputChange('service_type', e.target.value)}
                          placeholder="サービス名を入力"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-200 text-xs outline-none focus:border-blue-500"
                        />
                      )}
                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                // 商品リレーション（プルダウン）
                if (field.type === 'fk_product') {
                  return (
                    <React.Fragment key={field.key}>
                      <div className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                        <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>{field.label} {field.required && <span className="text-rose-400">*</span>}</span>
                          <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                        </label>
                        <select
                          value={value}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${error ? 'border-rose-500' : 'border-slate-700/80'} text-slate-200 text-xs outline-none focus:border-blue-500`}
                        >
                          <option value="">-- 提案商品を選択（未定可） --</option>
                          {products.filter((p) => p.status !== 'inactive' || p.id === value).map((p) => <option key={p.id} value={p.id}>{p.product_name}{p.status === 'inactive' ? '（取扱停止・既存記録）' : ''} (月額: ¥{Number(p.monthly_fee || 0).toLocaleString()})</option>)}
                        </select>
                        {error && <p className="text-[11px] text-rose-400">{error}</p>}
                      </div>
                      {tableKey === 'deals' && field.key === 'product_id' && (
                        <ProposalPlanTemplatePicker
                          productId={String(formData.product_id || '')}
                          selectedTemplateId={proposalPlanTemplateId}
                          name={String(formData.proposal_plan_name || '')}
                          description={String(formData.memo || '')}
                          initialFee={formData.initial_fee ?? ''}
                          monthlyFee={formData.monthly_fee ?? ''}
                          totalAmount={formData.total_amount ?? ''}
                          sharedTemplate={sharedProposalTemplate}
                          onApply={(template?: ProposalPlanTemplate | null) => {
                            setProposalPlanTemplateId(template?.id || '');
                            if (template) setFormData((prev) => ({
                              ...prev,
                              proposal_plan_template_id: template.id,
                              product_id: template.product_id,
                              proposal_plan_name: template.name,
                              memo: template.description || prev.memo,
                              initial_fee: template.initial_fee ?? '',
                              monthly_fee: template.monthly_fee ?? '',
                              total_amount: template.total_amount ?? '',
                            }));
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                }

                // リードリレーション（プルダウン）
                if (field.type === 'fk_lead') {
                  return (
                    <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                      </label>

                      <select
                        value={value}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                          error ? 'border-rose-500' : 'border-slate-700/80'
                        } text-slate-200 text-xs outline-none focus:border-blue-500`}
                      >
                        <option value="">-- 紐づくリードを選択（任意） --</option>
                        {leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            ID: {l.id} - {l.service_type || l.source || 'リード'} ({l.status || '新規'})
                          </option>
                        ))}
                      </select>
                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                // セレクトボックス
                if (field.type === 'select' && field.options) {
                  const isCustomChoice = field.allowCustom && value === '__custom';
                  return (
                    <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                      </label>

                      <select
                        value={value}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                          error ? 'border-rose-500' : 'border-slate-700/80'
                        } text-slate-200 text-xs outline-none focus:border-blue-500`}
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {field.allowCustom && <option value="__custom">その他（自由入力）</option>}
                      </select>
                      {isCustomChoice && (
                        <input
                          type="text"
                          value={customFieldValues[field.key] || ''}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || `${field.label}を入力`}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-200 text-xs outline-none focus:border-blue-500"
                        />
                      )}
                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                if (tableKey === 'deals' && field.key === 'proposal_plan_name') {
                  return (
                    <div key={field.key} className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                      </label>
                      <input
                        type="text"
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${error ? 'border-rose-500' : 'border-slate-700/80'} text-slate-200 text-xs outline-none focus:border-blue-500`}
                      />

                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                // テキストエリア
                if (field.type === 'textarea') {
                  return (
                    <div key={field.key} className="sm:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                      </label>
                      <textarea
                        rows={3}
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                          error ? 'border-rose-500' : 'border-slate-700/80'
                        } text-slate-200 text-xs outline-none focus:border-blue-500`}
                      />
                      {error && <p className="text-[11px] text-rose-400">{error}</p>}
                    </div>
                  );
                }

                // 通常の input (text, number, date, email, url, tel)
                return (
                  <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                    <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{field.key}</span>
                    </label>
                    <input
                      type={field.type}
                      autoComplete={({
                        full_name: 'name',
                        contact_name: 'name',
                        company_name: 'organization',
                        email: 'email',
                        phone: 'tel',
                        postal_code: 'postal-code',
                        address: 'street-address',
                        role_title: 'organization-title',
                        website: 'url',
                      } as Record<string, string>)[field.key]}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                        error ? 'border-rose-500' : 'border-slate-700/80'
                      } text-slate-200 text-xs outline-none focus:border-blue-500`}
                    />
                    {error && <p className="text-[11px] text-rose-400">{error}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isEditing ? '※ 既存レコードを安全に更新します' : '※ 新規レコードを追加します'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEditing ? '更新を保存' : '新規登録する'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
