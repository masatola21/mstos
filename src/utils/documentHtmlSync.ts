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
 * `data-doc-var="key"`, injects the value directly without nesting a duplicate `<span>`.
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
export function coalesceSplitDocVarSiblings(root: ParentNode, ownerDoc?: Document): boolean {
  let mergedAny = false;
  const docRef = ownerDoc || (root as Document).ownerDocument || (typeof document !== 'undefined' ? document : undefined);
  if (!docRef) return false;
  const nodes = Array.from(root.querySelectorAll('[data-doc-var]'));
  for (const node of nodes) {
    if (!node.parentNode || !root.contains(node)) continue;
    const key = node.getAttribute('data-doc-var');
    if (!key) continue;
    let next = node.nextElementSibling;
    while (next && next.getAttribute('data-doc-var') === key) {
      const sibling = next;
      next = sibling.nextElementSibling;
      if (node.tagName === 'DIV') {
        const onlyChildEl = sibling.children.length === 1 && sibling.childNodes.length === 1 ? sibling.firstElementChild : null;
        if (onlyChildEl && BLOCK_TAGS.has(onlyChildEl.tagName)) {
          node.appendChild(onlyChildEl);
        } else {
          const wrapper = docRef.createElement('div');
          wrapper.style.margin = '0';
          while (sibling.firstChild) {
            wrapper.appendChild(sibling.firstChild);
          }
          node.appendChild(wrapper);
        }
      } else {
        if (BLOCK_TAGS.has(node.tagName) && (node.textContent || '').trim().length > 0 && (sibling.textContent || '').trim().length > 0) {
          node.appendChild(docRef.createElement('br'));
        }
        while (sibling.firstChild) {
          node.appendChild(sibling.firstChild);
        }
      }
      sibling.remove();
      mergedAny = true;
    }
  }
  return mergedAny;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE']);

const INLINE_EDIT_STYLE_SUFFIX =
  'border-bottom:1px dashed #a78bfa; background:rgba(139,92,246,0.06); border-radius:3px; padding:0 3px; outline:none;';
const BLOCK_EDIT_STYLE_SUFFIX = 'outline:none; min-height:1.4em; border-radius:4px;';

function applyEditingStyle(el: Element, origStyle: string, isBlock: boolean) {
  const cleanOrig = origStyle.trim();
  const sep = cleanOrig && !cleanOrig.endsWith(';') ? '; ' : cleanOrig ? ' ' : '';
  el.setAttribute('data-doc-orig-style', origStyle);
  el.setAttribute('data-doc-editing', '1');
  el.setAttribute('style', `${cleanOrig}${sep}${isBlock ? BLOCK_EDIT_STYLE_SUFFIX : INLINE_EDIT_STYLE_SUFFIX}`.trim());
}

/**
 * Prepares HTML containing `[data-doc-var]` markers for direct WYSIWYG editing inside
 * a single `contentEditable` container without `contenteditable="false"` islands (which
 * Chromium deletes atomically on cross-boundary Backspace/selection). Empty inline slots
 * receive a `\u200B` clickable anchor so users can focus and type directly inside them.
 */
export function toInteractiveRichDom(cleanHtml: string): string {
  if (!cleanHtml || typeof DOMParser === 'undefined') return cleanHtml;
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, 'text/html');
  const markers = Array.from(doc.body.querySelectorAll('[data-doc-var]'));

  for (const el of markers) {
    const isBlock = BLOCK_TAGS.has(el.tagName);
    const origStyle = el.getAttribute('data-doc-orig-style') ?? (el.getAttribute('style') || '');
    applyEditingStyle(el, origStyle, isBlock);

    if (!isBlock && !(el.textContent || '').replace(/\u200B/g, '').trim()) {
      el.textContent = '\u200B';
    }
  }

  return doc.body.innerHTML;
}

/**
 * Strips interactive WYSIWYG editing attributes/styles and `\u200B` caret anchors from
 * the rich editor DOM while preserving every `[data-doc-var]` marker and all user edits.
 */
