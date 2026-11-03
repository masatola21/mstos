
export interface PlaceholderDefinition {
  key: string;
  label: string;
  description: string;
  sampleValue: string;
  enKey?: string;
  aliases?: readonly string[];
}

/**
 * ユーザー向けに表示・挿入する標準の差し込み変数定義（日本語推奨）
 * 後方互換のため、英語キー（{recipient_name} 等）も自動で同じ値に解決されます。
 */
export const PLACEHOLDER_DEFS: readonly PlaceholderDefinition[] = [
  {
    key: 'お名前',
    label: 'お名前',
    enKey: 'recipient_name',
    description: '宛先の氏名（例: 山田 太郎 様）',
    sampleValue: '山田 太郎',
    aliases: ['氏名', '宛名', 'recipient_name', 'name'],
  },
  {
    key: '会社名',
    label: '会社名',
    enKey: 'company_name',
    description: '会社名・企業名（例: 株式会社サンプル）',
    sampleValue: '株式会社サンプル',
    aliases: ['企業名', '法人名', 'company_name'],
  },
  {
    key: '書類名',
    label: '書類名',
    enKey: 'document_title',
    description: '選択した書類・診断レポートのタイトル',
    sampleValue: 'ご提案書',
    aliases: ['タイトル', 'document_title'],
  },
  {
    key: '面談予約URL',
    label: '面談予約URL',
    enKey: 'booking_url',
    description: 'Google面談予約ページのURL（日程調整）',
    sampleValue: 'https://example.com/booking',
    aliases: ['予約URL', '日程調整URL', 'booking_url'],
  },
  {
    key: '案内URL',
    label: '案内URL',
    enKey: 'link_url',
    description: '診断・フォーム・専用案内URL',
    sampleValue: 'https://example.com/form',
    aliases: ['リンクURL', '診断URL', 'フォームURL', 'link_url'],
  },
  {
    key: '書類URL',
    label: '書類URL',
    enKey: 'document_url',
    description: '最新書類・レポートの確認URL',
    sampleValue: 'https://example.com/docs/doc_123',
    aliases: ['レポートURL', '共有URL', 'document_url'],
  },
  {
    key: '資料URL',
    label: '資料URL',
    enKey: 'material_url',
    description: 'フォーム定義の配布資料URL',
    sampleValue: 'https://example.com/materials/guide.pdf',
    aliases: ['配布資料URL', 'material_url'],
  },
  {
    key: 'フォーム名',
    label: 'フォーム名',
    enKey: 'form_title',
    description: '診断・フォームの名称',
    sampleValue: '無料相談フォーム',
    aliases: ['診断名', 'form_title'],
  },
  {
    key: '書類本文',
    label: '書類本文',
    enKey: 'document_content',
    description: '書類や契約書の本文テキスト（同意案内用）',
    sampleValue: 'ご提案内容をご確認ください。',
    aliases: ['document_content'],
  },
] as const;

/**
 * 日本語・英語・別名の相互マッピング辞書
 */
export const CANONICAL_ALIAS_MAP: Record<string, string> = {
  // お名前
  'お名前': 'recipient_name',
  '氏名': 'recipient_name',
  '宛名': 'recipient_name',
  'recipient_name': 'recipient_name',
  'name': 'recipient_name',

  // 会社名
  '会社名': 'company_name',
  '企業名': 'company_name',
  '法人名': 'company_name',
  'company_name': 'company_name',

  // 書類名
  '書類名': 'document_title',
  'タイトル': 'document_title',
  'document_title': 'document_title',

  // 書類URL
  '書類URL': 'document_url',
  'レポートURL': 'document_url',
  '共有URL': 'document_url',
  'document_url': 'document_url',

  // 書類本文
  '書類本文': 'document_content',
  'document_content': 'document_content',

  // 面談予約URL
  '面談予約URL': 'booking_url',
  '予約URL': 'booking_url',
  '日程調整URL': 'booking_url',
  'booking_url': 'booking_url',

  // 案内URL
  '案内URL': 'link_url',
  'リンクURL': 'link_url',
  '診断URL': 'link_url',
  'フォームURL': 'link_url',
  'link_url': 'link_url',

  // 資料URL
  '資料URL': 'material_url',
  '配布資料URL': 'material_url',
  'material_url': 'material_url',

  // フォーム名
  'フォーム名': 'form_title',
  '診断名': 'form_title',
  'form_title': 'form_title',
};

/**
 * 日本語と英語の両方のキーでサンプル値を引けるようにマップ
 */
