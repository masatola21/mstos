import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface CustomerDoc {
  id: string;
  title: string;
  document_type?: string;
  body_html?: string | null;
  created_at?: string | null;
}

// 日本語フォント(Noto Sans JP / SIL OFL)をリポジトリに同梱する。
// サーバー(Vercel)にはシステムフォントがないため、同梱しないと日本語が文字化けする。
// vercel.json の includeFiles で server/fonts/** をデプロイに含める。
const FONT_CANDIDATES = [
  path.join(process.cwd(), 'server', 'fonts', 'NotoSansJP-Regular.ttf'),
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts', 'NotoSansJP-Regular.ttf'),
  '/usr/share/fonts/opentype/unifont/unifont_jp.otf',
];

function getJapaneseFont(): string {
  for (const fontPath of FONT_CANDIDATES) {
    if (fs.existsSync(fontPath)) return fontPath;
  }
  // フォントがないまま作ると文字化けしたPDFができる。作らずにエラーにする。
  throw new Error('日本語フォントが見つからないため、PDFを作成できません。');
}

// ─── 後方互換のための簡易ブロック抽出 API ──────────────────────────
export interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'table' | 'hr';
  text?: string;
  rows?: string[][];
}

// ─── HTML ツリーパーサー（ネストした div / flex / grid / table を正確に構造化） ───
interface HtmlNode {
  tag: string; // '#text' for text nodes
  text?: string;
  attrs: Record<string, string>;
  style: Record<string, string>;
  children: HtmlNode[];
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);
const INLINE_TAGS = new Set(['#text', 'span', 'strong', 'b', 'em', 'i', 'u', 'small', 'code', 'a', 'br']);

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function parseInlineStyle(styleStr: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!styleStr) return map;
  for (const part of styleStr.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k && v) map[k] = v;
  }
  return map;
}

function parseHtmlTree(html: string): HtmlNode {
  const root: HtmlNode = { tag: 'root', attrs: {}, style: {}, children: [] };
  if (!html) return root;

  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  const stack: HtmlNode[] = [root];
  const tokenRe = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(cleaned)) !== null) {
    const [, closingSlash, rawTag, rawAttrs, textChunk] = match;
    const parent = stack[stack.length - 1];

    if (textChunk !== undefined) {
      const decoded = decodeHtmlEntities(textChunk);
      if (decoded.trim() || decoded.includes('\n')) {
        parent.children.push({ tag: '#text', text: decoded, attrs: {}, style: {}, children: [] });
      }
      continue;
    }

    const tag = rawTag.toLowerCase();
    if (closingSlash) {
      // 対応する開始タグまで戻る
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs = parseAttributes(rawAttrs || '');
    const node: HtmlNode = {
      tag,
      attrs,
      style: parseInlineStyle(attrs.style),
      children: [],
    };
    parent.children.push(node);

    const selfClosing = VOID_TAGS.has(tag) || rawAttrs.trim().endsWith('/');
    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root;
}

function flattenTextWithBreaks(node: HtmlNode, preserveWhitespace = false): string {
  if (node.tag === '#text') {
    const raw = node.text || '';
    if (preserveWhitespace) return raw;
    return raw.replace(/\s+/g, ' ');
  }
  if (node.tag === 'br') return '\n';

  const nextPreserve = preserveWhitespace || (node.style['white-space'] || '').includes('pre');
  let out = '';
  for (const child of node.children) {
    out += flattenTextWithBreaks(child, nextPreserve);
  }
  if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'].includes(node.tag) && !out.endsWith('\n')) {
    out += '\n';
  }
  return out;
}

function collectNodesByTag(node: HtmlNode, tagName: string, out: HtmlNode[] = []): HtmlNode[] {
  if (node.tag === tagName) out.push(node);
  for (const c of node.children) collectNodesByTag(c, tagName, out);
  return out;
}

export function parseHtmlToBlocks(html: string): ParsedBlock[] {
  if (!html) return [];
  const tree = parseHtmlTree(html);
  const blocks: ParsedBlock[] = [];

  const walk = (node: HtmlNode) => {
    if (node.tag === 'table') {
      const trs = collectNodesByTag(node, 'tr');
      const rows: string[][] = [];
      for (const tr of trs) {
        const cells = tr.children
          .filter((c) => c.tag === 'th' || c.tag === 'td')
          .map((c) => flattenTextWithBreaks(c).replace(/\n+/g, ' ').trim());
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      return;
    }
    if (node.tag === 'hr') {
      blocks.push({ type: 'hr' });
      return;
    }
    if (node.tag === 'h1' || node.tag === 'h2' || node.tag === 'h3') {
      const t = flattenTextWithBreaks(node).trim();
      if (t) blocks.push({ type: node.tag, text: t });
      return;
    }
    if (node.tag === 'p' || node.tag === 'li') {
      const t = flattenTextWithBreaks(node).trim();
      if (t) blocks.push({ type: 'p', text: t });
      return;
    }
    if (node.tag === 'div' || node.tag === 'section') {
      const hasBlockChildren = node.children.some((c) => !INLINE_TAGS.has(c.tag));
      if (!hasBlockChildren) {
        const t = flattenTextWithBreaks(node).trim();
        if (t) blocks.push({ type: 'p', text: t });
        return;
      }
    }
    for (const c of node.children) walk(c);
  };

  walk(tree);
  return blocks;
}

// ─── CSS 単位・ボックスモデル・色ヘルパー ──────────────────────────────
const PX_SCALE = 0.74;
const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_TOP = 38;
const PAGE_MARGIN_BOTTOM = 42;

function parseLengthPx(raw: string | undefined, refWidth = 515): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === '0') return 0;
  const pxMatch = s.match(/^(-?[\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]) * PX_SCALE;
  const pctMatch = s.match(/^(-?[\d.]+)%$/);
  if (pctMatch) return (parseFloat(pctMatch[1]) / 100) * refWidth;
  const numMatch = s.match(/^(-?[\d.]+)$/);
  if (numMatch) return parseFloat(numMatch[1]) * PX_SCALE;
  return null;
}

interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function parseShorthandEdges(raw: string | undefined): BoxEdges {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!raw) return zero;
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((p) => (p === 'auto' ? 0 : (parseLengthPx(p) ?? 0)));
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  if (parts.length >= 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  return zero;
}

function getEdges(style: Record<string, string>, prop: 'padding' | 'margin'): BoxEdges {
  const base = parseShorthandEdges(style[prop]);
  const top = parseLengthPx(style[`${prop}-top`]);
  const right = parseLengthPx(style[`${prop}-right`]);
  const bottom = parseLengthPx(style[`${prop}-bottom`]);
  const left = parseLengthPx(style[`${prop}-left`]);
  const vScale = prop === 'margin' ? 0.78 : 0.85;
  return {
    top: (top ?? base.top) * vScale,
    right: right ?? base.right,
    bottom: (bottom ?? base.bottom) * vScale,
    left: left ?? base.left,
  };
}

