import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  Check, 
  Terminal, 
  AlertTriangle,
  FileCode2,
  Database
} from 'lucide-react';

interface RlsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RlsGuideModal: React.FC<RlsGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rlsSqlContent = `-- ==============================================================================
-- MST AI経営OS: Supabase Row Level Security (RLS) 推奨設定SQL
-- ==============================================================================
-- 【重要: アクセス権限のスコープについて】
-- 本設定で使用している \`TO authenticated USING (true)\` は、
-- Supabase Auth に招待・ログインしたすべての社内ユーザーが、全テーブルの
-- 全レコードを閲覧（SELECT）・登録（INSERT）・更新（UPDATE）できる
-- 「全社共有型（社内オープン）」のアクセス権限設定です。
--
-- 【注意】
-- 1. このSQLはテーブルの作成や既存データの削除・変更を行いません。
-- 2. DROP TABLE や DELETE などの破壊的な文は一切含まれていません。
-- 3. 実行は Supabase Dashboard の「SQL Editor」で行ってください。
-- ==============================================================================

-- 1. RLSの有効化
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

-- 2. 接続テスト用の不要な anon ポリシーの削除（実際に作成済みのテストポリシーを含む）
DROP POLICY IF EXISTS "anon_select_companies_for_test" ON public.companies;
DROP POLICY IF EXISTS "Allow anon read companies" ON public.companies;
DROP POLICY IF EXISTS "Anon can select companies" ON public.companies;

-- 3. companies（会社マスタ）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
CREATE POLICY "Allow authenticated read companies"
  ON public.companies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert companies" ON public.companies;
CREATE POLICY "Allow authenticated insert companies"
  ON public.companies FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update companies" ON public.companies;
CREATE POLICY "Allow authenticated update companies"
  ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. prospects（見込み企業）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read prospects" ON public.prospects;
CREATE POLICY "Allow authenticated read prospects"
  ON public.prospects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert prospects" ON public.prospects;
CREATE POLICY "Allow authenticated insert prospects"
  ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update prospects" ON public.prospects;
CREATE POLICY "Allow authenticated update prospects"
  ON public.prospects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 5. leads（リード）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read leads" ON public.leads;
CREATE POLICY "Allow authenticated read leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert leads" ON public.leads;
CREATE POLICY "Allow authenticated insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update leads" ON public.leads;
CREATE POLICY "Allow authenticated update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6. products（商品マスタ）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read products" ON public.products;
CREATE POLICY "Allow authenticated read products"
  ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert products" ON public.products;
CREATE POLICY "Allow authenticated insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update products" ON public.products;
CREATE POLICY "Allow authenticated update products"
  ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 7. deals（商談）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read deals" ON public.deals;
CREATE POLICY "Allow authenticated read deals"
  ON public.deals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert deals" ON public.deals;
CREATE POLICY "Allow authenticated insert deals"
  ON public.deals FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update deals" ON public.deals;
CREATE POLICY "Allow authenticated update deals"
  ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 8. customers（顧客）ポリシー
DROP POLICY IF EXISTS "Allow authenticated read customers" ON public.customers;
CREATE POLICY "Allow authenticated read customers"
  ON public.customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert customers" ON public.customers;
CREATE POLICY "Allow authenticated insert customers"
  ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update customers" ON public.customers;
CREATE POLICY "Allow authenticated update customers"
  ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(rlsSqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Supabase RLS（行レベルセキュリティ）設定ガイド</h2>
              <p className="text-xs text-slate-500">社内データ保護のための認証ポリシー設定</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Safety & Non-destructive Notice */}
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex gap-3 text-purple-950">
            <Database className="w-5 h-5 shrink-0 text-purple-700 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-purple-900">非破壊的な安全設計</p>
              <p className="text-purple-800">
                このSQLは既存のテーブル定義やテストデータを変更・削除しません。
                対象6テーブル（companies, prospects, leads, products, deals, customers）に対して
                ログイン済み社内メンバー（authenticatedロール）のみが安全にアクセスできるようアクセス制御を付与します。
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-800">companies テーブルの接続テスト用 anon ポリシーについて</p>
              <p className="text-amber-700">
                もしSupabase上で、接続確認用に <code>companies</code> に anon (未認証) に対する SELECT ポリシーが残っている場合は、
                第三者が社名や連絡先を閲覧できてしまうリスクがあるため、本番利用前に削除または置換することを推奨します。
              </p>
            </div>
          </div>

          {/* Execution steps */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4 text-purple-600" />
              Supabase での適用手順
            </h3>
            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 pl-1">
              <li>Supabaseの管理ダッシュボードを開きます。</li>
              <li>左メニューの <strong>SQL Editor</strong> をクリックします。</li>
              <li>「New query」を開き、以下のSQLを貼り付けて <strong>Run</strong> を実行します。</li>
              <li>
                左メニュー <strong>Authentication &gt; Users</strong> から社内担当者のメールアドレスを「Invite user」または「Add user」で登録します。
              </li>
            </ol>
          </div>

          {/* Code Viewer with Copy Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-purple-600" /> supabase_rls_setup.sql
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>コピー完了</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>SQLをクリップボードにコピー</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs text-emerald-300 max-h-72 overflow-y-auto leading-relaxed select-all">
              <pre>{rlsSqlContent}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 bg-white transition-colors cursor-pointer shadow-2xs"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
