import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'right' | 'bottom' | 'top';
  className?: string;
}

export function Tooltip({ label, children, side = 'right', className }: TooltipProps) {
  return (
    <span className={`${styles.wrap} ${className ?? ''}`}>
      {children}
      <span className={`${styles.bubble} ${styles[side]}`} role="tooltip">
        {label}
      </span>
    </span>
  );
}
