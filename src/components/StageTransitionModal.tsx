import React, { useState, useEffect } from 'react';
import { Company, Product, Lead, Customer } from '../types/database';
import { ProposalPlanTemplatePicker } from './ProposalPlanTemplatePicker';
import type { ProposalPlanTemplate } from './ProposalPlanTemplatePicker';
import { 
  fetchProductsList, 
  fetchCustomerByCompanyId, 
  insertRecord 
} from '../services/dataService';
import { 
  X, 
  ArrowRight, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Info,
  ShieldAlert,
  Briefcase,
  Layers,
  UserCheck
} from 'lucide-react';

export type TransitionType = 'prospect_to_lead' | 'lead_to_deal' | 'deal_to_customer';

interface StageTransitionModalProps {
  isOpen: boolean;
  type: TransitionType;
  sourceRecord: any;
  onClose: () => void;
  onSuccess: (targetTable: 'leads' | 'deals' | 'customers', recordId?: string | number) => void;
  onViewExistingCustomer?: (customer: Customer) => void;
}

export const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  isOpen,
  type,
  sourceRecord,
  onClose,
  onSuccess,
  onViewExistingCustomer,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Products for Deal conversion
  const [products, setProducts] = useState<Product[]>([]);

  // Existing customer check for Deal -> Customer conversion
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);

  // Form states for target record creation
  // For Prospect -> Lead
  const [leadSource, setLeadSource] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceTypeProductChoice, setServiceTypeProductChoice] = useState('');
  const [priorityChannel, setPriorityChannel] = useState('メール');
  const [leadStatus, setLeadStatus] = useState('新規');
  const [leadNotes, setLeadNotes] = useState('');

  // For Lead -> Deal
  const [dealId, setDealId] = useState('');
  const [proposalPlanName, setProposalPlanName] = useState('');
  const [proposalPlanTemplateId, setProposalPlanTemplateId] = useState('');
  const [proposalStatus, setProposalStatus] = useState('初回面談');
  const [productId, setProductId] = useState('');
  const [initialFee, setInitialFee] = useState<number | string>('');
  const [monthlyFee, setMonthlyFee] = useState<number | string>('');
  const [totalAmount, setTotalAmount] = useState<number | string>('');
  const [dealMemo, setDealMemo] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  // For Deal -> Customer
  const [contractStatus, setContractStatus] = useState('契約中');
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerMemo, setCustomerMemo] = useState('');

  const company = sourceRecord?.company as Company | undefined;
  const companyId = sourceRecord?.company_id || '';
  const companyName = company?.company_name || companyId;

  // 初期化
  useEffect(() => {
    if (!isOpen || !sourceRecord) return;
    setErrorMessage(null);
    setIsSubmitting(false);

    if (type === 'prospect_to_lead') {
      setLeadSource(sourceRecord.source || '見込みアプローチ');
      setServiceType(sourceRecord.service_type || '');
      setServiceTypeProductChoice('');
      setPriorityChannel(sourceRecord.approach_method === 'LINE' ? 'LINE' : 'メール');
      setLeadStatus('新規');
      setLeadNotes(sourceRecord.memo ? `【見込み時メモ引継ぎ】\n${sourceRecord.memo}` : '');
      void fetchProductsList().then((prods) => {
        setProducts(prods);
        const suggestedId = sourceRecord.recommended_product_id || sourceRecord.product_id || '';
        const matched = prods.find((product) => product.id === suggestedId)
          || prods.find((product) => product.product_name === sourceRecord.service_type);
        setServiceTypeProductChoice(matched?.id || (sourceRecord.service_type ? '__custom' : ''));
        if (matched) setServiceType(matched.product_name);
      });
    } else if (type === 'lead_to_deal') {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      setDealId(`DEAL-${randomCode}`);
      setProposalPlanName(sourceRecord.service_type ? `${sourceRecord.service_type} 導入提案` : '新規導入提案');
      setProposalPlanTemplateId('');
      setProposalStatus('初回面談');
      setDealMemo(sourceRecord.notes ? `【リード相談引継ぎ】\n${sourceRecord.notes}` : '');
      setMeetingDate(sourceRecord.meeting_date || '');

      void fetchProductsList().then((prods) => {
        setProducts(prods);
        const suggestedId = sourceRecord.interested_product_id || sourceRecord.product_id || '';
        const selected = prods.find((product) => product.id === suggestedId)
          || prods.find((product) => product.product_name === sourceRecord.service_type);
        if (selected) {
          setProductId(selected.id);
          setInitialFee(selected.initial_fee ?? 0);
          setMonthlyFee(selected.monthly_fee ?? 0);
          setTotalAmount(Number(selected.initial_fee || 0) + Number(selected.monthly_fee || 0));
        } else {
          setProductId('');
          setInitialFee('');
          setMonthlyFee('');
          setTotalAmount('');
        }
      });
    } else if (type === 'deal_to_customer') {
      setContractStatus('契約中');
      setContractStartDate(new Date().toISOString().split('T')[0]);
      setCustomerMemo(sourceRecord.proposal_plan_name ? `商談「${sourceRecord.proposal_plan_name}」受注に伴う契約登録` : '');

      // 既存顧客チェック（重複防止）
      if (companyId) {
        setCheckingCustomer(true);
        fetchCustomerByCompanyId(companyId)
          .then((cust) => {
            setExistingCustomer(cust);
          })
          .finally(() => {
            setCheckingCustomer(false);
          });
      }
    }
  }, [isOpen, type, sourceRecord]);

  // 商品変更時に金額を連動
  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    setProposalPlanTemplateId('');
    const selected = products.find(p => p.id === newProductId);
    if (selected) {
      const initF = selected.initial_fee ?? 0;
      const monthF = selected.monthly_fee ?? 0;
      setInitialFee(initF);
      setMonthlyFee(monthF);
      setTotalAmount(Number(initF) + Number(monthF));
    } else {
      setInitialFee('');
      setMonthlyFee('');
      setTotalAmount('');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // 二重クリック防止

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (type === 'prospect_to_lead') {
        const payload: Record<string, any> = {
          company_id: companyId,
          source: leadSource.trim() || '見込みアプローチ',
          service_type: serviceType.trim() || null,
          interested_product_id: serviceTypeProductChoice && serviceTypeProductChoice !== '__custom' ? serviceTypeProductChoice : null,
          priority_channel: priorityChannel || 'メール',
          status: leadStatus || '新規',
          notes: leadNotes.trim() || null,
          first_registered_at: new Date().toISOString(),
          last_contacted_at: sourceRecord.last_contacted_at || null,
        };

        const res = await insertRecord('leads', payload);
        if (res.error) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }

        onSuccess('leads', res.data?.id);
        onClose();
      } else if (type === 'lead_to_deal') {
        if (!dealId.trim()) {
          setErrorMessage('商談ID（例: DEAL-001）を入力してください。');
          setIsSubmitting(false);
          return;
        }
        if (!proposalPlanName.trim()) {
          setErrorMessage('提案プラン名・商談名を入力してください。');
          setIsSubmitting(false);
          return;
        }

        const selectedProd = products.find(p => p.id === productId);

        const payload: Record<string, any> = {
          id: dealId.trim(),
          company_id: companyId || null,
          lead_id: sourceRecord.id, // lead_id を引き継ぎ
          proposal_plan_name: proposalPlanName.trim(),
          proposal_plan_template_id: proposalPlanTemplateId || null,
          proposal_type: selectedProd?.product_type || '月額サブスク',
          proposal_status: proposalStatus,
          product_id: productId || null,
          initial_fee: initialFee !== '' ? Number(initialFee) : null,
          monthly_fee: monthlyFee !== '' ? Number(monthlyFee) : null,
          total_amount: totalAmount !== '' ? Number(totalAmount) : null,
          proposal_date: new Date().toISOString().split('T')[0],
          meeting_date: meetingDate || null,
          memo: dealMemo.trim() || null,
        };

        const res = await insertRecord('deals', payload);
        if (res.error) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }

        onSuccess('deals', res.data?.id);
        onClose();
      } else if (type === 'deal_to_customer') {
        // 重複チェック
        if (existingCustomer) {
          setErrorMessage('既にこの会社の顧客レコードが存在します。重複作成はできません。');
          setIsSubmitting(false);
          return;
        }

        const payload: Record<string, any> = {
          company_id: companyId,
          contract_status: contractStatus,
          contract_start_date: contractStartDate || null,
          memo: customerMemo.trim() || null,
        };

        const res = await insertRecord('customers', payload);
        if (res.error) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }

        onSuccess('customers', res.data?.id);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || '処理中にエラーが発生しました。');
      setIsSubmitting(false);
    }
  };

  const titles: Record<TransitionType, { title: string; subtitle: string; icon: React.ReactNode; buttonText: string }> = {
    prospect_to_lead: {
      title: '見込み企業からリードへ進める',
      subtitle: 'アプローチ対象の見込み企業を案件化リードとして登録します',
      icon: <Layers className="w-5 h-5 text-cyan-400" />,
      buttonText: 'リードを作成して進める',
    },
    lead_to_deal: {
      title: 'リードから商談を作成する',
      subtitle: '個別相談リードを具体的な提案・商談パイプラインへ引き継ぎます',
      icon: <Briefcase className="w-5 h-5 text-emerald-400" />,
      buttonText: '商談を作成する',
    },
    deal_to_customer: {
      title: '商談から顧客として登録する',
      subtitle: '成約・内諾に伴い、会社の顧客契約レコードを登録します',
      icon: <UserCheck className="w-5 h-5 text-pink-400" />,
      buttonText: '顧客レコードを作成する',
    },
  };

  const currentMeta = titles[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              {currentMeta.icon}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{currentMeta.title}</h2>
              <p className="text-xs text-slate-400">{currentMeta.subtitle}</p>
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-200">
            {/* Target Company & Source Record Banner */}
            <div className="space-y-3">
              {/* Company Info */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-blue-300 font-semibold">引き継ぎ対象会社（company_id 継承）</div>
                    <div className="text-base font-bold text-white">{companyName}</div>
                    <div className="text-xs font-mono text-slate-400">会社ID: {companyId}</div>
                  </div>
                </div>
                {company?.industry && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                    {company.industry}
                  </span>
                )}
              </div>

              {/* Source Record Details Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>引き継ぎ元レコードの確認</span>
                  </span>
                  <span className="font-mono text-slate-500">ID: {sourceRecord?.id}</span>
                </div>

                {type === 'prospect_to_lead' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>アプローチ方法: <span className="text-white font-medium">{sourceRecord?.approach_method || '未設定'}</span></div>
                    <div>ステータス: <span className="text-white font-medium">{sourceRecord?.status || '未設定'}</span></div>
                    <div>獲得元: <span className="text-white font-medium">{sourceRecord?.source || '未設定'}</span></div>
                    <div>AI確度スコア: <span className="text-blue-300 font-medium">{sourceRecord?.ai_score !== undefined && sourceRecord?.ai_score !== null ? `${sourceRecord.ai_score}点` : '-'}</span></div>
                    {sourceRecord?.memo && (
                      <div className="col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2">
                        メモ: {sourceRecord.memo}
                      </div>
                    )}
                  </div>
                )}

                {type === 'lead_to_deal' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>検討サービス: <span className="text-white font-medium">{sourceRecord?.service_type || '未設定'}</span></div>
                    <div>ステータス: <span className="text-white font-medium">{sourceRecord?.status || '未設定'}</span></div>
                    <div>連絡チャネル: <span className="text-white font-medium">{sourceRecord?.priority_channel || '未設定'}</span></div>
                    <div>面談日: <span className="text-white font-mono">{sourceRecord?.meeting_date || '未定'}</span></div>
                    {sourceRecord?.notes && (
                      <div className="col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2">
                        相談メモ: {sourceRecord.notes}
                      </div>
                    )}
                  </div>
                )}

                {type === 'deal_to_customer' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>商談プラン名: <span className="text-white font-medium">{sourceRecord?.proposal_plan_name || '未設定'}</span></div>
                    <div>商談ステータス: <span className="text-emerald-300 font-medium">{sourceRecord?.proposal_status || '未設定'}</span></div>
                    <div>商品: <span className="text-white font-medium">{sourceRecord?.product?.product_name || sourceRecord?.product_id || '未定'}</span></div>
                    <div>想定総額: <span className="text-emerald-400 font-mono font-medium">{sourceRecord?.total_amount ? `¥${Number(sourceRecord.total_amount).toLocaleString()}` : '-'}</span></div>
                    {sourceRecord?.memo && (
                      <div className="col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2">
                        商談メモ: {sourceRecord.memo}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* =========================================================================
                CASE 1: Prospect -> Lead
               ========================================================================= */}
            {type === 'prospect_to_lead' && (
              <div className="space-y-4">
                {/* Operational Limitation Notice */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>実装上の制限事項（スキーマ仕様）</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    ※ 現行のSupabaseデータベーススキーマでは、<code>leads</code> テーブルに <code>prospect_id</code>（見込み企業ID）列が存在しないため、見込み企業とリードは「共通の会社ID（<code>company_id</code>）」によってのみ関連付けられます。同一会社に対して複数の見込み企業やリードが存在する場合、どの見込み企業から直接派生したリードかをDB列から特定・追跡することはできません。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      リード獲得元 (source)
                    </label>
                    <input
                      type="text"
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value)}
                      placeholder="見込みアプローチ"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      検討サービス種別 (service_type)
                    </label>
                    <select
                      value={serviceTypeProductChoice}
                      onChange={(e) => {
                        const choice = e.target.value;
                        const product = products.find((item) => item.id === choice);
                        setServiceTypeProductChoice(choice);
                        setServiceType(product?.product_name || '');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="">商品を選択（未定）</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}
                      <option value="__custom">その他（自由入力）</option>
                    </select>
                    {serviceTypeProductChoice === '__custom' && (
                      <input
                        type="text"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        placeholder="サービス名を入力"
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      優先連絡チャネル (priority_channel)
                    </label>
                    <select
                      value={priorityChannel}
                      onChange={(e) => setPriorityChannel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="メール">メール</option>
                      <option value="電話">電話</option>
                      <option value="LINE">LINE</option>
                      <option value="Slack">Slack</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      初期ステータス (status)
                    </label>
                    <select
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="新規">新規</option>
                      <option value="ヒアリング済">ヒアリング済</option>
                      <option value="商談化">商談化</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      リード相談メモ (notes)
                    </label>
                    <textarea
                      rows={3}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CASE 2: Lead -> Deal
               ========================================================================= */}
            {type === 'lead_to_deal' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>リードID連携</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    ※ <code>deals.lead_id</code> に本リードのID（<code>{sourceRecord.id}</code>）が自動的に引き継がれ、商談とリードが直接結び付けられます。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      商談ID (text PK) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={dealId}
                      onChange={(e) => setDealId(e.target.value)}
                      placeholder="DEAL-001"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      提案プラン名・商談名 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={proposalPlanName}
                      onChange={(e) => setProposalPlanName(e.target.value)}
                      placeholder="例: AI経営OS Standard導入提案"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      提案商品 (product_id)
                    </label>
                    <select
                      value={productId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="">-- 未定 --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} (月額: ¥{Number(p.monthly_fee || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <ProposalPlanTemplatePicker
                    productId={productId}
                    selectedTemplateId={proposalPlanTemplateId}
                    name={proposalPlanName}
                    description={dealMemo}
                    initialFee={initialFee}
                    monthlyFee={monthlyFee}
                    totalAmount={totalAmount}
                    onApply={(template?: ProposalPlanTemplate) => {
                      setProposalPlanTemplateId(template?.id || '');
                      if (template) {
                        setProductId(template.product_id);
                        setProposalPlanName(template.name);
                        setDealMemo(template.description || '');
                        setInitialFee(template.initial_fee ?? '');
                        setMonthlyFee(template.monthly_fee ?? '');
                        setTotalAmount(template.total_amount ?? '');
                      }
                    }}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      初期ステータス (proposal_status)
                    </label>
                    <select
                      value={proposalStatus}
                      onChange={(e) => setProposalStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="初回面談">初回面談</option>
                      <option value="要件提案">要件提案</option>
                      <option value="見積提示">見積提示</option>
                      <option value="成約">成約</option>
                    </select>
                  </div>

                  {/* Financial Fields */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      月額費用 (monthly_fee)
                    </label>
                    <input
                      type="number"
                      value={monthlyFee}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMonthlyFee(val);
                        setTotalAmount(Number(initialFee || 0) + Number(val || 0));
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      想定総額 (total_amount)
                    </label>
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      面談日 (meeting_date)
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      商談メモ (memo)
                    </label>
                    <textarea
                      rows={3}
                      value={dealMemo}
                      onChange={(e) => setDealMemo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CASE 3: Deal -> Customer
               ========================================================================= */}
            {type === 'deal_to_customer' && (
              <div className="space-y-4">
                {checkingCustomer ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />
                    既存顧客レコードの重複チェック中...
                  </div>
                ) : existingCustomer ? (
                  /* 重複検知バナー & 既存表示誘導 */
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300 text-sm">
                          既にこの会社の顧客レコードが存在します
                        </div>
                        <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                          Supabaseのスキーマ制約上、<code>customers.company_id</code> は1社につき1件のみ登録可能です。
                          重複レコードは作成せず、既存の顧客詳細を確認・更新してください。
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1">
                      <div>契約ステータス: <span className="font-bold text-white">{existingCustomer.contract_status}</span></div>
                      <div>契約開始日: <span className="font-mono text-slate-300">{existingCustomer.contract_start_date || '未設定'}</span></div>
                      <div>顧客ID: <span className="font-mono text-slate-400">{existingCustomer.id}</span></div>
                    </div>
                    {onViewExistingCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewExistingCustomer(existingCustomer);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>既存の顧客詳細を開く</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Business Assumption Notice */}
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-amber-400" />
                        <span>業務上の前提（商談成約と顧客契約の分離）</span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed text-[11px]">
                        ※ 商談の「成約/受注」は営業面談における合意・内諾段階であり、法的な正式契約締結やサービス利用開始とは異なる場合があります。商談の成約だけで一律に契約締結済みと判断せず、実務の進行段階に合わせて適切な契約ステータス（正式契約締結済の場合は「契約中」、先行利用の場合は「トライアル」等）と契約開始日を指定してください。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          初期契約ステータス (contract_status) <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={contractStatus}
                          onChange={(e) => setContractStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                        >
                          <option value="契約中">契約中（正式契約締結済）</option>
                          <option value="トライアル">トライアル（試用期間・先行利用）</option>
                          <option value="更新交渉中">更新交渉中</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          契約開始日 (contract_start_date)
                        </label>
                        <input
                          type="date"
                          value={contractStartDate}
                          onChange={(e) => setContractStartDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          顧客メモ (memo)
                        </label>
                        <textarea
                          rows={3}
                          value={customerMemo}
                          onChange={(e) => setCustomerMemo(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {type === 'deal_to_customer' && existingCustomer
                ? '※ 既存顧客のため新規作成はスキップされます'
                : '※ 会社IDを引き継ぎ、安全に次ステージへ移行します'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                キャンセル
              </button>
              {!(type === 'deal_to_customer' && existingCustomer) && (
                <button
                  type="submit"
                  disabled={isSubmitting || checkingCustomer}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>作成中...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{currentMeta.buttonText}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
