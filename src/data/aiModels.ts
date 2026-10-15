// AIモデル接続先の共通定義（フロントエンドとサーバーの両方から使う）。
// APIキーはここには一切置かない。キーはサーバーの環境変数でのみ管理する。

export type AIProviderId = 'gemini' | 'groq' | 'openrouter';

export interface AIModelTarget {
  provider: AIProviderId;
  model: string;
}

export interface AIModelSetting {
  primary: AIModelTarget;
  /** 主モデルが失敗した場合に順番に試す切り替え先（最大2件） */
  fallbacks: AIModelTarget[];
}

export interface AIProviderInfo {
  id: AIProviderId;
  label: string;
  envKey: string;
  suggestedModels: string[];
  pricingUrl: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    suggestedModels: ['gemini-3.8-flash'],
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    suggestedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    pricingUrl: 'https://console.groq.com/docs/rate-limits',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    suggestedModels: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free'],
    pricingUrl: 'https://openrouter.ai/pricing',
  },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AIProviderId[];
export const MAX_FALLBACKS = 2;

export const DEFAULT_MODEL_SETTING: AIModelSetting = {
  primary: { provider: 'gemini', model: 'gemini-3.8-flash' },
  fallbacks: [],
};

const MODEL_NAME_PATTERN = /^[A-Za-z0-9._:/\-]{1,120}$/;

export function isProviderId(value: unknown): value is AIProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as string[]).includes(value);
}

export function sanitizeTarget(input: unknown): AIModelTarget | null {
  if (!input || typeof input !== 'object') return null;
  const { provider, model } = input as { provider?: unknown; model?: unknown };
  if (!isProviderId(provider) || typeof model !== 'string') return null;
  const trimmed = model.trim();
  if (!MODEL_NAME_PATTERN.test(trimmed)) return null;
  return { provider, model: trimmed };
}

/** 不正な入力は null を返す。サーバーでもクライアントでも同じ検証を使う。 */
export function sanitizeModelSetting(input: unknown): AIModelSetting | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as { primary?: unknown; fallbacks?: unknown };
  const primary = sanitizeTarget(raw.primary);
  if (!primary) return null;
  const fallbacks = (Array.isArray(raw.fallbacks) ? raw.fallbacks : [])
    .map(sanitizeTarget)
    .filter((target): target is AIModelTarget => target !== null)
    .slice(0, MAX_FALLBACKS);
  return { primary, fallbacks };
}

/** 主モデル→切り替え先の順に、重複を除いた実行順リストを返す。 */
export function buildModelChain(setting: AIModelSetting): AIModelTarget[] {
  const seen = new Set<string>();
  return [setting.primary, ...setting.fallbacks].filter((target) => {
    const key = `${target.provider}:${target.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function describeTarget(target: AIModelTarget): string {
  return `${AI_PROVIDERS[target.provider].label} / ${target.model}`;
}