export function fromInteractiveRichDom(editorRoot: HTMLElement): string {
  const clone = editorRoot.cloneNode(true) as HTMLElement;
  const ownerDoc = clone.ownerDocument;

  // Defensive unwrap if any legacy `data-doc-host` wrappers exist
  const hosts = Array.from(clone.querySelectorAll('[data-doc-host="1"]'));
  for (const host of hosts) {
    const parent = host.parentNode;
    if (!parent) continue;
    while (host.firstChild) {
      parent.insertBefore(host.firstChild, host);
    }
    host.remove();
  }

  coalesceSplitDocVarSiblings(clone, ownerDoc);

  const editedMarkers = Array.from(clone.querySelectorAll('[data-doc-var]'));
  for (const el of editedMarkers) {
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-doc-editing');
    if (el.hasAttribute('data-doc-orig-style')) {
      const origStyle = el.getAttribute('data-doc-orig-style') || '';
      if (origStyle) {
        el.setAttribute('style', origStyle);
      } else {
        el.removeAttribute('style');
      }
      el.removeAttribute('data-doc-orig-style');
    }
  }

  clone.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable');
  });

  // Remove zero-width space anchors used during editing
  if (ownerDoc && typeof ownerDoc.createTreeWalker === 'function') {
    const walker = ownerDoc.createTreeWalker(clone, 4 /* NodeFilter.SHOW_TEXT */);
    const toClean: Text[] = [];
    let current = walker.nextNode();
    while (current) {
      if (current.nodeValue && current.nodeValue.includes('\u200B')) {
        toClean.push(current as Text);
      }
      current = walker.nextNode();
    }
    for (const textNode of toClean) {
      textNode.nodeValue = (textNode.nodeValue || '').replace(/\u200B/g, '');
    }
  }

  return clone.innerHTML;
}

export interface PendingRichVarGuard {
  totalMarkersBefore: number;
  targets: Array<{
    el: Element;
    key: string;
    tagName: string;
    origStyle: string;
    isBlock: boolean;
    parent: Node | null;
    prevSibling: Node | null;
    prevSiblingText: string | null;
    nextSibling: Node | null;
    nextSiblingText: string | null;
  }>;
}

function findContainingDocVar(node: Node | null, root: HTMLElement): Element | null {
  let curr: Node | null = node;
  while (curr && curr !== root) {
    if (curr.nodeType === 1 && (curr as Element).hasAttribute('data-doc-var')) {
      return curr as Element;
    }
    curr = curr.parentNode;
  }
  return null;
}

function getSelectedRangeText(range: Range): string {
  return range.toString().replace(/\u200B/g, '');
}

/**
 * Captures any `[data-doc-var]` element intersecting or immediately adjacent to the
 * browser selection right before an edit, and nudges collapsed Backspace/Delete into
 * adjacent inline markers so Chrome edits inside the variable instead of deleting it.
 */
