import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveCustomConfig, clearCustomConfig, validatePublishableKey } from '../lib/supabaseClient';
import { 
  X, 
  ShieldAlert, 
  KeyRound, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Info,
  Server
} from 'lucide-react';

interface ConfigGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigGuideModal: React.FC<ConfigGuideModalProps> = ({ isOpen, onClose }) => {
  const { config, refreshConfig } = useAuth();
  const [url, setUrl] = useState(config.url || '');
  const [key, setKey] = useState(config.key || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validatePublishableKey(key);
    if (!validation.valid) {
      setErrorMsg(validation.reason || '無効なキーです');
      return;
    }

    try {
      saveCustomConfig(url, key, true);
      refreshConfig();
      setSuccessMsg('Supabase接続設定を保存しました。');
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || '保存に失敗しました。');
    }
  };

  const handleClear = () => {
    clearCustomConfig();
    refreshConfig();
    setUrl('');
    setKey('');
    setSuccessMsg('ローカル接続設定をリセットしました。');
  };

  const sampleEnvText = `# Supabase環境変数設定例 (.env.local または AI Studio Secrets)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
`;

  const copyEnvSnippet = () => {
    navigator.clipboard.writeText(sampleEnvText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Supabase 接続と環境変数設定</h2>
              <p className="text-xs text-slate-400">MST AI経営OS データベース接続ガイド</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-sm">
          {/* Security Alert Banner */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-3 text-amber-200">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-300">【重要】キーのセキュリティ保護について</p>
              <p>
                本アプリは社内Webフロントエンドです。<strong className="underline">service_role</strong> などの管理者シークレットキーは
                絶対に設定・入力しないでください。必ず Supabase ダッシュボードの Project Settings &gt; API にある
                <strong> anon / publishable public key</strong> を使用してください。
              </p>
            </div>
          </div>

          {/* Current Status */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">現在の接続状況</h3>
            <div className="flex items-center gap-2">
              {config.isConfigured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  接続情報 設定完了
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  接続情報 未設定
                </span>
              )}
              {config.isFromEnv ? (
                <span className="text-xs text-slate-400">（ホスト環境変数から読み込み中）</span>
              ) : config.isConfigured ? (
                <span className="text-xs text-slate-400">（ブラウザ保存設定から読み込み中）</span>
              ) : null}
            </div>
            {config.url && (
              <p className="text-xs text-slate-400 font-mono">
                Project URL: <span className="text-slate-200">{config.url}</span>
              </p>
            )}
          </div>

          {/* Environment Variable Setup Method */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              方法1: 環境変数（推奨）
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              プロジェクトのルートの <code>.env.local</code> または ホスティング環境の Secrets / 環境変数に
              以下の2つの変数を設定すると自動的に読み込まれます。
            </p>
            <div className="relative bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs text-emerald-400">
              <pre className="whitespace-pre-wrap select-all">{sampleEnvText}</pre>
              <button
                onClick={copyEnvSnippet}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-[11px] transition-colors"
              >
                {copiedEnv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>コピー済</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>コピー</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Browser Input Fallback */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-400" />
              方法2: ブラウザセッションでの直接設定
            </h3>
            <p className="text-xs text-slate-400">
              環境変数の即時反映が難しい場合、ブラウザのストレージに保存して直ちに接続・動作確認できます。
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Supabase Project URL (NEXT_PUBLIC_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-xs font-mono outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  ※ ブラウザのアドレスバーのURL（supabase.com/dashboard/...）ではなく、Supabaseの <strong>Project Settings &gt; API</strong> にある <strong>Project URL</strong>（<code>https://[ID].supabase.co</code>）です。
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  Publishable / Anon Key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-xs font-mono outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  ※ service_role キーを入力するとセキュリティ保護のため拒否されます。
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  ローカル設定クリア
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
                  >
                    閉じる
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-colors"
                  >
                    接続情報を保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
