export const WELCOME_MATCH_TEXT = '__welcome__';
export const LEGACY_WELCOME_MATCH_TEXTS = ['友だち追加', 'ウェルカム', 'あいさつ', '挨拶'] as const;
export const ALL_WELCOME_MATCH_TEXTS = [WELCOME_MATCH_TEXT, ...LEGACY_WELCOME_MATCH_TEXTS] as const;

export interface WelcomeRuleCandidate {
  id?: string;
  owner_id?: string | null;
  name?: string | null;
  match_text?: string | null;
  match_mode?: string | null;
  reply_type?: string | null;
  reply_text?: string | null;
  reply_payload?: any;
  tag_id?: string | null;
  priority?: number | null;
  enabled?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export type WelcomeRuleSource =
  | 'welcome_rule'
  | 'welcome_disabled'
  | 'legacy_keyword_rule'
  | 'default_fallback';

export interface WelcomeRuleSelection {
  rule: WelcomeRuleCandidate | null;
  disabled: boolean;
  source: WelcomeRuleSource;
  conflictingLegacyRules: WelcomeRuleCandidate[];
}

function sortRulesByPriorityAndRecency(a: WelcomeRuleCandidate, b: WelcomeRuleCandidate): number {
  const pa = typeof a.priority === 'number' ? a.priority : 100;
  const pb = typeof b.priority === 'number' ? b.priority : 100;
  if (pa !== pb) return pa - pb;
  const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
  const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
}

/**
 * Selects the authoritative LINE welcome rule.
 * Priority:
 * 1. Explicit '__welcome__' rule (from LINE・メール自動配信) for the channel owner
 * 2. Explicit '__welcome__' rule across any owner (guards against multi-admin owner_id drift)
 *    - If an explicit '__welcome__' rule exists with enabled === false, respect disabled state
 *      and do NOT fall back to legacy keyword rules or hardcoded defaults.
 * 3. Enabled legacy keyword rules ('友だち追加', 'ウェルカム', 'あいさつ', '挨拶')
 * 4. Hardcoded default fallback (handled by caller when rule === null && !disabled)
 */
export function selectWelcomeRule(
  candidates: WelcomeRuleCandidate[] | null | undefined,
  ownerId?: string | null
): WelcomeRuleSelection {
  const rows = Array.isArray(candidates) ? candidates : [];
  const welcomeRows = rows.filter((r) => String(r.match_text || '').trim() === WELCOME_MATCH_TEXT);
  const legacyEnabledRows = rows
    .filter(
      (r) =>
        LEGACY_WELCOME_MATCH_TEXTS.includes(String(r.match_text || '').trim() as any) &&
        r.enabled !== false
    )
    .sort((a, b) => {
      const aOwn = ownerId && a.owner_id === ownerId ? 0 : 1;
      const bOwn = ownerId && b.owner_id === ownerId ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      return sortRulesByPriorityAndRecency(a, b);
    });

  const prioritizedWelcome = [...welcomeRows].sort((a, b) => {
    const aOwn = ownerId && a.owner_id === ownerId ? 0 : 1;
    const bOwn = ownerId && b.owner_id === ownerId ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    const aEnabled = a.enabled !== false ? 0 : 1;
    const bEnabled = b.enabled !== false ? 0 : 1;
    if (aEnabled !== bEnabled) return aEnabled - bEnabled;
    return sortRulesByPriorityAndRecency(a, b);
  });

  const explicitWelcome = prioritizedWelcome[0] || null;
  if (explicitWelcome) {
    if (explicitWelcome.enabled === false) {
      return {
        rule: null,
        disabled: true,
        source: 'welcome_disabled',
        conflictingLegacyRules: legacyEnabledRows,
      };
    }
    return {
      rule: explicitWelcome,
      disabled: false,
      source: 'welcome_rule',
      conflictingLegacyRules: legacyEnabledRows,
    };
  }

  if (legacyEnabledRows.length > 0) {
    return {
      rule: legacyEnabledRows[0],
      disabled: false,
      source: 'legacy_keyword_rule',
      conflictingLegacyRules: legacyEnabledRows,
    };
  }

  return {
    rule: null,
    disabled: false,
    source: 'default_fallback',
    conflictingLegacyRules: [],
  };
}

/**
 * Extracts only the Flex message fields sent to LINE Messaging API (altText + contents),
 * ignoring editor/postback metadata like choices, patternA, patternB, editMode so their
 * placeholders (e.g. {q1_label}) or empty optional URLs don't trigger fallback.
 */
export function extractWelcomeFlexTarget(payload: any): { altText: string; contents: any } | null {
  if (!payload || typeof payload !== 'object') return null;
  const contents =
    payload.contents ??
    (payload.type === 'bubble' || payload.type === 'carousel' ? payload : null);
  if (!contents || typeof contents !== 'object') return null;
  const altText =
    typeof payload.altText === 'string' && payload.altText.trim()
      ? payload.altText.trim()
      : '友だち追加ありがとうございます';
  return { altText, contents };
}

/**
 * Sanitizes a Flex Message tree for LINE Messaging API compatibility:
 * - Normalizes button height to 'sm' | 'md'
 * - Removes empty text nodes inside 'contents' arrays (LINE rejects text: "")
 */
export function sanitizeWelcomeFlexNode(node: any): any {
  if (Array.isArray(node)) {
    return node
      .map(sanitizeWelcomeFlexNode)
      .filter((item) => {
        if (item && typeof item === 'object' && item.type === 'text') {
          return typeof item.text === 'string' && item.text.trim().length > 0;
        }
        return item !== undefined && item !== null;
      });
  }
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = sanitizeWelcomeFlexNode(v);
    }
    if (out.type === 'button' && out.height !== undefined && !['sm', 'md'].includes(out.height)) {
      out.height = 'md';
    }
    return out;
  }
  return node;
}

/**
 * Expands canonical message variables with Japanese placeholder aliases used across UI editors.
 */
export function expandMessageVarAliases(baseVars: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = { ...baseVars };
  const aliasPairs: Array<[string, string[]]> = [
    ['recipient_name', ['お名前', '氏名', '宛名', 'name']],
    ['company_name', ['会社名', '企業名', '法人名']],
    ['booking_url', ['面談予約URL', '予約URL', '日程調整URL']],
    ['link_url', ['案内URL', 'リンクURL', '診断URL', 'フォームURL']],
    ['material_url', ['資料URL', '配布資料URL']],
    ['document_url', ['書類URL', 'レポートURL', '共有URL']],
  ];
  for (const [canonical, aliases] of aliasPairs) {
    const value = vars[canonical];
    if (typeof value === 'string') {
      for (const alias of aliases) {
        if (!Object.prototype.hasOwnProperty.call(vars, alias)) {
          vars[alias] = value;
        }
      }
    }
  }
  return vars;
}

export function replaceMessagePlaceholders(text: string, vars: Record<string, string>): string {
  return String(text ?? '').replace(/\{([^{}\r\n]+)\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}
