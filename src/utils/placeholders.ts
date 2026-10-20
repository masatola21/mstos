export interface PlaceholderDefinition {
  key: string;
  description: string;
  sampleValue: string;
}

export const PLACEHOLDER_DEFS: readonly PlaceholderDefinition[] = [
  { key: 'recipient_name', description: '宛先の氏名', sampleValue: '山田 太郎' },
  { key: 'company_name', description: '会社名', sampleValue: '株式会社サンプル' },
  { key: 'form_title', description: 'フォーム名', sampleValue: '無料相談フォーム' },
  { key: 'document_title', description: '書類名', sampleValue: 'ご提案書' },
  { key: 'document_url', description: '書類URL', sampleValue: 'https://example.com/documents/proposal' },
  { key: 'document_content', description: '書類本文', sampleValue: 'ご提案内容をご確認ください。' },
  { key: 'name', description: '宛先の氏名（recipient_name の互換別名）', sampleValue: '山田 太郎' },
  { key: 'link_url', description: 'フォーム・予約URL（既存テンプレート互換）', sampleValue: 'https://example.com/form' },
] as const;

export const PLACEHOLDER_SAMPLE_VALUES: Record<string, string> = Object.fromEntries(
  PLACEHOLDER_DEFS.map(({ key, sampleValue }) => [key, sampleValue]),
);

const PLACEHOLDER_KEYS = new Set(PLACEHOLDER_DEFS.map(({ key }) => key));

export function renderPlaceholders(text: string, values: Record<string, unknown>): string {
  const normalizedValues = { ...values };
  if (normalizedValues.recipient_name == null && normalizedValues.name != null) normalizedValues.recipient_name = normalizedValues.name;
  if (normalizedValues.name == null && normalizedValues.recipient_name != null) normalizedValues.name = normalizedValues.recipient_name;
  return String(text ?? '').replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(normalizedValues, key)) return match;
    const value = normalizedValues[key];
    return value == null ? '' : String(value);
  });
}

export function findUnknownPlaceholders(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(/\{([a-z_]+)\}/g)) {
    if (!PLACEHOLDER_KEYS.has(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}
