import crypto from 'crypto';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryResult {
  siteUrl: string;
  rows: GscRow[];
  startDate: string;
  endDate: string;
}

/**
 * サービスアカウント秘密鍵から Google OAuth2 アクセストークンを取得
 */
export async function getGoogleAccessToken(sa: ServiceAccountKey, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64UrlEncode(header);
  const encodedClaim = base64UrlEncode(claim);
  const signInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  signer.end();

  const signature = signer
    .sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google認証トークン取得に失敗しました: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/**
 * Search Console API を叩いて検索アナリティクスを取得
 */
export async function fetchSearchConsoleAnalytics(
  sa: ServiceAccountKey,
  siteUrl: string,
  options?: { days?: number; dimension?: 'page' | 'query' }
): Promise<GscQueryResult> {
  const token = await getGoogleAccessToken(sa, ['https://www.googleapis.com/auth/webmasters.readonly']);

  // GSCのデータは通常2〜3日前までしか反映されないため、endDateは3日前にする
  const dEnd = new Date();
  dEnd.setDate(dEnd.getDate() - 3);
  const endDate = dEnd.toISOString().slice(0, 10);

  const dStart = new Date(dEnd);
  dStart.setDate(dStart.getDate() - (options?.days || 28));
  const startDate = dStart.toISOString().slice(0, 10);

  const dimension = options?.dimension || 'page';

  // サイトURLの揺れ（末尾のスラッシュ、sc-domain: など）に対応
  const cleanSiteUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;

  // Search Console API query
  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cleanSiteUrl)}/searchAnalytics/query`;

  let res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: 100,
    }),
  });

  // もしURL末尾スラッシュなしで登録されている場合のフォールバック試行
  if (!res.ok && res.status === 404) {
    const altUrl = siteUrl.replace(/\/$/, '');
    const altApiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(altUrl)}/searchAnalytics/query`;
    const altRes = await fetch(altApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: 100,
      }),
    });
    if (altRes.ok) {
      res = altRes;
    }
  }

  // ドメインプロパティ（sc-domain:example.com）の場合のフォールバック
  if (!res.ok && res.status === 404) {
    const hostname = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname;
    const domainProp = `sc-domain:${hostname}`;
    const domainApiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(domainProp)}/searchAnalytics/query`;
    const domainRes = await fetch(domainApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: 100,
      }),
    });
    if (domainRes.ok) {
      res = domainRes;
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Search Console API呼び出しに失敗しました (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rows: GscRow[] = Array.isArray(data.rows)
    ? data.rows.map((r: any) => ({
        keys: r.keys || [],
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: Math.round((r.ctr || 0) * 1000) / 10,
        position: Math.round((r.position || 0) * 10) / 10,
      }))
    : [];

  return {
    siteUrl,
    rows,
    startDate,
    endDate,
  };
}
