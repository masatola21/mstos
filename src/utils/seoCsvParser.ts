/**
 * Google Search Console および GA4 のエクスポートCSVパーサー
 */

export interface ParsedSeoRow {
  target: string;        // ページURL または 検索クエリ
  targetType: 'page' | 'query' | 'other';
  impressions: number;
  clicks: number;
  avgPosition: number;
  ctr: number;           // パーセント（例: 5.2）
  matchedArticleId?: string;
  matchedArticleTitle?: string;
  resolvedTitle?: string; // 人間が読みやすいページ名（例: 🏠 トップページ、記事タイトル）
  cleanPath?: string;     // 正規化されたパス（例: /media/dx-support）
}

export interface ResolvedPageInfo {
  displayName: string;
  cleanPath: string;
  pageType: 'article' | 'home' | 'media_index' | 'service' | 'contact' | 'query' | 'other';
  typeLabel: string;
  matchedArticleId?: string;
  matchedArticleTitle?: string;
  fullUrl?: string;
}

/**
 * ページURL または 検索クエリから、人間が直感的に理解できるページ名・種別を解決する
 */
export function resolvePageInfo(
  targetOrUrl: string,
  articles: Array<{ id: string; title: string; payload?: { slug?: string } }> = []
): ResolvedPageInfo {
  const raw = (targetOrUrl || '').trim();
  if (!raw) {
    return { displayName: '未指定', cleanPath: '', pageType: 'other', typeLabel: '不明' };
  }

  // 1. 検索クエリ判定（URL形式でない一般的な文字列）
  const isUrlLike = raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/') || raw.includes('.html');
  if (!isUrlLike && !raw.includes('/')) {
    return {
      displayName: `🔍 ${raw}`,
      cleanPath: raw,
      pageType: 'query',
      typeLabel: '検索クエリ',
    };
  }

  // 2. URLの解析とパス抽出
  let pathname = raw;
  let fullUrl: string | undefined;

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      fullUrl = raw;
      const parsed = new URL(raw);
      pathname = parsed.pathname;
    }
  } catch {
    pathname = raw;
  }

  // URLデコード（日本語スラッグ対応）
  try {
    pathname = decodeURIComponent(pathname);
  } catch {}

  // パスの末尾スラッシュの正規化
  const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const lowerPath = cleanPath.toLowerCase();

  // 3. トップページ判定
  if (lowerPath === '' || lowerPath === '/' || lowerPath === '/index' || lowerPath === '/index.html') {
    return {
      displayName: '🏠 トップページ（ホーム）',
      cleanPath: '/',
      pageType: 'home',
      typeLabel: 'トップページ',
      fullUrl,
    };
  }

  // 4. メディア・お役立ち情報一覧
  if (lowerPath === '/media' || lowerPath === '/blog' || lowerPath === '/media/index' || lowerPath === '/news') {
    return {
      displayName: '📚 お役立ち情報・記事一覧',
      cleanPath,
      pageType: 'media_index',
      typeLabel: 'メディア一覧',
      fullUrl,
    };
  }

  // 5. サービス紹介ページ
  if (lowerPath === '/service' || lowerPath === '/services' || lowerPath.startsWith('/services/') || lowerPath.startsWith('/service/')) {
    const sub = cleanPath.split('/').filter(Boolean).slice(1).join('/');
    const subLabel = sub ? ` (${sub})` : '';
    return {
      displayName: `💼 サービス紹介${subLabel}`,
      cleanPath,
      pageType: 'service',
      typeLabel: 'サービス',
      fullUrl,
    };
  }

  // 6. お問い合わせ
  if (lowerPath === '/contact' || lowerPath.startsWith('/contact')) {
    return {
      displayName: '✉️ お問い合わせ',
      cleanPath,
      pageType: 'contact',
      typeLabel: 'お問い合わせ',
      fullUrl,
    };
  }

  // 7. 会社概要・特商法など
  if (lowerPath === '/company' || lowerPath === '/about' || lowerPath.startsWith('/company')) {
    return {
      displayName: '🏢 会社概要',
      cleanPath,
      pageType: 'other',
      typeLabel: '会社情報',
      fullUrl,
    };
  }
  if (lowerPath === '/privacy' || lowerPath.includes('privacy')) {
    return {
      displayName: '📜 プライバシーポリシー',
      cleanPath,
      pageType: 'other',
      typeLabel: '規約',
      fullUrl,
    };
  }

  // 8. 自社記事とのマッチング
  // パスの末尾セグメントをスラッグ候補とする（例: /media/ai-consulting -> ai-consulting）
  const segments = cleanPath.split('/').filter(Boolean);
  const slugFromUrl = segments[segments.length - 1] || '';

  const matched = articles.find((a) => {
    const slug = (a.payload?.slug || '').trim();
    if (!slug) return false;
    let decodedSlug = slug;
    try {
      decodedSlug = decodeURIComponent(slug);
    } catch {}

    // 完全一致
    if (slugFromUrl === slug || slugFromUrl === decodedSlug) return true;
    // URLの末尾またはパス内にスラッグが含まれるか
    if (cleanPath.endsWith(`/${slug}`) || cleanPath.endsWith(`/${decodedSlug}`)) return true;
    if (raw.includes(`/${slug}`) || raw.includes(`/${decodedSlug}`)) return true;
    // タイトルが含まれるか
    if (a.title && (cleanPath.includes(a.title) || raw.includes(encodeURIComponent(a.title)))) return true;
    return false;
  });

  if (matched) {
    return {
      displayName: `📄 ${matched.title}`,
      cleanPath,
      pageType: 'article',
      typeLabel: '自社記事',
      matchedArticleId: matched.id,
      matchedArticleTitle: matched.title,
      fullUrl,
    };
  }

  // 9. 記事にはマッチしなかった一般ページ
  const prettyName = slugFromUrl ? `📄 /${slugFromUrl}` : cleanPath;
  return {
    displayName: prettyName,
    cleanPath,
    pageType: 'other',
    typeLabel: '一般ページ',
    fullUrl,
  };
}

