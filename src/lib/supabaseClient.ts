import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'mst_supabase_url';
const STORAGE_KEY_KEY = 'mst_supabase_key';

export interface SupabaseConfigInfo {
  url: string;
  key: string;
  isConfigured: boolean;
  isFromEnv: boolean;
  error?: string;
}

// Supabase Project URLの正規化と自動補正
export function normalizeSupabaseUrl(rawUrl: string): { url: string; error?: string } {
  if (!rawUrl) return { url: '', error: 'URLが入力されていません。' };
  let trimmed = rawUrl.trim();

  // ダッシュボードURL（https://supabase.com/dashboard/project/xxxx）を貼り付けてしまった場合の自動修正
  const dashboardMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    const projectRef = dashboardMatch[1];
    return { url: `https://${projectRef}.supabase.co` };
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    // Supabase JS クライアントは必ずオリジン (https://xxx.supabase.co) を要求するため、
    // /rest/v1, /auth/v1 などの余計なパスや末尾スラッシュを自動除去
    return { url: parsed.origin };
  } catch {
    return { url: trimmed, error: 'URLの形式が正しくありません。' };
  }
}

// 安全性チェック: service_role や secret キーの混入をブロック
export function validatePublishableKey(key: string): { valid: boolean; reason?: string } {
  if (!key) return { valid: false, reason: 'キーが指定されていません' };
  const trimmed = key.trim();
  if (trimmed.toLowerCase().includes('service_role')) {
    return {
      valid: false,
      reason: '危険: service_roleキーが検出されました。本アプリはフロントエンドのため、必ず公開用(anon/publishable)キーを使用してください。'
    };
  }
  if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('secret_')) {
    return {
      valid: false,
      reason: '危険: シークレットキーが検出されました。必ず公開用(anon/publishable)キーを使用してください。'
    };
  }
  return { valid: true };
}

export function getSupabaseConfig(): SupabaseConfigInfo {
  // 1. 環境変数の確認 (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を最優先)
  const envUrlRaw = (
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const envKey = (
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  const envUrl = envUrlRaw ? normalizeSupabaseUrl(envUrlRaw).url : '';

  if (envUrl && envKey) {
    const keyValidation = validatePublishableKey(envKey);
    if (!keyValidation.valid) {
      return {
        url: envUrl,
        key: '',
        isConfigured: false,
        isFromEnv: true,
        error: keyValidation.reason,
      };
    }
    return {
      url: envUrl,
      key: envKey,
      isConfigured: true,
      isFromEnv: true,
    };
  }

  // 2. ブラウザローカル設定（環境変数が未注入の場合のフォールバック）
  if (typeof window !== 'undefined') {
    const storedUrlRaw = (sessionStorage.getItem(STORAGE_KEY_URL) || localStorage.getItem(STORAGE_KEY_URL) || '').trim();
    const storedKey = (sessionStorage.getItem(STORAGE_KEY_KEY) || localStorage.getItem(STORAGE_KEY_KEY) || '').trim();
    const storedUrl = storedUrlRaw ? normalizeSupabaseUrl(storedUrlRaw).url : '';

    if (storedUrl && storedKey) {
      const keyValidation = validatePublishableKey(storedKey);
      if (!keyValidation.valid) {
        return {
          url: storedUrl,
          key: '',
          isConfigured: false,
          isFromEnv: false,
          error: keyValidation.reason,
        };
      }
      return {
        url: storedUrl,
        key: storedKey,
        isConfigured: true,
        isFromEnv: false,
      };
    }
  }

  return {
    url: envUrl || '',
    key: envKey || '',
    isConfigured: false,
    isFromEnv: false,
  };
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.key) {
    return null;
  }

  if (cachedClient && lastUsedUrl === config.url && lastUsedKey === config.key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastUsedUrl = config.url;
    lastUsedKey = config.key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    return null;
  }
}

export function saveCustomConfig(url: string, key: string, persist = true) {
  const normalized = normalizeSupabaseUrl(url);
  if (normalized.error) {
    throw new Error(normalized.error);
  }
  const cleanUrl = normalized.url;
  const trimmedKey = key.trim();
  const validation = validatePublishableKey(trimmedKey);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (persist) {
    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
    localStorage.setItem(STORAGE_KEY_KEY, trimmedKey);
  } else {
    sessionStorage.setItem(STORAGE_KEY_URL, cleanUrl);
    sessionStorage.setItem(STORAGE_KEY_KEY, trimmedKey);
  }
  cachedClient = null;
  lastUsedUrl = '';
  lastUsedKey = '';
}

export function clearCustomConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  sessionStorage.removeItem(STORAGE_KEY_URL);
  sessionStorage.removeItem(STORAGE_KEY_KEY);
  cachedClient = null;
  lastUsedUrl = '';
  lastUsedKey = '';
}
