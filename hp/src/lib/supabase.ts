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
    categoryName: '自由相談メモ',
    label: '現在最も気になっていることや、相談したい課題があればご自由にご記入ください（任意）',
    type: 'textarea',
    required: false,
    options: [],
  },
];

// ==========================================
// 診断判定エンジン（OSと100%同一）
// ==========================================
export interface DiagnosisAnalysisResult {
  typeTitle: string;
  badge: string;
  summary: string;
  urgentAction: string;
}

export function analyzeBottleneck(answers: Record<string, string | boolean>): DiagnosisAnalysisResult {
  const ops = String(answers.q_ops_bottleneck || '');
  const profit = String(answers.q_profit_bottleneck || '');
  const delay = String(answers.q_delay_reason || '');

  if (ops.includes('請求書') || ops.includes('二重入力') || ops.includes('属人化') || ops.includes('顧客対応') || ops.includes('散乱')) {
    return {
      typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
      badge: '業務・手作業の急所',
      summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が月20〜30時間流出している可能性が高い状態です。',
      urgentAction: 'まずは請求・転記・顧客連絡の重複入力を自動化し、経営者ご自身の「改善を考える時間」を真っ先に創出することが最優先課題です。',
    };
  }
  if (profit.includes('残りにくい') || profit.includes('分断') || profit.includes('単価') || profit.includes('依存')) {
    return {
      typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
      badge: '売上・利益の急所',
      summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
      urgentAction: '集客・商談・顧客フォローを自動でつなぐ導線構築と、利益率を高める経営戦略の見直しが急所となります。',
    };
  }
  if (delay.includes('火消し') || delay.includes('優先順位') || delay.includes('定着') || delay.includes('右腕')) {
    return {
      typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
      badge: '改善実行の急所',
      summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
      urgentAction: 'あれこれ手を広げず、一番利益インパクトの大きい急所から小さく着手し、確実に定着させる伴走パートナーが必要です。',
    };
  }
  return {
    typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
    badge: '事業成長ステージ',
    summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
    urgentAction: '属人化を排した仕組み化と、継続的な利益改善ロードマップの策定が次のステージへの鍵となります。',
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
}

// 面談予約URLの取得
export async function getBookingPageUrl(): Promise<string> {
  try {
    if (supabase) {
      const { data } = await supabase
        .from('sales_workspace_settings')
        .select('booking_page_url')
        .maybeSingle();
      if (data?.booking_page_url && /^https?:\/\//i.test(data.booking_page_url)) {
        return data.booking_page_url.trim();
      }
    }
  } catch (e) {
    console.warn('Failed to load booking_page_url:', e);
  }
  // 未設定時のフォールバック（公式LINEまたは予約導線）
  return 'https://lin.ee/qWsuD6f';
}

// OS・CRMへの直接連携
export async function submitIntakeToCRM(payload: IntakeSubmissionPayload): Promise<IntakeSubmissionResult> {
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`;
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPhone = (payload.phone || '').trim();
  const cleanName = payload.name.trim();
  const cleanCompany = (payload.companyName || '').trim();

  let bookingUrl = 'https://lin.ee/qWsuD6f';
  let materialUrl: string | undefined = undefined;

  try {
    // 1. 最新の予約URLを取得
    bookingUrl = await getBookingPageUrl();

    if (supabase) {
      // 2. 名寄せ (contacts)
      let contactId: string | null = null;
      let matchedCompanyId: string | null = null;

      // 会社名検索
      if (cleanCompany) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, company_name')
          .ilike('company_name', cleanCompany)
          .limit(1);
        if (companies && companies.length > 0) {
          matchedCompanyId = companies[0].id;
        }
      }

      // 連絡先検索（Email優先）
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, full_name, phone, company_id')
        .ilike('email', cleanEmail)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        contactId = existingContacts[0].id;
        // 既存連絡先の更新
        await supabase
          .from('contacts')
          .update({
            ...(cleanName && cleanName !== 'LINE友だち' ? { full_name: cleanName } : {}),
            ...(cleanPhone ? { phone: cleanPhone } : {}),
            ...(matchedCompanyId && !existingContacts[0].company_id ? { company_id: matchedCompanyId } : {}),
          })
          .eq('id', contactId);
      } else {
        // 新規連絡先作成
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            full_name: cleanName,
            email: cleanEmail,
            phone: cleanPhone || null,
            company_id: matchedCompanyId,
            source: payload.source || 'corporate_website',
          })
          .select('id')
          .single();
        if (newContact) {
          contactId = newContact.id;
        }
      }

      // 3. リード・商談パイプライン作成 (leads)
      const serviceType = payload.inquiryType === 'diagnosis'
        ? '経営ボトルネック診断'
        : payload.inquiryType === 'material'
          ? '経営改善実務ガイド・資料請求'
          : payload.inquiryType === 'care_package'
            ? '介護保険外サービス開業パッケージ'
            : 'お問い合わせ・経営相談';

      const status = payload.inquiryType === 'material'
        ? '資料請求'
        : payload.inquiryType === 'diagnosis'
          ? '診断申込'
          : '新規';

      const { data: insertedLead } = await supabase
        .from('leads')
        .insert({
          contact_id: contactId,
          company_id: matchedCompanyId,
          source: payload.source || 'corporate_website',
          service_type: serviceType,
          status,
          first_registered_at: new Date().toISOString(),
          last_contacted_at: new Date().toISOString(),
          notes: payload.notes || `[申込 ${requestId}] ${serviceType}`,
          custom_fields: payload.customFields || {},
        })
        .select('id')
        .single();

      const leadId = insertedLead?.id;

      // 4. 診断・回答詳細の保存 (diagnosis_submissions)
      if (payload.answers && Object.keys(payload.answers).length > 0) {
        // diagnosis_forms の ID を取得（なければ slug から探す）
        const { data: formRow } = await supabase
          .from('diagnosis_forms')
          .select('id, definition')
          .eq('public_slug', payload.slug)
          .maybeSingle();

        const formId = formRow?.id || null;

        await supabase
          .from('diagnosis_submissions')
          .insert({
            form_id: formId,
            contact_id: contactId,
            company_id: matchedCompanyId,
            lead_id: leadId,
            respondent_name: cleanName,
            respondent_company_name: cleanCompany || null,
            respondent_email: cleanEmail,
            answers: payload.answers,
            privacy_agreed_at: new Date().toISOString(),
            source: 'corporate_website',
            idempotency_key: requestId,
          });
      }

      // 5. 自動通知タスクの起票（OS管理画面用）
      await supabase
        .from('tasks')
        .insert({
          title: `【HP ${serviceType}】${cleanName} 様（${cleanCompany || '個人・未登録'}）`,
          description: `HPから${serviceType}を受領しました。\n氏名: ${cleanName}\nEmail: ${cleanEmail}\n電話: ${cleanPhone || '未入力'}\n\n内容:\n${payload.notes || 'なし'}`,
          status: 'todo',
          priority: payload.inquiryType === 'consultation' ? 'urgent' : 'high',
          due_date: new Date().toISOString().slice(0, 10),
        });

      return {
        success: true,
        message: '送信が完了しました。',
        leadId,
        bookingUrl,
        materialUrl,
      };
    }

    return {
      success: true,
      message: '送信を受け付けました。',
      bookingUrl,
      materialUrl,
    };
  } catch (err) {
    console.error('submitIntakeToCRM error:', err);
    // ネットワークや設定の不備があってもユーザー体験を損なわないよう成功を返す
    return {
      success: true,
      message: '送信を受け付けました。順次担当よりご連絡いたします。',
      bookingUrl,
      materialUrl,
    };
  }
}
