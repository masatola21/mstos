import { getSupabase } from '../lib/supabaseClient';
import { ManagedProduct, ProductArchetype, PricingModel } from '../types/matrix';
import { matrixService } from './matrixService';

export interface ProductCatalogFees {
  initialFee: number;
  monthlyFee: number;
}

export interface FormattedProductPrice {
  label: string;
  subLabel?: string;
  badge: string;
  isFlexible: boolean;
  model: PricingModel;
}

/**
 * Formats a product's price for display across the CRM, handling fixed prices,
 * starting prices (e.g. ¥10,000〜), price ranges (¥10,000〜¥50,000), and custom quotes.
 */
export function formatProductPrice(product: {
  initial_fee?: number | null;
  monthly_fee?: number | null;
  price?: number | null;
  salesInitialFee?: number | null;
  salesMonthlyFee?: number | null;
  pricing_model?: string | null;
  pricingModel?: string | null;
  price_range_max?: number | null;
  priceRangeMax?: number | null;
  price_note?: string | null;
  priceNote?: string | null;
}): FormattedProductPrice {
  const model = ((product.pricing_model || product.pricingModel || 'fixed') as PricingModel);
  const initial = Number(product.initial_fee ?? product.salesInitialFee ?? 0);
  const monthly = Number(product.monthly_fee ?? product.salesMonthlyFee ?? (model === 'fixed' && !initial ? product.price ?? 0 : 0));
  const max = product.price_range_max ?? product.priceRangeMax ?? null;
  const note = product.price_note || product.priceNote || '';

  if (model === 'custom_quote') {
    return {
      label: '個別見積・商談時決定',
      subLabel: note || '商談の要件・規模に合わせて提示',
      badge: '商談時決定',
      isFlexible: true,
      model,
    };
  }

  if (model === 'starting_at') {
    const base = monthly > 0 ? monthly : initial > 0 ? initial : Number(product.price || 0);
    const period = monthly > 0 ? '月額 ' : initial > 0 ? '初期 ' : '';
    return {
      label: `${period}¥${base.toLocaleString('ja-JP')}〜`,
      subLabel: note ? `商談で本決め（${note}）` : '商談で本決め',
      badge: '最低価格〜',
      isFlexible: true,
      model,
    };
  }

  if (model === 'range') {
    const base = monthly > 0 ? monthly : initial > 0 ? initial : Number(product.price || 0);
    const period = monthly > 0 ? '月額 ' : '';
    const maxText = max ? `¥${Number(max).toLocaleString('ja-JP')}` : '上限応相談';
    return {
      label: `${period}¥${base.toLocaleString('ja-JP')} 〜 ${maxText}`,
      subLabel: note ? `商談で本決め（${note}）` : '商談で本決め',
      badge: '価格帯',
      isFlexible: true,
      model,
    };
  }

  // Fixed price
  const parts: string[] = [];
  if (initial > 0) parts.push(`初期 ¥${initial.toLocaleString('ja-JP')}`);
  if (monthly > 0) parts.push(`月額 ¥${monthly.toLocaleString('ja-JP')}`);
  if (parts.length === 0) {
    const p = Number(product.price || 0);
    parts.push(p > 0 ? `¥${p.toLocaleString('ja-JP')}` : '¥0');
  }

  return {
    label: parts.join(' / '),
    subLabel: note || undefined,
    badge: '固定価格',
    isFlexible: false,
    model: 'fixed',
  };
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

  const payload: Record<string, any> = {
    id: product.id,
    product_name: product.name,
    product_type: product.category || product.archetype,
    phase: String(product.customFields?.phase || '').trim() || null,
    pricing_model: product.pricingModel || 'fixed',
    price_range_max: product.priceRangeMax ?? null,
    price_note: product.priceNote || null,
    initial_fee: fees.initialFee,
    monthly_fee: fees.monthlyFee,
    description: product.description || null,
    status,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });

  // Graceful fallback if database does not yet have flexible pricing columns
  if (error && (
    error.message.includes('pricing_model') ||
    error.message.includes('price_range_max') ||
    error.message.includes('price_note') ||
    error.message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  )) {
    delete payload.pricing_model;
    delete payload.price_range_max;
    delete payload.price_note;
    const retry = await supabase.from('products').upsert(payload, { onConflict: 'id' });
    error = retry.error;
  }

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

  const payload: Record<string, any> = {
    id: product.id,
    product_name: product.name,
    product_type: product.category || product.archetype,
    phase: String(product.customFields?.phase || '').trim() || null,
    pricing_model: product.pricingModel || 'fixed',
    price_range_max: product.priceRangeMax ?? null,
    price_note: product.priceNote || null,
    initial_fee: fees.initialFee,
    monthly_fee: fees.monthlyFee,
    description: product.description || null,
    status: product.status === 'archived' ? 'inactive' : product.status === 'active' ? 'active' : 'draft',
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });

  // Fallback if schema not yet updated
  if (error && (
    error.message.includes('pricing_model') ||
    error.message.includes('price_range_max') ||
    error.message.includes('price_note') ||
    error.message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  )) {
    delete payload.pricing_model;
    delete payload.price_range_max;
    delete payload.price_note;
    const retry = await supabase.from('products').upsert(payload, { onConflict: 'id' });
    error = retry.error;
  }

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
 * Performs synchronization between the CRM products table and ManagedProduct list.
 * 1. Imports products from the CRM products table into the managed catalog (updating prices/status).
 * 2. Does NOT auto-resurrect deleted products into CRM! Managed products only publish to CRM on explicit action.
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

    const pendingDeletions = matrixService.getPendingDeletions(matrixService.getActiveUserId());
    const managedMap = new Map<string, ManagedProduct>(
      managedProducts
        .filter((p) => !pendingDeletions.products.has(p.id))
        .map((p) => [p.id, p])
    );
    const crmIds = new Set(crmProducts.map((c) => c.id));

    // 1. Process CRM products: update existing or import new (excluding pending deletions)
    crmProducts.forEach((crm) => {
      if (pendingDeletions.products.has(crm.id)) return;

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
          (existing.status === 'active' && updatedStatus !== 'active') ||
          crm.pricing_model !== undefined ||
          crm.price_range_max !== undefined ||
          crm.price_note !== undefined
        ) {
          existing.name = crm.product_name;
          existing.salesInitialFee = crm.initial_fee ?? 0;
          existing.salesMonthlyFee = crm.monthly_fee ?? 0;
          if (crm.pricing_model) existing.pricingModel = crm.pricing_model as PricingModel;
          if (crm.price_range_max !== undefined) existing.priceRangeMax = crm.price_range_max;
          if (crm.price_note !== undefined) existing.priceNote = crm.price_note;
          existing.salesCatalogPublishedAt = Date.now();
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
          pricingModel: (crm.pricing_model as PricingModel) || 'fixed',
          priceRangeMax: crm.price_range_max ?? undefined,
          priceNote: crm.price_note || undefined,
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
      }
    });

    // 2. If a managed product was marked as published to CRM but is now gone from CRM
    // (i.e. user deleted it from the CRM product master), clear its published state
    // so it NEVER gets pushed back to CRM without explicit user action!
    managedMap.forEach((p) => {
      if (!crmIds.has(p.id) && p.salesCatalogPublishedAt) {
        delete p.salesCatalogPublishedAt;
      }
    });

    return Array.from(managedMap.values()).filter((p) => !pendingDeletions.products.has(p.id));
  } catch (err) {
    console.warn('商品マスタ双方向同期エラー:', err);
    return managedProducts;
  }
}