interface BorderSpec {
  width: number;
  color: string;
}

function parseBorderSpec(raw: string | undefined): BorderSpec | null {
  if (!raw || raw.trim().toLowerCase() === 'none') return null;
  const s = raw.trim();
  const widthMatch = s.match(/([\d.]+)px/);
  const width = widthMatch ? Math.max(0.5, parseFloat(widthMatch[1]) * 0.75) : 0.75;
  const color = extractColor(s) || '#cbd5e1';
  return { width, color };
}

function extractColor(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const hexMatch = s.match(/#([0-9a-f]{3,8})\b/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return `#${hex.slice(0, 6)}`;
  }
  const named: Record<string, string> = {
    white: '#ffffff',
    black: '#000000',
    transparent: '',
  };
  const lower = s.toLowerCase();
  for (const [k, v] of Object.entries(named)) {
    if (lower === k || lower.includes(` ${k}`)) return v || null;
  }
  return null;
}

interface InlineRun {
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  bgColor?: string;
  borderColor?: string;
  isBadge?: boolean;
  link?: string;
}

interface InheritedTextStyle {
  color: string;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  preserveWhitespace: boolean;
}

function mergeTextStyle(node: HtmlNode, inherited: InheritedTextStyle): InheritedTextStyle {
  const fsPx = parseLengthPx(node.style['font-size']);
  const fontSize = fsPx ? Math.max(7.2, Math.min(24, fsPx)) :
    node.tag === 'h1' ? 17.5 :
    node.tag === 'h2' ? 13 :
    node.tag === 'h3' ? 11.2 :
    node.tag === 'h4' ? 10 :
    inherited.fontSize;

  const fw = (node.style['font-weight'] || '').toLowerCase();
  const bold =
    node.tag === 'strong' ||
    node.tag === 'b' ||
    node.tag === 'h1' ||
    node.tag === 'h2' ||
    node.tag === 'h3' ||
    node.tag === 'th' ||
    fw === 'bold' ||
    Number(fw) >= 600 ||
    inherited.bold;

  const color = extractColor(node.style.color) || inherited.color;
  const ta = (node.style['text-align'] || '').toLowerCase();
  const align: 'left' | 'center' | 'right' =
    ta === 'center' ? 'center' : ta === 'right' ? 'right' : inherited.align;
  const preserveWhitespace =
    inherited.preserveWhitespace || (node.style['white-space'] || '').includes('pre');

  return { color, fontSize, bold, align, preserveWhitespace };
}

function collectInlineRuns(node: HtmlNode, inherited: InheritedTextStyle, runs: InlineRun[] = []): InlineRun[] {
  if (node.tag === '#text') {
    const raw = node.text || '';
    const text = inherited.preserveWhitespace
      ? raw.replace(/^\n+|\n+$/g, (m) => (m.length > 0 ? m : ''))
      : raw.replace(/\s+/g, ' ');
    if (text) {
      runs.push({
        text,
        color: inherited.color,
        fontSize: inherited.fontSize,
        bold: inherited.bold,
      });
    }
    return runs;
  }

  if (node.tag === 'br') {
    runs.push({ text: '\n', color: inherited.color, fontSize: inherited.fontSize, bold: inherited.bold });
    return runs;
  }

  const nextStyle = mergeTextStyle(node, inherited);
  const bg = extractColor(node.style.background || node.style['background-color']);
  const border = parseBorderSpec(node.style.border);
  const isBadge =
    (node.tag === 'span' || node.tag === 'a') &&
    Boolean(bg) &&
    node.children.every((c) => INLINE_TAGS.has(c.tag));

  if (isBadge) {
    const badgeText = flattenTextWithBreaks(node, nextStyle.preserveWhitespace).replace(/\n+/g, ' ').trim();
    if (badgeText) {
      runs.push({
        text: badgeText,
        color: nextStyle.color,
        fontSize: nextStyle.fontSize,
        bold: nextStyle.bold,
        bgColor: bg || undefined,
        borderColor: border?.color,
        isBadge: true,
        link: node.tag === 'a' ? node.attrs.href : undefined,
      });
    }
    return runs;
  }

  if (node.tag === 'a' && node.attrs.href) {
    const linkText = flattenTextWithBreaks(node, nextStyle.preserveWhitespace).trim();
    if (linkText) {
      runs.push({
        text: linkText,
        color: extractColor(node.style.color) || '#1d4ed8',
        fontSize: nextStyle.fontSize,
        bold: nextStyle.bold,
        link: node.attrs.href,
      });
    }
    return runs;
  }

  for (const child of node.children) {
    collectInlineRuns(child, nextStyle, runs);
  }
  return runs;
}

function normalizeInlineRuns(runs: InlineRun[], preserveWhitespace: boolean): InlineRun[] {
  if (preserveWhitespace) {
    // 先頭・末尾の純粋な改行のみ整え、内部改行は維持
    const joined = runs.slice();
    while (joined.length && !joined[0].isBadge && joined[0].text.trim() === '' && !joined[0].text.includes('\n')) {
      joined.shift();
    }
    while (joined.length && !joined[joined.length - 1].isBadge && joined[joined.length - 1].text.trim() === '' && !joined[joined.length - 1].text.includes('\n')) {
      joined.pop();
    }
    return joined;
  }

  const cleaned: InlineRun[] = [];
  for (const r of runs) {
    if (r.isBadge || r.text === '\n') {
      cleaned.push(r);
      continue;
    }
    let txt = r.text;
    if (cleaned.length === 0 || cleaned[cleaned.length - 1].text === '\n') {
      txt = txt.replace(/^\s+/, '');
    }
    if (txt) cleaned.push({ ...r, text: txt });
  }
  while (cleaned.length > 0 && !cleaned[cleaned.length - 1].isBadge) {
    const last = cleaned[cleaned.length - 1];
    last.text = last.text.replace(/[ \t]+$/, '');
    if (!last.text) cleaned.pop();
    else break;
  }
  return cleaned;
}

function runsToPlainText(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join('');
}

// ─── PDF レイアウト・レンダリングエンジン ─────────────────────────────
class HtmlPdfRenderer {
  private pdf: InstanceType<typeof PDFDocument>;
  private fontPath: string;
  private pageTop = PAGE_MARGIN_TOP;
  private pageBottom: number;

  constructor(pdf: InstanceType<typeof PDFDocument>, fontPath: string) {
    this.pdf = pdf;
    this.fontPath = fontPath;
    this.pageBottom = pdf.page.height - PAGE_MARGIN_BOTTOM;
  }

  private ensurePageSpace(neededHeight: number, y: number): number {
    const usable = this.pageBottom - this.pageTop;
    if (y > this.pageTop && neededHeight <= usable && y + neededHeight > this.pageBottom) {
      this.pdf.addPage();
      this.pdf.font(this.fontPath);
      return this.pageTop;
    }
    return y;
  }

