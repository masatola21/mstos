import { getSupabase } from '../lib/supabaseClient';
import { TableKey, Company, Product, Lead, Prospect, Deal, Customer, Diagnosis, AiReport, DiagnosisStatus } from '../types/database';
import { executeDealWonAutomation } from './dealWonAutomationService';
import { matrixService } from './matrixService';

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
      counts: { companies: 0, contacts: 0, prospects: 0, leads: 0, products: 0, deals: 0, customers: 0 },
      error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' }
    };
  }

  const tables: TableKey[] = ['companies', 'contacts', 'prospects', 'leads', 'products', 'deals', 'customers'];
  const counts: Record<TableKey, number> = { companies: 0, contacts: 0, prospects: 0, leads: 0, products: 0, deals: 0, customers: 0 };
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
    if (!data) return [];
    const localProducts = matrixService.loadProducts();
    const localMap = new Map(localProducts.map(p => [p.id, p]));
    return (data as Product[]).map(item => {
      const local = localMap.get(String(item.id));
      return {
        ...item,
        pricing_model: item.pricing_model || local?.pricingModel || 'fixed',
        price_range_max: item.price_range_max ?? local?.priceRangeMax ?? null,
        price_note: item.price_note || local?.priceNote || null,
      };
    });
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

    if (tableKey === 'products') {
      const localProducts = matrixService.loadProducts();
      const localMap = new Map(localProducts.map(p => [p.id, p]));
      enrichedData = enrichedData.map(item => {
        const local = localMap.get(String(item.id));
        return {
          ...item,
          pricing_model: item.pricing_model || local?.pricingModel || 'fixed',
          price_range_max: item.price_range_max ?? local?.priceRangeMax ?? null,
          price_note: item.price_note || local?.priceNote || null,
        };
      });
    }

    if (['contacts', 'prospects', 'leads', 'deals', 'customers'].includes(tableKey)) {
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

// レコードは参照関係を壊さない場合に限り削除する。参照確認エラー時は安全のため削除を中止する。
const TABLE_REFERENCE_CHECKS: Partial<Record<TableKey, Array<{ table: string; field: string }>>> = {
  companies: [
    { table: 'contacts', field: 'company_id' }, { table: 'prospects', field: 'company_id' },
    { table: 'leads', field: 'company_id' }, { table: 'deals', field: 'company_id' },
    { table: 'customers', field: 'company_id' }, { table: 'diagnoses', field: 'company_id' },
    { table: 'customer_contracts', field: 'company_id' }, { table: 'customer_invoices', field: 'company_id' },
    { table: 'customer_documents', field: 'company_id' }, { table: 'customer_service_engagements', field: 'company_id' },
  ],
  contacts: [{ table: 'communication_outbox', field: 'recipient_contact_id' }],
  prospects: [],
  leads: [{ table: 'deals', field: 'lead_id' }, { table: 'diagnoses', field: 'lead_id' }],
  products: [
    { table: 'deals', field: 'product_id' }, { table: 'customer_contracts', field: 'product_id' },
    { table: 'customer_invoices', field: 'product_id' }, { table: 'prospects', field: 'recommended_product_id' },
    { table: 'leads', field: 'interested_product_id' }, { table: 'ai_reports', field: 'recommended_product_id' },
  ],
  deals: [
    { table: 'customer_contracts', field: 'deal_id' }, { table: 'customer_documents', field: 'deal_id' },
    { table: 'communication_outbox', field: 'deal_id' },
  ],
  customers: [
    { table: 'customer_contracts', field: 'company_id' }, { table: 'customer_invoices', field: 'company_id' },
    { table: 'customer_documents', field: 'company_id' }, { table: 'customer_service_engagements', field: 'company_id' },
  ],
};

// スキーマエラーから未存在の列名を抽出するヘルパー
function extractMissingColumn(error: any): string | null {
  if (!error) return null;
  const msg = error.message || String(error);
  // PostgREST: Could not find the 'xyz' column of 'table' in the schema cache
  const pgrstMatch = msg.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch) return pgrstMatch[1];

  // PostgreSQL: column "xyz" of relation "table" does not exist
  const pgMatch1 = msg.match(/column "([^"]+)" of relation/i);
  if (pgMatch1) return pgMatch1[1];

  // PostgreSQL: column table.xyz does not exist OR column xyz does not exist
  const pgMatch2 = msg.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
  if (pgMatch2) return pgMatch2[1];

  return null;
}

