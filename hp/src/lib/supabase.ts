import { createClient } from '@supabase/supabase-js';

// 環墁E��数 また�E OS共通�ESupabase接続情報
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
// 診断用マスター設問！ESと100%同一�E�E// ==========================================
export interface BottleneckQuestion {
  id: string;
  label: string;
  categoryName: string;
  type: 'radio' | 'textarea';
  required: boolean;
  options: string[];
}

// 会社の基本惁E���E�診断の前提�E�。OSの設問定義�E�E_industry / q_employee_count�E�と値を同一に保つこと、Eexport const MST_INDUSTRY_OPTIONS: string[] = [
  'IT・通信・Webサービス',
  '製造業・も�Eづくり',
  '卸売・小売・EC',
  '建設・不動産・住宁E,
  '飲食�E宿泊�E観允E,
  '医療�E福祉�Eヘルスケア',
  '士業・コンサルチE��ング・専門サービス',
  '人材�E教育・研修',
  '物流�E運輸',
  '金融・保険',
  'そ�E仁E,
];

export const MST_EMPLOYEE_COUNT_OPTIONS: string[] = [
  '1、E吁E,
  '6、E0吁E,
  '21、E0吁E,
  '51、E00吁E,
  '101、E00吁E,
  '301名以丁E,
];

export const MST_OFFICIAL_BOTTLENECK_QUESTIONS: BottleneckQuestion[] = [
  {
    id: 'q_ops_bottleneck',
    categoryName: '業務�E手作業の急所',
    label: '【業務�E手作業】日、E�E業務で最も時間や手間を奪われてぁE��手作業・ボトルネックは何ですか�E�E,
    type: 'radio',
    required: true,
    options: [
      '請求書・見積書等�E作�EめE��ール間�E二重入力�E転記作業',
      '顧客対応や連絡漏れ・対応状況�E確認に追われてぁE��',
      '経営老E��特定�E人に仕事が雁E��し、属人化してぁE��',
      '惁E��が散乱しており、どこに何があるか探す時間が長ぁE,
      '特に大きな手作業の負拁E�Eなく、�E走できてぁE��',
    ],
  },
  {
    id: 'q_profit_bottleneck',
    categoryName: '売上�E利益�E急所',
    label: '【売上�E利益】売上と利益�E現状につぁE��、最も当てはまるお悩みは何ですか�E�E,
    type: 'radio',
    required: true,
    options: [
      '売上�Eある程度あるが、手允E��利益が残りにくい',
      '雁E��から啁E��E�Eフォローまでの導線が刁E��され、案件化が漏れてぁE��',
      '日、E�E業務に追われ、単価アチE�EめE��益改喁E�E見直しに着手できてぁE��ぁE,
      '営業めE��客獲得が経営老E�E人脈や属人皁E��力に依存してぁE��',
      '利益�E頁E��に出ており、さらなる事業拡大・新事業を目持E��たい',
    ],
  },
  {
    id: 'q_delay_reason',
    categoryName: '改喁E��滞�E原因',
    label: '【改喁E��滞�E原因】「改喁E��たい」と思いながらも後回しになってぁE��主な原因は何ですか�E�E,
    type: 'radio',
    required: true,
    options: [
      '日、E�E現場業務や火消しに追われ、改喁E��老E��る時間がなぁE,
      '何から手を付けれ�E一番効果が出るか、優先頁E��が刁E��らなぁE,
      'チE�Eルを導�Eしてみたが、�E社の業務に合わず定着しなかっぁE,
      '改喁E��伴走・相諁E��きる右腕（パートナー�E�が社冁E��にぁE��ぁE,
      '計画はあるが、社冁E��けで実行を継続する�Eが難しい',
    ],
  },
  {
    id: 'q_ideal_future',
    categoryName: '目持E��たい未来',
    label: '【目持E��たい未来】仕絁E��化によって経営老E�E時間と利益が創出できたら、何に一番時間を使ぁE��ぁE��すか�E�E,
    type: 'radio',
    required: true,
    options: [
      '経営判断めE��略・次の一手（新規事業めE��収益源�E立ち上げ�E�E,
      '既存事業の利益率向上とマ�EケチE��ング・雁E��の強匁E,
      '絁E��化・人材育成�E権限移譲を進め、�E走する絁E��づくり',
      '経営老E�E身の余白・休日の確保と健康管琁E,
      'まず�E目の前�E手作業を減らし、日、E�E負拁E��軽減したい',
    ],
  },
  {
    id: 'q_free_notes',
    categoryName: '今一番のお悩み',
    label: '今、経営めE��務で一番お悩みのことは何ですか�E��E体的に書ぁE��ぁE��だくほど、診断結果が貴社向けになります（任意！E,
    type: 'textarea',
    required: false,
    options: [],
  },
];

