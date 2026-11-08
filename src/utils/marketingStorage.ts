import { MarketingScenario, OfficialLinkItem } from '../types/marketing';

const STORAGE_KEY = 'mst_marketing_scenarios_v1';
const OFFICIAL_LINKS_KEY = 'mst_marketing_official_links_v2';

export function deduplicateMarketingScenarios(scenarios: MarketingScenario[]): MarketingScenario[] {
  const map = new Map<string, MarketingScenario>();
  for (const s of scenarios) {
    const key = (s.name || '').trim();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
      map.set(key, s);
    }
  }
  return Array.from(map.values());
}

export function loadMarketingScenarios(): MarketingScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? (parsed as MarketingScenario[]) : [];
    return deduplicateMarketingScenarios(list);
  } catch {
    return [];
  }
}

export function saveMarketingScenarios(scenarios: MarketingScenario[]): void {
  try {
    const deduped = deduplicateMarketingScenarios(scenarios);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
  } catch (error) {
    console.warn('Could not save marketing scenarios locally:', error);
  }
}

export function loadStoredOfficialLinks(): OfficialLinkItem[] | null {
  try {
    const raw = localStorage.getItem(OFFICIAL_LINKS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as OfficialLinkItem[]) : null;
  } catch {
    return null;
  }
}

export function saveStoredOfficialLinks(links: OfficialLinkItem[]): void {
  try {
    localStorage.setItem(OFFICIAL_LINKS_KEY, JSON.stringify(links));
  } catch (error) {
    console.warn('Could not save official links locally:', error);
  }
}

export function clearStoredOfficialLinks(): void {
  try {
    localStorage.removeItem(OFFICIAL_LINKS_KEY);
  } catch (error) {
    console.warn('Could not clear official links locally:', error);
  }
}

const TRACKING_MEDIA_KEY_V1 = 'mst_marketing_tracking_media_v1';
const TRACKING_MEDIA_KEY = 'mst_marketing_tracking_media_v2';

export function loadStoredTrackingMedia<T extends { isCustom?: boolean }>(defaultPresets?: T[]): T[] | null {
  try {
    const rawV2 = localStorage.getItem(TRACKING_MEDIA_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T[];
      }
    }

    // v1 からの自動マイグレーション: ユーザー追加の独自媒体 (isCustom: true) を保持し、新初期プリセットとマージ
    const rawV1 = localStorage.getItem(TRACKING_MEDIA_KEY_V1);
    if (rawV1) {
      try {
        const parsedV1 = JSON.parse(rawV1);
        if (Array.isArray(parsedV1)) {
          const customItems = parsedV1.filter((item: any) => item && item.isCustom === true) as T[];
          const merged = defaultPresets ? [...defaultPresets, ...customItems] : customItems;
          if (merged.length > 0) {
            saveStoredTrackingMedia(merged);
            return merged;
          }
        }
      } catch {}
    }

    return null;
  } catch {
    return null;
  }
}

export function saveStoredTrackingMedia<T>(media: T[]): void {
  try {
    localStorage.setItem(TRACKING_MEDIA_KEY, JSON.stringify(media));
  } catch (error) {
    console.warn('Could not save tracking media locally:', error);
  }
}

export function clearStoredTrackingMedia(): void {
  try {
    localStorage.removeItem(TRACKING_MEDIA_KEY);
    localStorage.removeItem(TRACKING_MEDIA_KEY_V1);
  } catch (error) {
    console.warn('Could not clear tracking media locally:', error);
  }
}

