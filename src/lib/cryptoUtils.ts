// ブラウザ標準の Web Crypto API を利用した安全なトークン生成・SHA-256ハッシュ算出
// 外部ライブラリへの依存なしで動作します

/**
 * 推測困難な暗号論的擬似乱数トークンを生成 (32バイト = 256ビット、hex文字列64文字)
 */
export function generateSurveyToken(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 文字列の SHA-256 ハッシュを16進数文字列で算出
 */
export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 流入元ソース（source）のバリデーションと正規化
 */
export const ALLOWED_SOURCES = [
  'line_rich_menu',
  'line_flex',
  'email',
  'lp',
  'other'
] as const;

export type AllowedSource = typeof ALLOWED_SOURCES[number];

export function sanitizeSource(rawSource?: string | null): AllowedSource {
  if (!rawSource) return 'other';
  const trimmed = rawSource.trim().toLowerCase();
  if (ALLOWED_SOURCES.includes(trimmed as AllowedSource)) {
    return trimmed as AllowedSource;
  }
  return 'other';
}

/**
 * UTMパラメータ等の文字列サニタイズ（英数字、ハイフン、アンダースコア、ピリオドのみ許可、最大50文字）
 */
export function sanitizeUtmParam(rawParam?: string | null, maxLength = 50): string | null {
  if (!rawParam) return null;
  const trimmed = rawParam.trim();
  if (!trimmed) return null;
  // 安全な文字（英数字、ハイフン、アンダースコア、英字）のみ抽出し長さを制限
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, maxLength);
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * テキスト入力の安全なサニタイズ（HTMLタグ除去・空白正規化・長さ制限）
 */
export function sanitizeText(input?: string | null, maxLength = 255): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // 不正なHTMLタグ開始・終了文字を除去
    .trim()
    .slice(0, maxLength);
}

/**
 * メールアドレスの簡易形式チェック
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 255) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