  private nextPage(y: number): number {
    if (y > this.pageTop + 2) {
      this.pdf.addPage();
      this.pdf.font(this.fontPath);
    }
    return this.pageTop;
  }

  private measureInlineBlock(runs: InlineRun[], width: number, baseStyle: InheritedTextStyle): number {
    if (runs.length === 0) return 0;
    const hasBadge = runs.some((r) => r.isBadge);
    if (!hasBadge) {
      const fullText = runsToPlainText(runs);
      if (!fullText.trim()) return 0;
      const maxFs = Math.max(...runs.map((r) => r.fontSize), baseStyle.fontSize);
      this.pdf.fontSize(maxFs);
      const h = this.pdf.heightOfString(fullText, { width: Math.max(20, width), lineGap: maxFs >= 13 ? 3 : 2.5 });
      return Math.max(maxFs * 1.35, h);
    }

    // バッジ付き行の計測（行ごと）
    const lines = this.splitRunsIntoLines(runs);
    let totalH = 0;
    for (const lineRuns of lines) {
      const maxFs = Math.max(...lineRuns.map((r) => r.fontSize), baseStyle.fontSize);
      const plain = lineRuns.map((r) => r.text).join(' ');
      this.pdf.fontSize(maxFs);
      const estW = this.pdf.widthOfString(plain) + lineRuns.filter((r) => r.isBadge).length * 14;
      const lineCount = Math.max(1, Math.ceil(estW / Math.max(30, width)));
      totalH += lineCount * (maxFs * 1.55 + 2);
    }
    return totalH;
  }

  private splitRunsIntoLines(runs: InlineRun[]): InlineRun[][] {
    const lines: InlineRun[][] = [[]];
    for (const r of runs) {
      if (r.text === '\n') {
        lines.push([]);
        continue;
      }
      if (r.isBadge || !r.text.includes('\n')) {
        lines[lines.length - 1].push(r);
        continue;
      }
      const parts = r.text.split('\n');
      parts.forEach((p, idx) => {
        if (idx > 0) lines.push([]);
        if (p) lines[lines.length - 1].push({ ...r, text: p });
      });
    }
    return lines.filter((l, idx) => l.length > 0 || (idx > 0 && idx < lines.length - 1));
  }

  private drawInlineRuns(runs: InlineRun[], x: number, y: number, width: number, baseStyle: InheritedTextStyle): number {
    if (runs.length === 0) return y;
    const hasBadges = runs.some((r) => r.isBadge);
    const hasMixedStyle = runs.some((r) => r.color !== runs[0].color || r.fontSize !== runs[0].fontSize || r.link);

    // 単純テキスト or 色のみ異なるテキスト（バッジなし）
    if (!hasBadges) {
      const lines = this.splitRunsIntoLines(runs);
      let cy = y;
      for (const lineRuns of lines) {
        if (lineRuns.length === 0) {
          cy += baseStyle.fontSize * 0.9;
          continue;
        }
        const linePlain = lineRuns.map((r) => r.text).join('');
        const maxFs = Math.max(...lineRuns.map((r) => r.fontSize), baseStyle.fontSize);
        const lineGap = maxFs >= 13 ? 3 : 2.5;
        this.pdf.fontSize(maxFs);
        const h = this.pdf.heightOfString(linePlain, { width: Math.max(20, width), lineGap });
        cy = this.ensurePageSpace(Math.min(h, this.pageBottom - this.pageTop - 10), cy);

        if (!hasMixedStyle) {
          const r0 = lineRuns[0];
          this.pdf.fillColor(r0.color).fontSize(r0.fontSize);
          this.pdf.text(linePlain, x, cy, {
            width: Math.max(20, width),
            align: baseStyle.align,
            lineGap,
          });
        } else if (baseStyle.align === 'right' || baseStyle.align === 'center') {
          // 1行で収まる場合は正確に x を計算してセグメント色分け描画
          let totalW = 0;
          for (const seg of lineRuns) {
            this.pdf.fontSize(seg.fontSize);
            totalW += this.pdf.widthOfString(seg.text);
          }
          if (totalW <= width + 2) {
            let sx = baseStyle.align === 'right' ? x + width - totalW : x + (width - totalW) / 2;
            for (const seg of lineRuns) {
              this.pdf.fontSize(seg.fontSize).fillColor(seg.color);
              const w = this.pdf.widthOfString(seg.text);
              const yOffset = maxFs - seg.fontSize;
              this.pdf.text(seg.text, sx, cy + yOffset, { lineBreak: false, link: seg.link || undefined });
              sx += w;
            }
          } else {
            this.pdf.fillColor(lineRuns[0].color).fontSize(maxFs);
            this.pdf.text(linePlain, x, cy, { width: Math.max(20, width), align: baseStyle.align, lineGap });
          }
        } else {
          // 左寄せマルチセグメント（PDFKit の continued: true で自然折り返し＋色切替）
          lineRuns.forEach((seg, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === lineRuns.length - 1;
            this.pdf.fontSize(seg.fontSize).fillColor(seg.color);
            const opts: PDFKit.Mixins.TextOptions = {
              width: Math.max(20, width),
              align: 'left',
              lineGap,
              continued: !isLast,
              link: seg.link || undefined,
            };
            if (isFirst) this.pdf.text(seg.text, x, cy, opts);
            else this.pdf.text(seg.text, opts);
          });
        }
        cy += Math.max(maxFs * 1.35, h);
      }
      return cy;
    }

    // バッジ（ピル型ラベル）を含む行の描画
    const lines = this.splitRunsIntoLines(runs);
    let cy = y;
    for (const lineRuns of lines) {
      if (lineRuns.length === 0) {
        cy += baseStyle.fontSize * 0.9;
        continue;
      }
      const maxFs = Math.max(...lineRuns.map((r) => r.fontSize), baseStyle.fontSize);
      const lineH = maxFs * 1.55 + 2;
      cy = this.ensurePageSpace(lineH, cy);

      // 幅を計算
      const segWidths = lineRuns.map((seg) => {
        this.pdf.fontSize(seg.fontSize);
        const tw = this.pdf.widthOfString(seg.text);
        return seg.isBadge ? tw + 12 : tw;
      });
      const totalW = segWidths.reduce((a, b) => a + b + 2, 0);

      if (totalW <= width + 4) {
        let sx =
          baseStyle.align === 'right'
            ? x + width - totalW
            : baseStyle.align === 'center'
            ? x + (width - totalW) / 2
            : x;
        lineRuns.forEach((seg, idx) => {
          const sw = segWidths[idx];
          if (seg.isBadge && seg.bgColor) {
            const bh = seg.fontSize + 5;
            const by = cy + (maxFs - seg.fontSize) * 0.5;
            this.pdf.save();
            this.pdf.roundedRect(sx, by, sw, bh, 3).fill(seg.bgColor);
            if (seg.borderColor) {
              this.pdf.strokeColor(seg.borderColor).lineWidth(0.6).roundedRect(sx, by, sw, bh, 3).stroke();
            }
            this.pdf.restore();
            this.pdf.fontSize(seg.fontSize).fillColor(seg.color);
            this.pdf.text(seg.text, sx + 6, by + 2.5, { lineBreak: false, link: seg.link || undefined });
            sx += sw + 4;
          } else {
            this.pdf.fontSize(seg.fontSize).fillColor(seg.color);
            this.pdf.text(seg.text, sx, cy + 2, { lineBreak: false, link: seg.link || undefined });
            sx += sw + 2;
          }
        });
        cy += lineH;
      } else {
        // 幅を超える場合は通常テキストとして折り返し描画
        const plain = lineRuns.map((r) => (r.isBadge ? ` [${r.text}]` : r.text)).join('');
        this.pdf.fontSize(maxFs).fillColor(baseStyle.color);
        const h = this.pdf.heightOfString(plain, { width, lineGap: 2.5 });
        this.pdf.text(plain, x, cy, { width, align: baseStyle.align, lineGap: 2.5 });
        cy += Math.max(lineH, h);
      }
    }
    return cy;
  }

