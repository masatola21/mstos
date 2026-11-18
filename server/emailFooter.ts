/**
 * 全メール共通の差出人署名（特定電子メール法の表示事項＋HP・連絡先）。
 * テンプレート・手動メール・自動配信のどれでも、送信直前にサーバーがここで付ける。
 */

export const SENDER_PROFILE = {
  companyLine: '有限会社MST　代表取締役 大橋真人',
  postalCode: '〒503-0981',
  address: '岐阜県大垣市桧町127番地',
  website: 'https://corp.mstcorp.info',
  logoUrl: 'https://corp.mstcorp.info/images/logo.png',
  logoAlt: '有限会社MST',
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

export function escapeEmailHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s<>"']+$/i.test(String(url || '').trim());
}

function resolveLogoUrl(customLogoUrl?: string): string {
  const candidate = String(customLogoUrl || '').trim();
  if (isSafeHttpUrl(candidate)) return candidate;
  return SENDER_PROFILE.logoUrl;
}

function formatPlainLineWithLinks(line: string): string {
  const urlRe = /https?:\/\/[^\s<>"'（）()「」『』【】、。]+/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(line)) !== null) {
    const start = match.index;
    let rawUrl = match[0];
    if (start > lastIndex) {
      result += escapeEmailHtml(line.slice(lastIndex, start));
    }

    // 末尾にASCII句読点だけが付いている場合はURLから外す
    let trailing = '';
    while (rawUrl.length > 0 && /[.,;:!?)]$/.test(rawUrl)) {
      trailing = rawUrl.slice(-1) + trailing;
      rawUrl = rawUrl.slice(0, -1);
    }

    if (isSafeHttpUrl(rawUrl)) {
      const safeUrl = escapeEmailHtml(rawUrl);
      result += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;text-decoration:underline;word-break:break-all;">${safeUrl}</a>`;
    } else {
      result += escapeEmailHtml(rawUrl);
    }

    if (trailing) {
      result += escapeEmailHtml(trailing);
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < line.length) {
    result += escapeEmailHtml(line.slice(lastIndex));
  }

  return result;
}

export function formatPlainBodyAsEmailHtml(text: string): string {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trimEnd();
  if (!normalized) return '';
  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').map(formatPlainLineWithLinks).join('<br />');
      return `<p style="margin:0 0 14px 0;line-height:1.75;color:#1e293b;text-align:left;">${lines}</p>`;
    })
    .join('\n');
}

export function buildHtmlSenderSignature(opts: {
  senderEmail: string;
  logoUrl?: string;
}): string {
  const mail = String(opts.senderEmail || '').trim();
  const logoUrl = escapeEmailHtml(resolveLogoUrl(opts.logoUrl));
  const website = escapeEmailHtml(SENDER_PROFILE.website);
  const logoAlt = escapeEmailHtml(SENDER_PROFILE.logoAlt);
  const companyLine = escapeEmailHtml(SENDER_PROFILE.companyLine);
  const addressLine = escapeEmailHtml(`${SENDER_PROFILE.postalCode} ${SENDER_PROFILE.address}`);
  const mailRow = mail
    ? `<div>Mail: <a href="mailto:${escapeEmailHtml(mail)}" style="color:#0369a1;text-decoration:underline;">${escapeEmailHtml(mail)}</a></div>`
    : '';

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid #cbd5e1;padding-top:16px;border-collapse:separate;">',
    '  <tr>',
    '    <td valign="middle" style="padding:16px 14px 0 0;width:124px;">',
    `      <a href="${website}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;text-decoration:none;">`,
    `        <img src="${logoUrl}" alt="${logoAlt}" width="100" height="40" style="display:block;width:100px;height:40px;border:0;outline:none;text-decoration:none;" />`,
    '      </a>',
    '    </td>',
    '    <td valign="middle" style="padding:16px 0 0 0;font-size:12px;line-height:1.65;color:#334155;">',
    `      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px;">${companyLine}</div>`,
    `      <div>${addressLine}</div>`,
    `      <div>HP: <a href="${website}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;text-decoration:underline;">${website}</a></div>`,
    mailRow ? `      ${mailRow}` : '',
    '    </td>',
    '  </tr>',
    '</table>',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildHtmlUnsubscribeBlock(unsubscribeUrl?: string): string {
  const cleanUrl = String(unsubscribeUrl || '').trim();
  if (!cleanUrl) return '';
  const content = isSafeHttpUrl(cleanUrl)
    ? `配信停止はこちら: <a href="${escapeEmailHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer" style="color:#64748b;text-decoration:underline;word-break:break-all;">${escapeEmailHtml(cleanUrl)}</a>`
    : escapeEmailHtml(`配信停止はこちら: ${cleanUrl}`);

  return [
    '<div style="margin-top:14px;padding-top:10px;border-top:1px dashed #e2e8f0;font-size:11px;line-height:1.6;color:#64748b;">',
    `  ${content}`,
    '</div>',
  ].join('\n');
}

export function prepareEmailPayloadContent(
  body: string,
  opts: { senderEmail: string; unsubscribeUrl?: string; logoUrl?: string },
): {
  bodyWithoutLegacySignature: string;
  shouldIncludeSignature: boolean;
  text: string;
  html: string;
} {
  const original = String(body || '').replace(/\s+$/, '');
  const { text: cleanBody, stripped } = stripTrailingLegacySignature(original);
  const shouldIncludeSignature = stripped || !cleanBody.includes(SENDER_PROFILE.addressMarker);

  const textParts = [cleanBody];
  if (shouldIncludeSignature) {
    textParts.push(buildSenderSignature(opts.senderEmail));
  }
  if (opts.unsubscribeUrl) {
    textParts.push(`配信停止はこちら: ${opts.unsubscribeUrl}`);
  }

  const bodyHtml = formatPlainBodyAsEmailHtml(cleanBody);
  const signatureHtml = shouldIncludeSignature
    ? buildHtmlSenderSignature({ senderEmail: opts.senderEmail, logoUrl: opts.logoUrl })
    : '';
  const unsubscribeHtml = buildHtmlUnsubscribeBlock(opts.unsubscribeUrl);

  const html = [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1.0" />',
    '</head>',
    '<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,\'Hiragino Sans\',\'Hiragino Kaku Gothic ProN\',\'Yu Gothic\',Meiryo,sans-serif;color:#1e293b;font-size:14px;line-height:1.75;text-align:left;">',
    '  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" align="left" style="margin:0;padding:0;border-collapse:collapse;text-align:left;max-width:680px;">',
    '    <tr>',
    '      <td align="left" style="margin:0;padding:12px 0 20px 0;text-align:left;font-family:-apple-system,BlinkMacSystemFont,\'Hiragino Sans\',\'Hiragino Kaku Gothic ProN\',\'Yu Gothic\',Meiryo,sans-serif;color:#1e293b;font-size:14px;line-height:1.75;">',
    bodyHtml,
    signatureHtml,
    unsubscribeHtml,
    '      </td>',
    '    </tr>',
    '  </table>',
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    bodyWithoutLegacySignature: cleanBody,
    shouldIncludeSignature,
    text: textParts.join('\n\n'),
    html,
  };
}

/**
 * テキストメール本文をそのまま安全にHTML化し、末尾にMSTロゴ入りHTML署名（＋配信停止リンク）を付与する。
 */
export function appendHtmlEmailFooter(
  body: string,
  opts: { senderEmail: string; unsubscribeUrl?: string; logoUrl?: string },
): string {
  return prepareEmailPayloadContent(body, opts).html;
}
