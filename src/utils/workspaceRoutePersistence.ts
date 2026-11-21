import type { UnifiedNavTab } from '../components/UnifiedNavbar';

export const SESSION_WORKSPACE_ROUTE_KEY = 'mst_active_workspace_route_v1';
export const LOCAL_WORKSPACE_ROUTE_KEY = 'mst_last_workspace_route_v1';
export const LOCAL_ROUTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PersistedWorkspaceRoute {
  tab: UnifiedNavTab;
  acquisitionTargetTab?: string;
  inboxTargetChannel?: 'line' | 'email' | 'forms';
  customerWorkspaceContext?: Record<string, any>;
  savedAt: number;
}

const VALID_WORKSPACE_TABS = new Set<string>([
  'mst_dashboard',
  'inbox_hub',
  'inflow_dashboard',
  'unified_calendar',
  'mst_diagnoses',
  'deal_invitations',
  'customer_meeting_invitations',
  'communication_send',
  'ai_acquisition',
  'marketing_automation',
  'custom_lists',
  'customer_operations',
  'document_templates',
  'companies',
  'contacts',
  'prospects',
  'leads',
  'products',
  'deals',
  'customers',
  'product_hub',
  'category_hub',
  'automations',
  'ai_dashboard',
  'ai_chat',
  'ai_projects',
  'ai_tasks',
  'ai_approvals',
  'ai_presets',
  'ai_knowledge',
]);

export function normalizeWorkspaceTab(rawTab: string | null | undefined): UnifiedNavTab | null {
  if (!rawTab || typeof rawTab !== 'string') return null;
  const trimmed = rawTab.trim();
  if (!trimmed) return null;
  if (trimmed === 'ai_dashboard') return 'mst_dashboard';
  if (trimmed === 'diagnoses') return 'mst_diagnoses';
  if (VALID_WORKSPACE_TABS.has(trimmed)) {
    return trimmed as UnifiedNavTab;
  }
  return null;
}

function normalizeRoutePayload(raw: unknown): PersistedWorkspaceRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const tab = normalizeWorkspaceTab(typeof obj.tab === 'string' ? obj.tab : null);
  if (!tab) return null;
  const inboxTargetChannel =
    obj.inboxTargetChannel === 'line' ||
    obj.inboxTargetChannel === 'email' ||
    obj.inboxTargetChannel === 'forms'
      ? obj.inboxTargetChannel
      : undefined;
  const acquisitionTargetTab =
    typeof obj.acquisitionTargetTab === 'string' && obj.acquisitionTargetTab.trim()
      ? obj.acquisitionTargetTab
      : undefined;
  const customerWorkspaceContext =
    obj.customerWorkspaceContext && typeof obj.customerWorkspaceContext === 'object'
      ? (obj.customerWorkspaceContext as Record<string, any>)
      : undefined;
  const savedAt = typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt) ? obj.savedAt : Date.now();
  return {
    tab,
    acquisitionTargetTab,
    inboxTargetChannel,
    customerWorkspaceContext,
    savedAt,
  };
}

export function buildWorkspaceUrlWithTab(currentHref: string, tab: UnifiedNavTab): string {
  try {
    const url = new URL(currentHref);
    url.searchParams.set('tab', tab);
    return url.toString();
  } catch {
    return currentHref;
  }
}