  private getEffectivePadding(node: HtmlNode, isRootContainer: boolean): BoxEdges {
    if (isRootContainer) return { top: 0, right: 0, bottom: 0, left: 0 };
    return getEdges(node.style, 'padding');
  }

  private isStandaloneButtonLink(node: HtmlNode): boolean {
    if (node.tag !== 'a') return false;
    const display = (node.style.display || '').toLowerCase();
    return Boolean(extractColor(node.style.background || node.style['background-color'])) &&
      (display.includes('inline-block') || display.includes('block'));
  }

  private measureNode(node: HtmlNode, availWidth: number, inherited: InheritedTextStyle, isRootContainer = false): number {
    if (node.tag === '#text') {
      const runs = normalizeInlineRuns(collectInlineRuns(node, inherited), inherited.preserveWhitespace);
      return this.measureInlineBlock(runs, availWidth, inherited);
    }
    if (node.tag === 'hr') return 14;
    if (node.tag === 'br') return inherited.fontSize * 0.8;

    const nextStyle = mergeTextStyle(node, inherited);
    const margin = isRootContainer ? { top: 0, right: 0, bottom: 0, left: 0 } : getEdges(node.style, 'margin');
    const padding = this.getEffectivePadding(node, isRootContainer);

    if (this.isStandaloneButtonLink(node)) {
      const btnText = flattenTextWithBreaks(node).trim();
      if (!btnText) return 0;
      return margin.top + padding.top + nextStyle.fontSize * 1.5 + padding.bottom + margin.bottom + 4;
    }

    if (node.tag === 'table') {
      return margin.top + this.measureTable(node, availWidth, nextStyle) + margin.bottom;
    }

    const display = (node.style.display || '').toLowerCase();
    const innerWidth = Math.max(40, availWidth - padding.left - padding.right);

    if (display === 'flex' || display === 'grid') {
      return margin.top + padding.top + this.measureFlexOrGrid(node, innerWidth, nextStyle) + padding.bottom + margin.bottom;
    }

    // すべてインライン要素の段落 / 見出し / テキストブロック
    const allInline = node.children.every((c) => INLINE_TAGS.has(c.tag));
    if (allInline) {
      const runs = normalizeInlineRuns(collectInlineRuns(node, nextStyle), nextStyle.preserveWhitespace);
      if (runs.length === 0) return 0;
      const textH = this.measureInlineBlock(runs, innerWidth, nextStyle);
      const defaultGap =
        node.tag === 'h1' ? 6 :
        node.tag === 'h2' ? 6 :
        node.tag === 'h3' ? 4 :
        node.tag === 'p' ? 4 : 0;
      const mb = margin.bottom || defaultGap;
      return margin.top + padding.top + textH + padding.bottom + mb;
    }

    // コンテナノード
    let total = margin.top + padding.top;
    node.children.forEach((c) => {
      total += this.measureNode(c, innerWidth, nextStyle, false);
    });
    return total + padding.bottom + margin.bottom;
  }

  private computeFlexColumns(node: HtmlNode, availWidth: number): Array<{ child: HtmlNode; xOffset: number; width: number }> {
    const children = node.children.filter(
      (c) => c.tag !== '#text' || Boolean((c.text || '').trim()),
    );
    if (children.length === 0) return [];

    const display = (node.style.display || '').toLowerCase();
    const justify = (node.style['justify-content'] || '').toLowerCase();
    const gapRaw = (node.style.gap || '').trim().split(/\s+/).pop();
    const gap = Math.max(10, parseLengthPx(gapRaw) ?? 12);

    // justify-content: flex-end（合計金額ボックス等）
    if (display === 'flex' && justify === 'flex-end' && children.length === 1) {
      const child = children[0];
      const specifiedW = parseLengthPx(child.style.width, availWidth);
      const w = Math.min(availWidth, specifiedW ?? Math.min(260, availWidth * 0.56));
      return [{ child, xOffset: availWidth - w, width: w }];
    }

    // CSS Grid (例: 1fr 1fr) または均等・指定幅 Flex カラム
    if (display === 'grid') {
      const colsSpec = (node.style['grid-template-columns'] || '').trim().split(/\s+/).filter(Boolean);
      const colCount = Math.max(1, colsSpec.length || children.length);
      const colW = (availWidth - gap * (colCount - 1)) / colCount;
      return children.map((child, idx) => ({
        child,
        xOffset: (idx % colCount) * (colW + gap),
        width: colW,
      }));
    }

    // Flex Row: 明示幅があれば採用、なければテキスト量に応じて配分
    const explicitWidths = children.map((c) => parseLengthPx(c.style.width, availWidth));
    if (explicitWidths.every((w) => w !== null)) {
      const sum = explicitWidths.reduce((a, b) => a + (b || 0), 0);
      const scale = sum > availWidth - gap * (children.length - 1)
        ? (availWidth - gap * (children.length - 1)) / sum
        : 1;
      const result: Array<{ child: HtmlNode; xOffset: number; width: number }> = [];
      let cx = 0;
      const extraBetween = justify === 'space-between' && children.length > 1
        ? Math.max(gap, (availWidth - sum * scale) / (children.length - 1))
        : gap;
      children.forEach((child, idx) => {
        const w = (explicitWidths[idx] || 0) * scale;
        result.push({ child, xOffset: cx, width: w });
        cx += w + extraBetween;
      });
      return result;
    }

    const colW = (availWidth - gap * (children.length - 1)) / children.length;
    if (children.length === 2 && justify === 'space-between') {
      const t0 = flattenTextWithBreaks(children[0]).trim();
      const t1 = flattenTextWithBreaks(children[1]).trim();
      const hasMultiLineChild0 = t0.includes('\n') || children[0].children.some((g) => !INLINE_TAGS.has(g.tag));
      const hasMultiLineChild1 = t1.includes('\n') || children[1].children.some((g) => !INLINE_TAGS.has(g.tag));
      if (!hasMultiLineChild0 && !hasMultiLineChild1) {
        const fs0 = parseLengthPx(children[0].style['font-size']) ?? parseLengthPx(node.style['font-size']) ?? 9.8;
        const fs1 = parseLengthPx(children[1].style['font-size']) ?? parseLengthPx(node.style['font-size']) ?? 9.8;
        this.pdf.fontSize(fs1);
        const w1Need = Math.min(availWidth * 0.55, Math.max(55, this.pdf.widthOfString(t1) + 14));
        this.pdf.fontSize(fs0);
        const w0Need = this.pdf.widthOfString(t0) + 10;
        if (w0Need + w1Need + gap <= availWidth) {
          return [
            { child: children[0], xOffset: 0, width: availWidth - gap - w1Need },
            { child: children[1], xOffset: availWidth - w1Need, width: w1Need },
          ];
        }
      }
      const isRightSummary = t1.length <= 42 && (children[1].style['text-align'] === 'right' || node.children.length === 2);
      const w0 = isRightSummary && t0.length > 12 ? availWidth * 0.56 - gap / 2 : colW;
      const w1 = availWidth - gap - w0;
      return [
        { child: children[0], xOffset: 0, width: w0 },
        { child: children[1], xOffset: w0 + gap, width: w1 },
      ];
    }

    return children.map((child, idx) => ({
      child,
      xOffset: idx * (colW + gap),
      width: colW,
    }));
  }

