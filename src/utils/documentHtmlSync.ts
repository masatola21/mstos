/**
 * Utilities for keeping DocumentTemplateView's form fields (項目フォーム) and
 * WYSIWYG direct HTML edits (本文を直接編集) synchronized without losing
 * custom text edits or breaking form updates.
 */

export function hasDocVarMarkers(html: string | null | undefined): boolean {
  if (!html) return false;
  return /data-doc-var=["'][a-zA-Z0-9_]+["']/.test(html);
}

export function wrapDocVarHtml(key: string, formattedHtmlValue: string): string {
  if (!key || key === 'apply_url') return formattedHtmlValue;
  return `<span data-doc-var="${key}">${formattedHtmlValue}</span>`;
}

/**
 * Updates only the specified variable keys inside an existing custom HTML string
 * that contains `<span data-doc-var="key">...</span>` markers, leaving all other
 * direct text/styling edits intact.
 */
export function patchDocVarHtml(
  html: string,
  updates: Record<string, string>,
  formatValue: (key: string, rawVal: string) => string,
): { html: string; updatedCount: number; hasMarkers: boolean } {
  const keys = Object.keys(updates);
  const markersPresent = hasDocVarMarkers(html);
  if (!html || !markersPresent || keys.length === 0) {
    return { html, updatedCount: 0, hasMarkers: markersPresent };
  }

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes = doc.body.querySelectorAll('[data-doc-var]');
    let updatedCount = 0;
    nodes.forEach((node) => {
      const key = node.getAttribute('data-doc-var');
      if (!key || !(key in updates)) return;
      const nextHtml = formatValue(key, updates[key] ?? '');
      if (node.innerHTML !== nextHtml) {
        node.innerHTML = nextHtml;
        updatedCount += 1;
      }
    });
    return {
      html: doc.body.innerHTML,
      updatedCount,
      hasMarkers: nodes.length > 0,
    };
  }

  // Fallback for Node/SSR test environments without DOMParser
  let result = html;
  let updatedCount = 0;
  for (const key of keys) {
    const tokenPattern = new RegExp(
      `(<span\\b[^>]*\\bdata-doc-var=["']${key}["'][^>]*>)([\\s\\S]*?)(</span>)`,
      'g',
    );
    const nextInner = formatValue(key, updates[key] ?? '');
    result = result.replace(tokenPattern, (_full, openTag: string, prevInner: string, closeTag: string) => {
      if (prevInner !== nextInner) {
        updatedCount += 1;
      }
      return `${openTag}${nextInner}${closeTag}`;
    });
  }
  return { html: result, updatedCount, hasMarkers: markersPresent };
}

/**
 * Extracts plain-text values from `<span data-doc-var="key">` elements inside
 * an HTML container (e.g., contentEditable editor or saved document HTML).
 */
export function extractDocVarTextFromElement(root: ParentNode): Record<string, string> {
  const extracted: Record<string, string> = {};
  const nodes = root.querySelectorAll('[data-doc-var]');
  nodes.forEach((node) => {
    const key = node.getAttribute('data-doc-var');
    if (!key) return;
    const text = (node as HTMLElement).innerText ?? node.textContent ?? '';
    extracted[key] = text;
  });
  return extracted;
}

export function extractDocVarTextFromHtml(html: string): Record<string, string> {
  if (!html || !hasDocVarMarkers(html)) return {};
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return extractDocVarTextFromElement(doc.body);
  }
  const extracted: Record<string, string> = {};
  const regex = /<span\b[^>]*\bdata-doc-var=["']([a-zA-Z0-9_]+)["'][^>]*>([\s\S]*?)<\/span>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    extracted[match[1]] = match[2].replace(/<[^>]+>/g, '');
  }
  return extracted;
}
