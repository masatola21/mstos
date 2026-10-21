import { getSupabase } from '../lib/supabaseClient';

export type AssetType = 'draft' | 'website' | 'landing_page' | 'image' | 'video' | 'document' | 'other';
export type AssetStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export type MarketingAsset = {
  id: string;
  user_id?: string;
  title: string;
  asset_type: AssetType;
  source: 'upload' | 'url';
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  strategy_record_id: string | null;
  tool_record_id: string | null;
  product_id: string | null;
  status: AssetStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  is_local?: boolean;
};

export const BUCKET_NAME = 'mst-marketing-assets';
export const LOCAL_STORAGE_KEY = 'mst_local_marketing_assets';

export const ASSET_TYPES: Array<{ value: AssetType; label: string; tabHint?: string }> = [
  { value: 'website', label: 'HP・Webサイト', tabHint: 'media' },
  { value: 'video', label: '動画素材・動画URL', tabHint: 'video' },
  { value: 'image', label: '画像・バナー・アイキャッチ', tabHint: 'social' },
  { value: 'landing_page', label: 'LP・集客導線', tabHint: 'funnel' },
  { value: 'draft', label: '草案・台本・構成案', tabHint: 'content' },
  { value: 'document', label: '資料・レポート・提案書', tabHint: 'strategy' },
  { value: 'other', label: 'その他素材' },
];

export const ASSET_STATUSES: Array<{ value: AssetStatus; label: string; badgeClass: string }> = [
  { value: 'draft', label: '草案・下書き', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' },
  { value: 'review', label: '確認中・レビュー', badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-700/60' },
  { value: 'approved', label: '承認済み', badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60' },
  { value: 'published', label: '公開中・利用中', badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60' },
  { value: 'archived', label: '保管・アーカイブ', badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
];

export const MIGRATION_FILE_NAME = 'supabase/migrations/20261020230000_marketing_asset_library.sql';

export const MIGRATION_SQL = `-- Private owner-scoped storage for marketing drafts, website/LP source files, and creative assets.
CREATE TABLE IF NOT EXISTS public.mst_marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('draft', 'website', 'landing_page', 'image', 'video', 'document', 'other')),
  source text NOT NULL CHECK (source IN ('upload', 'url')),
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  strategy_record_id text,
  tool_record_id text,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mst_marketing_assets_source_location_check CHECK (
    (source = 'upload' AND storage_path IS NOT NULL AND external_url IS NULL)
    OR (source = 'url' AND external_url IS NOT NULL AND storage_path IS NULL)
  )
);

ALTER TABLE public.mst_marketing_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own marketing assets" ON public.mst_marketing_assets;
CREATE POLICY "Users manage own marketing assets"
  ON public.mst_marketing_assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mst_marketing_assets TO authenticated;

CREATE INDEX IF NOT EXISTS idx_mst_marketing_assets_user_updated
  ON public.mst_marketing_assets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mst_marketing_assets_user_links
  ON public.mst_marketing_assets(user_id, strategy_record_id, tool_record_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mst-marketing-assets', 'mst-marketing-assets', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Users manage own marketing asset files" ON storage.objects;
CREATE POLICY "Users manage own marketing asset files"
  ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'mst-marketing-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mst-marketing-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );`;

export function isDbMissingError(error: any): boolean {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : error?.message || '').toLowerCase();
  return (
    msg.includes('mst_marketing_assets') ||
    msg.includes('relation "public.mst_marketing_assets" does not exist') ||
    msg.includes('does not exist') ||
    msg.includes('table not found') ||
    msg.includes('pgrst204') ||
    msg.includes('pgrst205')
  );
}

export function getLocalAssets(): MarketingAsset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAssets(assets: MarketingAsset[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assets));
  } catch (err) {
    console.error('Failed to save local assets', err);
  }
}

export async function fetchMarketingAssets(userId?: string): Promise<{
  assets: MarketingAsset[];
  isDbReady: boolean;
  errorMessage?: string;
}> {
  const localItems = getLocalAssets();
  const db = getSupabase();

  if (!db) {
    return {
      assets: localItems,
      isDbReady: false,
      errorMessage: 'Supabaseに未接続です。現在はローカル一時保管モードで動作しています。',
    };
  }

  try {
    const { data: auth } = await db.auth.getUser();
    const effectiveUserId = userId || auth.user?.id;
    if (!effectiveUserId) {
      return {
        assets: localItems,
        isDbReady: false,
        errorMessage: 'ログイン状態を確認できません。ローカル一時保管モードで表示しています。',
      };
    }

    const { data, error } = await db
      .from('mst_marketing_assets')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isDbMissingError(error)) {
        return {
          assets: localItems,
          isDbReady: false,
          errorMessage: `素材保管DBが未適用です。${MIGRATION_FILE_NAME} を適用してください。`,
        };
      }
      return {
        assets: localItems,
        isDbReady: false,
        errorMessage: '素材データの読み込みに失敗しました: ' + error.message,
      };
    }

    // DBからのデータと、ローカル保存のみのデータをマージ（ID重複排除）
    const dbAssets = (data || []) as MarketingAsset[];
    const dbIds = new Set(dbAssets.map((a) => a.id));
    const pendingLocal = localItems.filter((item) => item.is_local && !dbIds.has(item.id));
    const merged = [...pendingLocal, ...dbAssets].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    return {
      assets: merged,
      isDbReady: true,
    };
  } catch (err: any) {
    return {
      assets: localItems,
      isDbReady: false,
      errorMessage: err?.message || '素材データの取得中にエラーが発生しました。',
    };
  }
}

