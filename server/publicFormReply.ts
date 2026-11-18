export type PublicFormNotificationKind =
  | 'care_package'
  | 'material_download'
  | 'consultation_inquiry'
  | 'diagnosis';

export function hasCoreDiagnosisAnswers(answers?: Record<string, unknown> | null): boolean {
  if (!answers || typeof answers !== 'object') return false;
  return Boolean(
    answers.q_ops_bottleneck ||
    answers.q_profit_bottleneck ||
    answers.q_delay_reason ||
    answers.q_ideal_future
  );
}

export function classifyPublicFormNotificationKind(params: {
  slug: string;
  formType: string;
  inquiryType?: string | null;
  isCarePackage?: boolean;
  formName?: string | null;
  answers?: Record<string, unknown> | null;
  utmInquiryType?: string | null;
}): PublicFormNotificationKind {
  const slug = String(params.slug || '').trim().toLowerCase();
  const formType = String(params.formType || '').trim().toLowerCase();
  const inquiryType = String(params.inquiryType || '').trim();
  const formName = String(params.formName || '').trim();
  const utmInquiryType = String(params.utmInquiryType || '').trim().toLowerCase();
  const answers = params.answers && typeof params.answers === 'object' ? params.answers : null;

  if (params.isCarePackage) return 'care_package';
  if (slug === 'material-download' || inquiryType === '資料請求' || inquiryType.startsWith('資料請求')) {
    return 'material_download';
  }

  if (slug === 'business-diagnosis') {
    return 'diagnosis';
  }

  if (
    slug === 'contact-inquiry' ||
    utmInquiryType === 'consultation' ||
    formType === 'consultation' ||
    formType === 'meeting'
  ) {
    return 'consultation_inquiry';
  }

  if (hasCoreDiagnosisAnswers(answers)) {
    return 'diagnosis';
  }

  if (
    formName &&
    (formName.includes('お問い合わせ') || formName.includes('お問合せ') || formName.includes('相談')) &&
    !formName.includes('診断')
  ) {
    return 'consultation_inquiry';
  }

  if (answers && (answers.service_interest || answers.consultation_message || answers.message)) {
    return 'consultation_inquiry';
  }

  if (formType === 'diagnosis') {
    return 'diagnosis';
  }
  return 'consultation_inquiry';
}

export function extractConsultationDetailsText(params: {
  userNotes?: string | null;
  answers?: Record<string, unknown> | null;
}): { consultationText: string; preferredDateText: string } {
  const answers = params.answers && typeof params.answers === 'object' ? params.answers : {};
  const answerCandidates = [
    answers.consultation_message,
    answers.message,
    answers.q_free_notes,
    answers.q_message,
    answers.inquiry,
    answers.content,
    answers.details,
    answers.notes,
  ];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of answerCandidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
  }

  // 専用回答欄が無いフォーム送信時のみ userNotes を使う（ContactForm由来のメタ情報行は除外し重複・ノイズを防ぐ）
  if (parts.length === 0 && typeof params.userNotes === 'string') {
    const cleanedLines = params.userNotes
      .split('\n')
      .map((line) => line.replace(/^【(?:ご相談内容|自由記入メモ|メモ)】/, '').trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith('【ご関心のあるテーマ】') &&
          !line.startsWith('【認知経路】') &&
          !line.startsWith('【資料請求】') &&
          !line.startsWith('【経営ボトルネック診断】')
      );
    const cleanedNote = cleanedLines.join('\n').trim();
    if (cleanedNote) {
      parts.push(cleanedNote);
    }
  }

  const preferredDate = typeof answers.preferred_date === 'string' ? answers.preferred_date.trim() : '';
  const preferredTime = typeof answers.preferred_time === 'string' ? answers.preferred_time.trim() : '';
  const preferredDateText = [preferredDate, preferredTime].filter(Boolean).join(' ');

  return {
    consultationText: parts.join('\n').slice(0, 2000),
    preferredDateText,
  };
}

