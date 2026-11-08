import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { CommunicationSendCenter } from '../components/CommunicationSendCenter';

export type SendDrawerKind =
  | 'document'
  | 'form'
  | 'diagnosis'
  | 'deal'
  | 'customer_meeting'
  | 'announcement'
  | 'sales_outreach'
  | 'nurturing_story';

export interface SendDrawerOptions {
  kind?: SendDrawerKind;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  documentId?: string;
  formId?: string;
  channel?: 'email' | 'line' | 'both';
  subject?: string;
  body?: string;
  initialRecipientEmail?: string;
  originTitle?: string;
  onSent?: (result: { ok: boolean; summary: string }) => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface SendDrawerContextType {
  isOpen: boolean;
  options: SendDrawerOptions | null;
  openSendDrawer: (opts?: SendDrawerOptions) => void;
  closeSendDrawer: (force?: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setDraftDirty: (dirty: boolean) => void;
}

const SendDrawerContext = createContext<SendDrawerContextType | undefined>(undefined);

export const SendDrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<SendDrawerOptions | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const isPopStateRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const id = Date.now();
    setToast({ id, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const setDraftDirty = useCallback((dirty: boolean) => {
    setIsDraftDirty(dirty);
  }, []);

  const openSendDrawer = useCallback((opts?: SendDrawerOptions) => {
    setOptions(opts || {});
    setIsDraftDirty(false);
    setShowConfirmClose(false);
    setIsOpen(true);

    if (typeof window !== 'undefined' && !isPopStateRef.current) {
      const cur = window.history.state;
      const nextState = {
        ...(cur && typeof cur === 'object' ? cur : {}),
        mst: true,
        modal: 'send_drawer',
      };
      window.history.pushState(nextState, '', window.location.href);
    }
  }, []);

  const executeClose = useCallback(() => {
    setShowConfirmClose(false);
    setIsDraftDirty(false);
    setIsOpen(false);
    setOptions(null);

    if (typeof window !== 'undefined') {
      const cur = window.history.state;
      if (cur?.mst && cur.modal === 'send_drawer') {
        window.history.back();
      }
    }
  }, []);

  const closeSendDrawer = useCallback((force = false) => {
    if (!force && isDraftDirty) {
      setShowConfirmClose(true);
      return;
    }
    executeClose();
  }, [isDraftDirty, executeClose]);

  // Handle browser back button (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (isOpen && state?.modal !== 'send_drawer') {
        isPopStateRef.current = true;
        setIsOpen(false);
        setOptions(null);
        setShowConfirmClose(false);
        setIsDraftDirty(false);
        setTimeout(() => {
          isPopStateRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  // Handle Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showConfirmClose) {
          setShowConfirmClose(false);
        } else {
          closeSendDrawer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmClose, closeSendDrawer]);

  const handleSendSuccess = (result: { ok: boolean; summary: string }) => {
    setIsDraftDirty(false);
    setShowConfirmClose(false);
    setIsOpen(false);
    showToast(result.summary || '送信が完了しました', 'success');
    if (options?.onSent) {
      options.onSent(result);
    }
    setOptions(null);

    if (typeof window !== 'undefined') {
      const cur = window.history.state;
      if (cur?.mst && cur.modal === 'send_drawer') {
        window.history.back();
      }
    }
  };

  return (
    <SendDrawerContext.Provider
      value={{
        isOpen,
        options,
        openSendDrawer,
        closeSendDrawer,
        showToast,
        setDraftDirty,
      }}
    >
      {children}

      {/* Floating Global Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-[70] max-w-md animate-in slide-in-from-top-2 duration-200"
        >
          <div
            className={`flex items-start gap-3 rounded-xl p-4 shadow-xl border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-purple-50 border-purple-300 text-purple-900'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />}
            <div className="flex-1 text-xs font-semibold leading-relaxed whitespace-pre-wrap">{toast.message}</div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Send Drawer Modal & Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => closeSendDrawer()}
            aria-hidden="true"
          />

          {/* Drawer Slide-over Panel (Right on Desktop, Bottom Sheet on Mobile) */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="送信ドロワー"
              className="w-screen max-w-2xl lg:max-w-3xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200 max-sm:rounded-t-2xl max-sm:mt-12"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-2xs">
                    <Send className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">個別送信（LINE・メール）</h2>
                      <span className="rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 border border-purple-200">
                        ドロワー送信
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      元の画面の一覧や文脈を見失わずに、宛先・テンプレート・プレビューを確認して直接送信できます。
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => closeSendDrawer()}
                  className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                  title="ドロワーを閉じる（Esc）"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Close Confirmation Dialog (If user has unsaved draft) */}
              {showConfirmClose && (
                <div className="bg-amber-50 border-b border-amber-200 px-5 py-3.5 flex items-center justify-between gap-3 animate-in fade-in duration-150 shrink-0">
                  <div className="flex items-center gap-2.5 text-xs text-amber-900 font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>編集中の内容があります。下書きを破棄してドロワーを閉じますか？</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowConfirmClose(false)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                    >
                      編集を続ける
                    </button>
                    <button
                      type="button"
                      onClick={executeClose}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-2xs"
                    >
                      破棄して閉じる
                    </button>
                  </div>
                </div>
              )}

              {/* Drawer Body: Embedded CommunicationSendCenter with variant="drawer" */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/40">
                {options && (
                  <CommunicationSendCenter
                    key={`${options.companyId || ''}:${options.contactId || ''}:${options.documentId || ''}:${options.formId || ''}:${options.dealId || ''}`}
                    variant="drawer"
                    initialKind={options.kind || (options.documentId ? 'document' : 'form')}
                    initialCompanyId={options.companyId}
                    initialDocumentId={options.documentId}
                    initialFormId={options.formId}
                    initialDealId={options.dealId}
                    initialContactId={options.contactId}
                    initialChannel={options.channel}
                    initialSubject={options.subject}
                    initialBody={options.body}
                    onClose={() => closeSendDrawer()}
                    onSent={handleSendSuccess}
                    onDraftChange={setDraftDirty}
                  />
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </SendDrawerContext.Provider>
  );
};

export const useSendDrawer = (): SendDrawerContextType => {
  const context = useContext(SendDrawerContext);
  if (!context) {
    throw new Error('useSendDrawer must be used within a SendDrawerProvider');
  }
  return context;
};
