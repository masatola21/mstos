import React, { useState, useEffect } from 'react';
import { Company, Product, Lead, Customer } from '../types/database';
import { ProposalPlanTemplatePicker } from './ProposalPlanTemplatePicker';
import { todayJst, formatJapaneseDate, formatJapaneseDateTime } from '../utils/date';
import type { ProposalPlanTemplate } from './ProposalPlanTemplatePicker';
import { 
  fetchProductsList, 
  fetchCompaniesList,
  fetchCustomerByCompanyId, 
  insertRecord,
  updateRecord
} from '../services/dataService';
import { executeDealWonAutomation } from '../services/dealWonAutomationService';
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
  UserCheck,
  Sparkles
} from 'lucide-react';
import { formatProductPrice } from '../services/productCatalogService';

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
  const [contractStartDate, setContractStartDate] = useState(todayJst());
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
      // リードの希望内容（inquiry_type / service_type / 相談メモ）から最適な提案プラン名を自動判定
      const inquiry = (sourceRecord.inquiry_type || sourceRecord.service_type || '').trim();
      const notes = (sourceRecord.notes || '').toLowerCase();
      let initialPlanName = '';

      // 基本は「顧問導入提案」。診断系は廃止し、複数の改善・経営課題・相談は顧問提案を最優先
      if (
        inquiry === 'ボトルネック診断' ||
        inquiry.includes('診断') ||
        inquiry === '経営全体・利益改善' ||
        inquiry.includes('利益改善') ||
        inquiry.includes('顧問') ||
        inquiry.includes('経営') ||
        notes.includes('顧問') ||
        notes.includes('改善') ||
        notes.includes('診断')
      ) {
        initialPlanName = '顧問導入提案';
      } else if (inquiry === '業務効率化・IT/自動化' || inquiry.includes('効率化') || inquiry.includes('自動化')) {
        initialPlanName = '業務効率化・IT自動化システム 導入提案';
      } else if (inquiry === '集客・マーケティング' || inquiry.includes('マーケティング') || inquiry.includes('集客')) {
        initialPlanName = '集客・マーケティング支援 導入提案';
      } else if (inquiry === '介護保険外開業' || inquiry.includes('介護')) {
        initialPlanName = '介護保険外サービス開業支援 導入提案';
      } else if (inquiry === '資料請求' || inquiry.includes('資料')) {
        initialPlanName = '顧問導入提案';
      } else if (inquiry) {
        initialPlanName = inquiry.endsWith('提案') ? inquiry : `${inquiry} 導入提案`;
      } else {
        initialPlanName = '顧問導入提案';
      }

      setProposalPlanName(initialPlanName);
      setProposalPlanTemplateId('');
      setProposalStatus('初回面談');
      setDealMemo(sourceRecord.notes ? `【リード相談引継ぎ】\n${sourceRecord.notes}` : '');
      setMeetingDate(sourceRecord.meeting_date || '');

      void fetchProductsList().then((prods) => {
        setProducts(prods);
        const suggestedId = sourceRecord.interested_product_id || sourceRecord.product_id || '';
        const inq = (sourceRecord.inquiry_type || sourceRecord.service_type || '').toLowerCase();
        
        // 1. 指定IDマッチ
        let selected = prods.find((product) => product.id === suggestedId);
        // 2. サービス名完全マッチ
        if (!selected && sourceRecord.service_type) {
          selected = prods.find((product) => product.product_name === sourceRecord.service_type);
        }
        // 3. 希望内容（inquiry_type）からのファジィマッチ
        if (!selected && inq) {
          selected = prods.find((p) => {
            const pName = p.product_name.toLowerCase();
            if ((inq.includes('診断') || inq.includes('顧問') || inq.includes('経営')) && (pName.includes('顧問') || pName.includes('コンサル') || pName.includes('経営'))) return true;
            if (inq.includes('業務') && pName.includes('業務')) return true;
            if (inq.includes('集客') && pName.includes('集客')) return true;
            if (inq.includes('介護') && pName.includes('介護')) return true;
            return false;
          });
        }

        if (selected) {
          setProductId(selected.id);
          // 商品が特定された場合、より具体的な「商品名 導入提案」にプラン名を更新（未編集時のみ）
          setProposalPlanName((prev) => {
            if (!prev || prev === '顧問導入提案' || prev === '新規導入提案') {
              return `${selected.product_name} 導入提案`;
            }
            return prev;
          });
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
        if (!proposalPlanName.trim()) {
          setErrorMessage('提案プラン名・商談名を入力してください。');
          setIsSubmitting(false);
          return;
        }

        const selectedProd = products.find(p => p.id === productId);

        const payload: Record<string, any> = {
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
          proposal_date: todayJst(),
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
        let customerRecordId = existingCustomer?.id;

        if (!existingCustomer) {
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
          customerRecordId = res.data?.id;
        }

        // 商談ステータスを「成約」に更新（updateRecord内部でexecuteDealWonAutomationが自動実行されます）
        if (sourceRecord?.id && sourceRecord.proposal_status !== '成約') {
          await updateRecord('deals', sourceRecord.id, { proposal_status: '成約' });
        } else if (sourceRecord?.id) {
          // 既に成約ステータスだった場合は念のため直接自動起票を実行（冪等性ガード付き）
          await executeDealWonAutomation(sourceRecord.id);
        }

        onSuccess('customers', customerRecordId);
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
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      buttonText: 'リードを作成して進める',
    },
    lead_to_deal: {
      title: 'リードから商談を作成する',
      subtitle: '個別相談リードを具体的な提案・商談パイプラインへ引き継ぎます',
      icon: <Briefcase className="w-5 h-5 text-purple-600" />,
      buttonText: '商談を作成する',
    },
    deal_to_customer: {
      title: '商談から顧客として登録する',
      subtitle: '成約・内諾に伴い、会社の顧客契約レコードを登録します',
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      buttonText: '顧客レコードを作成する',
    },
  };

  const currentMeta = titles[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl">
              {currentMeta.icon}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{currentMeta.title}</h2>
              <p className="text-xs text-slate-500">{currentMeta.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700">
            {/* Target Company & Source Record Banner */}
            <div className="space-y-3">
              {/* Company Info */}
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 rounded-xl text-white shadow-2xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-purple-700 font-semibold">引き継ぎ対象会社（company_id 継承）</div>
                    <div className="text-base font-bold text-slate-900">{companyName}</div>
                    <div className="text-xs font-mono text-slate-500">会社ID: {companyId}</div>
                  </div>
                </div>
                {company?.industry && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white text-purple-700 border border-purple-200 font-semibold shadow-2xs">
                    {company.industry}
                  </span>
                )}
              </div>

              {/* Source Record Details Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>引き継ぎ元レコードの確認</span>
                  </span>
                  <span className="font-mono text-slate-400">ID: {sourceRecord?.id}</span>
                </div>

                {type === 'prospect_to_lead' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>アプローチ方法: <span className="text-slate-900 font-medium">{sourceRecord?.approach_method || '未設定'}</span></div>
                    <div>ステータス: <span className="text-slate-900 font-medium">{sourceRecord?.status || '未設定'}</span></div>
                    <div>獲得元: <span className="text-slate-900 font-medium">{sourceRecord?.source || '未設定'}</span></div>
                    <div>AI確度スコア: <span className="text-purple-700 font-semibold">{sourceRecord?.ai_score !== undefined && sourceRecord?.ai_score !== null ? `${sourceRecord.ai_score}点` : '-'}</span></div>
                    {sourceRecord?.memo && (
                      <div className="col-span-2 text-slate-700 pt-1 border-t border-slate-200 line-clamp-2">
                        メモ: {sourceRecord.memo}
                      </div>
                    )}
                  </div>
                )}

                {type === 'lead_to_deal' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>希望内容: <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{sourceRecord?.inquiry_type || sourceRecord?.service_type || '未設定'}</span></div>
                    <div>ステータス: <span className="text-slate-900 font-medium">{sourceRecord?.status || '未設定'}</span></div>
                    <div>連絡チャネル: <span className="text-slate-900 font-medium">{sourceRecord?.priority_channel || '未設定'}</span></div>
                    <div>面談日時: <span className="text-emerald-700 font-bold">{formatJapaneseDateTime(sourceRecord?.meeting_date, { fallbackTime: sourceRecord?.meeting_start_time }) || '未定'}</span></div>
                    {sourceRecord?.notes && (
                      <div className="col-span-2 text-slate-800 pt-1.5 border-t border-slate-200 whitespace-pre-wrap text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 font-semibold">【相談メモ・ヒアリング引継ぎ】:</span>
                        <div className="mt-0.5">{sourceRecord.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {type === 'deal_to_customer' && (
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>商談プラン名: <span className="text-slate-900 font-medium">{sourceRecord?.proposal_plan_name || '未設定'}</span></div>
                    <div>商談ステータス: <span className="text-emerald-700 font-semibold">{sourceRecord?.proposal_status || '未設定'}</span></div>
                    <div>商品: <span className="text-slate-900 font-medium">{sourceRecord?.product?.product_name || sourceRecord?.product_id || '未定'}</span></div>
                    <div>想定総額: <span className="text-purple-700 font-mono font-bold">{sourceRecord?.total_amount ? `¥${Number(sourceRecord.total_amount).toLocaleString()}` : '-'}</span></div>
                    {sourceRecord?.memo && (
                      <div className="col-span-2 text-slate-700 pt-1 border-t border-slate-200 line-clamp-2">
                        商談メモ: {sourceRecord.memo}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* =========================================================================
                CASE 1: Prospect -> Lead
               ========================================================================= */}
            {type === 'prospect_to_lead' && (
              <div className="space-y-4">
                {/* Operational Limitation Notice */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>実装上の制限事項（スキーマ仕様）</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-500">
                    ※ 現行のSupabaseデータベーススキーマでは、<code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-purple-700">leads</code> テーブルに <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-purple-700">prospect_id</code>（見込み企業ID）列が存在しないため、見込み企業とリードは「共通の会社ID（<code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-purple-700">company_id</code>）」によってのみ関連付けられます。同一会社に対して複数の見込み企業やリードが存在する場合、どの見込み企業から直接派生したリードかをDB列から特定・追跡することはできません。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      リード獲得元 (source)
                    </label>
                    <input
                      type="text"
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value)}
                      placeholder="見込みアプローチ"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
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
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      優先連絡チャネル (priority_channel)
                    </label>
                    <select
                      value={priorityChannel}
                      onChange={(e) => setPriorityChannel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    >
                      <option value="メール">メール</option>
                      <option value="電話">電話</option>
                      <option value="LINE">LINE</option>
                      <option value="Slack">Slack</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      初期ステータス (status)
                    </label>
                    <select
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    >
                      <option value="新規">新規</option>
                      <option value="ヒアリング済">ヒアリング済</option>
                      <option value="商談化">商談化</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      リード相談メモ (notes)
                    </label>
                    <textarea
                      rows={3}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
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
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>リードID連携</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-emerald-800/90">
                    ※ <code className="bg-white/80 px-1 py-0.5 rounded border border-emerald-200 text-emerald-900 font-mono">deals.lead_id</code> に本リードのID（<code className="bg-white/80 px-1 py-0.5 rounded border border-emerald-200 text-emerald-900 font-mono">{sourceRecord.id}</code>）が自動的に引き継がれ、商談とリードが直接結び付けられます。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      提案プラン名・商談名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={proposalPlanName}
                      onChange={(e) => setProposalPlanName(e.target.value)}
                      placeholder="例: 顧問導入提案"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs font-medium"
                    />
                    {/* 希望内容からのワンタップ候補 */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>候補プランから選ぶ:</span>
                      </span>
                      {(() => {
                        const inq = (sourceRecord.inquiry_type || sourceRecord.service_type || '').trim();
                        const suggestions = Array.from(new Set([
                          '顧問導入提案',
                          '経営顧問・伴走支援 導入提案',
                          inq && !inq.includes('診断') ? (inq.endsWith('提案') ? inq : `${inq} 導入提案`) : null,
                          '業務効率化・IT自動化システム 導入提案',
                          '集客・マーケティング支援 導入提案',
                          '介護保険外サービス開業支援 導入提案',
                          productId ? `${products.find(p => p.id === productId)?.product_name || ''} 導入提案` : null,
                          '個別カスタマイズ提案'
                        ])).filter((s): s is string => Boolean(s && s.trim() && s !== '導入提案'));

                        return suggestions.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setProposalPlanName(sug)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
                              proposalPlanName === sug
                                ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                            }`}
                          >
                            {sug}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      提案商品 (product_id)
                    </label>
                    <select
                      value={productId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    >
                      <option value="">-- 未定 --</option>
                      {products.map((p) => {
                        const priceInfo = formatProductPrice(p);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.product_name} ({priceInfo.label}{priceInfo.isFlexible ? ` 【${priceInfo.badge}】` : ''})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {(() => {
                    const currentProduct = products.find((p) => p.id === productId);
                    if (!currentProduct || !currentProduct.pricing_model || currentProduct.pricing_model === 'fixed') {
                      return null;
                    }
                    const modelLabel = currentProduct.pricing_model === 'starting_at' 
                      ? '最低価格〜（商談で本決め）' 
                      : currentProduct.pricing_model === 'range' 
                      ? '価格帯（商談で本決め）' 
                      : '個別見積・商談時決定';
                    return (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 text-xs text-cyan-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-cyan-800">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                          <span>融通設定商品: {modelLabel}</span>
                        </div>
                        <p className="text-[11px] text-cyan-800/90 leading-relaxed">
                          {currentProduct.price_note ? `💡 ${currentProduct.price_note}` : '💡 システム保守など顧客のアカウント規模や対応要件に合わせて、下記の金額欄に商談で合意した本決め金額を自由に入力してください。'}
                        </p>
                      </div>
                    );
                  })()}

                  <ProposalPlanTemplatePicker
                    productId={productId}
                    selectedTemplateId={proposalPlanTemplateId}
                    name={proposalPlanName}
                    description={dealMemo}
                    initialFee={initialFee}
                    monthlyFee={monthlyFee}
                    totalAmount={totalAmount}
                    sharedTemplate={null}
                    onApply={(template?: ProposalPlanTemplate | null) => {
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      初期ステータス (proposal_status)
                    </label>
                    <select
                      value={proposalStatus}
                      onChange={(e) => setProposalStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    >
                      <option value="初回面談">初回面談</option>
                      <option value="要件提案">要件提案</option>
                      <option value="見積提示">見積提示</option>
                      <option value="成約">成約</option>
                    </select>
                  </div>

                  {/* Financial Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        初期費用（税抜・円）
                      </label>
                      <input
                        type="number"
                        value={initialFee}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInitialFee(val);
                          setTotalAmount(Number(val || 0) + Number(monthlyFee || 0));
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-mono outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                      />
                      {initialFee !== '' && !isNaN(Number(initialFee)) && (
                        <p className="mt-1 text-[11px] font-medium text-purple-700">
                          税込: ¥{Math.floor(Number(initialFee) * 1.1).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        月額費用（税抜・円）
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
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-mono outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                      />
                      {monthlyFee !== '' && !isNaN(Number(monthlyFee)) && (
                        <p className="mt-1 text-[11px] font-medium text-purple-700">
                          税込: ¥{Math.floor(Number(monthlyFee) * 1.1).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      想定総額（税抜・円）
                    </label>
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-mono outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    />
                    {totalAmount !== '' && !isNaN(Number(totalAmount)) && (
                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        消費税 (10%): ¥{Math.floor(Number(totalAmount) * 0.1).toLocaleString()} ｜ 税込合計: <span className="text-purple-700 font-bold">¥{Math.floor(Number(totalAmount) * 1.1).toLocaleString()}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      面談日 (meeting_date)
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      商談メモ (memo)
                    </label>
                    <textarea
                      rows={3}
                      value={dealMemo}
                      onChange={(e) => setDealMemo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
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
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-purple-600" />
                    既存顧客レコードの重複チェック中...
                  </div>
                ) : existingCustomer ? (
                  /* 重複検知バナー & 既存表示誘導 */
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-800 text-sm">
                          既にこの会社の顧客レコードが存在します
                        </div>
                        <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                          Supabaseのスキーマ制約上、<code className="bg-white/80 px-1 py-0.5 rounded border border-amber-200 text-amber-900 font-mono">customers.company_id</code> は1社につき1件のみ登録可能です。
                          重複レコードは作成せず、既存の顧客詳細を確認・更新してください。
                        </p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-200 text-xs space-y-1 text-slate-700">
                      <div>契約ステータス: <span className="font-bold text-slate-900">{existingCustomer.contract_status}</span></div>
                      <div>契約開始日: <span className="font-mono text-slate-600">{existingCustomer.contract_start_date || '未設定'}</span></div>
                      <div>顧客ID: <span className="font-mono text-slate-400">{existingCustomer.id}</span></div>
                    </div>
                    {onViewExistingCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewExistingCustomer(existingCustomer);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>既存の顧客詳細を開く</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Business Assumption Notice */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-purple-600" />
                        <span>業務上の前提（商談成約と顧客契約の分離）</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        ※ 商談の「成約/受注」は営業面談における合意・内諾段階であり、法的な正式契約締結やサービス利用開始とは異なる場合があります。商談の成約だけで一律に契約締結済みと判断せず、実務の進行段階に合わせて適切な契約ステータス（正式契約締結済の場合は「契約中」、先行利用の場合は「トライアル」等）と契約開始日を指定してください。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          初期契約ステータス (contract_status) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={contractStatus}
                          onChange={(e) => setContractStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                        >
                          <option value="契約中">契約中（正式契約締結済）</option>
                          <option value="トライアル">トライアル（試用期間・先行利用）</option>
                          <option value="更新交渉中">更新交渉中</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          契約開始日 (contract_start_date)
                        </label>
                        <input
                          type="date"
                          value={contractStartDate}
                          onChange={(e) => setContractStartDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          顧客メモ (memo)
                        </label>
                        <textarea
                          rows={3}
                          value={customerMemo}
                          onChange={(e) => setCustomerMemo(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {type === 'deal_to_customer' && existingCustomer
                ? '※ 既存顧客のため新規作成はスキップされます'
                : '※ 会社IDを引き継ぎ、安全に次ステージへ移行します'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 bg-white transition-colors shadow-2xs cursor-pointer"
              >
                キャンセル
              </button>
              {!(type === 'deal_to_customer' && existingCustomer) && (
                <button
                  type="submit"
                  disabled={isSubmitting || checkingCustomer}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
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
