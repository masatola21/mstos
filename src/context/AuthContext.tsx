import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig, SupabaseConfigInfo } from '../lib/supabaseClient';

export interface SignInResult {
  error?: string;
  errorCode?: string;
  rawMessage?: string;
  solution?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  config: SupabaseConfigInfo;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshConfig: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<SupabaseConfigInfo>(getSupabaseConfig());

  const refreshConfig = () => {
    const nextCfg = getSupabaseConfig();
    setConfig(nextCfg);
  };

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      setUser(null);
      setSession(null);
      return;
    }

    let isMounted = true;

    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Supabase getSession error:', error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // 認証リスナー
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [config.url, config.key]);

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { 
        error: 'Supabaseの接続情報（URLと公開キー）が設定されていません。',
        solution: '画面上部の「接続設定」からSupabaseのProject URLとanon public keyを設定してください。'
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let msg = error.message;
        let solution = '';
        if (msg.includes('Email not confirmed')) {
          msg = 'メールアドレスの確認が完了していません（Email not confirmed）。';
          solution = 'Supabaseダッシュボードの [Authentication] > [Users] を開き、該当ユーザーの右端「...」から「Confirm user」をクリックしてください。';
        } else if (msg.includes('Invalid login credentials')) {
          msg = 'メールアドレスまたはパスワードが一致しません（Invalid login credentials）。';
          solution = 'メールアドレスの入力ミス、またはパスワードをご確認ください。Supabaseの [Authentication] > [Users] で該当ユーザーの「...」から「Reset password」で再設定することも可能です。';
        } else if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
          msg = 'Supabaseサーバーと通信できませんでした（Failed to fetch）。';
          solution = '設定されたSupabase Project URLが正しいか確認してください。また、Supabaseプロジェクトが一定期間アクセスがなく休止状態（Paused）になっていないかご確認ください。';
        } else if (msg.toLowerCase().includes('invalid path') || msg.toLowerCase().includes('not found')) {
          msg = 'Supabase Project URLの形式が無効です（Invalid path specified in request URL）。';
          solution = '現在設定されているURLを確認してください。ブラウザのアドレスバーのURL（https://supabase.com/dashboard/project/...）ではなく、Supabaseの [Project Settings] > [API] にある「Project URL」（例: https://xxxxxxxx.supabase.co）を設定してください。';
        }

        return { 
          error: msg,
          errorCode: error.code || String(error.status || ''),
          rawMessage: error.message,
          solution,
        };
      }

      setSession(data.session);
      setUser(data.user);
      return {};
    } catch (err: any) {
      return { 
        error: err?.message || 'ログイン中に予期せぬエラーが発生しました。',
        rawMessage: String(err),
        solution: 'SupabaseのURLとAPIキーの設定をご確認ください。'
      };
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        config,
        signIn,
        signOut,
        refreshConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