  private measureFlexOrGrid(node: HtmlNode, availWidth: number, inherited: InheritedTextStyle): number {
    const cols = this.computeFlexColumns(node, availWidth);
    if (cols.length === 0) return 0;
    const display = (node.style.display || '').toLowerCase();
    if (display === 'grid') {
      const colsSpec = (node.style['grid-template-columns'] || '').trim().split(/\s+/).filter(Boolean);
      const colCount = Math.max(1, colsSpec.length || cols.length);
      let total = 0;
      for (let i = 0; i < cols.length; i += colCount) {
        const rowCols = cols.slice(i, i + colCount);
        const rowH = Math.max(...rowCols.map((c) => this.measureNode(c.child, c.width, inherited, false)));
        total += rowH + (i + colCount < cols.length ? 10 : 0);
      }
      return total;
    }
    return Math.max(...cols.map((c) => this.measureNode(c.child, c.width, inherited, false)));
  }

  private computeTableLayout(table: HtmlNode, availWidth: number): {
    headerRows: HtmlNode[];
    bodyRows: HtmlNode[];
    colWidths: number[];
  } {
    const headerRows: HtmlNode[] = [];
    const bodyRows: HtmlNode[] = [];
    const collectRows = (n: HtmlNode, inHead: boolean) => {
      for (const c of n.children) {
        if (c.tag === 'thead') collectRows(c, true);
        else if (c.tag === 'tbody') collectRows(c, false);
        else if (c.tag === 'tr') {
          if (inHead || (headerRows.length === 0 && c.children.some((cell) => cell.tag === 'th'))) {
            headerRows.push(c);
          } else {
            bodyRows.push(c);
          }
        }
      }
    };
    collectRows(table, false);

    const allRows = [...headerRows, ...bodyRows];
    const colCount = Math.max(0, ...allRows.map((r) => r.children.filter((c) => c.tag === 'th' || c.tag === 'td').length));
    if (colCount === 0) return { headerRows, bodyRows, colWidths: [] };

    const explicitWidths = new Array<number | null>(colCount).fill(null);
    for (const r of allRows) {
      const cells = r.children.filter((c) => c.tag === 'th' || c.tag === 'td');
      cells.forEach((cell, i) => {
        if (explicitWidths[i] === null) {
          const w = parseLengthPx(cell.style.width || cell.attrs.width, availWidth);
          if (w && w > 20) explicitWidths[i] = w;
        }
      });
    }

    const colWidths = new Array<number>(colCount).fill(availWidth / colCount);
    const fixedSum = explicitWidths.reduce<number>((acc, w) => acc + (w || 0), 0);
    const autoCount = explicitWidths.filter((w) => w === null).length;

    if (autoCount > 0 && fixedSum < availWidth - 40) {
      const rem = (availWidth - fixedSum) / autoCount;
      for (let i = 0; i < colCount; i++) {
        colWidths[i] = explicitWidths[i] ?? rem;
      }
    } else if (autoCount === 0 && fixedSum > 0) {
      const scale = availWidth / fixedSum;
      for (let i = 0; i < colCount; i++) {
        colWidths[i] = (explicitWidths[i] || availWidth / colCount) * scale;
      }
    } else if (colCount === 2) {
      // 2列テーブル（請求書品名＋金額、提案書P4項目＋金額）は 68% / 32% で読みやすく配置
      colWidths[0] = availWidth * 0.68;
      colWidths[1] = availWidth * 0.32;
    } else if (colCount === 3) {
      colWidths[0] = availWidth * 0.48;
      colWidths[1] = availWidth * 0.28;
      colWidths[2] = availWidth * 0.24;
    }

    return { headerRows, bodyRows, colWidths };
  }

  private measureTableRow(row: HtmlNode, colWidths: number[], inherited: InheritedTextStyle): number {
    const cells = row.children.filter((c) => c.tag === 'th' || c.tag === 'td');
    let maxH = 22;
    cells.forEach((cell, idx) => {
      const w = Math.max(24, (colWidths[idx] || 60) - 12);
      const cellStyle = mergeTextStyle(cell, {
        ...inherited,
        fontSize: cell.tag === 'th' ? 9 : 9.2,
      });
      const runs = normalizeInlineRuns(collectInlineRuns(cell, cellStyle), true);
      const h = this.measureInlineBlock(runs, w, cellStyle);
      if (h + 12 > maxH) maxH = h + 12;
    });
    return maxH;
  }

  private measureTable(table: HtmlNode, availWidth: number, inherited: InheritedTextStyle): number {
    const { headerRows, bodyRows, colWidths } = this.computeTableLayout(table, availWidth);
    if (colWidths.length === 0) return 0;
    let total = 0;
    for (const r of [...headerRows, ...bodyRows]) {
      total += this.measureTableRow(r, colWidths, inherited);
    }
    return total + 8;
  }

