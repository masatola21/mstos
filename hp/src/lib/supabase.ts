import { createClient } from '@supabase/supabase-js';

// 環境変数 または OS共通のSupabase接続情報
const SUPABASE_URL = (
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://dztyybyamquuyyevplsm.supabase.co'
).trim();

const SUPABASE_ANON_KEY = (
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_rsjl0XQYKiAXw58f52fSrw_2vMib_Xa'
).trim();

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==========================================
// 診断用マスター設問（OSと100%同一）
// ==========================================
export interface BottleneckQuestion {
  id: string;
  label: string;
  categoryName: string;
  type: 'radio' | 'textarea';
  required: boolean;
  options: string[];
}

// 会社の基本情報（診断の前提）。OSの設問定義（q_industry / q_employee_count）と値を同一に保つこと。
export const MST_INDUSTRY_OPTIONS: string[] = [
  'IT・通信・Webサービス',
  '製造業・ものづくり',
  '卸売・小売・EC',
  '建設・不動産・住宅',
  '飲食・宿泊・観光',
  '医療・福祉・ヘルスケア',
  '士業・コンサルティング・専門サービス',
  '人材・教育・研修',
  '物流・運輸',
  '金融・保険',
  'その他',
];

export const MST_EMPLOYEE_COUNT_OPTIONS: string[] = [
  '1〜5名',
  '6〜20名',
  '21〜50名',
  '51〜100名',
  '101〜300名',
  '301名以上',
];

export const MST_OFFICIAL_BOTTLENECK_QUESTIONS: BottleneckQuestion[] = [
  {
    id: 'q_ops_bottleneck',
    categoryName: '業務・手作業の急所',
    label: '【業務・手作業】日々の業務で最も時間や手間を奪われている手作業・ボトルネックは何ですか？',
    type: 'radio',
    required: true,
    options: [
      '請求書・見積書等の作成やツール間の二重入力・転記作業',
      '顧客対応や連絡漏れ・対応状況の確認に追われている',
      '経営者や特定の人に仕事が集中し、属人化している',
      '情報が散乱しており、どこに何があるか探す時間が長い',
      '特に大きな手作業の負担はなく、自走できている',
    ],
  },
  {
    id: 'q_profit_bottleneck',
    categoryName: '売上・利益の急所',
    label: '【売上・利益】売上と利益の現状について、最も当てはまるお悩みは何ですか？',
    type: 'radio',
    required: true,
    options: [
      '売上はある程度あるが、手元に利益が残りにくい',
      '集客から商談・フォローまでの導線が分断され、案件化が漏れている',
      '日々の業務に追われ、単価アップや利益改善の見直しに着手できていない',
      '営業や顧客獲得が経営者の人脈や属人的な力に依存している',
      '利益は順調に出ており、さらなる事業拡大・新事業を目指したい',
    ],
  },
  {
    id: 'q_delay_reason',
    categoryName: '改善停滞の原因',
    label: '【改善停滞の原因】「改善したい」と思いながらも後回しになっている主な原因は何ですか？',
    type: 'radio',
    required: true,
    options: [
      '日々の現場業務や火消しに追われ、改善を考える時間がない',
      '何から手を付ければ一番効果が出るか、優先順位が分からない',
      'ツールを導入してみたが、自社の業務に合わず定着しなかった',
      '改善を伴走・相談できる右腕（パートナー）が社内外にいない',
      '計画はあるが、社内だけで実行を継続するのが難しい',
    ],
  },
  {
    id: 'q_ideal_future',
    categoryName: '目指したい未来',
    label: '【目指したい未来】仕組み化によって経営者の時間と利益が創出できたら、何に一番時間を使いたいですか？',
    type: 'radio',
    required: true,
    options: [
      '経営判断や戦略・次の一手（新規事業や新収益源の立ち上げ）',
      '既存事業の利益率向上とマーケティング・集客の強化',
      '組織化・人材育成・権限移譲を進め、自走する組織づくり',
      '経営者自身の余白・休日の確保と健康管理',
      'まずは目の前の手作業を減らし、日々の負担を軽減したい',
    ],
  },
  {
    id: 'q_free_notes',
    categoryName: '今一番のお悩み',
    label: '今、経営や業務で一番お悩みのことは何ですか？具体的に書いていただくほど、診断結果が貴社向けになります（任意）',
    type: 'textarea',
    required: false,
    options: [],
  },
];

// ==========================================
// 診断判定エンジン（OSと100%同一）
// ==========================================
export interface DiagnosisScoreItem {
  label: string;
  stars: string;
  status: string;
  level: 'danger' | 'warning' | 'good' | 'great';
}

