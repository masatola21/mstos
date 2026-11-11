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
 * 本文末尾に、旧形式の直書き署名（罫線で区切られた社名・住所のブロック）があれば取り除く。
 * 取り除けるのは「最後の罫線から末尾まで」が短い署名ブロックの場合だけ。本文中の住所は触らない。
 */
export function stripTrailingLegacySignature(text: string): { text: string; stripped: boolean } {
  const idx = text.lastIndexOf(SENDER_PROFILE.addressMarker);
  if (idx < 0) return { text, stripped: false };
  const before = text.slice(0, idx);
  const ruleRe = /^[-－ー=━─]{10,}[ \t]*$/gm;
  let lastRule = -1;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(before)) !== null) lastRule = m.index;
  if (lastRule < 0) return { text, stripped: false };
  const tail = text.slice(lastRule);
  const lines = tail.split('\n');
  if (tail.length > 300 || lines.some((line) => line.length > 80)) return { text, stripped: false };
  return { text: text.slice(0, lastRule).replace(/\s+$/, ''), stripped: true };
}

/**
 * 本文の末尾に「差出人署名」と（営業・案内メールのみ）「配信停止リンク」を付ける。
 * - 旧形式の直書き署名が末尾にあれば、標準の署名に置き換える（形式を全メールで統一）。
 * - 本文の途中に住所が入っているだけの場合は、署名を重ねない。
 * - unsubscribeUrl が空（請求書・受付完了などの取引メール）なら配信停止リンクは付けない。
 */
export function appendEmailFooter(
  body: string,
  opts: { senderEmail: string; unsubscribeUrl?: string },
): string {
  const original = String(body || '').replace(/\s+$/, '');
  const { text, stripped } = stripTrailingLegacySignature(original);
  const parts = [text];
  if (stripped || !text.includes(SENDER_PROFILE.addressMarker)) {
    parts.push(buildSenderSignature(opts.senderEmail));
  }
  if (opts.unsubscribeUrl) {
    parts.push(`配信停止はこちら: ${opts.unsubscribeUrl}`);
  }
  return parts.join('\n\n');
}
