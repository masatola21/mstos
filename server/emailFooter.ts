/**
 * 全メール共通の差出人署名（特定電子メール法の表示事項＋HP・連絡先）。
 * テンプレート・手動メール・自動配信のどれでも、送信直前にサーバーがここで付ける。
 */

export const SENDER_PROFILE = {
  companyLine: '有限会社MST　代表取締役 大橋真人',
  postalCode: '〒503-0981',
  address: '岐阜県大垣市桧町127番地',
  website: 'https://mstcorp.info',
  // 本文に既にこの文字列が含まれていれば、署名は二重に付けない
  addressMarker: '桧町127番地',
} as const;

const RULE = '--------------------------------------------------';

export function buildSenderSignature(senderEmail: string): string {
  const mail = String(senderEmail || '').trim();
  return [
    RULE,
    SENDER_PROFILE.companyLine,
    `${SENDER_PROFILE.postalCode} ${SENDER_PROFILE.address}`,
    `HP: ${SENDER_PROFILE.website}`,
    ...(mail ? [`Mail: ${mail}`] : []),
    RULE,
  ].join('\n');
}

/**
 * 本文の末尾に「差出人署名」と（営業・案内メールのみ）「配信停止リンク」を付ける。
 * - 本文にすでに住所が入っている場合は署名を重ねない（旧テンプレートの直書き署名との二重表示防止）。
 * - unsubscribeUrl が空（請求書などの取引メール）なら配信停止リンクは付けない。
 */
export function appendEmailFooter(
  body: string,
  opts: { senderEmail: string; unsubscribeUrl?: string },
): string {
  const text = String(body || '').replace(/\s+$/, '');
  const parts = [text];
  if (!text.includes(SENDER_PROFILE.addressMarker)) {
    parts.push(buildSenderSignature(opts.senderEmail));
  }
  if (opts.unsubscribeUrl) {
    parts.push(`配信停止はこちら: ${opts.unsubscribeUrl}`);
  }
  return parts.join('\n\n');
}