export async function deleteTableRecord(
  tableKey: TableKey,
  record: { id: string | number; company_id?: string | null },
  options?: { force?: boolean },
): Promise<{ error?: DataFetchError; blockedBy?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };

  try {
    if (options?.force && tableKey === 'products') {
      const prodId = String(record.id);
      // 関連テーブルの参照を安全に解除（NULL設定）
      await Promise.allSettled([
        supabase.from('deals').update({ product_id: null }).eq('product_id', prodId),
        supabase.from('customer_contracts').update({ product_id: null }).eq('product_id', prodId),
        supabase.from('customer_invoices').update({ product_id: null }).eq('product_id', prodId),
        supabase.from('prospects').update({ recommended_product_id: null }).eq('recommended_product_id', prodId),
        supabase.from('leads').update({ interested_product_id: null }).eq('interested_product_id', prodId),
        supabase.from('ai_reports').update({ recommended_product_id: null }).eq('recommended_product_id', prodId),
      ]);
    } else {
      for (const reference of TABLE_REFERENCE_CHECKS[tableKey] || []) {
        const { data, error } = await supabase
          .from(reference.table)
          .select('id')
          .eq(reference.field, tableKey === 'customers' ? record.company_id || record.id : record.id)
          .limit(1);
        if (error) {
          // リモートスキーマに対象テーブルや列が存在しない場合は参照なしとみなし安全にスキップ
          const errorMsg = (error.message || '').toLowerCase();
          const errorCode = error.code || '';
          if (
            errorCode === '42703' || // undefined_column
            errorCode === '42P01' || // undefined_table
            errorCode === 'PGRST204' ||
            errorCode === 'PGRST205' ||
            errorMsg.includes('does not exist') ||
            errorMsg.includes('could not find the') ||
            errorMsg.includes('schema cache')
          ) {
            continue;
          }
          return { error: parseSupabaseError(error) };
        }
        if (data?.length) {
          return { blockedBy: reference.table };
        }
      }
    }

    // 1. クライアント側からの直接削除を試行
    const { data, error } = await supabase.from(tableKey).delete().eq('id', record.id).select('id');
    if (!error && data && data.length > 0) {
      if (tableKey === 'products') {
        const prodId = String(record.id);
        matrixService.deleteProduct(prodId);
        await supabase.from('mst_managed_products').delete().eq('id', prodId);
      }
      return {};
    }

    // 2. 既に削除済みかチェック（存在しない場合は正常終了とする）
    const { data: existingCheck } = await supabase.from(tableKey).select('id').eq('id', record.id).maybeSingle();
    if (!existingCheck) {
      if (tableKey === 'products') {
        const prodId = String(record.id);
        matrixService.deleteProduct(prodId);
        await supabase.from('mst_managed_products').delete().eq('id', prodId);
      }
      return {};
    }

    // 3. RLSポリシー等でクライアント側から削除できない場合のサーバーAPIフォールバック
    try {
      const resp = await fetch(`/api/admin/tables/${encodeURIComponent(tableKey)}/records/${encodeURIComponent(String(record.id))}?force=${options?.force ? 'true' : 'false'}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.ok) {
        if (tableKey === 'products') {
          const prodId = String(record.id);
          matrixService.deleteProduct(prodId);
          await supabase.from('mst_managed_products').delete().eq('id', prodId);
        }
        return {};
      }
    } catch {
      // ネットワークエラー時は元の判定へフォールバック
    }

    if (error) return { error: parseSupabaseError(error) };
    if (!data?.length) {
      return { error: { type: 'UNKNOWN', message: '削除対象が見つからないか、削除権限がありません。' } };
    }
    return {};
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// 新規レコード追加
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
    if (['contacts', 'prospects', 'leads', 'customers'].includes(tableKey)) {
      delete payload.id;
    }

    // 商品テーブルの場合、柔軟価格設定をローカル/matrixServiceに退避保存
    if (tableKey === 'products' && (payload.id || payload.product_name)) {
      const prodId = String(payload.id || payload.code || '');
      if (prodId) {
        matrixService.updateProduct(prodId, {
          pricingModel: payload.pricing_model || undefined,
          priceRangeMax: payload.price_range_max != null ? Number(payload.price_range_max) : undefined,
          priceNote: payload.price_note || undefined,
          name: payload.product_name || undefined,
          price: payload.initial_fee || payload.monthly_fee || undefined,
          description: payload.description || undefined,
        });
      }
    }

    let currentPayload = { ...payload };
    let data: any = null;
    let lastError: any = null;

    // リモートDBのスキーマキャッシュに未反映の列（price_note等）があれば自動で除外して再試行
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await supabase
        .from(tableKey)
        .insert([currentPayload])
        .select()
        .single();

      if (!result.error) {
        data = result.data;
        lastError = null;
        break;
      }

      lastError = result.error;
      const missingCol = extractMissingColumn(lastError);
      if (missingCol && missingCol in currentPayload) {
        delete currentPayload[missingCol];
        continue;
      }

      let stripped = false;
      for (const knownCol of ['price_note', 'price_range_max', 'pricing_model']) {
        if (knownCol in currentPayload && (
          lastError.message?.includes(knownCol) ||
          lastError.message?.includes('schema cache') ||
          lastError.code === 'PGRST204' ||
          lastError.code === '42703'
        )) {
          delete currentPayload[knownCol];
          stripped = true;
        }
      }
      if (stripped) continue;

      break;
    }

    if (lastError) {
      return { error: parseSupabaseError(lastError) };
    }

    if (tableKey === 'products' && data) {
      const localProducts = matrixService.loadProducts();
      const local = localProducts.find(p => p.id === String(data.id));
      if (local) {
        data = {
          ...data,
          pricing_model: data.pricing_model || local.pricingModel || 'fixed',
          price_range_max: data.price_range_max ?? local.priceRangeMax ?? null,
          price_note: data.price_note || local.priceNote || null,
        };
      }
    }

    if (tableKey === 'deals' && data?.id && (payload.proposal_status === '成約' || payload.proposal_status === 'Won')) {
      void executeDealWonAutomation(String(data.id)).catch((err) => {
        console.warn('Auto deal-won automation warning on insert:', err);
      });
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

    // 商品テーブルの場合、柔軟価格設定をローカル/matrixServiceに退避保存
    if (tableKey === 'products') {
      const prodId = String(id);
      matrixService.updateProduct(prodId, {
        pricingModel: cleanPayload.pricing_model || undefined,
        priceRangeMax: cleanPayload.price_range_max != null ? Number(cleanPayload.price_range_max) : undefined,
        priceNote: cleanPayload.price_note || undefined,
        name: cleanPayload.product_name || undefined,
        price: cleanPayload.initial_fee || cleanPayload.monthly_fee || undefined,
        description: cleanPayload.description || undefined,
      });
    }

    let currentPayload = { ...cleanPayload };
    let data: any = null;
    let lastError: any = null;

    // リモートDBのスキーマキャッシュに未反映の列（price_note等）があれば自動で除外して再試行
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await supabase
        .from(tableKey)
        .update(currentPayload)
        .eq('id', id)
        .select()
        .single();

      if (!result.error) {
        data = result.data;
        lastError = null;
        break;
      }

      lastError = result.error;
      const missingCol = extractMissingColumn(lastError);
      if (missingCol && missingCol in currentPayload) {
        delete currentPayload[missingCol];
        continue;
      }

      let stripped = false;
      for (const knownCol of ['price_note', 'price_range_max', 'pricing_model']) {
        if (knownCol in currentPayload && (
          lastError.message?.includes(knownCol) ||
          lastError.message?.includes('schema cache') ||
          lastError.code === 'PGRST204' ||
          lastError.code === '42703'
        )) {
          delete currentPayload[knownCol];
          stripped = true;
        }
      }
      if (stripped) continue;

      break;
    }

    if (lastError) {
      return { error: parseSupabaseError(lastError) };
    }

    if (tableKey === 'products' && data) {
      const localProducts = matrixService.loadProducts();
      const local = localProducts.find(p => p.id === String(id));
      if (local) {
        data = {
          ...data,
          pricing_model: data.pricing_model || local.pricingModel || 'fixed',
          price_range_max: data.price_range_max ?? local.priceRangeMax ?? null,
          price_note: data.price_note || local.priceNote || null,
        };
      }
    }

    if (tableKey === 'deals' && (cleanPayload.proposal_status === '成約' || cleanPayload.proposal_status === 'Won')) {
      void executeDealWonAutomation(String(id)).catch((err) => {
        console.warn('Auto deal-won automation warning on update:', err);
      });
    }

    return { data };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// ============================================================================
// Phase 1-C: 診断（diagnoses）＆ AIレポート（ai_reports）サービス関数
// ============================================================================

// 診断一覧取得（会社情報・リード情報・最新AIレポート情報を結合）
export async function fetchDiagnosesList(): Promise<{ data: Diagnosis[]; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: [], error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const { data: diagnoses, error } = await supabase
      .from('diagnoses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: parseSupabaseError(error) };
    }

    if (!diagnoses || diagnoses.length === 0) {
      return { data: [] };
    }

    // 会社マスタ・リード・最新レポートを解決
    const [companies, leads] = await Promise.all([
      fetchCompaniesList(),
      fetchLeadsList(),
    ]);
    const compMap = new Map(companies.map(c => [String(c.id), c]));
    const leadMap = new Map(leads.map(l => [String(l.id), l]));

    // 最新のai_reportsも取得
    let latestReportMap = new Map<string, AiReport>();
    try {
      const { data: reports } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('is_latest', true);
      if (reports) {
        latestReportMap = new Map(reports.map(r => [String(r.diagnosis_id), r as AiReport]));
      }
    } catch (e) {
      console.warn('Failed to fetch latest reports', e);
    }

    const enriched: Diagnosis[] = diagnoses.map(item => ({
      ...item,
      company: compMap.get(String(item.company_id)),
      lead: item.lead_id ? leadMap.get(String(item.lead_id)) : undefined,
      latest_report: latestReportMap.get(String(item.id)) || null,
    }));

    return { data: enriched };
  } catch (err: any) {
    return { data: [], error: parseSupabaseError(err) };
  }
}

// 診断詳細取得（ID指定）
export async function fetchDiagnosisById(id: string): Promise<{ data?: Diagnosis; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const { data: diagnosis, error } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { error: parseSupabaseError(error) };
    }

    if (!diagnosis) {
      return { error: { type: 'UNKNOWN', message: '診断レコードが見つかりません。' } };
    }

    // 会社・リード取得
    const [companies, leads] = await Promise.all([
      fetchCompaniesList(),
      fetchLeadsList(),
    ]);
    const compMap = new Map(companies.map(c => [String(c.id), c]));
    const leadMap = new Map(leads.map(l => [String(l.id), l]));

    // 最新レポート取得
    let latestReport: AiReport | null = null;
    try {
      const { data: report } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('diagnosis_id', id)
        .eq('is_latest', true)
        .maybeSingle();
      if (report) latestReport = report as AiReport;
    } catch (e) {
      console.warn('Failed to fetch latest report for diagnosis', e);
    }

    const enriched: Diagnosis = {
      ...diagnosis,
      company: compMap.get(String(diagnosis.company_id)),
      lead: diagnosis.lead_id ? leadMap.get(String(diagnosis.lead_id)) : undefined,
      latest_report: latestReport,
    };

    return { data: enriched };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// 診断新規作成
// 【重要】status は DB側の列権限で INSERT 権限が付与されていないため、payload に status を含めず
// テーブル既定値 ('draft') で作成されます。
export async function createDiagnosis(params: {
  company_id: string;
  lead_id?: string | null;
  diagnosis_type?: string;
  questionnaire_version?: string;
  memo?: string | null;
  answers?: Record<string, unknown>;
}): Promise<{ data?: Diagnosis; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const insertPayload: Record<string, unknown> = {
      company_id: params.company_id,
      lead_id: params.lead_id || null,
      diagnosis_type: params.diagnosis_type || 'standard',
      questionnaire_version: params.questionnaire_version || 'v1.0',
      answers: params.answers || {},
      memo: params.memo || null,
    };

    const { data, error } = await supabase
      .from('diagnoses')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      return { error: parseSupabaseError(error) };
    }

    return { data: data as Diagnosis };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// 診断の回答保存（回答内容の変更）
// 【重要】status 列は直接更新不可。answers, memo, category_scores, score 等のみを更新。
// completed / reported の場合はDB側トリガーで直接編集が拒否されます。
export async function saveDiagnosisAnswers(
  diagnosisId: string,
  answers: Record<string, unknown>,
  options?: {
    memo?: string | null;
    diagnosis_type?: string;
    score?: number | null;
    category_scores?: Record<string, number> | null;
    conducted_at?: string | null;
  }
): Promise<{ data?: Diagnosis; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const updatePayload: Record<string, unknown> = {
      answers,
      updated_at: new Date().toISOString(),
    };

    if (options?.memo !== undefined) updatePayload.memo = options.memo;
    if (options?.diagnosis_type !== undefined) updatePayload.diagnosis_type = options.diagnosis_type;
    if (options?.score !== undefined) updatePayload.score = options.score;
    if (options?.category_scores !== undefined) updatePayload.category_scores = options.category_scores;
    if (options?.conducted_at !== undefined) updatePayload.conducted_at = options.conducted_at;

    const { data, error } = await supabase
      .from('diagnoses')
      .update(updatePayload)
      .eq('id', diagnosisId)
      .select()
      .single();

    if (error) {
      return { error: parseSupabaseError(error) };
    }

    return { data: data as Diagnosis };
  } catch (err: any) {
    return { error: parseSupabaseError(err) };
  }
}

// 診断ステータス変更 RPC 呼び出し
// 【重要】statusの更新は update_diagnosis_status RPC 経由に限定。
// 許可ステータス: 'received' | 'completed'
// completed 遷移時は必須設問の回答を確認します。
export async function updateDiagnosisStatus(
  diagnosisId: string,
  newStatus: DiagnosisStatus
): Promise<{ success: boolean; data?: any; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const { data, error } = await supabase.rpc('update_diagnosis_status', {
      p_diagnosis_id: diagnosisId,
      p_status: newStatus,
    });

    if (error) {
      return { success: false, error: parseSupabaseError(error) };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: parseSupabaseError(err) };
  }
}

// 診断に紐づくAIレポート一覧取得
export async function fetchAiReportsByDiagnosisId(
  diagnosisId: string
): Promise<{ data: AiReport[]; error?: DataFetchError }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: [], error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' } };
  }

  try {
    const { data, error } = await supabase
      .from('ai_reports')
      .select('*')
      .eq('diagnosis_id', diagnosisId)
      .order('version', { ascending: false });

    if (error) {
      return { data: [], error: parseSupabaseError(error) };
    }

    return { data: (data as AiReport[]) || [] };
  } catch (err: any) {
    return { data: [], error: parseSupabaseError(err) };
  }
}

// 診断件数およびステータス別集計
export async function fetchDiagnosisCounts(): Promise<{
  total: number;
  byStatus: Record<DiagnosisStatus, number>;
  error?: DataFetchError;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      total: 0,
      byStatus: { received: 0, completed: 0, generating: 0, reported: 0 },
      error: { type: 'NOT_CONFIGURED', message: 'Supabaseが初期化されていません。' }
    };
  }

  try {
    const { data, error } = await supabase.from('diagnoses').select('status');
    if (error) {
      return {
        total: 0,
        byStatus: { received: 0, completed: 0, generating: 0, reported: 0 },
        error: parseSupabaseError(error)
      };
    }

    const byStatus: Record<DiagnosisStatus, number> = {
      received: 0,
      completed: 0,
      generating: 0,
      reported: 0
    };

    (data || []).forEach((row: any) => {
      const st = row.status as DiagnosisStatus;
      if (byStatus[st] !== undefined) {
        byStatus[st] += 1;
      }
    });

    return {
      total: data?.length || 0,
      byStatus
    };
  } catch (err: any) {
    return {
      total: 0,
      byStatus: { received: 0, completed: 0, generating: 0, reported: 0 },
      error: parseSupabaseError(err)
    };
  }
}