  private renderTableRow(
    row: HtmlNode,
    x: number,
    y: number,
    availWidth: number,
    colWidths: number[],
    inherited: InheritedTextStyle,
    isHeaderRow: boolean,
  ): number {
    const rowBg = extractColor(row.style.background || row.style['background-color']) || (isHeaderRow ? '#0f172a' : null);
    const rowColor = extractColor(row.style.color) || (rowBg === '#0f172a' ? '#ffffff' : inherited.color);
    const rowStyle: InheritedTextStyle = {
      ...inherited,
      color: rowColor,
      fontSize: isHeaderRow ? 9 : 9.2,
      bold: isHeaderRow || inherited.bold,
    };

    const rowHeight = this.measureTableRow(row, colWidths, rowStyle);
    const rowBottomBorder = parseBorderSpec(row.style['border-bottom']);

    if (rowBg) {
      this.pdf.save();
      this.pdf.rect(x, y, availWidth, rowHeight).fill(rowBg);
      this.pdf.restore();
    }

    const cells = row.children.filter((c) => c.tag === 'th' || c.tag === 'td');
    let cx = x;
    cells.forEach((cell, idx) => {
      const cw = colWidths[idx] || 60;
      const cellStyle = mergeTextStyle(cell, rowStyle);
      if (!cell.style['text-align']) {
        const plain = flattenTextWithBreaks(cell).trim();
        if (idx === cells.length - 1 && /^[¥￥]?[-0-9,]+(\s*円)?/.test(plain)) {
          cellStyle.align = 'right';
        }
      }
      const runs = normalizeInlineRuns(collectInlineRuns(cell, cellStyle), true);
      const cellBorderBottom = parseBorderSpec(cell.style['border-bottom']) || rowBottomBorder;

      this.drawInlineRuns(runs, cx + 6, y + 6, Math.max(20, cw - 12), cellStyle);

      if (cellBorderBottom && !rowBg) {
        this.pdf.save();
        this.pdf
          .strokeColor(cellBorderBottom.color)
          .lineWidth(cellBorderBottom.width)
          .moveTo(cx, y + rowHeight)
          .lineTo(cx + cw, y + rowHeight)
          .stroke();
        this.pdf.restore();
      }
      cx += cw;
    });

    // デフォルトの下線（row と cell の両方に下線指定がなくても、視認性確保のため薄い罫線）
    if (!rowBg && !rowBottomBorder && !cells.some((c) => c.style['border-bottom'])) {
      this.pdf.save();
      this.pdf
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(x, y + rowHeight)
        .lineTo(x + availWidth, y + rowHeight)
        .stroke();
      this.pdf.restore();
    }

    return y + rowHeight;
  }

  private renderTable(table: HtmlNode, x: number, y: number, availWidth: number, inherited: InheritedTextStyle): number {
    const { headerRows, bodyRows, colWidths } = this.computeTableLayout(table, availWidth);
    if (colWidths.length === 0) return y;

    let cy = y;
    const drawHeaders = () => {
      for (const hr of headerRows) {
        cy = this.renderTableRow(hr, x, cy, availWidth, colWidths, inherited, true);
      }
    };

    const firstBodyHeight = bodyRows[0] ? this.measureTableRow(bodyRows[0], colWidths, inherited) : 0;
    const headerHeight = headerRows.reduce((a, r) => a + this.measureTableRow(r, colWidths, inherited), 0);
    cy = this.ensurePageSpace(headerHeight + firstBodyHeight, cy);
    drawHeaders();

    for (const br of bodyRows) {
      const rh = this.measureTableRow(br, colWidths, inherited);
      if (cy > this.pageTop && cy + rh > this.pageBottom) {
        cy = this.nextPage(cy);
        drawHeaders();
      }
      cy = this.renderTableRow(br, x, cy, availWidth, colWidths, inherited, false);
    }

    return cy + 8;
  }