export interface ParseCsvResult {
  sourceType: 'gsc_pages' | 'gsc_queries' | 'ga4_pages' | 'generic';
  rows: ParsedSeoRow[];
  totalImpressions: number;
  totalClicks: number;
  errors: string[];
}

/**
 * CSVの1行をパース（ダブルクォート対応）
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Search Console / GA4 のCSVテキストを解析
 */
export function parseSeoCsv(
  csvText: string,
  articles: Array<{ id: string; title: string; payload?: { slug?: string } }> = []
): ParseCsvResult {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { sourceType: 'generic', rows: [], totalImpressions: 0, totalClicks: 0, errors: ['CSVデータが空またはヘッダー行がありません。'] };
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase());

  // 列インデックスの特定
  let targetIdx = -1;
  let targetType: 'page' | 'query' | 'other' = 'page';
  let clicksIdx = -1;
  let impIdx = -1;
  let ctrIdx = -1;
  let posIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (/top pages|上位のページ|ページ|page path|page|url/.test(h)) {
      targetIdx = i;
      targetType = 'page';
    } else if (/top queries|上位のクエリ|クエリ|query|search query|検索キーワード/.test(h)) {
      targetIdx = i;
      targetType = 'query';
    } else if (/clicks|クリック数|クリック/.test(h)) {
      clicksIdx = i;
    } else if (/impressions|表示回数|インプレッション|views|表示/.test(h)) {
      impIdx = i;
    } else if (/ctr|クリック率/.test(h)) {
      ctrIdx = i;
    } else if (/position|掲載順位|平均掲載順位|順位/.test(h)) {
      posIdx = i;
    }
  }

  if (targetIdx === -1 && (clicksIdx !== -1 || impIdx !== -1)) {
    // 最初の列をターゲットとみなす
    targetIdx = 0;
  }

  if (targetIdx === -1) {
    return {
      sourceType: 'generic',
      rows: [],
      totalImpressions: 0,
      totalClicks: 0,
      errors: ['ページURLまたはクエリ列が見つかりませんでした。Search ConsoleのエクスポートCSVをご確認ください。'],
    };
  }

  const sourceType = targetType === 'query' ? 'gsc_queries' : 'gsc_pages';
  const parsedRows: ParsedSeoRow[] = [];
  let totalImp = 0;
  let totalClicks = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length <= targetIdx) continue;

    const rawTarget = cols[targetIdx] || '';
    if (!rawTarget) continue;

    const clicks = clicksIdx !== -1 ? parseInt(cols[clicksIdx]?.replace(/,/g, '') || '0', 10) || 0 : 0;
    const impressions = impIdx !== -1 ? parseInt(cols[impIdx]?.replace(/,/g, '') || '0', 10) || 0 : 0;
    let ctr = ctrIdx !== -1 ? parseFloat(cols[ctrIdx]?.replace(/[%,\s]/g, '') || '0') || 0 : 0;
    if (!ctr && impressions > 0) {
      ctr = Math.round((clicks / impressions) * 1000) / 10;
    }
    const avgPosition = posIdx !== -1 ? parseFloat(cols[posIdx]?.replace(/,/g, '') || '0') || 0 : 0;

    // ページURL/クエリの人間可読な名前・種別と、自社記事とのマッチング判定
    const resolved = resolvePageInfo(rawTarget, articles);
    const matchedArticleId = resolved.matchedArticleId;
    const matchedArticleTitle = resolved.matchedArticleTitle;

    totalImp += impressions;
    totalClicks += clicks;

    parsedRows.push({
      target: rawTarget,
      targetType: resolved.pageType === 'query' ? 'query' : targetType,
      impressions,
      clicks,
      avgPosition: Math.round(avgPosition * 10) / 10,
      ctr: Math.round(ctr * 10) / 10,
      matchedArticleId,
      matchedArticleTitle,
      resolvedTitle: resolved.displayName,
      cleanPath: resolved.cleanPath,
    });
  }

  return {
    sourceType,
    rows: parsedRows,
    totalImpressions: totalImp,
    totalClicks,
    errors: [],
  };
}
