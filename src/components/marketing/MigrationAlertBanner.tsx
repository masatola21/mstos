import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, Database, ExternalLink, RefreshCw } from 'lucide-react';
import { MIGRATION_FILE_NAME, MIGRATION_SQL } from '../../services/marketingAssetService';

export const MigrationAlertBanner: React.FC<{
  onRefresh?: () => void;
  compact?: boolean;
}> = ({ onRefresh, compact = false }) => {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await onRefresh?.();
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            素材保管DBが未適用です（現在はローカル保管モード）。
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded bg-amber-700/60 px-2 py-1 font-medium text-amber-100 hover:bg-amber-600"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
            {copied ? 'SQLコピー完了' : 'マイグレーションSQLコピー'}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              className="inline-flex items-center gap-1 rounded border border-amber-600/40 px-2 py-1 text-amber-200 hover:bg-amber-900/40"
              title="DB適用状況を再チェック"
            >
              <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
              再確認
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-slate-900 p-4 text-sm text-amber-200 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-100 flex items-center gap-2">
              素材保管DBが未適用です
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-normal text-amber-300">
                ローカル保管モード稼働中
              </span>
            </h3>
            <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
              Supabaseにテーブル <code className="rounded bg-slate-950 px-1.5 py-0.5 text-amber-300">mst_marketing_assets</code> とStorageバケットが未作成のため、現在はブラウザ内（ローカル）に一時保存されています。
              <br />
              <span className="text-amber-300 font-medium">
                {MIGRATION_FILE_NAME}
              </span> をSupabaseのSQL Editorで適用すると、永続保存とファイル共有が有効化されます。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-500 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'SQLをコピーしました！' : 'マイグレーションSQLをコピー'}
          </button>
          <button
            type="button"
            onClick={() => setShowSql(!showSql)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-600/50 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-900/60"
          >
            {showSql ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showSql ? 'SQLを閉じる' : 'SQL内容を確認'}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin text-amber-400' : ''}`} />
              適用を再チェック
            </button>
          )}
        </div>
      </div>

      {showSql && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>適用手順: Supabaseダッシュボード &gt; SQL Editor &gt; New query に貼り付けて「Run」を実行</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-cyan-300 hover:underline inline-flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> 全文コピー
            </button>
          </div>
          <pre className="max-h-56 overflow-auto rounded bg-slate-900 p-2.5 text-[11px] font-mono text-slate-200 select-all">
            {MIGRATION_SQL}
          </pre>
        </div>
      )}
    </div>
  );
};
