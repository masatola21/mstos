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
const TRACKING_MEDIA_KEY_V2 = 'mst_marketing_tracking_media_v2';
const TRACKING_MEDIA_KEY_V3 = 'mst_marketing_tracking_media_v3';

export const ROUND6_DEFAULT_PRESET_IDS = ['hp_blog', 'sns', 'line', 'email', 'material'];
const OLD_DEFAULT_PRESET_IDS = [
  'note',
  'x_twitter',
  'instagram',
  'line_broadcast',
  'flyer_qr',
  'meta_ads',
  'google_ads',
  'youtube',
  'newsletter',
  'partner',
];

export function migrateTrackingMediaList<T extends { id: string; utmSource?: string; name?: string; isCustom?: boolean }>(
  items: T[],
  defaultPresets?: T[]
): T[] {
  if (!Array.isArray(items) || items.length === 0) {
    return defaultPresets ? [...defaultPresets] : [];
  }

  // 1. 旧10媒体プリセット（note, x_twitter, line_broadcast 等）が含まれており、新コア媒体（hp_blog, sns等）が無い場合の自動移行
  const hasOldDefaults = items.some((item) => OLD_DEFAULT_PRESET_IDS.includes(item.id) && !item.isCustom);
  const hasNewCorePresets = items.some((item) => (item.id === 'hp_blog' || item.id === 'sns') && !item.isCustom);

  if (hasOldDefaults && !hasNewCorePresets && defaultPresets) {
    const customItems = items
      .filter((item) => item.isCustom === true)
      .map((item) => {
        if (item.id === 'line_broadcast' || item.utmSource === 'line_broadcast') {
          return { ...item, id: 'line', utmSource: 'line' };
        }
        return item;
      });
    return [...defaultPresets, ...customItems];
  }

  // 2. line_broadcast を line に正規化
  let normalized = items.map((item) => {
    if (item.id === 'line_broadcast' || item.utmSource === 'line_broadcast') {
      return {
        ...item,
        id: 'line',
        utmSource: 'line',
        name: item.name?.includes('LINE') ? item.name : 'LINE（配信・リッチメニュー）',
      };
    }
    return item;
  });

  // 3. 重複IDの排除
  const seenIds = new Set<string>();
  return normalized.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
}

export function loadStoredTrackingMedia<T extends { id: string; utmSource?: string; name?: string; isCustom?: boolean }>(
  defaultPresets?: T[]
): T[] | null {
  try {
    const rawV3 = localStorage.getItem(TRACKING_MEDIA_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return migrateTrackingMediaList(parsed as T[], defaultPresets);
      }
    }

    // v2 / v1 からの自動マイグレーション
    const rawV2 = localStorage.getItem(TRACKING_MEDIA_KEY_V2) || localStorage.getItem(TRACKING_MEDIA_KEY_V1);
    if (rawV2) {
      try {
        const parsedOld = JSON.parse(rawV2);
        if (Array.isArray(parsedOld) && parsedOld.length > 0) {
          const migrated = migrateTrackingMediaList(parsedOld as T[], defaultPresets);
          if (migrated.length > 0) {
            saveStoredTrackingMedia(migrated);
            return migrated;
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
    localStorage.setItem(TRACKING_MEDIA_KEY_V3, JSON.stringify(media));
  } catch (error) {
    console.warn('Could not save tracking media locally:', error);
  }
}

export function clearStoredTrackingMedia(): void {
  try {
    localStorage.removeItem(TRACKING_MEDIA_KEY_V3);
    localStorage.removeItem(TRACKING_MEDIA_KEY_V2);
    localStorage.removeItem(TRACKING_MEDIA_KEY_V1);
  } catch (error) {
    console.warn('Could not clear tracking media locally:', error);
  }
}


