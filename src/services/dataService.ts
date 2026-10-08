import { getSupabase } from '../lib/supabaseClient';
import { TableKey, Company, Product, Lead, Prospect, Deal, Customer } from '../types/database';

export type ErrorType = 'PERMISSION_DENIED' | 'SCHEMA_MISMATCH' | 'CONNECTION_ERROR' | 'NOT_CONFIGURED' | 'UNKNOWN';

export interface DataFetchError {
  type: ErrorType;
  message: string;
  originalError?: any;
}

export function parseSupabaseError(error: any): DataFetchError {
  if (!error) return { type: 'UNKNOWN', message: '不明なエラーが発生しました。' };
  
  const msg = error.message || String(error);
  const code = error.code || '';

  // RLS / 権限エラー
  if (
    code === '42501' ||
    msg.toLowerCase().includes('row-level security') ||
    msg.toLowerCase().includes('permission denied') ||
    msg.toLowerCase().includes('jwt') ||
    error.status === 401 ||
    error.status === 403
  ) {
    return {
      type: 'PERMISSION_DENIED',
      message: 'データベースのアクセス権限（RLSポリシー）が不足しています。社内ログイン中か、テーブルのRLSポリシーが authenticated に設定されているか確認してください。',
      originalError: error,
    };
  }

  // スキーマ・テーブル不一致
  if (code === '42P01' || code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
    return {
      type: 'SCHEMA_MISMATCH',
      message: `データベースのスキーマ・列名を確認してください: ${msg}`,
      originalError: error,
    };
  }

  // 接続エラー・ネットワーク
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return {
      type: 'CONNECTION_ERROR',
      message: 'Supabaseサーバーへの接続に失敗しました。URLまたはネットワーク環境をご確認ください。',
      originalError: error,
    };
  }

  return {
    type: 'UNKNOWN',
    message: msg,
    originalError: error,
  };
}

export async function fetchTableCounts(): Promise<{ counts: Record<TableKey, number>; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      counts: { companies: 0, prospects: 0, leads: 0, products: 0, deals: 0, customers: 0 },
      error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' }
    };
  }

  const tables: TableKey[] = ['companies', 'prospects', 'leads', 'products', 'deals', 'customers'];
  const counts: Record<TableKey, number> = { companies: 0, prospects: 0, leads: 0, products: 0, deals: 0, customers: 0 };
  let detectedError: DataFetchError | undefined;

  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        if (!detectedError) detectedError = parseSupabaseError(error);
        counts[table] = 0;
      } else {
        counts[table] = count || 0;
      }
    } catch (err) {
      if (!detectedError) detectedError = parseSupabaseError(err);
      counts[table] = 0;
    }
  }

  return { counts, error: detectedError };
}

// 会社マスタ一覧取得（外部キー候補用）
export async function fetchCompaniesList(): Promise<Company[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('companies').select('*').order('company_name', { ascending: true });
    return (data as Company[]) || [];
  } catch {
    return [];
  }
}

// 商品マスタ一覧取得（外部キー候補用）
export async function fetchProductsList(): Promise<Product[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('products').select('*').order('product_name', { ascending: true });
    return (data as Product[]) || [];
  } catch {
    return [];
  }
}

// リード一覧取得（外部キー候補用）
export async function fetchLeadsList(): Promise<Lead[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    return (data as Lead[]) || [];
  } catch {
    return [];
  }
}

// 会社IDから既存顧客レコードを取得（重複チェック用）
export async function fetchCustomerByCompanyId(companyId: string): Promise<Customer | null> {
  const supabase = getSupabase();
  if (!supabase || !companyId) return null;
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Customer;
  } catch {
    return null;
  }
}

// テーブルデータ取得＋外部キーリレーション情報結合
export async function fetchTableData(
  tableKey: TableKey
): Promise<{ data: any[]; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: [], error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    // 基本クエリ
    const { data, error } = await supabase.from(tableKey).select('*');
    if (error) {
      return { data: [], error: parseSupabaseError(error) };
    }

    if (!data || data.length === 0) {
      return { data: [] };
    }

    // 関連テーブルのルックアップを行い、会社名や商品名を人間に見やすい形で付与
    let enrichedData = [...data];

    if (['prospects', 'leads', 'deals', 'customers'].includes(tableKey)) {
      const companies = await fetchCompaniesList();
      const compMap = new Map(companies.map(c => [String(c.id), c]));
      enrichedData = enrichedData.map(item => ({
        ...item,
        company: compMap.get(String(item.company_id)),
      }));
    }

    if (tableKey === 'deals') {
      const [products, leads] = await Promise.all([
        fetchProductsList(),
        fetchLeadsList(),
      ]);
      const prodMap = new Map(products.map(p => [String(p.id), p]));
      const leadMap = new Map(leads.map(l => [String(l.id), l]));

      enrichedData = enrichedData.map(item => ({
        ...item,
        product: item.product_id ? prodMap.get(String(item.product_id)) : undefined,
        lead: item.lead_id ? leadMap.get(String(item.lead_id)) : undefined,
      }));
    }

    return { data: enrichedData };
  } catch (err: any) {
    return { data: [], error: parseSupabaseError(err) };
  }
}

// 新規レコード追加（削除操作は一切提供しません）
export async function insertRecord(
  tableKey: TableKey,
  payload: Record<string, any>
): Promise<{ data?: any; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    // 会社ごとに1件の制約チェック (customers)
    if (tableKey === 'customers' && payload.company_id) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', payload.company_id);
      if (existing && existing.length > 0) {
        return {
          error: {
            type: 'UNKNOWN',
            message: 'この会社には既に顧客レコードが存在します（顧客は1会社につき1件のみ登録可能です）。'
          }
        };
      }
    }

    // 自動生成UUIDテーブルの場合、空のidは確実に削除してDB自動採番に任せる
    if (['prospects', 'leads', 'customers'].includes(tableKey)) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from(tableKey)
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { error: parseSupabaseError(error) };
    }

    return { data };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// レコード更新（削除操作は一切提供しません）
export async function updateRecord(
  tableKey: TableKey,
  id: string | number,
  payload: Record<string, any>
): Promise<{ data?: any; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    // customersの会社重複チェック (自身を除く)
    if (tableKey === 'customers' && payload.company_id) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', payload.company_id)
        .neq('id', id);
      if (existing && existing.length > 0) {
        return {
          error: {
            type: 'UNKNOWN',
            message: '指定された会社には別の顧客レコードが既に存在します。'
          }
        };
      }
    }

    // 主キー id を payload から除外して更新
    const { id: _ignoredId, company, product, lead, ...cleanPayload } = payload;
    if (tableKey === 'customers') {
      cleanPayload.last_updated_at = new Date().toISOString();
    } else {
      cleanPayload.updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(tableKey)
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: parseSupabaseError(error) };
    }

    return { data };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}
