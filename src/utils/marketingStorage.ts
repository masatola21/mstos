import { MarketingScenario, OfficialLinkItem } from '../types/marketing';

const STORAGE_KEY = 'mst_marketing_scenarios_v1';
const OFFICIAL_LINKS_KEY = 'mst_marketing_official_links_v2';

const OFFICIAL_STORY_EPISODE_NAMES: Record<number, string> = {
  1: '【第1話】大橋の原体験：FC本部突然倒産の危機',
  2: '【第2話】最初に仕組み化した2大業務（管理＆集客）',
  3: '【第3話】何から手をつければいいか？3つのステップ',
  4: '【第4話】よくある失敗と4段階ロードマップ',
  5: '【第5話】人を増やさず回る会社へ（仕組み化は始まり）',
  6: '【第6話】システム屋でもコンサル屋でもない「経営の右腕」',
  7: '【第7話・最終話】「自分がいなくても回る会社」への最初の一歩',
};

export function extractEducationEpisodeNumber(scenario: Pick<MarketingScenario, 'name' | 'trigger'>): number | null {
  if (scenario.trigger !== 'line_registered') return null;
  const trimmed = (scenario.name || '').trim();
  const m = /^【第([1-7])話(?:[・\s]*最終話)?】/.exec(trimmed);
  return m ? parseInt(m[1], 10) : null;
}

export function getScenarioDedupKey(scenario: Pick<MarketingScenario, 'name' | 'trigger'>): string {
  const ep = extractEducationEpisodeNumber(scenario);
  if (ep !== null) return `story_episode:${ep}`;
  return `name:${(scenario.name || '').trim()}`;
}

function shouldPreferIncomingScenario(existing: MarketingScenario, incoming: MarketingScenario, ep: number | null): boolean {
  if (ep !== null) {
    const officialName = OFFICIAL_STORY_EPISODE_NAMES[ep];
    const existingIsOfficial = (existing.name || '').trim() === officialName;
    const incomingIsOfficial = (incoming.name || '').trim() === officialName;
    if (incomingIsOfficial !== existingIsOfficial) return incomingIsOfficial;
    if (Boolean(incoming.automationEnabled) !== Boolean(existing.automationEnabled)) {
      return Boolean(incoming.automationEnabled);
    }
  }
  return (incoming.updatedAt || 0) >= (existing.updatedAt || 0);
}

export function deduplicateMarketingScenarios(scenarios: MarketingScenario[]): MarketingScenario[] {
  const map = new Map<string, MarketingScenario>();
  for (const s of scenarios) {
    const trimmedName = (s.name || '').trim();
    if (!trimmedName) continue;
    const ep = extractEducationEpisodeNumber(s);
    const key = ep !== null ? `story_episode:${ep}` : `name:${trimmedName}`;
    const existing = map.get(key);
    if (!existing || shouldPreferIncomingScenario(existing, s, ep)) {
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

export const OFFICIAL_VERCEL_URLS = {
  diagnosis: 'https://corp.mstcorp.info/diagnosis',
  care_consult: 'https://business.mstcorp.info/',
  material_download: 'https://corp.mstcorp.info/materials',
  media_top: 'https://corp.mstcorp.info/',
} as const;

export function upgradeLegacyMstUrl(rawUrl: string, linkId?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return trimmed;

  const isLegacyInternalHost =
    /\.run\.app\b/i.test(trimmed) ||
    /mstos\.app\b/i.test(trimmed) ||
    /^https?:\/\/localhost(?::\d+)?\//i.test(trimmed) ||
    trimmed.startsWith('/');

  // Preserve query parameters (such as utm_* or cid) when upgrading path-known legacy URLs
  const extractQuery = (u: string): string => {
    const qIndex = u.indexOf('?');
    return qIndex >= 0 ? u.slice(qIndex) : '';
  };

  if (/\/(?:f|forms)\/business-diagnosis(?:\/|$|\?)/i.test(trimmed) || (linkId === 'diagnosis' && isLegacyInternalHost)) {
    return `${OFFICIAL_VERCEL_URLS.diagnosis}${extractQuery(trimmed)}`;
  }
  if (/\/(?:f|forms)\/care-package-inquiry(?:\/|$|\?)/i.test(trimmed) || (linkId === 'care_consult' && isLegacyInternalHost)) {
    return `${OFFICIAL_VERCEL_URLS.care_consult}${extractQuery(trimmed)}`;
  }
  if (/\/(?:f|forms)\/material-download(?:\/|$|\?)/i.test(trimmed) || (linkId === 'material_download' && isLegacyInternalHost)) {
    return `${OFFICIAL_VERCEL_URLS.material_download}${extractQuery(trimmed)}`;
  }
  if (linkId === 'media_top' && isLegacyInternalHost) {
    return `${OFFICIAL_VERCEL_URLS.media_top}${extractQuery(trimmed)}`;
  }
  return trimmed;
}

export function migrateOfficialLinks(links: OfficialLinkItem[]): { links: OfficialLinkItem[]; changed: boolean } {
  if (!Array.isArray(links) || links.length === 0) {
    return { links: [], changed: false };
  }
  let changed = false;
  const migrated = links.map((item) => {
    const upgradedUrl = upgradeLegacyMstUrl(item.url, item.id);
    if (upgradedUrl && upgradedUrl !== item.url) {
      changed = true;
      return { ...item, url: upgradedUrl };
    }
    return item;
  });
  return { links: migrated, changed };
}

export function loadStoredOfficialLinks(): OfficialLinkItem[] | null {
  try {
    const raw = localStorage.getItem(OFFICIAL_LINKS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const { links, changed } = migrateOfficialLinks(parsed as OfficialLinkItem[]);
    if (changed) {
      saveStoredOfficialLinks(links);
    }
    return links;
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


