/**
 * オブジェクトのキーをアルファベット順にソートして一貫したJSON文字列を生成するユーティリティ。
 *
 * 背景:
 * PostgreSQL (Supabase) の jsonb 型はキーを長さ順・辞書順等で再配置して保存・返却します。
 * 標準の JSON.stringify はプロパティの挿入順に依存するため、値が同一であっても
 * 文字列不一致となり、誤ったマージ競合や不要な保存（dirty誤判定）が発生していました。
 *
 * 仕様:
 * - オブジェクトのキーを再帰的にアルファベット順でソート
 * - 配列の順序は厳密に維持
 * - undefined の扱いは JSON.stringify と同等（オブジェクト内プロパティは除外、配列要素は null）
 * - Date 型は ISO 文字列、toJSON を持つオブジェクトは toJSON() の結果を正規化
 */

export function stableNormalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
    return stableNormalize((value as { toJSON: () => unknown }).toJSON());
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stableNormalize(item)));
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
      result[key] = stableNormalize(val);
    }
  }

  return result;
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return undefined as unknown as string;
  }
  return JSON.stringify(stableNormalize(value));
}