export const PLACEHOLDER_SAMPLE_VALUES: Record<string, string> = {
  'お名前': '山田 太郎',
  '氏名': '山田 太郎',
  '宛名': '山田 太郎',
  'recipient_name': '山田 太郎',
  'name': '山田 太郎',

  '会社名': '株式会社サンプル',
  '企業名': '株式会社サンプル',
  '法人名': '株式会社サンプル',
  'company_name': '株式会社サンプル',

  '書類名': 'ご提案書',
  'タイトル': 'ご提案書',
  'document_title': 'ご提案書',

  '書類URL': 'https://example.com/docs/doc_123',
  'レポートURL': 'https://example.com/docs/doc_123',
  '共有URL': 'https://example.com/docs/doc_123',
  'document_url': 'https://example.com/docs/doc_123',

  '書類本文': 'ご提案内容をご確認ください。',
  'document_content': 'ご提案内容をご確認ください。',

  '面談予約URL': 'https://example.com/booking',
  '予約URL': 'https://example.com/booking',
  '日程調整URL': 'https://example.com/booking',
  'booking_url': 'https://example.com/booking',

  '案内URL': 'https://example.com/form',
  'リンクURL': 'https://example.com/form',
  '診断URL': 'https://example.com/form',
  'フォームURL': 'https://example.com/form',
  'link_url': 'https://example.com/form',

  '資料URL': 'https://example.com/materials/guide.pdf',
  '配布資料URL': 'https://example.com/materials/guide.pdf',
  'material_url': 'https://example.com/materials/guide.pdf',

  'フォーム名': '無料相談フォーム',
  '診断名': '無料相談フォーム',
  'form_title': '無料相談フォーム',
};

const ALL_KNOWN_KEYS = new Set([
  ...Object.keys(CANONICAL_ALIAS_MAP),
]);

export function normalizePlaceholderKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  return CANONICAL_ALIAS_MAP[trimmed] || trimmed;
}

/**
 * テンプレート文字列内の差し込み変数を置換。
 * `{お名前}` でも `{recipient_name}` でも同じように解決されます。
 */
export function renderPlaceholders(text: string, values: Record<string, unknown>): string {
  const normalized: Record<string, unknown> = {};

  // 生の値をセット
  for (const [k, v] of Object.entries(values || {})) {
    normalized[k] = v;
    const canonical = normalizePlaceholderKey(k);
    if (normalized[canonical] === undefined) {
      normalized[canonical] = v;
    }
  }

  // 互換性フォールバック（name <-> recipient_name）
  if (normalized.recipient_name == null && normalized.name != null) normalized.recipient_name = normalized.name;
  if (normalized.name == null && normalized.recipient_name != null) normalized.name = normalized.recipient_name;

  // 日本語の標準キーにもフォールバック
  if (normalized['お名前'] == null && normalized.recipient_name != null) normalized['お名前'] = normalized.recipient_name;
  if (normalized['会社名'] == null && normalized.company_name != null) normalized['会社名'] = normalized.company_name;
  if (normalized['書類名'] == null && normalized.document_title != null) normalized['書類名'] = normalized.document_title;
  if (normalized['書類URL'] == null && normalized.document_url != null) normalized['書類URL'] = normalized.document_url;
  if (normalized['書類本文'] == null && normalized.document_content != null) normalized['書類本文'] = normalized.document_content;
  if (normalized['面談予約URL'] == null && normalized.booking_url != null) normalized['面談予約URL'] = normalized.booking_url;
  if (normalized['案内URL'] == null && normalized.link_url != null) normalized['案内URL'] = normalized.link_url;
  if (normalized['資料URL'] == null && normalized.material_url != null) normalized['資料URL'] = normalized.material_url;
  if (normalized['フォーム名'] == null && normalized.form_title != null) normalized['フォーム名'] = normalized.form_title;

  return String(text ?? '').replace(/\{([^{}\r\n]+)\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (Object.prototype.hasOwnProperty.call(normalized, key) && normalized[key] != null) {
      return String(normalized[key]);
    }
    const canonical = normalizePlaceholderKey(key);
    if (Object.prototype.hasOwnProperty.call(normalized, canonical) && normalized[canonical] != null) {
      return String(normalized[canonical]);
    }
    return match;
  });
}

/**
 * 未知の差し込みキー（タイポなど）を検出
 */
export function findUnknownPlaceholders(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of String(text ?? '').matchAll(/\{([^{}\r\n]+)\}/g)) {
    const key = match[1].trim();
    if (!ALL_KNOWN_KEYS.has(key)) {
      unknown.add(key);
    }
  }
  return [...unknown];
}

/**
 * 含まれる差し込みキーの一覧を取得
 */
export function findUnresolvedPlaceholders(text: string): string[] {
  const matches = new Set<string>();
  for (const match of String(text ?? '').matchAll(/\{([^{}\r\n]+)\}/g)) {
    matches.add(match[1].trim());
  }
  return [...matches];
}

