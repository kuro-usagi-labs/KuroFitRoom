import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import styles from './Toasts.module.css';

export function Toasts({ lift = 'none' }: { lift?: 'none' | 'bar' | 'apply' }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className={`${styles.stack} ${lift === 'bar' ? styles.aboveBar : ''} ${
        lift === 'apply' ? styles.aboveApply : ''
      }`}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
          {toast.tone === 'error' ? (
            <AlertCircle size={15} />
          ) : toast.tone === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <Info size={15} />
          )}
          <span>{toast.message}</span>
          <button className={styles.close} onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
