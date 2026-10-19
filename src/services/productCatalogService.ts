import { getSupabase } from '../lib/supabaseClient';
import { ManagedProduct } from '../types/matrix';

/**
 * Publishes a managed product into the CRM catalog using the same ID.
 * Contract and invoice product_id values can therefore resolve to the CRM product,
 * and deals can reference the same catalog entry through their FK.
 */
export async function publishManagedProductToSalesCatalog(
  product: ManagedProduct,
  fees: { initialFee: number; monthlyFee: number },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabaseに接続されていません。接続設定を確認してください。');
  }

  const { error } = await supabase.from('products').upsert({
    id: product.id,
    product_name: product.name,
    product_type: product.category || product.archetype,
    initial_fee: fees.initialFee,
    monthly_fee: fees.monthlyFee,
    description: product.description || null,
    status: product.status === 'active' ? 'active' : 'draft',
  }, { onConflict: 'id' });

  if (error) {
    throw new Error(`営業商品マスタへの反映に失敗しました: ${error.message}`);
  }
}
