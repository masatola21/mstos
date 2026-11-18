export const DEFAULT_LINE_ALERT_EMAIL = 'mst.shikumikaizen@gmail.com';

export type LineInboundAlertMode = 'all' | 'unmatched_only';

export interface LineInboundAlertSettings {
  enabled: boolean;
  email: string;
  mode: LineInboundAlertMode;
}

export function isValidAlertEmail(email: string): boolean {
  const trimmed = String(email || '').trim();
  return Boolean(trimmed) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function normalizeLineInboundAlertSettings(
  raw: any,
  fallbackEmail: string = DEFAULT_LINE_ALERT_EMAIL,
): LineInboundAlertSettings {
  const safeFallback = isValidAlertEmail(fallbackEmail)
    ? fallbackEmail.trim().toLowerCase()
    : DEFAULT_LINE_ALERT_EMAIL;
  const rawEmail = typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const email = isValidAlertEmail(rawEmail) ? rawEmail : safeFallback;
  const enabled = typeof raw?.enabled === 'boolean' ? raw.enabled : true;
  const mode: LineInboundAlertMode =
    raw?.mode === 'unmatched_only' ? 'unmatched_only' : 'all';

  return { enabled, email, mode };
}

export function shouldSendLineInboundAlert(options: {
  settings: LineInboundAlertSettings;
  matchedRuleName?: string | null;
}): { shouldSend: boolean; reason?: string } {
  const { settings, matchedRuleName } = options;
  if (!settings.enabled) {
    return { shouldSend: false, reason: 'LINE受信アラート通知が無効に設定されています' };
  }
  if (!isValidAlertEmail(settings.email)) {
    return { shouldSend: false, reason: '通知先メールアドレスが未設定または不正です' };
  }
  if (settings.mode === 'unmatched_only' && matchedRuleName) {
    return {
      shouldSend: false,
      reason: `自動返信ルール「${matchedRuleName}」に一致したため通知対象外（自由入力のみ通知モード）`,
    };
  }
  return { shouldSend: true };
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LineInboundAlertEmailPayload {
  subject: string;
  text: string;
  html: string;
}

export function buildLineInboundAlertEmailPayload(params: {
  senderName: string;
  companyName?: string | null;
  lineUserId: string;
  messageText: string;
  receivedAt?: string | null;
  matchedRuleName?: string | null;
  autoReplyText?: string | null;
  inboxUrl?: string | null;
  isTest?: boolean;
}): LineInboundAlertEmailPayload {
  const senderLabel = params.companyName
    ? `${params.senderName}（${params.companyName}）`
    : params.senderName;
  const receivedJst = params.receivedAt
    ? new Date(params.receivedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const preview = String(params.messageText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const needsHumanAttention = !params.matchedRuleName;

  const prefix = params.isTest ? '【テスト通知】' : '';
  const subject = needsHumanAttention
    ? `${prefix}【MST LINE受信・要返信】${params.senderName}様「${preview}」`
    : `${prefix}【MST LINE受信（自動応答: ${params.matchedRuleName}）】${params.senderName}様`;

  const autoReplySummary = params.matchedRuleName
    ? `自動返信ルール「${params.matchedRuleName}」で応答済み（必要に応じ追加フォロー）`
    : params.autoReplyText
      ? '個別対応が必要な自由メッセージ（受付確認の定型文のみ自動返信済み・手動返信を推奨）'
      : '自動応答なし（手動返信が必要です）';

  const inboxUrl = (params.inboxUrl || '').trim();
  const textLines = [
    params.isTest
      ? '【LINE受信通知・テスト送信】'
      : '【LINE公式アカウント 新着メッセージ受信通知】',
    '',
    `差出人: ${senderLabel}`,
    `LINE ID: ${params.lineUserId}`,
    `受信日時: ${receivedJst}`,
    `対応区分: ${autoReplySummary}`,
    '--------------------------------------------------',
    '▼ 受信メッセージ本文',
    params.messageText,
    '--------------------------------------------------',
    ...(inboxUrl
      ? ['', '▼ OS受信トレイで返信する', inboxUrl]
      : []),
    '',
    '※ このメールは MST AI経営OS のLINE受信アラート設定により自動送信されています。',
  ];

  const badgeBg = needsHumanAttention ? '#FEF3C7' : '#ECFDF5';
  const badgeBorder = needsHumanAttention ? '#F59E0B' : '#10B981';
  const badgeText = needsHumanAttention ? '#92400E' : '#065F46';

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1E293B; background-color: #F8FAFC;">
  <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px;">
    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeText}; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
      ${params.isTest ? 'テスト通知 · ' : ''}${needsHumanAttention ? '要手動返信（個別メッセージ）' : `自動応答済み: ${escapeHtml(params.matchedRuleName || '')}`}
    </div>
    <h2 style="margin: 0 0 8px 0; font-size: 17px; color: #0F172A;">
      ${escapeHtml(senderLabel)} 様からLINEメッセージが届きました
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748B;">
      受信日時: ${escapeHtml(receivedJst)} ｜ ${escapeHtml(autoReplySummary)}
    </p>
    <div style="background-color: #F1F5F9; border-left: 4px solid #10B981; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #0F172A;">${escapeHtml(params.messageText)}</div>
    ${inboxUrl ? `
    <div style="margin-bottom: 16px;">
      <a href="${escapeHtml(inboxUrl)}" style="display: inline-block; background-color: #059669; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 18px; border-radius: 8px;">
        OSのLINEチャットを開いて返信する →
      </a>
    </div>` : ''}
    <p style="margin: 16px 0 0 0; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8;">
      MST AI経営OS ｜ LINE受信即時アラート通知
    </p>
  </div>
</div>`.trim();

  return {
    subject,
    text: textLines.join('\n'),
    html,
  };
}

export async function deliverLineInboundAlertEmail(params: {
  resendApiKey: string;
  fromString: string;
  toEmail: string;
  payload: LineInboundAlertEmailPayload;
}): Promise<{ success: boolean; resendMessageId?: string; error?: string }> {
  if (!params.resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY が未設定です。' };
  }
  if (!isValidAlertEmail(params.toEmail)) {
    return { success: false, error: '通知先メールアドレスが不正です。' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.fromString,
        to: [params.toEmail.trim().toLowerCase()],
        subject: params.payload.subject,
        text: params.payload.text,
        html: params.payload.html,
        headers: {
          'X-MST-Line-Alert': '1',
        },
      }),
    });

    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) {
      return {
        success: false,
        error: result.message || `Resend送信エラー (HTTP ${response.status})`,
      };
    }

    return { success: true, resendMessageId: result.id };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'LINE通知メール送信中にネットワークエラーが発生しました。',
    };
  }
}
