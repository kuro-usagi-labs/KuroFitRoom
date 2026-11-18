import { Minus, Plus, Maximize2, RotateCcw } from 'lucide-react';
import type { Unit } from '@/types';
import { formatLength } from '@/engine/units';
import { useProjectStore } from '@/store/projectStore';
import { IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './CanvasControls.module.css';

interface CanvasControlsProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function CanvasControls({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: CanvasControlsProps) {
  const settings = useProjectStore((state) => state.project.settings);
  const updateSettings = useProjectStore((state) => state.updateSettings);

  return (
    <div className={styles.controls}>
      <div className={styles.group}>
        <IconButton aria-label="Zoom out" onClick={onZoomOut}>
          <Minus size={15} />
        </IconButton>
        <span className={styles.zoom} aria-live="polite">
          {zoomPercent}%
        </span>
        <IconButton aria-label="Zoom in" onClick={onZoomIn}>
          <Plus size={15} />
        </IconButton>
      </div>

      <span className={styles.divider} />

      <Tooltip label="Fit room to screen" side="top">
        <IconButton aria-label="Fit to screen" onClick={onFit}>
          <Maximize2 size={15} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Reset view to 100%" side="top">
        <IconButton aria-label="Reset view" onClick={onReset}>
          <RotateCcw size={15} />
        </IconButton>
      </Tooltip>

      <span className={styles.divider} />

      <label className={styles.field}>
        <span className={styles.label}>Grid</span>
        <select
          className={styles.select}
          value={settings.gridSize}
          onChange={(event) => updateSettings({ gridSize: Number(event.target.value) })}
          aria-label="Grid size"
        >
          {[50, 100, 250, 500, 1000].map((value) => (
            <option key={value} value={value}>
              {formatLength(value, settings.unit)}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Unit</span>
        <select
          className={styles.select}
          value={settings.unit}
          onChange={(event) => updateSettings({ unit: event.target.value as Unit })}
          aria-label="Display unit"
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="m">m</option>
        </select>
      </label>
    </div>
  );
}
