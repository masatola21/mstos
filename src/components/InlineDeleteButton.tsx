import React, { useState } from 'react';

interface InlineDeleteButtonProps {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  warning?: string;
  confirmLabel?: string;
  className?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const InlineDeleteButton: React.FC<InlineDeleteButtonProps> = ({
  onConfirm,
  children,
  warning = '削除しますか？',
  confirmLabel = '削除を確定',
  className = 'rounded border border-rose-800 px-2 py-1 text-xs text-rose-300',
  confirmClassName = 'rounded bg-rose-700 px-2 py-1 text-xs font-semibold text-white',
  cancelClassName = 'rounded border border-slate-700 px-2 py-1 text-xs text-slate-300',
  disabled = false,
  ariaLabel = '削除',
}) => {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const confirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button type="button" disabled={disabled || pending} aria-label={ariaLabel}
        onClick={(event) => { event.stopPropagation(); setConfirming(true); }}
        className={className}>
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={ariaLabel}>
      <span className="text-xs text-amber-200">{warning}</span>
      <button type="button" disabled={disabled || pending} onClick={(event) => void confirm(event)} className={confirmClassName}>
        {pending ? '削除中…' : confirmLabel}
      </button>
      <button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); setConfirming(false); }} className={cancelClassName}>
        キャンセル
      </button>
    </span>
  );
};