// ==========================================
// 診断判定エンジン�E�ESと100%同一�E�E// ==========================================
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
  // レポ�Eト①�E��Eトルネック判定スコア
  scores: {
    profit: DiagnosisScoreItem;
    ops: DiagnosisScoreItem;
  };
  // レポ�Eト②�E�最初に着手したい候裁E  firstStep: string;
  // レポ�Eト③�E�優先改喁E��ード�EチE�E�E�社長視点の刁E��りやすい言葉！E  roadmap: {
    step1: { title: string; desc: string };
    step2: { title: string; desc: string };
    step3: { title: string; desc: string };
  };
}

export function analyzeBottleneck(answers: Record<string, string | boolean>): DiagnosisAnalysisResult {
  const ops = String(answers.q_ops_bottleneck || '');
  const profit = String(answers.q_profit_bottleneck || '');
  const delay = String(answers.q_delay_reason || '');

  // 1. スコア判宁E  let profitScore: DiagnosisScoreItem = {
    label: '案件別採算性・原価管琁E,
    stars: '☁E�E☁E�E☁E,
    status: '要改喁E��不採算特定が忁E��E��E,
    level: 'warning',
  };
  if (profit.includes('頁E��')) {
    profitScore = { label: '案件別採算性・原価管琁E, stars: '☁E�E☁E�E☁E, status: '良好�E�さらなる改喁E�E余地を確認！E, level: 'good' };
  } else if (profit.includes('残りにくい') || profit.includes('単価')) {
    profitScore = { label: '案件別採算性・原価管琁E, stars: '☁E�E☁E�E☁E, status: '深刻�E�利益流�Eの懸念大�E�E, level: 'danger' };
  }

  let opsScore: DiagnosisScoreItem = {
    label: '業務フロー標準化・属人匁E,
    stars: '☁E�E☁E�E☁E,
    status: '深刻�E�社長・特定人への依存大�E�E,
    level: 'danger',
  };
  if (ops.includes('自走できてぁE��')) {
    opsScore = { label: '業務フロー標準化・属人匁E, stars: '☁E�E☁E�E☁E, status: '自律稼働中', level: 'good' };
  } else if (ops.includes('二重入劁E) || ops.includes('属人匁E)) {
    opsScore = { label: '業務フロー標準化・属人匁E, stars: '☁E�E☁E�E☁E, status: '深刻�E�改喁E��先度�E�最高！E, level: 'danger' };
  } else {
    opsScore = { label: '業務フロー標準化・属人匁E, stars: '☁E�E☁E�E☁E, status: '要改喁E��改喁E��地大�E�E, level: 'warning' };
  }

  // 2. ロード�EチE�E設計（�EかりめE��ぁE��現�E�E  const roadmap = {
    step1: {
      title: '現状の整琁E,
      desc: '啁E��E��現状と優先頁E��をお伺ぁE��、着手する篁E��を決めます、E,
    },
    step2: {
      title: '仕絁E��づくり',
      desc: '決めた篁E��につぁE��、手作業めE��人化を減らす仕絁E��を整えます、E,
    },
    step3: {
      title: '定着と自走',
      desc: '社冁E��運用できる状態をめざして定着させます、E,
    },
  };

  // 基本タイプ判宁E  if (ops.includes('請求書') || ops.includes('二重入劁E) || ops.includes('属人匁E) || ops.includes('顧客対忁E) || ops.includes('散乱')) {
    return {
      typeTitle: '経営老E�E現場拘束 �E�E事務手作業・属人化タイチE,
      badge: '業務�E手作業の急所',
      summary: '売上�Eあるも�Eの、請求書めE��積書の手作業、E��客対応、特定�E人への属人化に時間を奪われ、経営老E��「次の一手」を打つ時間が取りにくくなってぁE��可能性が高い状態です、E,
      urgentAction: 'まず�E請求�E転記�E顧客連絡の重褁E�E力を見直し、経営老E��自身が「改喁E��老E��る時間」を確保できる状態をめざすことが、最初�EチE�Eマと老E��られます、E,
      firstStep: '最初�E候補�E、請求�E見積�E顧客惁E��など、褁E��の場所に同じ冁E��を�E力してぁE��作業の見直しです。商諁E��、どの作業から着手する�Eが良ぁE��を一緒に絞り込みます、E,
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  if (profit.includes('残りにくい') || profit.includes('刁E��') || profit.includes('単価') || profit.includes('依孁E)) {
    return {
      typeTitle: '利益流�E �E�E雁E��〜�E紁E��線�E断タイチE,
      badge: '売上�E利益�E急所',
      summary: '雁E��から啁E��E�Eフォローまでの一連の流れが�E断されてぁE��か、単価・コスト�E見直しが進んでぁE��ぁE��め、売上規模に対して手�Eに残る利益が削られてぁE��可能性が高い状態です、E,
      urgentAction: '雁E��・啁E��E�E顧客フォローを�E動でつなぐ導線構築と、利益率を高める経営戦略の見直しが急所となります、E,
      firstStep: '最初�E候補�E、E��客から問い合わせ�E啁E��E�Eフォローまでのつながりと、案件ごとの利益�E見え方を整琁E��ることです。商諁E��、どこで途�EれてぁE��かをお伺ぁE��ます、E,
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  if (delay.includes('火消し') || delay.includes('優先頁E��E) || delay.includes('定着') || delay.includes('右腁E)) {
    return {
      typeTitle: '改喁E��回ぁE�E�E優先頁E��停滞タイチE,
      badge: '改喁E��行�E急所',
      summary: '「改喁E��たい」と思いながらも日、E�E現場対応や火消しに追われ、どこから手を付けれ�E一番効果が出る�Eか優先頁E��が決まらず、改喁E��後回しになってぁE��状態です、E,
      urgentAction: 'あれこれ手を庁E��ず、一番利益インパクト�E大きい急所から小さく着手し、定着させることが鍵となります、E,
      firstStep: '最初�E候補�E、改喁E��ーマを1つに絞り、小さく着手して定着させることです。商諁E��、いま一番優先したいチE�Eマをお伺ぁE��ます、E,
      scores: { profit: profitScore, ops: opsScore },
      roadmap,
    };
  }
  return {
    typeTitle: '経営の仕絁E��匁E�E�E次の一手着手タイチE,
    badge: '事業成長スチE�Eジ',
    summary: '現状の事業基盤を活かしながら、経営老E��現場作業から完�Eに離れ、新規事業めE��収益源�E創出・自走絁E��づくりへとシフトするタイミングです、E,
    urgentAction: '属人化を排した仕絁E��化と、継続的な利益改喁E��ード�EチE�Eの策定が次のスチE�Eジへの鍵となります、E,
    firstStep: '最初�E候補�E、経営老E�E方に雁E��ってぁE��判断めE��業を洗い出し、任せられる形に整えることです。商諁E��、次に力を入れたぁE��向をお伺ぁE��ます、E,
    scores: { profit: profitScore, ops: opsScore },
    roadmap,
  };
}

// ==========================================
// 送信チE�Eタ垁E�E�ECRM同期関数
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

// 面諁E��紁E�E式URL�E�EimeRex�E�Eexport const OFFICIAL_TIMEREX_BOOKING_URL = 'https://timerex.net/s/mstcorp/c3dd3eea';

// 面諁E��約URLの取得（フォールバック用�E�Eexport async function getBookingPageUrl(): Promise<string> {
  return OFFICIAL_TIMEREX_BOOKING_URL;
}

/**
 * UUID v4 生�E関数�E�EFC 4122準拠�E�E */
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
 * バックエンチEAPI エンド�Eイント�E解決
 * 環墁E��数 VITE_OS_API_URL を優先し、未設定時は https://os.mstcorp.info を使用
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
 * OS・CRMへの安�Eな連携
 * ブラウザから直接Supabaseへ書き込まず、サーバ�Eの POST /api/public/forms/:slug/submissions 経由で実行します、E * 送信失敗時は確実に success: false とエラーメチE��ージを返却し、誤った完亁E��示を防ぎます、E */
export async function submitIntakeToCRM(payload: IntakeSubmissionPayload): Promise<IntakeSubmissionResult> {
  const requestId = generateUuid();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPhone = (payload.phone || '').trim();
  const cleanName = payload.name.trim();
  const cleanCompany = (payload.companyName || '').trim();

  if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      success: false,
      message: 'お名前と有効なメールアドレスをご入力ください、E,
    };
  }

  const endpoint = resolveApiEndpoint(`/api/public/forms/${encodeURIComponent(payload.slug)}/submissions`);

  // ブラウザ環墁E��ら詳細UTMパラメータ・LINE識別孁Ecid/luid)を�E動収雁E  let browserUtm: Record<string, string> = {};
  let urlContactId = '';
  let urlLineUserId = '';
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      for (const [k, v] of searchParams.entries()) {
        if (k.startsWith('utm_') || k === 'source' || k === 'ref') {
          browserUtm[k] = v;
        }
      }
      urlContactId = (searchParams.get('cid') || searchParams.get('contact_id') || '').trim();
      urlLineUserId = (searchParams.get('luid') || searchParams.get('line_user_id') || '').trim();
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
    ...(urlContactId ? { contactId: urlContactId } : {}),
    ...(urlLineUserId ? { lineUserId: urlLineUserId } : {}),
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
      const errorMessage = data?.error || data?.message || `送信に失敗しました、EHTTP ${response.status})`;
      console.error('submitIntakeToCRM API failed:', errorMessage, response.status);
      return {
        success: false,
        message: errorMessage,
      };
    }

    return {
      success: true,
      message: data.message || '送信を受け付けました、E,
      leadId: data.leadId,
      bookingUrl: data.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL,
      materialUrl: data.materialUrl,
      materialUrls: data.materialUrls,
    };
  } catch (err: any) {
    console.error('submitIntakeToCRM network/fetch error:', err);
    return {
      success: false,
      message: 'サーバ�Eとの通信に失敗しました。インターネット接続をご確認�E上、�E度お試しください、E,
    };
  }
}
