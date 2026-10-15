import { AIModelSetting, DEFAULT_MODEL_SETTING, sanitizeModelSetting } from '../data/aiModels';
import { RoleAIOverrides, sanitizeRoleOverride } from '../data/aiWorkModes';

export interface AIModelSettings {
  /** 役割・AIに個別設定がないときに使う全体のモデル設定 */
  defaultSetting: AIModelSetting;
  /** 役割AIごとの詳細設定（キーは役割ID） */
  roleOverrides: RoleAIOverrides;
}

const KEY = 'mst_ai_model_settings_v1';

export function defaultAIModelSettings(): AIModelSettings {
  return { defaultSetting: DEFAULT_MODEL_SETTING, roleOverrides: {} };
}

export function loadAIModelSettings(): AIModelSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultAIModelSettings();
    const parsed = JSON.parse(raw);
    const roleOverrides: RoleAIOverrides = {};
    if (parsed && typeof parsed.roleOverrides === 'object' && parsed.roleOverrides) {
      Object.entries(parsed.roleOverrides).forEach(([id, value]) => {
        const clean = sanitizeRoleOverride(value);
        if (Object.keys(clean).length > 0) roleOverrides[id] = clean;
      });
    }
    return {
      defaultSetting: sanitizeModelSetting(parsed?.defaultSetting) ?? DEFAULT_MODEL_SETTING,
      roleOverrides,
    };
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