  private renderNode(node: HtmlNode, x: number, y: number, availWidth: number, inherited: InheritedTextStyle, isRootContainer = false): number {
    if (node.tag === '#text') {
      const runs = normalizeInlineRuns(collectInlineRuns(node, inherited), inherited.preserveWhitespace);
      if (runs.length === 0) return y;
      return this.drawInlineRuns(runs, x, y, availWidth, inherited);
    }
    if (node.tag === 'hr') {
      const cy = this.ensurePageSpace(14, y);
      this.pdf.save();
      this.pdf.strokeColor('#cbd5e1').lineWidth(0.6).moveTo(x, cy + 6).lineTo(x + availWidth, cy + 6).stroke();
      this.pdf.restore();
      return cy + 14;
    }
    if (node.tag === 'br') {
      return y + inherited.fontSize * 0.8;
    }

    const nextStyle = mergeTextStyle(node, inherited);
    const margin = isRootContainer ? { top: 0, right: 0, bottom: 0, left: 0 } : getEdges(node.style, 'margin');
    const padding = this.getEffectivePadding(node, isRootContainer);

    if (this.isStandaloneButtonLink(node)) {
      const btnText = flattenTextWithBreaks(node).trim();
      if (!btnText) return y;
      const bg = extractColor(node.style.background || node.style['background-color']) || '#059669';
      const color = extractColor(node.style.color) || '#ffffff';
      const fs = nextStyle.fontSize;
      this.pdf.fontSize(fs);
      const btnW = Math.min(availWidth, this.pdf.widthOfString(btnText) + Math.max(36, padding.left + padding.right));
      const btnH = fs + Math.max(14, padding.top + padding.bottom);
      let cy = this.ensurePageSpace(margin.top + btnH + margin.bottom, y) + margin.top;
      const bx = nextStyle.align === 'center' ? x + (availWidth - btnW) / 2 : nextStyle.align === 'right' ? x + availWidth - btnW : x;

      this.pdf.save();
      this.pdf.roundedRect(bx, cy, btnW, btnH, 6).fill(bg);
      this.pdf.restore();
      this.pdf.fontSize(fs).fillColor(color);
      this.pdf.text(btnText, bx, cy + (btnH - fs * 1.15) / 2, {
        width: btnW,
        align: 'center',
        link: node.attrs.href || undefined,
      });
      return cy + btnH + margin.bottom;
    }

    if (node.tag === 'table') {
      const cy = y + margin.top;
      return this.renderTable(node, x, cy, availWidth, nextStyle) + margin.bottom;
    }

    const bgColor = isRootContainer ? null : extractColor(node.style.background || node.style['background-color']);
    const borderAll = isRootContainer ? null : parseBorderSpec(node.style.border);
    const borderTop = isRootContainer ? null : parseBorderSpec(node.style['border-top']);
    const borderBottom = isRootContainer ? null : parseBorderSpec(node.style['border-bottom']);
    const borderLeft = isRootContainer ? null : parseBorderSpec(node.style['border-left']);
    const borderRight = isRootContainer ? null : parseBorderSpec(node.style['border-right']);
    const radius = parseLengthPx(node.style['border-radius']) ?? 0;
    const hasVisualBox = Boolean(bgColor || borderAll || borderTop || borderBottom || borderLeft || borderRight);

    const display = (node.style.display || '').toLowerCase();
    const innerX = x + padding.left;
    const innerWidth = Math.max(30, availWidth - padding.left - padding.right);

    // フレックス / グリッド行の描画
    if (display === 'flex' || display === 'grid') {
      const cols = this.computeFlexColumns(node, innerWidth);
      if (cols.length === 0) return y;
      const blockH = this.measureFlexOrGrid(node, innerWidth, nextStyle) + padding.top + Math.max(padding.bottom, borderBottom ? 8 : 0);
      let cy = this.ensurePageSpace(margin.top + blockH + margin.bottom, y) + margin.top;
      const boxY = cy;

      if (hasVisualBox) {
        this.drawBoxChrome(x, boxY, availWidth, blockH, { bgColor, borderAll, borderTop, borderBottom, borderLeft, borderRight, radius });
      }

      let contentY = boxY + padding.top;
      if (display === 'grid') {
        const colsSpec = (node.style['grid-template-columns'] || '').trim().split(/\s+/).filter(Boolean);
        const colCount = Math.max(1, colsSpec.length || cols.length);
        for (let i = 0; i < cols.length; i += colCount) {
          const rowCols = cols.slice(i, i + colCount);
          const rowH = Math.max(...rowCols.map((c) => this.measureNode(c.child, c.width, nextStyle, false)));
          contentY = this.ensurePageSpace(rowH, contentY);
          for (const col of rowCols) {
            this.renderNode(col.child, innerX + col.xOffset, contentY, col.width, nextStyle, false);
          }
          contentY += rowH + (i + colCount < cols.length ? 10 : 0);
        }
      } else {
        const justify = (node.style['justify-content'] || '').toLowerCase();
        const alignItems = (node.style['align-items'] || '').toLowerCase();
        const colHeights = cols.map((c) => this.measureNode(c.child, c.width, nextStyle, false));
        const maxColH = Math.max(...colHeights, 0);
        cols.forEach((col, idx) => {
          const childStyle = col.child.style['text-align'] || justify === 'space-between' && idx === cols.length - 1 && !col.child.style.width && cols.length === 2 && !col.child.children.some((g) => !INLINE_TAGS.has(g.tag))
            ? nextStyle
            : nextStyle;
          const yOff = alignItems === 'flex-end' || alignItems === 'baseline'
            ? Math.max(0, maxColH - colHeights[idx])
            : 0;
          this.renderNode(col.child, innerX + col.xOffset, contentY + yOff, col.width, childStyle, false);
        });
      }

      return boxY + blockH + margin.bottom;
    }

    // すべてインライン要素（見出し・段落・ラベル）
    const allInline = node.children.every((c) => INLINE_TAGS.has(c.tag));
    if (allInline) {
      const isInlinePill = node.tag === 'span' && (node.style.display || 'inline') !== 'block' && hasVisualBox;
      if (isInlinePill) {
        const plainBadge = flattenTextWithBreaks(node, nextStyle.preserveWhitespace).replace(/\n+/g, ' ').trim();
        if (!plainBadge) return y;
        this.pdf.fontSize(nextStyle.fontSize);
        const tw = this.pdf.widthOfString(plainBadge);
        const padX = Math.max(6, padding.left + padding.right);
        const pillWidth = Math.min(availWidth, tw + padX * 1.15);
        const boxH = Math.max(nextStyle.fontSize + 6, nextStyle.fontSize + padding.top + padding.bottom + 2);
        const cy = this.ensurePageSpace(margin.top + boxH + 4, y) + margin.top;
        const boxX = nextStyle.align === 'right'
          ? x + availWidth - pillWidth
          : nextStyle.align === 'center'
          ? x + (availWidth - pillWidth) / 2
          : x;
        this.drawBoxChrome(boxX, cy, pillWidth, boxH, { bgColor, borderAll, borderTop, borderBottom, borderLeft, borderRight, radius });
        this.pdf.fontSize(nextStyle.fontSize).fillColor(nextStyle.color);
        this.pdf.text(plainBadge, boxX, cy + (boxH - nextStyle.fontSize * 1.15) / 2, {
          width: pillWidth,
          align: 'center',
        });
        return cy + boxH + (margin.bottom || 4);
      }

      const runs = normalizeInlineRuns(collectInlineRuns(node, nextStyle), nextStyle.preserveWhitespace);
      if (runs.length === 0) return y;
      const textH = this.measureInlineBlock(runs, innerWidth, nextStyle);
      const boxH = padding.top + textH + padding.bottom;
      const defaultGap =
        node.tag === 'h1' ? 5 :
        node.tag === 'h2' ? 5 :
        node.tag === 'h3' ? 4 :
        node.tag === 'p' ? 3 : 2;
      const mb = margin.bottom || defaultGap;

      let cy = this.ensurePageSpace(margin.top + Math.min(boxH, this.pageBottom - this.pageTop - 16), y) + margin.top;
      const boxY = cy;

      if (hasVisualBox) {
        this.drawBoxChrome(x, boxY, availWidth, boxH, { bgColor, borderAll, borderTop, borderBottom, borderLeft, borderRight, radius });
      }

      const endY = this.drawInlineRuns(runs, innerX, boxY + padding.top, innerWidth, nextStyle);
      return Math.max(boxY + boxH, endY + padding.bottom) + mb;
    }

    // カード / セクション / コンテナ（box 装飾があれば全体高さを計測し、収まる場合は改ページ後にまとめて描画）
    if (hasVisualBox) {
      const boxContentH = node.children.reduce(
        (acc, c) => acc + this.measureNode(c, innerWidth, nextStyle, false),
        0,
      ) + padding.top + padding.bottom;
      const usable = this.pageBottom - this.pageTop;
      let cy = y + margin.top;
      if (boxContentH <= usable) {
        cy = this.ensurePageSpace(boxContentH, cy);
        this.drawBoxChrome(x, cy, availWidth, boxContentH, { bgColor, borderAll, borderTop, borderBottom, borderLeft, borderRight, radius });
        let childY = cy + padding.top;
        for (const c of node.children) {
          childY = this.renderNode(c, innerX, childY, innerWidth, nextStyle, false);
        }
        return cy + boxContentH + margin.bottom;
      }
      // 1ページを超える大きなボックスは上ボーダー・下ボーダーを分けつつ中身を自然に改ページ
      if (borderTop) {
        this.drawBoxChrome(x, cy, availWidth, 0, { bgColor: null, borderAll: null, borderTop, borderBottom: null, borderLeft: null, borderRight: null, radius: 0 });
      }
      let childY = cy + padding.top;
      for (const c of node.children) {
        childY = this.renderNode(c, innerX, childY, innerWidth, nextStyle, false);
      }
      return childY + padding.bottom + margin.bottom;
    }

    // 装飾なしラッパー div / root
    let cy = y + margin.top;
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // 見出し（h1〜h3）がページ下端に孤立しないよう次の要素の先頭分も含めて判定
      if ((child.tag === 'h1' || child.tag === 'h2' || child.tag === 'h3') && i + 1 < children.length) {
        const headingH = this.measureNode(child, innerWidth, nextStyle, false);
        const nextH = Math.min(48, this.measureNode(children[i + 1], innerWidth, nextStyle, false));
        cy = this.ensurePageSpace(headingH + nextH, cy);
      }
      cy = this.renderNode(child, innerX, cy, innerWidth, nextStyle, false);
    }
    return cy + margin.bottom;
  }

  private drawBoxChrome(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
      bgColor: string | null;
      borderAll: BorderSpec | null;
      borderTop: BorderSpec | null;
      borderBottom: BorderSpec | null;
      borderLeft: BorderSpec | null;
      borderRight: BorderSpec | null;
      radius: number;
    },
  ) {
    const r = Math.min(opts.radius, w / 4, Math.max(0, h / 4));
    this.pdf.save();
    if (opts.bgColor && h > 0) {
      if (r > 0) this.pdf.roundedRect(x, y, w, h, r).fill(opts.bgColor);
      else this.pdf.rect(x, y, w, h).fill(opts.bgColor);
    }
    if (opts.borderAll && h > 0) {
      this.pdf.strokeColor(opts.borderAll.color).lineWidth(opts.borderAll.width);
      if (r > 0) this.pdf.roundedRect(x, y, w, h, r).stroke();
      else this.pdf.rect(x, y, w, h).stroke();
    }
    if (opts.borderTop) {
      this.pdf.strokeColor(opts.borderTop.color).lineWidth(opts.borderTop.width).moveTo(x, y).lineTo(x + w, y).stroke();
    }
    if (opts.borderBottom && h >= 0) {
      this.pdf.strokeColor(opts.borderBottom.color).lineWidth(opts.borderBottom.width).moveTo(x, y + h).lineTo(x + w, y + h).stroke();
    }
    if (opts.borderLeft && h > 0) {
      this.pdf.strokeColor(opts.borderLeft.color).lineWidth(Math.max(1.5, opts.borderLeft.width)).moveTo(x, y).lineTo(x, y + h).stroke();
    }
    if (opts.borderRight && h > 0) {
      this.pdf.strokeColor(opts.borderRight.color).lineWidth(opts.borderRight.width).moveTo(x + w, y).lineTo(x + w, y + h).stroke();
    }
    this.pdf.restore();
  }

  public renderDocument(tree: HtmlNode, startY: number, pageWidth: number): number {
    const baseStyle: InheritedTextStyle = {
      color: '#1e293b',
      fontSize: 9.8,
      bold: false,
      align: 'left',
      preserveWhitespace: false,
    };

    // ルート直下の要素が単一のラッパー <div>（max-width 指定）ならルートパディングを省いて全面使う
    const meaningfulChildren = tree.children.filter((c) => c.tag !== '#text' || Boolean((c.text || '').trim()));
    if (meaningfulChildren.length === 1 && meaningfulChildren[0].tag === 'div') {
      return this.renderNode(meaningfulChildren[0], PAGE_MARGIN_X, startY, pageWidth, baseStyle, true);
    }
    let cy = startY;
    for (const child of meaningfulChildren) {
      cy = this.renderNode(child, PAGE_MARGIN_X, cy, pageWidth, baseStyle, false);
    }
    return cy;
  }
}

