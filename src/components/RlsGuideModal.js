import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, ShieldCheck, Copy, Check, Terminal, AlertTriangle, FileCode2, Database } from 'lucide-react';
export const RlsGuideModal = ({ isOpen, onClose }) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen)
        return null;
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
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700", children: _jsx(ShieldCheck, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Supabase RLS\uFF08\u884C\u30EC\u30D9\u30EB\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\uFF09\u8A2D\u5B9A\u30AC\u30A4\u30C9" }), _jsx("p", { className: "text-xs text-slate-500", children: "\u793E\u5185\u30C7\u30FC\u30BF\u4FDD\u8B77\u306E\u305F\u3081\u306E\u8A8D\u8A3C\u30DD\u30EA\u30B7\u30FC\u8A2D\u5B9A" })] })] }), _jsx("button", { onClick: onClose, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-6 overflow-y-auto space-y-6 text-slate-700 text-sm", children: [_jsxs("div", { className: "p-4 rounded-xl bg-purple-50 border border-purple-200 flex gap-3 text-purple-950", children: [_jsx(Database, { className: "w-5 h-5 shrink-0 text-purple-700 mt-0.5" }), _jsxs("div", { className: "text-xs space-y-1", children: [_jsx("p", { className: "font-semibold text-purple-900", children: "\u975E\u7834\u58CA\u7684\u306A\u5B89\u5168\u8A2D\u8A08" }), _jsx("p", { className: "text-purple-800", children: "\u3053\u306ESQL\u306F\u65E2\u5B58\u306E\u30C6\u30FC\u30D6\u30EB\u5B9A\u7FA9\u3084\u30C6\u30B9\u30C8\u30C7\u30FC\u30BF\u3092\u5909\u66F4\u30FB\u524A\u9664\u3057\u307E\u305B\u3093\u3002 \u5BFE\u8C616\u30C6\u30FC\u30D6\u30EB\uFF08companies, prospects, leads, products, deals, customers\uFF09\u306B\u5BFE\u3057\u3066 \u30ED\u30B0\u30A4\u30F3\u6E08\u307F\u793E\u5185\u30E1\u30F3\u30D0\u30FC\uFF08authenticated\u30ED\u30FC\u30EB\uFF09\u306E\u307F\u304C\u5B89\u5168\u306B\u30A2\u30AF\u30BB\u30B9\u3067\u304D\u308B\u3088\u3046\u30A2\u30AF\u30BB\u30B9\u5236\u5FA1\u3092\u4ED8\u4E0E\u3057\u307E\u3059\u3002" })] })] }), _jsxs("div", { className: "p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 text-amber-900", children: [_jsx(AlertTriangle, { className: "w-5 h-5 shrink-0 text-amber-600 mt-0.5" }), _jsxs("div", { className: "text-xs space-y-1", children: [_jsx("p", { className: "font-semibold text-amber-800", children: "companies \u30C6\u30FC\u30D6\u30EB\u306E\u63A5\u7D9A\u30C6\u30B9\u30C8\u7528 anon \u30DD\u30EA\u30B7\u30FC\u306B\u3064\u3044\u3066" }), _jsxs("p", { className: "text-amber-700", children: ["\u3082\u3057Supabase\u4E0A\u3067\u3001\u63A5\u7D9A\u78BA\u8A8D\u7528\u306B ", _jsx("code", { children: "companies" }), " \u306B anon (\u672A\u8A8D\u8A3C) \u306B\u5BFE\u3059\u308B SELECT \u30DD\u30EA\u30B7\u30FC\u304C\u6B8B\u3063\u3066\u3044\u308B\u5834\u5408\u306F\u3001 \u7B2C\u4E09\u8005\u304C\u793E\u540D\u3084\u9023\u7D61\u5148\u3092\u95B2\u89A7\u3067\u304D\u3066\u3057\u307E\u3046\u30EA\u30B9\u30AF\u304C\u3042\u308B\u305F\u3081\u3001\u672C\u756A\u5229\u7528\u524D\u306B\u524A\u9664\u307E\u305F\u306F\u7F6E\u63DB\u3059\u308B\u3053\u3068\u3092\u63A8\u5968\u3057\u307E\u3059\u3002"] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("h3", { className: "font-semibold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider", children: [_jsx(Terminal, { className: "w-4 h-4 text-purple-600" }), "Supabase \u3067\u306E\u9069\u7528\u624B\u9806"] }), _jsxs("ol", { className: "list-decimal list-inside text-xs text-slate-600 space-y-1.5 pl-1", children: [_jsx("li", { children: "Supabase\u306E\u7BA1\u7406\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3092\u958B\u304D\u307E\u3059\u3002" }), _jsxs("li", { children: ["\u5DE6\u30E1\u30CB\u30E5\u30FC\u306E ", _jsx("strong", { children: "SQL Editor" }), " \u3092\u30AF\u30EA\u30C3\u30AF\u3057\u307E\u3059\u3002"] }), _jsxs("li", { children: ["\u300CNew query\u300D\u3092\u958B\u304D\u3001\u4EE5\u4E0B\u306ESQL\u3092\u8CBC\u308A\u4ED8\u3051\u3066 ", _jsx("strong", { children: "Run" }), " \u3092\u5B9F\u884C\u3057\u307E\u3059\u3002"] }), _jsxs("li", { children: ["\u5DE6\u30E1\u30CB\u30E5\u30FC ", _jsx("strong", { children: "Authentication > Users" }), " \u304B\u3089\u793E\u5185\u62C5\u5F53\u8005\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u300CInvite user\u300D\u307E\u305F\u306F\u300CAdd user\u300D\u3067\u767B\u9332\u3057\u307E\u3059\u3002"] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-medium text-slate-500 flex items-center gap-1.5", children: [_jsx(FileCode2, { className: "w-3.5 h-3.5 text-purple-600" }), " supabase_rls_setup.sql"] }), _jsx("button", { onClick: handleCopy, className: "px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer", children: copied ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-white" }), _jsx("span", { children: "\u30B3\u30D4\u30FC\u5B8C\u4E86" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "SQL\u3092\u30AF\u30EA\u30C3\u30D7\u30DC\u30FC\u30C9\u306B\u30B3\u30D4\u30FC" })] })) })] }), _jsx("div", { className: "bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs text-emerald-300 max-h-72 overflow-y-auto leading-relaxed select-all", children: _jsx("pre", { children: rlsSqlContent }) })] })] }), _jsx("div", { className: "px-6 py-3 border-t border-slate-200 bg-white flex justify-end", children: _jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 bg-white transition-colors cursor-pointer shadow-2xs", children: "\u9589\u3058\u308B" }) })] }) }));
};
