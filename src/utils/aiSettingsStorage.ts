import { AIModelSetting, DEFAULT_MODEL_SETTING, sanitizeModelSetting } from '../data/aiModels';
import { RoleAIOverrides, sanitizeRoleOverride } from '../data/aiWorkModes';

export interface AIModelSettings {
  /** 役割・AIに個別設定がないときに使う全体のモデル設定 */
  defaultSetting: AIModelSetting;
  /** 役割AIごとの詳細設定（キーは役割ID） */
  roleOverrides: RoleAIOverrides;
  /** デフォルトモデル設定の更新タイムスタンプ(ms) */
  defaultSettingUpdatedAt?: number;
}

const KEY = 'mst_ai_model_settings_v1';

export function defaultAIModelSettings(): AIModelSettings {
  return { defaultSetting: DEFAULT_MODEL_SETTING, roleOverrides: {} };
}

export function hasLocalAIModelSettingsCache(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function normalizeAIModelSettings(raw: unknown): AIModelSettings {
  if (!raw || typeof raw !== 'object') return defaultAIModelSettings();
  const parsed = raw as Record<string, unknown>;
  const roleOverrides: RoleAIOverrides = {};
  if (parsed.roleOverrides && typeof parsed.roleOverrides === 'object') {
    Object.entries(parsed.roleOverrides as Record<string, unknown>).forEach(([id, value]) => {
      const clean = sanitizeRoleOverride(value);
      // updatedAt のみ残っている空設定は除外する
      const hasEffectiveField = Object.keys(clean).some((k) => k !== 'updatedAt');
      if (hasEffectiveField) roleOverrides[id] = clean;
    });
  }
  const result: AIModelSettings = {
    defaultSetting: sanitizeModelSetting(parsed.defaultSetting) ?? DEFAULT_MODEL_SETTING,
    roleOverrides,
  };
  if (
    typeof parsed.defaultSettingUpdatedAt === 'number' &&
    Number.isFinite(parsed.defaultSettingUpdatedAt) &&
    parsed.defaultSettingUpdatedAt > 0
  ) {
    result.defaultSettingUpdatedAt = parsed.defaultSettingUpdatedAt;
  }
  return result;
}

export function loadAIModelSettings(): AIModelSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultAIModelSettings();
    return normalizeAIModelSettings(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load AI model settings', error);
    return defaultAIModelSettings();
  }
}

export function saveAIModelSettings(settings: AIModelSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save AI model settings', error);
  }
}
