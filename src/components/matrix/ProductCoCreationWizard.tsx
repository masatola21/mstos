import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Code2, 
  Award, 
  Package, 
  TrendingUp, 
  FileText,
  Loader2,
  Send,
  Zap,
  Target,
  DollarSign,
  Square
} from 'lucide-react';
import { ProductArchetype, PRODUCT_ARCHETYPES, ManagedProduct } from '../../types/matrix';
import { ApiUsageData, Project, TaskItem, CharacterConfig, UserProfile } from '../../types/ai-president';
import { dateAfterDaysJst } from '../../utils/date';
import { generateNextProductCode } from '../../services/productCatalogService';
import { getAuthHeaders } from '../../lib/supabaseClient';

interface ProductCoCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (product: ManagedProduct, project?: Project, tasks?: TaskItem[]) => void;
  onRecordUsage?: (params: { endpoint: 'chat'; endpointName: string; model?: string; usage: ApiUsageData }) => void;
  character?: CharacterConfig;
  userProfile?: UserProfile;
  existingProducts?: ManagedProduct[];
}

export const ProductCoCreationWizard: React.FC<ProductCoCreationWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  onRecordUsage,
  character,
  userProfile,
  existingProducts,
}) => {
  const [step, setStep] = useState<number>(1);
  const [archetype, setArchetype] = useState<ProductArchetype>('service_project');
  
  // Form values
  const [productName, setProductName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [problemToSolve, setProblemToSolve] = useState('');
  const [priceExpectation, setPriceExpectation] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  // AI Co-creation Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [customTargetRevenue, setCustomTargetRevenue] = useState('');
  const [aiProposal, setAiProposal] = useState<{
    refinedName: string;
    tagline: string;
    description: string;
    targetPrice: number;
    wbsTasks: Array<{ title: string; priority: 'high' | 'medium' | 'low'; description: string }>;
    marketingPlan: string;
    contractType: string;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleGenerateProposal = async () => {
    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        signal: controller.signal,
        body: JSON.stringify({
          message: `新商品開発の要件定義とWBSタスクの策定を行ってください。
【商品タイプ】: ${PRODUCT_ARCHETYPES[archetype].label}
【仮称商品名】: ${productName || '未定'}
【ターゲット顧客】: ${targetAudience || '中小企業経営者・事業責任者'}
【解決する課題】: ${problemToSolve || '業務の属人化、売上拡大、コスト削減'}
【想定価格帯】: ${priceExpectation || '未定'}
【オーナー/企業方針】: ${userProfile?.userGoals ? `${userProfile.userName || 'オーナー'}の方針: ${userProfile.userGoals}` : '自社の強みを活かした高付加価値事業の展開'}
【補足メモ】: ${customNotes}

以下のJSON形式のみで回答してください:
\`\`\`json
{
  "refinedName": "商品名",
  "tagline": "キャッチコピー（1行）",
  "description": "サービス概要（2〜3行）",
  "targetPrice": 300000,
  "wbsTasks": [
    {"title": "要件定義・仕様設計", "priority": "high", "description": "サービス提供範囲と納品物の確定"},
    {"title": "LP・プロモーション資料作成", "priority": "high", "description": "販売用セールスページ制作"},
    {"title": "契約書・請求フローの準備", "priority": "medium", "description": "利用規約または基本契約書の締結準備"},
    {"title": "テスト提供・初期フィードバック収集", "priority": "medium", "description": "モニター顧客への先行提供"}
  ],
  "marketingPlan": "初月のマーケティング施策概要",
  "contractType": "業務委託契約"
}
\`\`\``,
          character: {
            name: character?.name || 'AI社長',
            role: character?.role || 'AI社長 / 新規事業開発総指揮',
            personality: character?.personality || '戦略的かつ実行力重視',
            tone: character?.tone || 'プロフェッショナルな敬語',
            behaviorRules: character?.behaviorRules?.length ? character.behaviorRules : ['新規事業のWBSと収益モデルを具体的に設計する'],
          },
        }),
      });

      const data = await response.json();
      if (data.usage) {
        onRecordUsage?.({ endpoint: 'chat', endpointName: '商品企画AI生成', model: data.model, usage: data.usage });
      }
      const content = data.text || '';
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        setAiProposal(parsed);
        const defaultRev = (Number(parsed.targetPrice) || 250000) * (archetype === 'retainer' ? 60 : 10);
        setCustomTargetRevenue(String(defaultRev));
      } else {
        // Fallback fallback proposal
        const fallbackPrice = Number(priceExpectation) || 250000;
        setAiProposal({
          refinedName: productName || `${PRODUCT_ARCHETYPES[archetype].label} プレミアム`,
          tagline: `${targetAudience || '経営者'}の課題を解決する特化型ソリューション`,
          description: `${problemToSolve || '業務効率化'}を実現し、迅速な成果提供を保証する新サービスです。`,
          targetPrice: fallbackPrice,
          wbsTasks: [
            { title: 'サービス提供フロー・カリキュラム仕様策定', priority: 'high', description: '詳細設計の完了' },
            { title: '集客用LP・販促資料の制作', priority: 'high', description: 'コンバージョン導線の確立' },
            { title: '契約書式・請求フローの整備', priority: 'medium', description: '法務・経理体制の整備' },
            { title: '初期顧客向け先行ローンチ', priority: 'medium', description: '運用テストと改善' },
          ],
          marketingPlan: '既存顧客への先行案内およびSNS/メールによるクローズドローンチ',
          contractType: archetype === 'service_project' ? '受託契約' : archetype === 'retainer' ? '顧問契約' : '利用規約',
        });
        setCustomTargetRevenue(String(fallbackPrice * (archetype === 'retainer' ? 60 : 10)));
      }
      setStep(4);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        setIsGenerating(false);
        return;
      }
      // Fallback proposal on network/API failure
      const fallbackPrice = Number(priceExpectation) || 300000;
      setAiProposal({
        refinedName: productName || `${PRODUCT_ARCHETYPES[archetype].label} パッケージ`,
        tagline: `${targetAudience || '顧客'}の成果を最大化する新サービス`,
        description: `${problemToSolve || '生産性向上'}を短期間で実現するパッケージです。`,
        targetPrice: fallbackPrice,
        wbsTasks: [
          { title: 'サービス仕様・提供要件の確定', priority: 'high', description: '納品物と範囲の合意' },
          { title: 'マーケティングLP・案内資料の作成', priority: 'high', description: 'リード獲得導線の作成' },
          { title: '契約書雛形と請求フローのセットアップ', priority: 'medium', description: '安全な取引手続きの確立' },
          { title: 'キックオフと初期デリバリー', priority: 'high', description: '顧客満足度の最大化' },
        ],
        marketingPlan: 'ウェビナーおよび診断フォームからのリード育成',
        contractType: '業務委託契約',
      });
      setCustomTargetRevenue(String(fallbackPrice * (archetype === 'retainer' ? 60 : 10)));
      setStep(4);
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleFinish = () => {
    if (!aiProposal) return;

    const generatedCode = generateNextProductCode(existingProducts || [], 'PRD');
    const generatedId = generatedCode;
    const initialFee = archetype === 'retainer' ? 0 : aiProposal.targetPrice;
    const monthlyFee = archetype === 'retainer' ? aiProposal.targetPrice : 0;

    const newProduct: ManagedProduct = {
      id: generatedId,
      name: aiProposal.refinedName,
      code: generatedCode,
      category: PRODUCT_ARCHETYPES[archetype].label,
      archetype,
      price: aiProposal.targetPrice,
      salesInitialFee: initialFee,
      salesMonthlyFee: monthlyFee,
      description: aiProposal.description,
      status: 'developing',
      customFields: {
        tagline: aiProposal.tagline,
        marketingPlan: aiProposal.marketingPlan,
        contractType: aiProposal.contractType,
        phase: '商品開発',
      },
      kpis: {
        targetRevenue: customTargetRevenue !== '' ? Math.max(0, Number(customTargetRevenue)) : (aiProposal.targetPrice * (archetype === 'retainer' ? 60 : 10)),
        currentRevenue: 0,
        activeClients: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      productId: newProduct.id,
      name: `【商品開発】${aiProposal.refinedName}`,
      objective: `${aiProposal.tagline} - ${aiProposal.description}`,
      status: 'in_progress',
      priority: 'high',
      dueDate: dateAfterDaysJst(30),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newTasks: TaskItem[] = aiProposal.wbsTasks.map((t, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      projectId: newProject.id,
      title: t.title,
      description: t.description,
      status: idx === 0 ? 'in_progress' : 'waiting',
      priority: t.priority,
      workArea: 'product_development',
      sourceCategory: 'business_operations',
      taskKind: 'creation_analysis',
      relatedRecord: {
        type: 'product',
        id: newProduct.id,
        label: newProduct.name,
      },
      assignee: {
        type: 'ai_ceo',
        name: character?.name || 'AI社長',
      },
      dueDate: dateAfterDaysJst((idx + 1) * 7),
      completionCriteria: '成果物の納品と社内承認完了',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    onComplete(newProduct, newProject, newTasks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                AIプロダクト設計（新規プロダクトの共創）
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  全業種対応
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                構想をAIと対話し、ビジネスモデル・仕様・開発タスク・マーケティング計画まで具体化します。
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs">
          {[
            { num: 1, label: 'ビジネスモデル' },
            { num: 2, label: 'ターゲット＆課題' },
            { num: 3, label: 'AI分析＆WBS生成' },
            { num: 4, label: '完成・登録' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.num
                    ? 'bg-purple-600 text-white'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={step === s.num ? 'text-slate-900 font-semibold' : 'text-slate-500'}>
                {s.label}
              </span>
              {s.num < 4 && <div className="w-8 h-px bg-slate-200 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Archetype Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  Step 1. どのようなビジネスモデルのプロダクトを設計しますか？
                </h4>
                <p className="text-xs text-slate-500">
                  本OSはあらゆる商材に対応しています。最適なテンプレートを選択してください。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {(Object.keys(PRODUCT_ARCHETYPES) as ProductArchetype[]).map((key) => {
                  const info = PRODUCT_ARCHETYPES[key];
                  const isSelected = archetype === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setArchetype(key)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/70 shadow-sm ring-1 ring-purple-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-slate-900">{info.label}</span>
                        {key === 'service_project' && <Code2 className="w-4 h-4 text-blue-500" />}
                        {key === 'retainer' && <Award className="w-4 h-4 text-emerald-500" />}
                        {key === 'digital_asset' && <Package className="w-4 h-4 text-amber-500" />}
                        {key === 'media_content' && <TrendingUp className="w-4 h-4 text-purple-500" />}
                        {key === 'custom' && <Sparkles className="w-4 h-4 text-cyan-500" />}
                      </div>
                      <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                        {info.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {info.typicalItems.slice(0, 3).map((item, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Basic Concept */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  Step 2. プロダクトの構想と対象顧客を教えてください
                </h4>
                <p className="text-xs text-slate-500">
                  大まかなアイデアで構いません。AIと一緒にサービス体系や開発タスクまで具体化します。
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    商品名（仮称でOK）
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="例: 中小企業向けAI導入・自動化パック / 月額顧問DX支援"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    想定ターゲット顧客
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="例: 年商1億〜5億の製造業・サービス業の経営者、業務効率化したいチームリーダー"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    解決する主要な課題
                  </label>
                  <textarea
                    value={problemToSolve}
                    onChange={(e) => setProblemToSolve(e.target.value)}
                    placeholder="例: 属人化していて引き継ぎができない、見積・請求やリード管理がExcelで限界、人手不足"
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      想定価格帯（税抜・円）
                    </label>
                    <input
                      type="number"
                      value={priceExpectation}
                      onChange={(e) => setPriceExpectation(e.target.value)}
                      placeholder="例: 300000"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                    />
                    {priceExpectation && !isNaN(Number(priceExpectation)) && (
                      <p className="mt-1 text-[11px] font-semibold text-purple-700">
                        税込 (10%): ¥{Math.floor(Number(priceExpectation) * 1.1).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      補足要望・特記事項
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="例: 初月で成果が出るようにしたい、オンライン完結"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Trigger AI Generation */}
          {step === 3 && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center mx-auto shadow-md text-white">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">
                  AI社長「シドウ」とプロダクト設計を始めます
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  入力された構想をもとに、プロダクト仕様、キャッチコピー、開発タスク、マーケティング計画、契約形態をAIと一緒に設計します。
                </p>
              </div>

              <div className="pt-2">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="px-6 py-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 font-semibold text-sm shadow-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      <span>AIがプロダクト仕様・開発タスクを作成中...</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelGeneration}
                      className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="AI生成を中断して編集に戻る"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>生成を停止して入力に戻る</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateProposal}
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-sm flex items-center gap-2 mx-auto transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>AIと一緒に仕様・タスクを設計する</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: AI Proposal Review */}
          {step === 4 && aiProposal && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Step 4. AIと作成したプロダクト設計案の確認
                  </h4>
                  <p className="text-xs text-slate-500">
                    内容を確認し、問題なければOSに登録して開発プロジェクトを開始します。
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  生成完了
                </span>
              </div>

              {/* Product Card Preview */}
              <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700">
                      {PRODUCT_ARCHETYPES[archetype].label}
                    </span>
                    <h5 className="text-base font-bold text-slate-900 mt-0.5">
                      {aiProposal.refinedName}
                    </h5>
                    <p className="text-xs text-purple-700 mt-1 italic">
                      "{aiProposal.tagline}"
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">想定価格</span>
                    <span className="text-sm font-black text-purple-700">
                      ¥{aiProposal.targetPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed border-t border-purple-100 pt-2">
                  {aiProposal.description}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">マーケティング計画</span>
                    <span className="text-slate-800 text-xs font-medium">
                      {aiProposal.marketingPlan}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">推奨契約タイプ</span>
                    <span className="text-slate-800 text-xs font-medium">
                      {aiProposal.contractType}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-purple-200 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">目標売上設定（税抜・円）</span>
                      <span className="text-[10px] text-slate-500">ビジネスモデルに応じた初期目標（必要に応じて変更可能）</span>
                    </div>
                    <div className="w-44">
                      <input
                        type="number"
                        min="0"
                        value={customTargetRevenue}
                        onChange={(e) => setCustomTargetRevenue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-semibold text-right focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* WBS Tasks Preview */}
              <div>
                <h5 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-600" />
                  自動展開される開発タスク（WBS）
                </h5>
                <div className="space-y-1.5">
                  {aiProposal.wbsTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-[10px] border border-purple-100">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900">{task.title}</span>
                          <p className="text-[10px] text-slate-500">{task.description}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          task.priority === 'high'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {task.priority === 'high' ? '高優先度' : '中優先度'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                戻る
              </button>
            )}
          </div>

          <div>
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                次へ
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleFinish}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                設計内容を登録してプロダクト開発を開始する
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