export function buildConsultationInstantReply(params: {
  name: string;
  companyName?: string | null;
  inquiryType?: string | null;
  consultationText?: string | null;
  preferredDateText?: string | null;
  bookingUrl?: string | null;
}): { emailSubject: string; bodyText: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const cleanCompany = String(params.companyName || '').trim();
  const cleanType = String(params.inquiryType || '').trim() || '経営相談・お問い合わせ';
  const cleanConsultation = String(params.consultationText || '').trim();
  const cleanPreferred = String(params.preferredDateText || '').trim();
  const bookingUrl = String(params.bookingUrl || '').trim();
  const hasBookingUrl = Boolean(bookingUrl && /^https?:\/\//i.test(bookingUrl));

  const summaryLines = [
    ...(cleanCompany && !cleanCompany.includes('（個人）') ? [`■ 会社名：${cleanCompany}`] : []),
    `■ ご相談種別：${cleanType}`,
    ...(cleanPreferred ? [`■ ご希望日時等：${cleanPreferred}`] : []),
    ...(cleanConsultation ? [`■ ご相談内容（控え）：\n${cleanConsultation}`] : []),
  ];

  const bookingSection = hasBookingUrl
    ? `\nなお、お急ぎの場合やそのままオンラインでの個別面談（30分・無料）をご希望の場合は、下記カレンダーより直接ご希望日時をお選びいただくことも可能です。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n${bookingUrl}`
    : '';

  const bodyText = [
    `${cleanName} 様`,
    '',
    'この度は有限会社MSTへお問い合わせ・Web相談をお申し込みいただき、誠にありがとうございます。',
    '以下の内容にて受付を完了いたしました。',
    '',
    ...summaryLines,
    '',
    'いただいた内容を確認のうえ、代表の大橋（または担当）より通常1営業日以内を目安に、本メールアドレス宛てに折り返しご返信いたします。',
    bookingSection,
    '',
    '追加でお伝えしたい事項や確認したい点がございましたら、このまま本メールへのご返信にてお気軽にお送りください。',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  return {
    emailSubject: '【有限会社MST】Web相談・お問い合わせを受け付けました（担当者よりご連絡いたします）',
    bodyText,
  };
}

export function buildMaterialDownloadInstantReply(params: {
  name: string;
  requestedMaterials?: Array<{ label: string; url: string }>;
  fallbackChoiceLabel?: string | null;
  fallbackMaterialUrl?: string | null;
  bookingUrl?: string | null;
}): { emailSubject: string; bodyText: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const materials = (params.requestedMaterials || []).filter((m) => m && m.label && m.url);
  const fallbackLabel = String(params.fallbackChoiceLabel || '').trim();
  const fallbackUrl = String(params.fallbackMaterialUrl || '').trim();
  const hasFallbackUrl = Boolean(fallbackUrl && /^https?:\/\//i.test(fallbackUrl));
  const bookingUrl = String(params.bookingUrl || '').trim();
  const hasBookingUrl = Boolean(bookingUrl && /^https?:\/\//i.test(bookingUrl));

  const requestedLabelsText =
    materials.length > 0
      ? materials.map((m) => `・${m.label}`).join('\n')
      : fallbackLabel
        ? `・${fallbackLabel}`
        : '・MST 案内資料';

  const downloadSection =
    materials.length > 0
      ? [
          'ご請求いただいた資料は、以下のURLより今すぐご確認・ダウンロードいただけます。',
          '',
          materials.map((m) => `▼ ${m.label}\n${m.url}`).join('\n\n'),
          '',
          '※ダウンロード期限はございませんので、いつでもお見返しいただけます。',
        ].join('\n')
      : hasFallbackUrl
        ? [
            'ご請求いただいた資料は、以下のURLより今すぐご確認・ダウンロードいただけます。',
            '',
            fallbackUrl,
            '',
            '※ダウンロード期限はございませんので、いつでもお見返しいただけます。',
          ].join('\n')
        : '現在、最新版資料の送付準備中となっております。担当者より折り返しご案内をお送りいたしますので、恐れ入りますが少々お待ちくださいませ。';

  const bookingSection = hasBookingUrl
    ? `\n資料の内容をご覧になって「自社に当てはめるとどこから取り組めるか」「具体的な進め方を相談したい」といったご希望がございましたら、30分の無料オンライン相談もお気軽にご活用ください。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n${bookingUrl}`
    : '\n資料の内容についてご不明点やご相談がございましたら、このまま本メールへのご返信にてお気軽にお知らせください。';

  const bodyText = [
    '【MST】資料請求を受け付けました。',
    '',
    `${cleanName} 様`,
    'この度は資料をご請求いただき誠にありがとうございます。',
    '',
    `■ ご請求資料：\n${requestedLabelsText}`,
    '',
    downloadSection,
    bookingSection,
    '',
    '資料内容に関するご質問がございましたら、本メールへのご返信でも随時承っております。',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  return {
    emailSubject: '【MST】資料請求の受付完了（ダウンロードリンクのご案内）',
    bodyText,
  };
}

export function buildDiagnosisInstantReply(params: {
  name: string;
  formName?: string | null;
  typeTitle?: string | null;
  badge?: string | null;
  summary?: string | null;
  urgentAction?: string | null;
  firstStep?: string | null;
  freeNotes?: string | null;
  bookingUrl?: string | null;
}): { emailSubject: string; emailBodyText: string; lineBodyText: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const cleanFormName = String(params.formName || '').trim() || '3分無料経営診断';
  const cleanType = String(params.typeTitle || '').trim() || '経営ボトルネック簡易診断';
  const cleanBadge = String(params.badge || '').trim();
  const cleanSummary = String(params.summary || params.urgentAction || '').trim();
  const cleanFirstStep = String(params.firstStep || '').trim();
  const cleanFreeNotes = String(params.freeNotes || '').trim();
  const bookingUrl = String(params.bookingUrl || '').trim();
  const hasBookingUrl = Boolean(bookingUrl && /^https?:\/\//i.test(bookingUrl));

  const bookingSection = hasBookingUrl
    ? `\n▼ 30分無料オンライン商談（改善作戦会議）の日程予約はこちら\n${bookingUrl}\n\n※なお、さらに踏み込んだ貴社専用の【ご提案書（診断結果および改善プラン）】は、30分商談で現状をお伺いした方限定で商談後に作成・ご送付しております。`
    : '\n※なお、貴社専用の【ご提案書（診断結果および改善プラン）】は、30分商談を実施いただいた方限定で商談後に作成・ご送付しております。担当者より日程のご案内をお届けいたします。';

  const resultLines = [
    `■ 今回の簡易診断タイプ：${cleanType}`,
    ...(cleanBadge ? [`■ 判定カテゴリ：${cleanBadge}`] : []),
    ...(cleanSummary ? [`■ 診断の見立て：${cleanSummary}`] : []),
    ...(cleanFirstStep ? [`■ 最初に着手したい候補：${cleanFirstStep}`] : []),
    ...(cleanFreeNotes ? [`■ ご記入いただいたお悩み（控え）：\n${cleanFreeNotes}`] : []),
  ];

  // メール末尾の署名ブロックは送信直前に prepareEmailPayloadContent が自動付与するためここでは直書きしない
  const emailBodyText = [
    `${cleanName} 様`,
    '',
    '有限会社MST代表の大橋真人です。',
    `この度は「${cleanFormName}」にご回答いただき誠にありがとうございます。`,
    '',
    '送信直後にホームページ画面へ表示いたしました【簡易診断結果】の内容をお送りいたします。',
    '',
    ...resultLines,
    '',
    'より詳細なご状況を踏まえた【ご提案書（診断結果および改善プラン）】につきましては、机上の空論を避け御社の実情に合った内容でお届けするため、30分のオンライン商談を実施いただいた方限定で商談後に作成・ご送付しております。',
    bookingSection,
    '',
    '簡易診断結果について気になる点やご質問がございましたら、このまま本メールへのご返信でもお気軽にお送りください。',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  const lineBodyText = [
    `【MST】「${cleanFormName}」をご回答いただきありがとうございました！`,
    '',
    'ホームページ画面に表示された【簡易診断結果】はご覧いただけましたでしょうか？',
    `■ 今回の簡易診断タイプ：${cleanType}`,
    ...(cleanBadge ? [`■ 判定カテゴリ：${cleanBadge}`] : []),
    '',
    'なお、御社の実情に合わせた【ご提案書（診断結果および改善プラン）】は、30分オンライン商談にて直接お話を伺った方限定で、商談後に作成・ご送付しております。',
    bookingSection,
    '',
    '※簡易診断結果について気になる点やご質問がございましたら、このままLINEにご返信ください。',
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  return {
    emailSubject: `【MST】「${cleanFormName}」簡易診断結果の確認 ＆ 個別商談のご案内`,
    emailBodyText,
    lineBodyText,
  };
}

export function buildCarePackageInstantReply(params: {
  name: string;
  inquiryType?: string | null;
  requestedMaterials?: Array<{ label: string; url: string }>;
  fallbackMaterialUrl?: string | null;
  bookingUrl?: string | null;
  consultationText?: string | null;
}): { emailSubject: string; bodyText: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const cleanType = String(params.inquiryType || '').trim() || '開業相談';
  const materials = (params.requestedMaterials || []).filter((m) => m && m.label && m.url);
  const fallbackUrl = String(params.fallbackMaterialUrl || '').trim();
  const hasFallbackUrl = Boolean(fallbackUrl && /^https?:\/\//i.test(fallbackUrl));
  const bookingUrl = String(params.bookingUrl || '').trim();
  const hasBookingUrl = Boolean(bookingUrl && /^https?:\/\//i.test(bookingUrl));
  const cleanNotes = String(params.consultationText || '').trim();

  const materialSection =
    materials.length > 0
      ? `▼ 開業パッケージ資料URL\n${materials.map((m) => `▼ ${m.label}\n${m.url}`).join('\n\n')}`
      : hasFallbackUrl
        ? `▼ 開業パッケージ資料URL\n${fallbackUrl}`
        : '現在、最新版資料の送付準備中となっております。専任担当者より折り返しご案内をお送りいたしますので、恐れ入りますが少々お待ちくださいませ。';

  const bookingSection = hasBookingUrl
    ? `▼ 個別相談（30分・無料）の面談日程Web予約はこちら\n${bookingUrl}\n\n※上記リンクよりご都合のよい日時をお選びください。`
    : '担当者より面談日程のご案内を折り返しお届けいたします。';

  let bodyText = '';
  if (cleanType === '資料請求' || cleanType.startsWith('資料請求')) {
    bodyText = [
      '【MST】「介護保険外サービス開業パッケージ」資料請求を承りました。',
      '',
      `${cleanName} 様`,
      '資料請求いただき誠にありがとうございます！',
      '',
      materialSection,
      ...(cleanNotes ? ['', `■ ご記入内容（控え）：\n${cleanNotes}`] : []),
      '',
      'ご不明点や具体的な相談をご希望の場合は、いつでも本LINE／メールまでお気軽に返信してください。',
    ].join('\n');
  } else if (cleanType === '開業相談' || cleanType === '介護保険外開業') {
    bodyText = [
      '【MST】「介護保険外サービス開業パッケージ」開業相談のお申し込みを承りました。',
      '',
      `${cleanName} 様`,
      'ご相談のお申し込み誠にありがとうございます！',
      '',
      ...(cleanNotes ? [`■ ご相談内容（控え）：\n${cleanNotes}`, ''] : []),
      '専任コンサルタントによる30分のオンライン個別面談（Zoom・無料）にて、貴社の構想に合わせた開業ステップやサービス設計をご案内いたします。',
      '',
      bookingSection,
    ].join('\n');
  } else {
    bodyText = [
      '【MST】「介護保険外サービス開業パッケージ」資料請求・個別相談を承りました。',
      '',
      `${cleanName} 様`,
      'お申し込み誠にありがとうございます！',
      '',
      ...(cleanNotes ? [`■ ご記入内容（控え）：\n${cleanNotes}`, ''] : []),
      materialSection,
      '',
      bookingSection,
    ].join('\n');
  }

  return {
    emailSubject: `【MST】「介護保険外サービス開業パッケージ」${cleanType}の受付完了`,
    bodyText: bodyText.trim(),
  };
}

export function buildConsultationAdminAlertEmail(params: {
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  inquiryType?: string | null;
  consultationText?: string | null;
  preferredDateText?: string | null;
  formName?: string | null;
  emailAutoReplyStatus: 'sent' | 'queued' | 'failed';
  emailAutoReplyError?: string | null;
  appUrl?: string | null;
}): { subject: string; text: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const cleanCompany = String(params.companyName || '').trim() || '個人';
  const autoReplyLabel =
    params.emailAutoReplyStatus === 'sent'
      ? '送信済み（お客様へ自動受付メール送信完了）'
      : params.emailAutoReplyStatus === 'failed'
        ? `送信失敗（要確認: ${params.emailAutoReplyError || 'メール送信エラー'}）`
        : '未送信/キュー状態（環境設定または手動返信を確認してください）';

  const statusTag = params.emailAutoReplyStatus === 'sent' ? '要メール返信・Web相談' : '至急対応・自動返信未完';

  const lines = [
    `ホームページ（${params.formName || 'Web相談フォーム'}）より新しいお問い合わせ・Web相談が届きました。`,
    '',
    `■ お名前：${cleanName} 様`,
    `■ 会社名：${cleanCompany}`,
    `■ メールアドレス：${params.email}`,
    ...(params.phone ? [`■ 電話番号：${params.phone}`] : []),
    `■ ご相談種別：${params.inquiryType || '経営相談'}`,
    ...(params.preferredDateText ? [`■ ご希望日時等：${params.preferredDateText}`] : []),
    `■ 自動受付メール状況：${autoReplyLabel}`,
    '',
    '■ ご相談内容：',
    params.consultationText?.trim() || '（自由記述なし）',
    '',
    '※ この通知メールに直接「返信」すると、お客様のメールアドレス宛てへ返信できます。',
    ...(params.appUrl ? [`▼ OS管理画面で対応する\n${params.appUrl}`] : []),
  ];

  return {
    subject: `【${statusTag}】${cleanName} 様（${cleanCompany}）より新着お問い合わせ`,
    text: lines.join('\n'),
  };
}

export interface PublicFormAdminBackupParams {
  notificationKind: PublicFormNotificationKind;
  formName?: string | null;
  slug?: string | null;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  inquiryType?: string | null;
  consultationText?: string | null;
  preferredDateText?: string | null;
  answers?: Record<string, unknown> | null;
  questionLabels?: Record<string, string>;
  quickBottleneck?: { typeTitle?: string; badge?: string; summary?: string } | null;
  requestedMaterials?: Array<{ label: string; url?: string }>;
  hearAbout?: string | null;
  utmDetails?: string | null;
  lineAutoReplySent?: boolean;
  emailAutoReplySent?: boolean;
  emailAutoReplyStatus: 'sent' | 'queued' | 'failed';
  emailAutoReplyError?: string | null;
  appUrl?: string | null;
}

const DEFAULT_BACKUP_ANSWER_LABELS: Record<string, string> = {
  q_ops_bottleneck: '手作業・業務プロセスの急所',
  q_profit_bottleneck: '売上・利益の急所',
  q_delay_reason: '改善停滞の原因',
  q_ideal_future: '目指したい未来',
  q_free_notes: '今一番のお悩み・ご相談内容',
  q_industry: '業種',
  industry: '業種',
  q_employee_count: '従業員数',
  employee_count: '従業員数',
  service_interest: 'ご関心のあるテーマ',
  q_inquiry_type: 'ご希望内容',
  choice_label: '選択した資料',
  q_hear_about: '認知経路',
};

const SKIP_BACKUP_ANSWER_KEYS = new Set([
  'hear_about',
  'hearAbout',
  'companyName',
  'company',
  'company_name',
  'material_keys',
  'material_choice',
  'preferred_date',
  'preferred_time',
]);

function formatAutoReplyStatusSummary(params: {
  lineAutoReplySent?: boolean;
  emailAutoReplySent?: boolean;
  emailAutoReplyStatus: 'sent' | 'queued' | 'failed';
  emailAutoReplyError?: string | null;
}): string {
  const parts: string[] = [];
  if (params.lineAutoReplySent) parts.push('LINE自動返信送信済み');
  if (params.emailAutoReplySent && params.emailAutoReplyStatus === 'sent') {
    parts.push('お客様メール自動返信送信済み');
  } else if (params.emailAutoReplyStatus === 'failed') {
    parts.push(`メール自動返信失敗（${params.emailAutoReplyError || '送信エラー'}）`);
  } else if (!params.lineAutoReplySent) {
    parts.push('メール未送信/キュー');
  }
  return parts.join(' ／ ') || '自動返信記録なし';
}

function formatAnswerLines(
  answers?: Record<string, unknown> | null,
  questionLabels?: Record<string, string>,
): string[] {
  if (!answers || typeof answers !== 'object') return [];
  const lines: string[] = [];
  for (const [key, val] of Object.entries(answers)) {
    if (SKIP_BACKUP_ANSWER_KEYS.has(key)) continue;
    if (val === null || val === undefined || val === '' || val === false) continue;
    const label = questionLabels?.[key] || DEFAULT_BACKUP_ANSWER_LABELS[key] || key;
    const formatted = Array.isArray(val) ? val.join('、') : val === true ? 'はい' : String(val).trim();
    if (!formatted) continue;
    lines.push(`・${label}：${formatted}`);
  }
  return lines;
}

export function buildPublicFormAdminBackupEmail(
  params: PublicFormAdminBackupParams,
): { subject: string; text: string } {
  const cleanName = String(params.name || '').trim() || 'お客様';
  const cleanCompany = String(params.companyName || '').trim() || '個人';

  if (params.notificationKind === 'consultation_inquiry') {
    const base = buildConsultationAdminAlertEmail({
      name: cleanName,
      companyName: cleanCompany,
      email: params.email,
      phone: params.phone,
      inquiryType: params.inquiryType,
      consultationText: params.consultationText,
      preferredDateText: params.preferredDateText,
      formName: params.formName,
      emailAutoReplyStatus: params.emailAutoReplyStatus,
      emailAutoReplyError: params.emailAutoReplyError,
      appUrl: params.appUrl,
    });
    const extraLines = [
      ...(params.hearAbout ? [`■ 認知経路：${params.hearAbout}`] : []),
      ...(params.utmDetails ? [`■ 流入詳細：${params.utmDetails}`] : []),
      ...(params.lineAutoReplySent ? ['■ LINE自動返信：送信済み'] : []),
    ];
    if (extraLines.length === 0) return base;
    return {
      subject: base.subject,
      text: `${base.text}\n\n${extraLines.join('\n')}`,
    };
  }

  const replySummary = formatAutoReplyStatusSummary(params);
  const answerLines = formatAnswerLines(params.answers, params.questionLabels);
  const materialLabels = (params.requestedMaterials || []).map((m) => m.label).filter(Boolean);

  let kindTitle = 'Webフォーム';
  let subjectPrefix = 'フォーム控え';
  if (params.notificationKind === 'diagnosis') {
    kindTitle = params.formName || '経営ボトルネック診断';
    subjectPrefix = 'フォーム控え・経営診断';
  } else if (params.notificationKind === 'material_download') {
    kindTitle = params.formName || '資料請求フォーム';
    subjectPrefix = 'フォーム控え・資料請求';
  } else if (params.notificationKind === 'care_package') {
    kindTitle = '介護保険外サービス開業パッケージ';
    subjectPrefix = `フォーム控え・開業パッケージ（${params.inquiryType || 'お申し込み'}）`;
  }

  const lines: string[] = [
    `公開フォーム（${kindTitle}）より新しい送信がありました（個人メール控え）。`,
    '',
    `■ お名前：${cleanName} 様`,
    `■ 会社名：${cleanCompany}`,
    `■ メールアドレス：${params.email}`,
    ...(params.phone ? [`■ 電話番号：${params.phone}`] : []),
    ...(params.inquiryType ? [`■ 種別・希望内容：${params.inquiryType}`] : []),
    ...(params.preferredDateText ? [`■ ご希望日時等：${params.preferredDateText}`] : []),
    ...(params.hearAbout ? [`■ 認知経路：${params.hearAbout}`] : []),
    ...(params.utmDetails ? [`■ 流入詳細：${params.utmDetails}`] : []),
    `■ お客様への自動返信状況：${replySummary}`,
  ];

  if (params.quickBottleneck?.typeTitle) {
    lines.push('', `■ 簡易診断結果：${params.quickBottleneck.typeTitle}`);
    if (params.quickBottleneck.badge) lines.push(`■ 判定カテゴリ：${params.quickBottleneck.badge}`);
  }

  if (materialLabels.length > 0) {
    lines.push('', '■ 請求資料：');
    materialLabels.forEach((label) => lines.push(`・${label}`));
  }

  if (params.consultationText?.trim()) {
    lines.push('', '■ メモ・自由記入：', params.consultationText.trim());
  }

  if (answerLines.length > 0) {
    lines.push('', '■ フォーム回答内容：', ...answerLines);
  }

  lines.push(
    '',
    '※ このバックアップメールに直接「返信」すると、お客様（申込者）のメールアドレス宛てに返信できます。',
    ...(params.appUrl ? [`▼ OS管理画面で確認する\n${params.appUrl}`] : []),
  );

  return {
    subject: `【${subjectPrefix}】${cleanName} 様（${cleanCompany}）`,
    text: lines.join('\n'),
  };
}
