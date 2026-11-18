export type PublicFormNotificationKind =
  | 'care_package'
  | 'material_download'
  | 'consultation_inquiry'
  | 'diagnosis';

export function classifyPublicFormNotificationKind(params: {
  slug: string;
  formType: string;
  inquiryType?: string | null;
  isCarePackage?: boolean;
}): PublicFormNotificationKind {
  const slug = String(params.slug || '').trim().toLowerCase();
  const formType = String(params.formType || '').trim().toLowerCase();
  const inquiryType = String(params.inquiryType || '').trim();

  if (params.isCarePackage) return 'care_package';
  if (slug === 'material-download' || inquiryType === '資料請求' || inquiryType.startsWith('資料請求')) {
    return 'material_download';
  }
  if (formType === 'diagnosis' || slug === 'business-diagnosis') {
    return 'diagnosis';
  }
  return 'consultation_inquiry';
}

export function extractConsultationDetailsText(params: {
  userNotes?: string | null;
  answers?: Record<string, unknown> | null;
}): { consultationText: string; preferredDateText: string } {
  const answers = params.answers && typeof params.answers === 'object' ? params.answers : {};
  const candidates = [
    params.userNotes,
    answers.consultation_message,
    answers.message,
    answers.q_message,
    answers.inquiry,
    answers.content,
    answers.details,
    answers.notes,
  ];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
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