export interface DiagnosisAnalysisResult {
  typeTitle: string;
  badge: string;
  summary: string;
  urgentAction: string;
  // レポート①：ボトルネック判定スコア
  scores: {
    profit: DiagnosisScoreItem;
    ops: DiagnosisScoreItem;
  };
  // レポート②：最初に着手したい候補
  firstStep: string;
  // レポート③：優先改善ロードマップ（社長視点の分かりやすい言葉）
  roadmap: {
    step1: { title: string; desc: string };
    step2: { title: string; desc: string };
    step3: { title: string; desc: string };
  };
}

export function analyzeBottleneck(answers: Record<string, string | boolean>): DiagnosisAnalysisResult {
  const ops = String(answers.q_ops_bottleneck || '');
  const profit = String(answers.q_profit_bottleneck || '');
  const delay = String(answers.q_delay_reason || '');

  // 1. スコア判定
  let profitScore: DiagnosisScoreItem = {
    label: '案件別採算性・原価管理',
    stars: '★★☆☆☆',
    status: '要改善（不採算特定が必要）',
    level: 'warning',
  };
  if (profit.includes('順調')) {
    profitScore = { label: '案件別採算性・原価管理', stars: '★★★★☆', status: '良好（さらなる改善の余地を確認）', level: 'good' };
  } else if (profit.includes('残りにくい') || profit.includes('単価')) {
    profitScore = { label: '案件別採算性・原価管理', stars: '★☆☆☆☆', status: '深刻（利益流出の懸念大）', level: 'danger' };
  }

  let opsScore: DiagnosisScoreItem = {
    label: '業務フロー標準化・属人化',
    stars: '★☆☆☆☆',
    status: '深刻（社長・特定人への依存大）',
    level: 'danger',
  };
  if (ops.includes('自走できている')) {
    opsScore = { label: '業務フロー標準化・属人化', stars: '★★★★☆', status: '自律稼働中', level: 'good' };
  } else if (ops.includes('二重入力') || ops.includes('属人化')) {
    opsScore = { label: '業務フロー標準化・属人化', stars: '★☆☆☆☆', status: '深刻（改善優先度：最高）', level: 'danger' };
  } else {
    opsScore = { label: '業務フロー標準化・属人化', stars: '★★☆☆☆', status: '要改善（改善余地大）', level: 'warning' };
  }

  // 2. ロードマップ設計（分かりやすい表現）
  const roadmap = {
    step1: {
      title: '現状の整理',
      desc: '商談で現状と優先順位をお伺いし、着手する範囲を決めます。',
    },
    step2: {
      title: '仕組みづくり',
      desc: '決めた範囲について、手作業や属人化を減らす仕組みを整えます。',
    },
    step3: {
      title: '定着と自走',
      desc: '社内で運用できる状態をめざして定着させます。',
    },
  };

  // 基本タイプ判定
  if (ops.includes('請求書') || ops.includes('二重入力') || ops.includes('属人化') || ops.includes('顧客対応') || ops.includes('散乱')) {
    return {
      typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
      badge: '業務・手作業の急所',
      summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が取りにくくなっている可能性が高い状態です。',
      urgentAction: 'まずは請求・転記・顧客連絡の重複入力を見直し、経営者ご自身が「改善を考える時間」を確保できる状態をめざすことが、最初のテーマと考えられます。',
      firstStep: '最初の候補は、請求・見積・顧客情報など、複数の場所に同じ内容を入力している作業の見直しです。商談で、どの作業から着手するのが良いかを一緒に絞り込みます。',
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  if (profit.includes('残りにくい') || profit.includes('分断') || profit.includes('単価') || profit.includes('依存')) {
    return {
      typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
      badge: '売上・利益の急所',
      summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
      urgentAction: '集客・商談・顧客フォローを自動でつなぐ導線構築と、利益率を高める経営戦略の見直しが急所となります。',
      firstStep: '最初の候補は、集客から問い合わせ・商談・フォローまでのつながりと、案件ごとの利益の見え方を整理することです。商談で、どこで途切れているかをお伺いします。',
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  if (delay.includes('火消し') || delay.includes('優先順位') || delay.includes('定着') || delay.includes('右腕')) {
    return {
      typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
      badge: '改善実行の急所',
      summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
      urgentAction: 'あれこれ手を広げず、一番利益インパクトの大きい急所から小さく着手し、定着させることが鍵となります。',
      firstStep: '最初の候補は、改善テーマを1つに絞り、小さく着手して定着させることです。商談で、いま一番優先したいテーマをお伺いします。',
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  return {
    typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
    badge: '事業成長ステージ',
    summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
    urgentAction: '属人化を排した仕組み化と、継続的な利益改善ロードマップの策定が次のステージへの鍵となります。',
    firstStep: '最初の候補は、経営者の方に集まっている判断や作業を洗い出し、任せられる形に整えることです。商談で、次に力を入れたい方向をお伺いします。',
    scores: { profit: profitScore, ops: opsScore },
    roadmap,
  };
}

// ==========================================
// 送信データ型 ＆ CRM同期関数
// ==========================================
export interface IntakeSubmissionPayload {
  slug: 'contact-inquiry' | 'material-download' | 'business-diagnosis' | string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  inquiryType: 'consultation' | 'material' | 'diagnosis' | 'care_package';
  source?: string;
  notes?: string;
  answers?: Record<string, string | boolean>;
  customFields?: Record<string, any>;
}

export interface IntakeSubmissionResult {
  success: boolean;
  message: string;
  leadId?: string;
  bookingUrl?: string;
  materialUrl?: string;
  materialUrls?: Array<{ key: string; label: string; url: string }>;
}

// 面談予約公式URL（TimeRex）
export const OFFICIAL_TIMEREX_BOOKING_URL = 'https://timerex.net/s/mst.shikumikaizen_b173/4ac78e37';

// 面談予約URLの取得（フォールバック用）
export async function getBookingPageUrl(): Promise<string> {
  return OFFICIAL_TIMEREX_BOOKING_URL;
}

/**
 * UUID v4 生成関数（RFC 4122準拠）
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * バックエンド API エンドポイントの解決
 * 環境変数 VITE_OS_API_URL を優先し、未設定時は https://os.mstcorp.info を使用
 */
export function resolveApiEndpoint(path: string): string {
  const envUrl = (
    import.meta.env.VITE_OS_API_URL ||
    import.meta.env.PUBLIC_OS_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    import.meta.env.NEXT_PUBLIC_API_URL ||
    'https://os.mstcorp.info'
  ).trim();

  const baseUrl = envUrl || 'https://os.mstcorp.info';
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * OS・CRMへの安全な連携
 * ブラウザから直接Supabaseへ書き込まず、サーバーの POST /api/public/forms/:slug/submissions 経由で実行します。
 * 送信失敗時は確実に success: false とエラーメッセージを返却し、誤った完了表示を防ぎます。
 */
export async function submitIntakeToCRM(payload: IntakeSubmissionPayload): Promise<IntakeSubmissionResult> {
  const requestId = generateUuid();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPhone = (payload.phone || '').trim();
  const cleanName = payload.name.trim();
  const cleanCompany = (payload.companyName || '').trim();

  if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      success: false,
      message: 'お名前と有効なメールアドレスをご入力ください。',
    };
  }

  const endpoint = resolveApiEndpoint(`/api/public/forms/${encodeURIComponent(payload.slug)}/submissions`);

  // ブラウザ環境から詳細UTMパラメータを自動収集
  let browserUtm: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      for (const [k, v] of searchParams.entries()) {
        if (k.startsWith('utm_') || k === 'source' || k === 'ref') {
          browserUtm[k] = v;
        }
      }
      if (document.referrer) browserUtm.referrer = document.referrer.slice(0, 300);
      browserUtm.landing_page = window.location.href.slice(0, 300);
    } catch {}
  }

  const materialKeys = Array.isArray(payload.customFields?.material_keys)
    ? payload.customFields?.material_keys
    : Array.isArray((payload.answers as any)?.material_keys)
      ? (payload.answers as any).material_keys
      : [];

  const requestBody = {
    name: cleanName,
    companyName: cleanCompany,
    email: cleanEmail,
    phone: cleanPhone,
    requestId,
    privacyAgreed: true,
    materialKeys,
    answers: payload.answers || {},
    notes: payload.notes || '',
    customFields: payload.customFields || {},
    utm: {
      source: payload.source || 'corporate_website',
      inquiryType: payload.inquiryType,
      ...browserUtm,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const errorMessage = data?.error || data?.message || `送信に失敗しました。(HTTP ${response.status})`;
      console.error('submitIntakeToCRM API failed:', errorMessage, response.status);
      return {
        success: false,
        message: errorMessage,
      };
    }

    return {
      success: true,
      message: data.message || '送信を受け付けました。',
      leadId: data.leadId,
      bookingUrl: data.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL,
      materialUrl: data.materialUrl,
      materialUrls: data.materialUrls,
    };
  } catch (err: any) {
    console.error('submitIntakeToCRM network/fetch error:', err);
    return {
      success: false,
      message: 'サーバーとの通信に失敗しました。インターネット接続をご確認の上、再度お試しください。',
    };
  }
}