export function prepareRichDocVarBeforeInput(
  editorRoot: HTMLElement,
  inputType?: string,
): PendingRichVarGuard | null {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editorRoot.contains(range.commonAncestorContainer)) return null;

  // If collapsed right outside an inline [data-doc-var] and deleting, step caret inside it
  if (range.collapsed && (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward')) {
    const container = range.startContainer;
    const offset = range.startOffset;
    let adjacentVar: Element | null = null;
    if (container.nodeType === 3) {
      const textVal = container.nodeValue || '';
      if (inputType === 'deleteContentBackward' && offset === 0 && container.previousSibling?.nodeType === 1) {
        const prevEl = container.previousSibling as Element;
        if (prevEl.hasAttribute('data-doc-var')) adjacentVar = prevEl;
      } else if (inputType === 'deleteContentForward' && offset === textVal.length && container.nextSibling?.nodeType === 1) {
        const nextEl = container.nextSibling as Element;
        if (nextEl.hasAttribute('data-doc-var')) adjacentVar = nextEl;
      }
    } else if (container.nodeType === 1) {
      const idx = inputType === 'deleteContentBackward' ? offset - 1 : offset;
      const cand = container.childNodes[idx];
      if (cand?.nodeType === 1 && (cand as Element).hasAttribute('data-doc-var')) {
        adjacentVar = cand as Element;
      }
    }
    if (adjacentVar && !BLOCK_TAGS.has(adjacentVar.tagName)) {
      const r = editorRoot.ownerDocument.createRange();
      r.selectNodeContents(adjacentVar);
      r.collapse(inputType !== 'deleteContentBackward');
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  const activeRange = sel.getRangeAt(0);
  const matched = new Set<Element>();
  const anchorVar = findContainingDocVar(activeRange.startContainer, editorRoot);
  const focusVar = findContainingDocVar(activeRange.endContainer, editorRoot);
  if (anchorVar) matched.add(anchorVar);
  if (focusVar) matched.add(focusVar);

  if (!activeRange.collapsed) {
    const allVars = Array.from(editorRoot.querySelectorAll('[data-doc-var]'));
    for (const el of allVars) {
      try {
        if (activeRange.intersectsNode(el)) {
          matched.add(el);
        }
      } catch {
        // Ignore detached ranges
      }
    }
  }

  // Only guard elements where an unwrap/replacement could realistically happen
  if (matched.size === 0 && getSelectedRangeText(activeRange) === '') return null;

  const allMarkersBefore = editorRoot.querySelectorAll('[data-doc-var]').length;
  const targets = Array.from(matched).map((el) => ({
    el,
    key: el.getAttribute('data-doc-var') || '',
    tagName: el.tagName,
    origStyle: el.getAttribute('data-doc-orig-style') ?? (el.getAttribute('style') || ''),
    isBlock: BLOCK_TAGS.has(el.tagName),
    parent: el.parentNode,
    prevSibling: el.previousSibling,
    prevSiblingText: el.previousSibling?.nodeType === 3 ? el.previousSibling.nodeValue : null,
    nextSibling: el.nextSibling,
    nextSiblingText: el.nextSibling?.nodeType === 3 ? el.nextSibling.nodeValue : null,
  })).filter((t) => Boolean(t.key));

  return targets.length > 0 ? { totalMarkersBefore: allMarkersBefore, targets } : null;
}

/**
 * Unwraps/splits any nested `[data-doc-var]` element that Chromium merged inside an
 * outer `[data-doc-var]` block (e.g., pressing Backspace at the start of `ご担当:`).
 */
function splitMergedNestedDocVars(editorRoot: HTMLElement, doc: Document): void {
  const outerMarkers = Array.from(editorRoot.querySelectorAll('[data-doc-var]'));
  for (const outer of outerMarkers) {
    if (!editorRoot.contains(outer)) continue;
    const nested = outer.querySelector('[data-doc-var]');
    if (!nested || !outer.parentNode) continue;

    // Find the direct child of `outer` that contains `nested`
    let splitAnchor: Node | null = nested;
    while (splitAnchor && splitAnchor.parentNode !== outer) {
      splitAnchor = splitAnchor.parentNode;
    }
    if (!splitAnchor) continue;

    // Walk backward across preceding inline siblings up to any <br> or block boundary
    let moveStart: Node = splitAnchor;
    if (splitAnchor.nodeType !== 1 || !BLOCK_TAGS.has((splitAnchor as Element).tagName)) {
      while (moveStart.previousSibling) {
        const prev = moveStart.previousSibling;
        if (prev.nodeType === 1 && ((prev as Element).tagName === 'BR' || BLOCK_TAGS.has((prev as Element).tagName))) {
          break;
        }
        // Only pull preceding inline text like "ご担当: " if there was a break or block before it
        if (!prev.previousSibling && outer.firstChild === prev) {
          break;
        }
        moveStart = prev;
      }
    }

    const detachedBlock = doc.createElement(outer.tagName === 'P' ? 'p' : 'div');
    let cur: Node | null = moveStart;
    while (cur) {
      const next: Node | null = cur.nextSibling;
      detachedBlock.appendChild(cur);
      cur = next;
    }
    if (
      moveStart.previousSibling &&
      moveStart.previousSibling.nodeType === 1 &&
      (moveStart.previousSibling as Element).tagName === 'BR'
    ) {
      moveStart.previousSibling.remove();
    }
    outer.parentNode.insertBefore(detachedBlock, outer.nextSibling);
  }
}

/**
 * Restores any `[data-doc-var]` element that Chromium's contentEditable unwrapped or
 * removed during select-all replacement / backspace-to-empty, and keeps empty inline
 * and block fields clickable.
 */
export function repairRichDocVarsAfterInput(
  editorRoot: HTMLElement,
  guard: PendingRichVarGuard | null,
): void {
  const doc = editorRoot.ownerDocument;
  splitMergedNestedDocVars(editorRoot, doc);
  coalesceSplitDocVarSiblings(editorRoot, doc);

  if (guard) {
    const editorEmpty = !(editorRoot.textContent || '').replace(/\u200B/g, '').trim();
    const isWholeDocWipe = editorEmpty && guard.targets.length > 4 && guard.targets.length >= guard.totalMarkersBefore;
    for (const target of guard.targets) {
      if (target.el && editorRoot.contains(target.el)) continue;

      // Also check if another element with this key already exists under the exact same parent
      if (
        target.parent &&
        editorRoot.contains(target.parent) &&
        target.parent.nodeType === 1 &&
        (target.parent as Element).querySelector(`[data-doc-var="${target.key}"]`)
      ) {
        continue;
      }

      const wrapperTag = target.isBlock
        ? (target.tagName === 'P' ? 'p' : 'div')
        : (['SPAN', 'STRONG'].includes(target.tagName) ? target.tagName.toLowerCase() : 'span');
      const wrapper = doc.createElement(wrapperTag);
      wrapper.setAttribute('data-doc-var', target.key);
      applyEditingStyle(wrapper, target.origStyle, target.isBlock);

      if (target.parent && editorRoot.contains(target.parent)) {
        // If Chromium deleted an inline span and appended typed characters directly onto
        // the preceding/following sibling text node, split that text node so the new text
        // goes back inside `wrapper`.
        if (
          target.prevSibling &&
          target.prevSibling.parentNode === target.parent &&
          target.prevSibling.nodeType === 3 &&
          target.prevSiblingText !== null
        ) {
          const curVal = target.prevSibling.nodeValue || '';
          if (curVal.startsWith(target.prevSiblingText) && curVal.length > target.prevSiblingText.length) {
            (target.prevSibling as Text).splitText(target.prevSiblingText.length);
          }
        }
        if (
          target.nextSibling &&
          target.nextSibling.parentNode === target.parent &&
          target.nextSibling.nodeType === 3 &&
          target.nextSiblingText !== null
        ) {
          const curVal = target.nextSibling.nodeValue || '';
          if (curVal.endsWith(target.nextSiblingText) && curVal.length > target.nextSiblingText.length) {
            const prefixLen = curVal.length - target.nextSiblingText.length;
            const splitTail = (target.nextSibling as Text).splitText(prefixLen);
            target.nextSibling = splitTail;
          }
        }

        // Collect any nodes left between prevSibling and nextSibling
        const startNode = target.prevSibling && target.prevSibling.parentNode === target.parent
          ? target.prevSibling.nextSibling
          : target.parent.firstChild;
        const stopNode = target.nextSibling && target.nextSibling.parentNode === target.parent
          ? target.nextSibling
          : null;

        const nodesToWrap: Node[] = [];
        let cursor = startNode;
        while (cursor && cursor !== stopNode) {
          const next = cursor.nextSibling;
          if (!(cursor.nodeType === 1 && (cursor as Element).hasAttribute('data-doc-var'))) {
            nodesToWrap.push(cursor);
          }
          cursor = next;
        }

        if (nodesToWrap.length > 0) {
          target.parent.insertBefore(wrapper, nodesToWrap[0]);
          for (const n of nodesToWrap) {
            wrapper.appendChild(n);
          }
        } else {
          if (target.isBlock) {
            wrapper.appendChild(doc.createElement('br'));
          } else {
            wrapper.textContent = '\u200B';
          }
          if (stopNode) {
            target.parent.insertBefore(wrapper, stopNode);
          } else {
            target.parent.appendChild(wrapper);
          }
        }
      } else if (!isWholeDocWipe) {
        // Parent was also merged/unwrapped; re-wrap at the current selection caret if inside editorRoot
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          if (editorRoot.contains(r.startContainer)) {
            if (target.isBlock) {
              wrapper.appendChild(doc.createElement('br'));
            } else {
              wrapper.textContent = '\u200B';
            }
            r.insertNode(wrapper);
          }
        }
      }

      // Keep caret inside the restored wrapper
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel && editorRoot.contains(wrapper)) {
        const r = doc.createRange();
        r.selectNodeContents(wrapper);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
  }

  // Keep every inline [data-doc-var] non-zero-width and every empty block [data-doc-var] clickable
  const allMarkers = Array.from(editorRoot.querySelectorAll('[data-doc-var]'));
  for (const el of allMarkers) {
    if (!BLOCK_TAGS.has(el.tagName)) {
      if (!(el.textContent || '').replace(/\u200B/g, '').trim() && !el.textContent?.includes('\u200B')) {
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        const hadCaret = Boolean(sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).startContainer));
        el.textContent = '\u200B';
        if (hadCaret && sel) {
          const r = doc.createRange();
          r.setStart(el.firstChild!, 1);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
    } else if (!(el.textContent || '').replace(/\u200B/g, '').trim() && !el.querySelector('br')) {
      el.appendChild(doc.createElement('br'));
    }
  }
}

/**
 * Best-effort upgrade for legacy or partially-marked `tpl-proposal-report` HTML.
 * Attaches `[data-doc-var]` markers where unambiguous structural headings or labels
 * match and a marker for that key is not already present.
 */
export function rehydrateMissingProposalMarkers(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let attached = 0;

  const hasMarker = (key: string) => Boolean(doc.body.querySelector(`[data-doc-var="${key}"]`));

  const markBlock = (el: Element | null, key: string) => {
    if (!el || el.hasAttribute('data-doc-var') || hasMarker(key)) return;
    if (el.querySelector('[data-doc-var]')) return;
    el.setAttribute('data-doc-var', key);
    attached += 1;
  };

  const sectionHeadingToKey: Record<string, string> = {
    '結論サマリー': 'd0_summary',
    'D0': 'd0_summary',
    '診断の前提': 'd1_premise',
    'D1': 'd1_premise',
    '現状整理': 'd2_current',
    'D2': 'd2_current',
    '特定された急所と根拠': 'd3_bottleneck',
    'D3': 'd3_bottleneck',
    '放置した場合の影響': 'd4_impact',
    'D4': 'd4_impact',
    '改善の方向性': 'd5_direction',
    'D5': 'd5_direction',
    '提案の型と方針': 'p1_policy',
    'P1': 'p1_policy',
  };

  const subLabelToKey: Record<string, string> = {
    'サービス名': 'p2_service_name',
    '成果物': 'p2_deliverables',
    '構築の成果物': 'p2_deliverables',
    '月次の支援内容(定例の回数、相談範囲)': 'p2_monthly_support',
    '構築のスケジュール': 'p3_roadmap',
    'フェーズごとの重点テーマ': 'p3_roadmap',
    '構築期間から伴走への移行': 'p3_roadmap',
    '確認指標': 'p3_metrics',
    'お客様にお願いすること': 'p5_requests',
    '対象外': 'p5_exclusions',
    'お支払い条件': 'p6_payment_terms',
    '契約期間': 'p6_contract_period',
  };

  const headings = Array.from(doc.body.querySelectorAll('h3'));
  for (const h3 of headings) {
    const title = (h3.textContent || '').trim();
    const matchedKey = Object.entries(sectionHeadingToKey).find(([needle]) => title.includes(needle))?.[1];
    if (matchedKey) {
      const sibling = h3.nextElementSibling;
      if (sibling) {
        const innerPre = sibling.querySelector('div[style*="pre-wrap"]') || sibling;
        markBlock(innerPre, matchedKey);
      }
      continue;
    }

    if (title.includes('提供内容') || title.includes('ロードマップ') || title.includes('お願い') || title.includes('お支払い')) {
      const sectionEl = h3.parentElement;
      if (!sectionEl) continue;
      const subPs = Array.from(sectionEl.querySelectorAll('p'));
      for (const p of subPs) {
        const label = (p.textContent || '').trim();
        let subKey = subLabelToKey[label];
        if (!subKey && label.startsWith('前提・条件')) subKey = 'p5_prerequisites';
        if (subKey && p.nextElementSibling && p.nextElementSibling.tagName === 'DIV') {
          markBlock(p.nextElementSibling, subKey);
        }
      }
    }
  }

  // Also tag cover header fields if present
  const paragraphs = Array.from(doc.body.querySelectorAll('p'));
  for (const p of paragraphs) {
    const txt = (p.textContent || '').trim();
    if (txt.startsWith('案件名:') && !hasMarker('proposal_title') && !p.querySelector('[data-doc-var]')) {
      const val = txt.replace(/^案件名:\s*/, '');
      p.textContent = '案件名: ';
      const sp = doc.createElement('span');
      sp.setAttribute('data-doc-var', 'proposal_title');
      sp.textContent = val;
      p.appendChild(sp);
      attached += 1;
    } else if (/^ご担当:.*様$/.test(txt) && !hasMarker('client_name') && !p.querySelector('[data-doc-var]')) {
      const val = txt.replace(/^ご担当:\s*/, '').replace(/\s*様$/, '');
      p.textContent = 'ご担当: ';
      const sp = doc.createElement('span');
      sp.setAttribute('data-doc-var', 'client_name');
      sp.textContent = val;
      p.appendChild(sp);
      p.appendChild(doc.createTextNode(' 様'));
      attached += 1;
    } else if (
      p.style?.fontSize === '18px' &&
      (p.style?.fontWeight === 'bold' || p.style?.fontWeight === '700') &&
      !hasMarker('client_company') &&
      !p.hasAttribute('data-doc-var')
    ) {
      markBlock(p, 'client_company');
    } else if (txt.startsWith('代表取締役 ') && !hasMarker('sender_rep') && !p.querySelector('[data-doc-var]')) {
      const val = txt.replace(/^代表取締役\s*/, '');
      p.textContent = '代表取締役 ';
      const sp = doc.createElement('span');
      sp.setAttribute('data-doc-var', 'sender_rep');
      sp.textContent = val;
      p.appendChild(sp);
      attached += 1;
    } else if (
      p.parentElement?.style?.textAlign === 'right' &&
      (p.style?.fontWeight === 'bold' || p.style?.fontWeight === '700') &&
      !hasMarker('sender_company') &&
      !p.hasAttribute('data-doc-var')
    ) {
      markBlock(p, 'sender_company');
    } else if (
      p.parentElement?.style?.textAlign === 'right' &&
      p.previousElementSibling?.textContent?.includes('代表取締役') &&
      !txt.startsWith('代表取締役') &&
      !hasMarker('sender_address') &&
      !p.hasAttribute('data-doc-var')
    ) {
      markBlock(p, 'sender_address');
    }
  }

  const spans = Array.from(doc.body.querySelectorAll('span'));
  for (const sp of spans) {
    const firstLabel = sp.firstElementChild?.textContent?.trim();
    const strongEl = sp.querySelector('strong');
    if (firstLabel === '発行日:' && strongEl && !strongEl.hasAttribute('data-doc-var') && !hasMarker('issue_date')) {
      markBlock(strongEl, 'issue_date');
    } else if (firstLabel === '有効期限:' && strongEl && !strongEl.hasAttribute('data-doc-var') && !hasMarker('due_date')) {
      markBlock(strongEl, 'due_date');
    }
  }

  // Also tag P4 fee table rows
  const p4LabelToKey: Record<string, string> = {
    '初期費用': 'p4_initial_fee',
    '月額': 'p4_monthly_fee',
    '値引き': 'p4_discount',
    '小計(税抜)': 'p4_subtotal',
    '消費税(10%)': 'p4_tax',
    '合計(税込)': 'p4_total',
  };
  const rows = Array.from(doc.body.querySelectorAll('tr'));
  for (const tr of rows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length !== 2) continue;
    const key = p4LabelToKey[(cells[0].textContent || '').trim()];
    if (key && !hasMarker(key) && !cells[1].querySelector('[data-doc-var]')) {
      const valText = (cells[1].textContent || '').trim().replace(/^¥\s*/, '');
      cells[1].textContent = '¥';
      const sp = doc.createElement('span');
      sp.setAttribute('data-doc-var', key);
      sp.textContent = valText;
      cells[1].appendChild(sp);
      attached += 1;
    }
  }

  return attached > 0 ? doc.body.innerHTML : html;
}

export function rehydrateLegacyProposalHtml(html: string): string {
  if (!html || hasDocVarMarkers(html) || typeof DOMParser === 'undefined') return html;
  return rehydrateMissingProposalMarkers(html);
}

/**
 * Best-effort upgrade for any legacy saved document HTML (Proposal, Estimate, Contract,
 * Invoice, or Monthly Report) saved before `data-doc-var` markers existed.
 */
export function rehydrateLegacyDocumentHtml(html: string, templateId: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  if (templateId === 'tpl-proposal-report') {
    return rehydrateMissingProposalMarkers(html);
  }
  if (hasDocVarMarkers(html)) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let attached = 0;

  if (templateId === 'tpl-monthly-report-01') {
    const headingToKey: Record<string, string> = {
      '今月の総括': 'monthly_summary',
      '月次サマリー': 'monthly_summary',
      '主な実施内容': 'accomplishments',
      '今月の実施事項': 'accomplishments',
      '来月の予定': 'next_actions',
      '来月のアクションプラン': 'next_actions',
    };
    for (const h3 of Array.from(doc.body.querySelectorAll('h3'))) {
      const t = (h3.textContent || '').trim();
      const k = Object.entries(headingToKey).find(([needle]) => t.includes(needle))?.[1];
      if (k && h3.nextElementSibling && !h3.nextElementSibling.hasAttribute('data-doc-var')) {
        h3.nextElementSibling.setAttribute('data-doc-var', k);
        attached += 1;
      }
    }
    const h1 = doc.body.querySelector('h1');
    if (h1 && !h1.hasAttribute('data-doc-var')) {
      h1.setAttribute('data-doc-var', 'report_title');
      attached += 1;
    }
  }

  // Client company (`〇〇 御中`) & dates & payment terms
  for (const p of Array.from(doc.body.querySelectorAll('p, div, h2'))) {
    const txt = (p.textContent || '').trim();
    if (p.tagName === 'P' || p.tagName === 'H2') {
      if (txt.endsWith('御中') && !p.querySelector('[data-doc-var="client_company"]')) {
        const strong = p.querySelector('strong');
        if (strong && !strong.hasAttribute('data-doc-var')) {
          strong.setAttribute('data-doc-var', 'client_company');
          attached += 1;
        } else if (!strong) {
          const val = txt.replace(/\s*御中$/, '');
          p.innerHTML = `<span data-doc-var="client_company">${val}</span> 御中`;
          attached += 1;
        }
      } else if (/^発行日[:：]/.test(txt)) {
        const strong = p.querySelector('strong');
        if (strong && !strong.hasAttribute('data-doc-var')) {
          strong.setAttribute('data-doc-var', 'issue_date');
          attached += 1;
        }
      } else if (/^(?:有効期限|お支払い期限|支払期日)[:：]/.test(txt) && !p.querySelector('[data-doc-var="due_date"]')) {
        const strong = p.querySelector('strong');
        if (strong && !strong.hasAttribute('data-doc-var')) {
          strong.setAttribute('data-doc-var', 'due_date');
          attached += 1;
        }
      } else if (/^請求書番号[:：]/.test(txt) && !p.querySelector('[data-doc-var="invoice_number"]')) {
        const val = txt.replace(/^請求書番号[:：]\s*/, '');
        p.innerHTML = `請求書番号: <span data-doc-var="invoice_number">${val}</span>`;
        attached += 1;
      }
    } else if (p.tagName === 'DIV' && /^お支払い条件[:：]/.test(txt) && !p.querySelector('[data-doc-var="payment_terms"]')) {
      const val = txt.replace(/^お支払い条件[:：]\s*/, '');
      p.innerHTML = `<strong>お支払い条件:</strong> <span data-doc-var="payment_terms">${val}</span>`;
      attached += 1;
    }
  }

  for (const h3 of Array.from(doc.body.querySelectorAll('h3'))) {
    const txt = (h3.textContent || '').trim();
    if (/^件名[:：]/.test(txt) && !h3.querySelector('[data-doc-var="proposal_title"]')) {
      const val = txt.replace(/^件名[:：]\s*/, '');
      h3.innerHTML = `件名: <span data-doc-var="proposal_title">${val}</span>`;
      attached += 1;
    }
  }

  return attached > 0 ? doc.body.innerHTML : html;
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
 * Returns all variable keys referenced in a dynamic template HTML (via `{{key}}`
 * placeholders or `[data-doc-var="key"]` markers), excluding `apply_url`.
 */
export function extractTemplateDocVarKeys(templateHtml: string): string[] {
  if (!templateHtml) return [];
  const keys = new Set<string>();
  for (const m of templateHtml.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m[1] && m[1] !== 'apply_url') keys.add(m[1]);
  }
  for (const m of templateHtml.matchAll(/data-doc-var=["']([a-zA-Z0-9_]+)["']/g)) {
    if (m[1] && m[1] !== 'apply_url') keys.add(m[1]);
  }
  return Array.from(keys);
}

/**
 * Finds variable keys from `templateHtml` that no longer have a `[data-doc-var="key"]`
 * marker (or `{{key}}` placeholder) inside `customHtml`.
 */
export function findMissingDocVarKeys(customHtml: string, templateHtml: string): string[] {
  if (!customHtml || !templateHtml) return [];
  const expected = extractTemplateDocVarKeys(templateHtml);
  const present = new Set<string>();
  for (const m of customHtml.matchAll(/data-doc-var=["']([a-zA-Z0-9_]+)["']/g)) {
    if (m[1]) present.add(m[1]);
  }
  for (const m of customHtml.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m[1]) present.add(m[1]);
  }
  return expected.filter((k) => !present.has(k));
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
): { html: string; updatedCount: number; hasMarkers: boolean; missingKeys: string[] } {
  const keys = Object.keys(updates);
  const markersPresent = hasDocVarMarkers(html);
  if (!html || !markersPresent || keys.length === 0) {
    return { html, updatedCount: 0, hasMarkers: markersPresent, missingKeys: keys };
  }

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    coalesceSplitDocVarSiblings(doc.body, doc);
    const nodes = doc.body.querySelectorAll('[data-doc-var]');
    let updatedCount = 0;
    const matchedKeys = new Set<string>();
    nodes.forEach((node) => {
      const key = node.getAttribute('data-doc-var');
      if (!key) return;
      matchedKeys.add(key);
      if (!(key in updates)) return;
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
      missingKeys: keys.filter((k) => !matchedKeys.has(k)),
    };
  }

  // Fallback for Node/SSR test environments without DOMParser
  const result = html;
  let updatedCount = 0;
  const keySet = new Set(keys);
  const matchedKeys = new Set<string>();
  const openRe = /<([a-zA-Z0-9]+)\b[^>]*\bdata-doc-var=["']([a-zA-Z0-9_]+)["'][^>]*>/g;
  let out = '';
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(result)) !== null) {
    const openEnd = openRe.lastIndex;
    const tagName = m[1];
    const key = m[2];
    const bounds = matchClosingTagEnd(result, tagName, openEnd);
    if (!bounds) continue;
    matchedKeys.add(key);
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
  return {
    html: out,
    updatedCount,
    hasMarkers: markersPresent,
    missingKeys: keys.filter((k) => !matchedKeys.has(k)),
  };
}

function serializeDetachedDomText(node: Node): string {
  if (node.nodeType === 3) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (el.tagName === 'BR') return '\n';
  let inner = '';
  el.childNodes.forEach((child, idx) => {
    const childText = serializeDetachedDomText(child);
    if (
      idx > 0 &&
      child.nodeType === 1 &&
      BLOCK_TAGS.has((child as Element).tagName) &&
      inner.length > 0 &&
      !inner.endsWith('\n')
    ) {
      inner += '\n';
    }
    inner += childText;
  });
  return inner;
}

function normalizeElementPlainText(node: Element): string {
  const rawContent = (node.textContent ?? '').replace(/\u200B/g, '');
  if (!rawContent.trim()) return '';
  const rawInner = node.isConnected
    ? ((node as HTMLElement).innerText ?? rawContent)
    : serializeDetachedDomText(node);
  return rawInner.replace(/\r\n/g, '\n').replace(/\u200B/g, '').replace(/\n$/, '');
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
    if (!key || key in extracted) return;
    extracted[key] = normalizeElementPlainText(node);
  });
  return extracted;
}

export function extractDocVarTextFromHtml(html: string): Record<string, string> {
  if (!html || !hasDocVarMarkers(html)) return {};
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    coalesceSplitDocVarSiblings(doc.body, doc);
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
      .replace(/\u200B/g, '')
      .replace(/\n$/, '');
    if (!(key in extracted)) {
      extracted[key] = plain;
    }
    openRe.lastIndex = bounds.closeEnd;
  }
  return extracted;
}