export async function createMarketingAsset(
  params: {
    title: string;
    asset_type: AssetType;
    status: AssetStatus;
    external_url?: string;
    file?: File | null;
    strategy_record_id?: string | null;
    tool_record_id?: string | null;
    product_id?: string | null;
    notes?: string;
  },
  userId?: string
): Promise<{
  asset: MarketingAsset;
  savedToDb: boolean;
  message?: string;
}> {
  const { title, asset_type, status, external_url, file, strategy_record_id, tool_record_id, product_id, notes } = params;
  const now = new Date().toISOString();
  const db = getSupabase();

  let storagePath: string | null = null;
  let fileDataUrl: string | null = null;

  // ファイルの場合、ローカルプレビュー用DataURLを生成
  if (file) {
    try {
      fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch {
      // ignore
    }
  }

  // 1. Supabaseが利用可能かチェック
  let canUseDb = false;
  let effectiveUserId = userId || '';
  if (db) {
    const { data: auth } = await db.auth.getUser();
    if (auth.user) {
      effectiveUserId = auth.user.id;
      canUseDb = true;
    }
  }

  if (canUseDb && db) {
    try {
      // ファイルアップロード試行
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `${effectiveUserId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await db.storage.from(BUCKET_NAME).upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (uploadError) {
          console.warn('Storage upload failed, fallback to local', uploadError);
          storagePath = null;
        }
      }

      const row = {
        user_id: effectiveUserId,
        title: title.trim(),
        asset_type,
        source: file && storagePath ? 'upload' : file ? 'url' : 'url',
        storage_path: storagePath,
        external_url: storagePath ? null : file ? fileDataUrl : external_url?.trim() || null,
        mime_type: file?.type || null,
        file_size_bytes: file?.size || null,
        strategy_record_id: strategy_record_id || null,
        tool_record_id: tool_record_id || null,
        product_id: product_id || null,
        status,
        notes: notes?.trim() || '',
        updated_at: now,
      };

      const { data, error } = await db.from('mst_marketing_assets').insert(row).select('*').single();
      if (!error && data) {
        return {
          asset: data as MarketingAsset,
          savedToDb: true,
          message: '素材・成果物を保管しました。',
        };
      }
      if (storagePath) {
        await db.storage.from(BUCKET_NAME).remove([storagePath]);
      }
    } catch (err) {
      console.warn('DB save failed, falling back to local', err);
    }
  }

  // ローカルフォールバック保存
  const localId = `local-asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const localAsset: MarketingAsset = {
    id: localId,
    user_id: effectiveUserId || 'local-user',
    title: title.trim(),
    asset_type,
    source: file ? (fileDataUrl ? 'url' : 'upload') : 'url',
    storage_path: null,
    external_url: file ? fileDataUrl : external_url?.trim() || null,
    mime_type: file?.type || null,
    file_size_bytes: file?.size || null,
    strategy_record_id: strategy_record_id || null,
    tool_record_id: tool_record_id || null,
    product_id: product_id || null,
    status,
    notes: notes?.trim() || '',
    created_at: now,
    updated_at: now,
    is_local: true,
  };

  const currentLocal = getLocalAssets();
  saveLocalAssets([localAsset, ...currentLocal]);

  return {
    asset: localAsset,
    savedToDb: false,
    message: '素材を一時保管（ローカル）に保存しました。DBマイグレーション適用後にDBへ反映されます。',
  };
}

export async function deleteMarketingAsset(asset: MarketingAsset): Promise<{ success: boolean; message?: string }> {
  const db = getSupabase();

  // ローカルから削除
  const local = getLocalAssets();
  saveLocalAssets(local.filter((item) => item.id !== asset.id));

  if (!asset.is_local && db) {
    try {
      if (asset.storage_path) {
        await db.storage.from(BUCKET_NAME).remove([asset.storage_path]);
      }
      const { error } = await db.from('mst_marketing_assets').delete().eq('id', asset.id);
      if (error) {
        return { success: false, message: 'DBからの削除に失敗しました: ' + error.message };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || '削除中にエラーが発生しました。' };
    }
  }

  return { success: true, message: '削除しました。' };
}

export async function updateMarketingAssetStatus(
  asset: MarketingAsset,
  newStatus: AssetStatus
): Promise<{ success: boolean; message?: string }> {
  const db = getSupabase();
  const now = new Date().toISOString();

  // ローカル更新
  const local = getLocalAssets();
  saveLocalAssets(local.map((item) => (item.id === asset.id ? { ...item, status: newStatus, updated_at: now } : item)));

  if (!asset.is_local && db) {
    try {
      const { error } = await db
        .from('mst_marketing_assets')
        .update({ status: newStatus, updated_at: now })
        .eq('id', asset.id);
      if (error) {
        return { success: false, message: '状態の更新に失敗しました: ' + error.message };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || '更新中にエラーが発生しました。' };
    }
  }

  return { success: true };
}

export async function getAssetViewUrl(asset: MarketingAsset): Promise<string | null> {
  if (asset.external_url) {
    return asset.external_url;
  }
  if (!asset.storage_path) {
    return null;
  }
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db.storage.from(BUCKET_NAME).createSignedUrl(asset.storage_path, 600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
