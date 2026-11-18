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

    // 自社記事とのマッチング判定（URLまたはスラッグ、タイトルとの一致）
    let matchedArticleId: string | undefined;
    let matchedArticleTitle: string | undefined;

    const matched = articles.find((a) => {
      const slug = a.payload?.slug;
      if (slug && rawTarget.includes(slug)) return true;
      if (a.title && (rawTarget.includes(a.title) || a.title.includes(rawTarget))) return true;
      return false;
    });

    if (matched) {
      matchedArticleId = matched.id;
      matchedArticleTitle = matched.title;
    }

    totalImp += impressions;
    totalClicks += clicks;

    parsedRows.push({
      target: rawTarget,
      targetType,
      impressions,
      clicks,
      avgPosition: Math.round(avgPosition * 10) / 10,
      ctr: Math.round(ctr * 10) / 10,
      matchedArticleId,
      matchedArticleTitle,
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
