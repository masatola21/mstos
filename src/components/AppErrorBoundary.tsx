import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
          <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-rose-800/70 bg-slate-900 p-6 shadow-xl">
            <h1 className="text-xl font-bold">画面の表示中にエラーが発生しました</h1>
            <p className="mt-2 text-sm text-slate-300">アプリ全体が真っ白にならないよう、表示を停止しました。再読み込みしても続く場合は、下のエラー内容をサポートへ共有してください。</p>
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-rose-200">{this.state.error.message}</pre>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500">再読み込み</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
