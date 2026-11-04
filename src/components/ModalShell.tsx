import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ErrorBoundaryProps {
  onClose: () => void;
  children: React.ReactNode;
}

/** 子コンポーネントの描画エラーで画面全体が真っ白になるのを防ぐ。 */
class ModalErrorBoundary extends React.Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Modal render error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 space-y-3 text-sm text-slate-800">
        <p className="font-bold text-rose-600">この画面の表示中にエラーが発生しました。</p>
        <p className="text-xs text-slate-500 break-words">{this.state.error.message}</p>
        <button
          type="button"
          onClick={this.props.onClose}
          className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-xs cursor-pointer"
        >
          閉じる
        </button>
      </div>
    );
  }
}

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, children, maxWidthClass = 'max-w-5xl' }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${maxWidthClass} rounded-2xl border border-slate-200 bg-white shadow-2xl text-slate-900`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
        <ModalErrorBoundary onClose={onClose}>{children}</ModalErrorBoundary>
      </div>
    </div>
  );
};
