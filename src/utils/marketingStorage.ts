import { MarketingScenario, OfficialLinkItem } from '../types/marketing';

const STORAGE_KEY = 'mst_marketing_scenarios_v1';
const OFFICIAL_LINKS_KEY = 'mst_marketing_official_links_v2';

export function loadMarketingScenarios(): MarketingScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMarketingScenarios(scenarios: MarketingScenario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
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