export function buildWorkspaceUrlWithoutTab(currentHref: string): string {
  try {
    const url = new URL(currentHref);
    url.searchParams.delete('tab');
    return url.toString();
  } catch {
    return currentHref;
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ResolveRouteOptions {
  href?: string;
  historyState?: unknown;
  sessionStorage?: StorageLike | null;
  localStorage?: StorageLike | null;
  now?: number;
}

export function resolveInitialWorkspaceRoute(options?: ResolveRouteOptions): PersistedWorkspaceRoute {
  const now = options?.now ?? Date.now();
  const href = options?.href ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  const historyState =
    options?.historyState !== undefined
      ? options.historyState
      : typeof window !== 'undefined'
        ? window.history.state
        : null;
  const sStorage =
    options?.sessionStorage !== undefined
      ? options.sessionStorage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  const lStorage =
    options?.localStorage !== undefined
      ? options.localStorage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  let sessionRoute: PersistedWorkspaceRoute | null = null;
  if (sStorage) {
    try {
      const raw = sStorage.getItem(SESSION_WORKSPACE_ROUTE_KEY);
      if (raw) sessionRoute = normalizeRoutePayload(JSON.parse(raw));
    } catch {
      sessionRoute = null;
    }
  }

  let localRoute: PersistedWorkspaceRoute | null = null;
  if (lStorage) {
    try {
      const raw = lStorage.getItem(LOCAL_WORKSPACE_ROUTE_KEY);
      if (raw) {
        const parsed = normalizeRoutePayload(JSON.parse(raw));
        if (parsed && now - parsed.savedAt <= LOCAL_ROUTE_MAX_AGE_MS) {
          localRoute = parsed;
        }
      }
    } catch {
      localRoute = null;
    }
  }

  const historyRoute =
    historyState && typeof historyState === 'object' && (historyState as Record<string, unknown>).mst
      ? normalizeRoutePayload(historyState)
      : null;

  // 1. Explicit URL ?tab=...
  try {
    const url = new URL(href);
    const urlTab = normalizeWorkspaceTab(url.searchParams.get('tab'));
    if (urlTab) {
      const matchingContext =
        (historyRoute && historyRoute.tab === urlTab ? historyRoute : null) ||
        (sessionRoute && sessionRoute.tab === urlTab ? sessionRoute : null) ||
        (localRoute && localRoute.tab === urlTab ? localRoute : null);
      return {
        tab: urlTab,
        acquisitionTargetTab: matchingContext?.acquisitionTargetTab,
        inboxTargetChannel: matchingContext?.inboxTargetChannel,
        customerWorkspaceContext: matchingContext?.customerWorkspaceContext,
        savedAt: now,
      };
    }
  } catch {
    // ignore malformed href
  }

  // 2. History state (if it has a non-default tab or matches session/local)
  if (historyRoute) {
    // Note: if historyRoute.tab stayed at default 'mst_dashboard' due to a previous non-history transition,
    // prefer a fresher sessionRoute if sessionRoute recorded a non-dashboard tab.
    if (historyRoute.tab !== 'mst_dashboard' || !sessionRoute) {
      return historyRoute;
    }
  }

  // 3. Same-tab sessionStorage (survives reload / tab discard / vite preloadError reload)
  if (sessionRoute) {
    return sessionRoute;
  }

  // 4. Recent localStorage (survives iframe reload / container wake-up)
  if (localRoute) {
    return localRoute;
  }

  return { tab: 'mst_dashboard', savedAt: now };
}

export function persistWorkspaceRoute(
  route: Omit<PersistedWorkspaceRoute, 'savedAt'> & { savedAt?: number },
  options?: { sessionStorage?: StorageLike | null; localStorage?: StorageLike | null }
): PersistedWorkspaceRoute {
  const normalized: PersistedWorkspaceRoute = {
    tab: normalizeWorkspaceTab(route.tab) || 'mst_dashboard',
    acquisitionTargetTab: route.acquisitionTargetTab,
    inboxTargetChannel: route.inboxTargetChannel,
    customerWorkspaceContext: route.customerWorkspaceContext,
    savedAt: route.savedAt ?? Date.now(),
  };

  const sStorage =
    options?.sessionStorage !== undefined
      ? options.sessionStorage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  const lStorage =
    options?.localStorage !== undefined
      ? options.localStorage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  const serialized = JSON.stringify(normalized);
  if (sStorage) {
    try {
      sStorage.setItem(SESSION_WORKSPACE_ROUTE_KEY, serialized);
    } catch {
      // ignore storage quota errors
    }
  }
  if (lStorage) {
    try {
      lStorage.setItem(LOCAL_WORKSPACE_ROUTE_KEY, serialized);
    } catch {
      // ignore storage quota errors
    }
  }
  return normalized;
}

export function clearPersistedWorkspaceRoute(options?: {
  sessionStorage?: StorageLike | null;
  localStorage?: StorageLike | null;
}): void {
  const sStorage =
    options?.sessionStorage !== undefined
      ? options.sessionStorage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  const lStorage =
    options?.localStorage !== undefined
      ? options.localStorage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (sStorage) {
    try {
      sStorage.removeItem(SESSION_WORKSPACE_ROUTE_KEY);
    } catch {}
  }
  if (lStorage) {
    try {
      lStorage.removeItem(LOCAL_WORKSPACE_ROUTE_KEY);
    } catch {}
  }
  if (typeof window !== 'undefined' && !options?.sessionStorage && !options?.localStorage) {
    try {
      const nextUrl = buildWorkspaceUrlWithoutTab(window.location.href);
      if (nextUrl !== window.location.href) {
        window.history.replaceState(window.history.state, '', nextUrl);
      }
    } catch {}
  }
}