function hasEmbeddedHeader(tree: HtmlNode): boolean {
  return collectNodesByTag(tree, 'h1').length > 0;
}

export async function generateDocumentPdf(doc: CustomerDoc, companyName?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE_MARGIN_TOP, bottom: PAGE_MARGIN_BOTTOM, left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
        info: {
          Title: doc.title || '書類',
          Author: '有限会社MST',
          Subject: doc.document_type || '重要書類',
        },
      });

      const fontPath = getJapaneseFont();
      pdf.font(fontPath);

      const buffers: Buffer[] = [];
      pdf.on('data', (chunk) => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', (err) => reject(err));

      const pageWidth = pdf.page.width - PAGE_MARGIN_X * 2; // 595.28 - 80 = 515.28
      const htmlStr = String(doc.body_html || '');
      const tree = parseHtmlTree(htmlStr);

      let cursorY = PAGE_MARGIN_TOP;

      // 本文HTML自体に見出し(h1)や発行ヘッダが含まれていない簡易HTMLの場合のみ、標準ヘッダを補う
      if (!hasEmbeddedHeader(tree)) {
        pdf.fillColor('#0f172a').fontSize(17).text(doc.title || '書類', PAGE_MARGIN_X, cursorY, { width: pageWidth, align: 'center' });
        cursorY += 26;
        pdf.strokeColor('#334155').lineWidth(1.2).moveTo(PAGE_MARGIN_X, cursorY).lineTo(PAGE_MARGIN_X + pageWidth, cursorY).stroke();
        cursorY += 14;

        const createdDate = doc.created_at
          ? new Date(doc.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
          : new Date().toLocaleDateString('ja-JP');

        pdf.fillColor('#0f172a').fontSize(11).text(`${companyName || 'お客様'} 御中`, PAGE_MARGIN_X, cursorY, { width: 260 });
        pdf.fillColor('#64748b').fontSize(8.5).text('いつも格別のご愛顧を賜り、厚く御礼申し上げます。', PAGE_MARGIN_X, cursorY + 18, { width: 260 });

        const rightX = PAGE_MARGIN_X + pageWidth - 230;
        pdf.fillColor('#0f172a').fontSize(8.5);
        pdf.text(`発行日: ${createdDate}`, rightX, cursorY, { width: 230, align: 'right' });
        pdf.text(`書類番号: ${doc.id.slice(0, 8).toUpperCase()}`, rightX, cursorY + 13, { width: 230, align: 'right' });
        pdf.text('有限会社MST', rightX, cursorY + 29, { width: 230, align: 'right' });
        pdf.text('〒503-0981 岐阜県大垣市桧町127番地', rightX, cursorY + 42, { width: 230, align: 'right' });
        pdf.text('Email: contact@mstcorp.info', rightX, cursorY + 55, { width: 230, align: 'right' });

        cursorY += 74;
        pdf.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(PAGE_MARGIN_X, cursorY).lineTo(PAGE_MARGIN_X + pageWidth, cursorY).stroke();
        cursorY += 14;
      }

      const renderer = new HtmlPdfRenderer(pdf, fontPath);
      cursorY = renderer.renderDocument(tree, cursorY, pageWidth);

      // 最下部の電子発行注記（1ページに収まる場合は余白を見て、溢れる場合は次ページへ）
      if (cursorY > pdf.page.height - 58) {
        pdf.addPage();
        pdf.font(fontPath);
        cursorY = PAGE_MARGIN_TOP;
      } else {
        cursorY += 8;
      }
      pdf.fillColor('#64748b').fontSize(7.5).text('※ 本書は有限会社MSTより電子的に作成・発行された重要書類です。', PAGE_MARGIN_X, cursorY, {
        align: 'center',
        width: pageWidth,
      });

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}
