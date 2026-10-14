import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabaseClient';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  SlidersHorizontal,
  Database,
  ArrowRight,
  UserPlus,
  FileCode2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface AuthScreenProps {
  onOpenConfig: () => void;
  onOpenRls: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onOpenConfig, onOpenRls }) => {
  const { signIn, signUp, config } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpResult, setSignUpResult] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    solution?: string;
    rawMessage?: string;
    code?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pingStatus, setPingStatus] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);

  const testSupabaseConnection = async () => {
    setPingStatus({ testing: true });
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setPingStatus({ testing: false, success: false, message: '接続情報が未設定です。「接続設定」からURLとAPIキーを保存してください。' });
        return;
      }
      const { error } = await supabase.auth.getSession();
      if (error) {
        setPingStatus({ testing: false, success: false, message: `通信エラー: ${error.message}` });
      } else {
        setPingStatus({ testing: false, success: true, message: 'Supabaseプロジェクトと正常に通信できています！' });
      }
    } catch (err: any) {
      setPingStatus({ testing: false, success: false, message: `例外エラー: ${err?.message || '通信失敗'}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);

    if (!config.isConfigured) {
      setErrorDetails({
        message: 'Supabaseの接続情報（URLと公開キー）が設定されていません。',
        solution: '画面右上の「接続設定」を開き、SupabaseのProject URLとanon public keyを設定してください。'
      });
      return;
    }

    if (!email.trim() || !password) {
      setErrorDetails({
        message: 'メールアドレスとパスワードを入力してください。',
      });
      return;
    }

    setIsSubmitting(true);

    if (isSignUp) {
      const result = await signUp(email, password);
      setIsSubmitting(false);
      if (result.error) {
        if (result.error.includes('アカウントが作成されました')) {
          setSignUpResult(result.error);
          setIsSignUp(false);
        } else {
          setErrorDetails({
            message: result.error,
            solution: result.solution,
            rawMessage: result.rawMessage,
            code: result.errorCode,
          });
        }
      } else {
        setSignUpResult('アカウントが作成されました。自動的にログインしました。');
      }
      return;
    }

    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setErrorDetails({
        message: result.error,
        solution: result.solution,
        rawMessage: result.rawMessage,
        code: result.errorCode,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Top Banner & Quick Setup */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20">
              MST
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white">MST AI経営OS</span>
              <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">社内営業管理システム</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenRls}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 transition-colors flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>RLSポリシー設定</span>
            </button>
            <button
              onClick={onOpenConfig}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                config.isConfigured
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{config.isConfigured ? '接続設定済' : '接続設定（環境変数）'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full space-y-6">
          {/* Missing Env Notice if unconfigured */}
          {!config.isConfigured && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 animate-fade-in shadow-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-amber-300">
                    Supabase環境変数が未設定です
                  </h3>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    データベースへ接続するための環境変数が未検出です。以下のいずれかの方法で設定を行ってください。
                  </p>
                </div>
              </div>

              <div className="text-xs bg-slate-900/90 rounded-xl p-3 border border-amber-500/20 font-mono text-slate-300 space-y-1">
                <div className="text-slate-400"># 必要な環境変数</div>
                <div>NEXT_PUBLIC_SUPABASE_URL</div>
                <div>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</div>
              </div>

              <button
                onClick={onOpenConfig}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-amber-500/20"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>接続設定を開いて設定する</span>
              </button>
            </div>
          )}

          {/* Login Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />

            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-2 shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">{isSignUp ? 'アカウント作成' : '社内メンバーログイン'}</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                MST AI経営OSへアクセスするには社内アカウントで認証を行ってください。未ログイン状態では業務データは表示されません。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  社内メールアドレス
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.co.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm placeholder:text-slate-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  パスワード
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 text-sm placeholder:text-slate-500 outline-none transition-all"
                />
              </div>

              {/* Connection Diagnostics Quick Button */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={testSupabaseConnection}
                  disabled={pingStatus?.testing}
                  className="text-slate-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${pingStatus?.testing ? 'animate-spin' : ''}`} />
                  <span>Supabaseとの接続をテスト</span>
                </button>
                {config.isConfigured ? (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> URL・Key設定済
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenConfig}
                    className="text-[11px] text-amber-400 underline hover:text-amber-300"
                  >
                    未接続（接続情報を設定）
                  </button>
                )}
              </div>

              {pingStatus && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-fade-in ${
                  pingStatus.success 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}>
                  {pingStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{pingStatus.message}</span>
                </div>
              )}

              {/* Rich Error Diagnostic Box */}
              {errorDetails && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2 animate-fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="font-semibold text-rose-300 leading-snug">
                      {errorDetails.message}
                    </div>
                  </div>

                  {errorDetails.solution && (
                    <div className="bg-slate-950/80 rounded-xl p-2.5 border border-rose-500/20 text-slate-300 text-[11px] space-y-1">
                      <div className="font-semibold text-amber-400 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        <span>解決方法</span>
                      </div>
                      <p className="leading-relaxed">{errorDetails.solution}</p>
                    </div>
                  )}

                  {errorDetails.rawMessage && errorDetails.rawMessage !== errorDetails.message && (
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      詳細コード: {errorDetails.rawMessage}
                    </div>
                  )}
                </div>
              )}

              {signUpResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{signUpResult}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>処理中...</span>
                  </>
                ) : isSignUp ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>アカウントを作成</span>
                  </>
                ) : (
                  <>
                    <span>ログインして利用開始</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorDetails(null);
                    setSignUpResult(null);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isSignUp ? 'ログイン画面に戻る' : '初めての方はアカウントを作成'}
                </button>
              </div>
            </form>

            {/* Internal System Policy notice */}
            <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>パスワードとお持ちのアカウントについて</span>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-left text-xs text-slate-400 space-y-2">
                <p className="text-slate-300 font-medium">
                  🔑 <strong>固定の初期パスワードはありません</strong>
                </p>
                <p className="leading-relaxed">
                  本アプリはSupabase Authと連携しているため、<strong>接続先のSupabaseプロジェクトに登録されているユーザーのパスワード</strong>を入力します。
                </p>
                <div className="pt-1 border-t border-slate-800/80 text-[11px] space-y-1">
                  <div className="text-slate-300 font-semibold">【アカウント作成手順（1分で完了）】</div>
                  <div>1. Supabaseダッシュボード &gt; <strong>Authentication</strong> &gt; <strong>Users</strong> を開く</div>
                  <div>2. <strong>Add user</strong> &gt; <strong>Create user</strong> を選択</div>
                  <div>3. 任意のメールアドレスとパスワードを入力</div>
                  <div>4. <strong>Auto Confirm User?</strong> にチェックを入れて保存</div>
                  <div className="text-blue-400 pt-0.5">※作成後、そのメールとパスワードで即座にログイン可能です。</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-400">
        <p>© 2026 MST AI経営OS - 営業管理プラットフォーム (Supabase 連携)</p>
      </footer>
    </div>
  );
};
