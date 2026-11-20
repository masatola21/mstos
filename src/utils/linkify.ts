export type LinkifiedSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string; href: string };

const URL_REGEX = /https?:\/\/[^\s<>"'\u3000「」『』【】（）〔〕［］｛｝〈〉《》]+/g;
const TRAILING_PUNCTUATION = new Set(['.', ',', ':', ';', '!', '?', '。', '、', '．', '，', '：', '；', '！', '？', ')', '）', '」', '』', '】', '>', ']', '}', "'", '"']);

/**
 * Splits plain text into text chunks and safe clickable HTTP/HTTPS URL segments,
 * trimming trailing sentence punctuation while keeping balanced parentheses inside URLs.
 */
export function splitTextWithUrls(text: string): LinkifiedSegment[] {
  if (!text) return [];
  const segments: LinkifiedSegment[] = [];
  let lastIndex = 0;

  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const start = match.index;
    let rawUrl = match[0];

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    let trimmedTail = '';
    while (rawUrl.length > 0) {
      const lastChar = rawUrl[rawUrl.length - 1];
      if (!TRAILING_PUNCTUATION.has(lastChar)) break;

      if (lastChar === ')') {
        const openCount = (rawUrl.match(/\(/g) || []).length;
        const closeCount = (rawUrl.match(/\)/g) || []).length;
        if (closeCount <= openCount) break;
      }

      trimmedTail = lastChar + trimmedTail;
      rawUrl = rawUrl.slice(0, -1);
    }

    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
      segments.push({ type: 'url', value: rawUrl, href: rawUrl });
    } else if (rawUrl) {
      segments.push({ type: 'text', value: rawUrl });
    }

    if (trimmedTail) {
      segments.push({ type: 'text', value: trimmedTail });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Converts HTML email content into readable plain text while preserving
 * <a href="https://..."> URLs so meeting/booking links remain visible and clickable.
 */
export function htmlToReadableTextPreservingLinks(html: string): string {
  if (!html) return '';
  let work = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');

  // Preserve anchor href URLs before stripping tags
  work = work.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_full, rawHref, innerHtml) => {
    const href = decodeHtmlEntities(String(rawHref || '')).trim();
    const innerText = decodeHtmlEntities(String(innerHtml || '').replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();

    if (!/^https?:\/\//i.test(href)) {
      return innerText || '';
    }
    if (!innerText) return href;
    if (innerText.includes(href)) return innerText;
    return `${innerText} (${href})`;
  });

  work = work
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|section|article|table)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '・')
    .replace(/<[^>]+>/g, ' ');

  work = decodeHtmlEntities(work);

  return work
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface QuickLinkItem {
  label: string;
  url: string;
  kind: 'meeting' | 'booking' | 'other';
}

function classifyUrl(url: string): QuickLinkItem {
  const lower = url.toLowerCase();
  if (lower.includes('meet.google.com')) return { label: 'Google Meetに参加', url, kind: 'meeting' };
  if (lower.includes('zoom.us')) return { label: 'Zoomに参加', url, kind: 'meeting' };
  if (lower.includes('teams.microsoft.com')) return { label: 'Teamsに参加', url, kind: 'meeting' };
  if (lower.includes('timerex.net')) return { label: 'TimeRexリンクを開く', url, kind: 'booking' };
  if (lower.includes('calendar.google.com')) return { label: 'Googleカレンダーを開く', url, kind: 'booking' };
  return { label: url, url, kind: 'other' };
}

/**
 * Extracts deduplicated meeting / booking URLs (Google Meet, Zoom, Teams, TimeRex, etc.)
 * from both plain text and HTML bodies for 1-click access.
 */
export function extractQuickActionUrls(textBody?: string, htmlBody?: string): QuickLinkItem[] {
  const combinedText = [
    textBody || '',
    htmlBody ? htmlToReadableTextPreservingLinks(htmlBody) : '',
  ]
    .filter(Boolean)
    .join('\n');

  const seen = new Set<string>();
  const results: QuickLinkItem[] = [];

  for (const seg of splitTextWithUrls(combinedText)) {
    if (seg.type !== 'url') continue;
    if (seen.has(seg.href)) continue;
    seen.add(seg.href);
    const classified = classifyUrl(seg.href);
    if (classified.kind !== 'other') {
      results.push(classified);
    }
  }

  return results;
}
