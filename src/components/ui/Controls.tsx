import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { Unit } from '@/types';
import { formatNumber, unitToMm, clamp } from '@/engine/units';
import styles from './Controls.module.css';

interface NumberFieldProps {
  label: string;
  /** Value in millimetres. */
  value: number;
  unit: Unit;
  onChange: (mm: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  hint?: string;
  showUnit?: boolean;
}

/** Numeric input bound to millimetre data, displayed in the active unit. */
export function NumberField({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max = 100_000,
  step,
  disabled,
  hint,
  showUnit = true,
}: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => formatNumber(value, unit));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatNumber(value, unit));
  }, [value, unit, focused]);

  const commit = () => {
    const parsed = Number.parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setText(formatNumber(value, unit));
      return;
    }
    const mm = clamp(unitToMm(parsed, unit), min, max);
    onChange(mm);
    setText(formatNumber(mm, unit));
  };

  const stepValue = step ?? (unit === 'mm' ? 10 : unit === 'cm' ? 1 : 0.05);

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {hint ? <span className={styles.unitHint}>{hint}</span> : null}
      </div>
      <div className={`${styles.inputShell} ${disabled ? styles.disabled : ''}`}>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setText(formatNumber(value, unit));
              event.currentTarget.blur();
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              const direction = event.key === 'ArrowUp' ? 1 : -1;
              const next = clamp(
                unitToMm(
                  (Number.parseFloat(text.replace(',', '.')) || 0) + direction * stepValue,
                  unit,
                ),
                min,
                max,
              );
              onChange(next);
              setText(formatNumber(next, unit));
            }
          }}
        />
        {showUnit ? <span className={styles.suffix}>{unit}</span> : null}
      </div>
    </div>
  );
}

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  onEnter?: () => void;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 80,
  disabled,
  onEnter,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={styles.textInput}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onEnter?.();
        }}
      />
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ToggleProps {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ title, hint, checked, onChange, disabled }: ToggleProps) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.toggleText}>
        <span className={styles.toggleTitle}>{title}</span>
        {hint ? <span className={styles.toggleHint}>{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function TwoCol({ children }: { children: ReactNode }) {
  return <div className={styles.twoCol}>{children}</div>;
}

export function ThreeCol({ children }: { children: ReactNode }) {
  return <div className={styles.threeCol}>{children}</div>;
}
