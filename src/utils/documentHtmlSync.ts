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
 * Replaces `{{key}}` in template HTML with a `data-doc-var="key"`-tracked value.
 * If the placeholder is already enclosed in a block/inline container carrying
 * `data-doc-var="key"` (e.g. `<div data-doc-var="p1_policy" ...><div style="margin:0;">{{p1_policy}}</div></div>`
 * or `<p data-doc-var="client_company" ...>{{client_company}}</p>`), injects the value
 * directly without nesting a duplicate `<span data-doc-var>`.
 */
export function replacePlaceholderWithDocVar(
  html: string,
  key: string,
  formattedHtmlValue: string,
): string {
  if (!key) return html;
  if (key === 'apply_url') {
    return html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), formattedHtmlValue);
  }

  const enclosedDivPattern = new RegExp(
    `(<div\\b[^>]*\\bdata-doc-var=["']${key}["'][^>]*>\\s*<div\\b[^>]*>\\s*)\\{\\{${key}\\}\\}(\\s*</div>\\s*</div>)`,
    'g',
  );
  let result = html.replace(enclosedDivPattern, (_m, prefix: string, suffix: string) => `${prefix}${formattedHtmlValue}${suffix}`);

  const directTagPattern = new RegExp(
    `(<([a-zA-Z0-9]+)\\b[^>]*\\bdata-doc-var=["']${key}["'][^>]*>\\s*)\\{\\{${key}\\}\\}(\\s*</\\2>)`,
    'g',
  );
  result = result.replace(
    directTagPattern,
    (_m, prefix: string, _tag: string, suffix: string) => `${prefix}${formattedHtmlValue}${suffix}`,
  );

  const remainingPattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
  return result.replace(remainingPattern, wrapDocVarHtml(key, formattedHtmlValue));
}

/**
 * If browser contentEditable splits a `[data-doc-var="key"]` block on Enter into
 * consecutive sibling elements with the same `data-doc-var` key, merges them back
 * into the first element so form sync continues to update the entire field.
 */
export function coalesceSplitDocVarSiblings(root: ParentNode): boolean {
  let mergedAny = false;
  const nodes = Array.from(root.querySelectorAll('[data-doc-var]'));
  for (const node of nodes) {
    if (!node.isConnected) continue;
    const key = node.getAttribute('data-doc-var');
    if (!key) continue;
    let next = node.nextElementSibling;
    while (next && next.getAttribute('data-doc-var') === key) {
      const sibling = next;
      next = sibling.nextElementSibling;
      const wrapper = document.createElement('div');
      wrapper.style.margin = '0';
      while (sibling.firstChild) {
        wrapper.appendChild(sibling.firstChild);
      }
      node.appendChild(wrapper);
      sibling.remove();
      mergedAny = true;
    }
  }
  return mergedAny;
}

function formatBlockDivInnerHtml(nextHtml: string): string {
  return `<div style="margin:0;">${nextHtml}</div>`;
}

function matchClosingTagEnd(html: string, openTagName: string, searchFrom: number): { innerEnd: number; closeEnd: number } | null {
  const tagLower = openTagName.toLowerCase();
  const tokenRe = new RegExp(`<(/?)${tagLower}\\b[^>]*>`, 'gi');
  tokenRe.lastIndex = searchFrom;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html)) !== null) {
    const isClosing = m[1] === '/';
    const isSelfClosing = !isClosing && /\/\s*>$/.test(m[0]);
    if (isSelfClosing) continue;
    depth += isClosing ? -1 : 1;
    if (depth === 0) {
      return { innerEnd: m.index, closeEnd: tokenRe.lastIndex };
    }
  }
  return null;
}

/**
 * Updates only the specified variable keys inside an existing custom HTML string
 * that contains `[data-doc-var="key"]` markers, leaving all other direct
 * text/styling edits intact.
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
    coalesceSplitDocVarSiblings(doc.body);
    const nodes = doc.body.querySelectorAll('[data-doc-var]');
    let updatedCount = 0;
    nodes.forEach((node) => {
      const key = node.getAttribute('data-doc-var');
      if (!key || !(key in updates)) return;
      const formatted = formatValue(key, updates[key] ?? '');
      const nextHtml = node.tagName === 'DIV' ? formatBlockDivInnerHtml(formatted) : formatted;
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
  const keySet = new Set(keys);
  const openRe = /<([a-zA-Z0-9]+)\b[^>]*\bdata-doc-var=["']([a-zA-Z0-9_]+)["'][^>]*>/g;
  let out = '';
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(result)) !== null) {
    const openStart = m.index;
    const openEnd = openRe.lastIndex;
    const tagName = m[1];
    const key = m[2];
    const bounds = matchClosingTagEnd(result, tagName, openEnd);
    if (!bounds) continue;
    if (keySet.has(key)) {
      const prevInner = result.slice(openEnd, bounds.innerEnd);
      const formatted = formatValue(key, updates[key] ?? '');
      const nextInner = tagName.toLowerCase() === 'div' ? formatBlockDivInnerHtml(formatted) : formatted;
      out += result.slice(cursor, openEnd);
      out += nextInner;
      cursor = bounds.innerEnd;
      if (prevInner !== nextInner) {
        updatedCount += 1;
      }
    }
    openRe.lastIndex = bounds.closeEnd;
  }
  out += result.slice(cursor);
  return { html: out, updatedCount, hasMarkers: markersPresent };
}

function normalizeElementPlainText(node: Element): string {
  const rawContent = (node.textContent ?? '').replace(/\u200B/g, '');
  if (!rawContent.trim()) return '';
  const rawInner = ((node as HTMLElement).innerText ?? rawContent).replace(/\r\n/g, '\n').replace(/\u200B/g, '');
  return rawInner.replace(/\n$/, '');
}

/**
 * Extracts plain-text values from `[data-doc-var="key"]` elements inside
 * an HTML container (e.g., contentEditable editor or saved document HTML).
 */
export function extractDocVarTextFromElement(root: ParentNode): Record<string, string> {
  const extracted: Record<string, string> = {};
  const nodes = root.querySelectorAll('[data-doc-var]');
  nodes.forEach((node) => {
    const key = node.getAttribute('data-doc-var');
    if (!key) return;
    extracted[key] = normalizeElementPlainText(node);
  });
  return extracted;
}

export function extractDocVarTextFromHtml(html: string): Record<string, string> {
  if (!html || !hasDocVarMarkers(html)) return {};
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    coalesceSplitDocVarSiblings(doc.body);
    return extractDocVarTextFromElement(doc.body);
  }
  const extracted: Record<string, string> = {};
  const openRe = /<([a-zA-Z0-9]+)\b[^>]*\bdata-doc-var=["']([a-zA-Z0-9_]+)["'][^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const openEnd = openRe.lastIndex;
    const tagName = m[1];
    const key = m[2];
    const bounds = matchClosingTagEnd(html, tagName, openEnd);
    if (!bounds) continue;
    const innerHtml = html.slice(openEnd, bounds.innerEnd);
    const plain = innerHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>\s*<div\b[^>]*>/gi, '\n')
      .replace(/<\/p>\s*<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n/g, '\n')
      .replace(/\n$/, '');
    extracted[key] = plain;
    openRe.lastIndex = bounds.closeEnd;
  }
  return extracted;
}
