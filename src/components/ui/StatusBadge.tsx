import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { FitStatus } from '@/types';
import styles from './StatusBadge.module.css';

const CONFIG: Record<
  FitStatus,
  { className: string; Icon: typeof CheckCircle2; label: string }
> = {
  comfortable: { className: 'comfortable', Icon: CheckCircle2, label: 'Fits comfortably' },
  tight: { className: 'tight', Icon: AlertTriangle, label: 'Fits, but tight' },
  'no-fit': { className: 'noFit', Icon: XCircle, label: "Doesn't fit" },
  review: { className: 'review', Icon: HelpCircle, label: 'Needs review' },
};

interface StatusBadgeProps {
  status: FitStatus;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusBadge({ status, label, size = 'md', showIcon = true }: StatusBadgeProps) {
  const config = CONFIG[status];
  return (
    <span
      className={`${styles.badge} ${styles[config.className]} ${size === 'sm' ? styles.small : ''}`}
    >
      {showIcon ? <config.Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.2} /> : null}
      <span>{label ?? config.label}</span>
    </span>
  );
}
