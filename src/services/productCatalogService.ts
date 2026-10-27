import { getSupabase } from '../lib/supabaseClient';
import { ManagedProduct, ProductArchetype } from '../types/matrix';

export interface ProductCatalogFees {
  initialFee: number;
  monthlyFee: number;
}

/**
 * Calculates standard initial and monthly fees from a managed product.
 */
export function deriveProductFees(
  product: ManagedProduct,
  customFees?: Partial<ProductCatalogFees>
): ProductCatalogFees {
  if (customFees?.initialFee !== undefined && customFees?.monthlyFee !== undefined) {
    return {
      initialFee: Math.max(0, customFees.initialFee),
      monthlyFee: Math.max(0, customFees.monthlyFee),
    };
  }

  const defaultPrice = product.price || 0;
  if (product.archetype === 'retainer') {
    return {
      initialFee: customFees?.initialFee ?? product.salesInitialFee ?? 0,
      monthlyFee: customFees?.monthlyFee ?? product.salesMonthlyFee ?? defaultPrice,
    };
  }

  return {
    initialFee: customFees?.initialFee ?? product.salesInitialFee ?? defaultPrice,
    monthlyFee: customFees?.monthlyFee ?? product.salesMonthlyFee ?? 0,
  };
}

/**
 * Generates the next sequential product code/ID (e.g. PRD-001, PRD-002).
 */
export function generateNextProductCode(existingProducts: ManagedProduct[], prefix = 'PRD'): string {
  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}-?(\\d+)$`, 'i');

  existingProducts.forEach((p) => {
    const candidates = [p.id, p.code].filter(Boolean);
    candidates.forEach((cand) => {
      const match = String(cand).match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Publishes/updates a managed product into the CRM sales catalog (products table) using the same ID.
 * Guarantees that CRM deals, contracts, and invoices reference the exact same product ID.
 */
export async function syncManagedProductToSalesCatalog(
  product: ManagedProduct,
  customFees?: Partial<ProductCatalogFees>
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const fees = deriveProductFees(product, customFees);
  const status =
    product.status === 'archived'
      ? 'inactive'
      : product.status === 'active'
      ? 'active'
      : 'draft';

  const { error } = await supabase.from('products').upsert(
    {
      id: product.id,
      product_name: product.name,
      product_type: product.category || product.archetype,
      phase: String(product.customFields?.phase || '').trim() || null,
      initial_fee: fees.initialFee,
      monthly_fee: fees.monthlyFee,
      description: product.description || null,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.warn(`営業商品マスタへの自動同期をスキップ（オフラインまたは未接続）: ${error.message}`);
  }
}

/**
 * Backward-compatible publish helper with explicit error throwing if required by UI.
 */
export async function publishManagedProductToSalesCatalog(
  product: ManagedProduct,
  fees: ProductCatalogFees
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabaseに接続されていません。接続設定を確認してください。');
  }

  const { error } = await supabase.from('products').upsert(
    {
      id: product.id,
      product_name: product.name,
      product_type: product.category || product.archetype,
      phase: String(product.customFields?.phase || '').trim() || null,
      initial_fee: fees.initialFee,
      monthly_fee: fees.monthlyFee,
      description: product.description || null,
      status: product.status === 'archived' ? 'inactive' : product.status === 'active' ? 'active' : 'draft',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`営業商品マスタへの反映に失敗しました: ${error.message}`);
  }
}

/**
 * Helper to map a CRM product_type string to a ManagedProduct archetype.
 */
function inferArchetype(productType?: string | null): ProductArchetype {
  const lower = String(productType || '').toLowerCase();
  if (lower.includes('顧問') || lower.includes('月額') || lower.includes('retainer') || lower.includes('保守')) {
    return 'retainer';
  }
  if (lower.includes('デジタル') || lower.includes('商材') || lower.includes('テンプレート') || lower.includes('asset')) {
    return 'digital_asset';
  }
  if (lower.includes('メディア') || lower.includes('コンテンツ') || lower.includes('アフィリ')) {
    return 'media_content';
  }
  return 'service_project';
}

/**
 * Performs a bidirectional synchronization between the CRM products table and ManagedProduct list.
 * 1. Imports any products newly added in the CRM products table into the managed catalog.
 * 2. Ensures all managed products exist in the CRM products table with their latest pricing & status.
 */
export async function syncAllProductsBidirectionally(
  managedProducts: ManagedProduct[]
): Promise<ManagedProduct[]> {
  const supabase = getSupabase();
  if (!supabase) return managedProducts;

  try {
    const { data: crmProducts, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (error || !crmProducts) {
      return managedProducts;
    }

    const managedMap = new Map<string, ManagedProduct>(managedProducts.map((p) => [p.id, p]));
    const crmIds = new Set(crmProducts.map((c) => c.id));
    let hasChanges = false;

    // 1. Process CRM products: update existing or import new
    crmProducts.forEach((crm) => {
      const existing = managedMap.get(crm.id);
      if (existing) {
        // Sync CRM price/status updates back to managed product if CRM was edited
        const updatedStatus =
          crm.status === 'inactive'
            ? 'archived'
            : crm.status === 'draft'
            ? 'developing'
            : 'active';
        if (
          existing.name !== crm.product_name ||
          existing.salesInitialFee !== (crm.initial_fee ?? 0) ||
          existing.salesMonthlyFee !== (crm.monthly_fee ?? 0) ||
          (existing.status === 'active' && updatedStatus !== 'active')
        ) {
          existing.name = crm.product_name;
          existing.salesInitialFee = crm.initial_fee ?? 0;
          existing.salesMonthlyFee = crm.monthly_fee ?? 0;
          existing.salesCatalogPublishedAt = Date.now();
          hasChanges = true;
        }
      } else {
        // New product found in CRM (e.g. registered in TableManager) -> import into managed products
        const archetype = inferArchetype(crm.product_type);
        const imported: ManagedProduct = {
          id: crm.id,
          name: crm.product_name || '新規商品',
          code: crm.id,
          category: crm.product_type || '標準サービス',
          archetype,
          price: crm.initial_fee || crm.monthly_fee || 0,
          salesInitialFee: crm.initial_fee ?? 0,
          salesMonthlyFee: crm.monthly_fee ?? 0,
          description: crm.description || '',
          status: crm.status === 'inactive' ? 'archived' : crm.status === 'draft' ? 'developing' : 'active',
          customFields: {
            phase: crm.phase || '',
          },
          kpis: {
            targetRevenue: ((crm.initial_fee || crm.monthly_fee || 100000)) * 10,
            currentRevenue: 0,
            activeClients: 0,
          },
          salesCatalogPublishedAt: Date.now(),
          createdAt: crm.created_at ? Date.parse(crm.created_at) || Date.now() : Date.now(),
          updatedAt: crm.updated_at ? Date.parse(crm.updated_at) || Date.now() : Date.now(),
        };
        managedMap.set(imported.id, imported);
        hasChanges = true;
      }
    });

    // 2. Process managed products: push any not in CRM to CRM products table
    const toPushToCrm = managedProducts.filter((p) => !crmIds.has(p.id));
    if (toPushToCrm.length > 0) {
      for (const p of toPushToCrm) {
        await syncManagedProductToSalesCatalog(p);
        p.salesCatalogPublishedAt = Date.now();
        hasChanges = true;
      }
    }

    return Array.from(managedMap.values());
  } catch (err) {
    console.warn('商品マスタ双方向同期エラー:', err);
    return managedProducts;
  }
}
