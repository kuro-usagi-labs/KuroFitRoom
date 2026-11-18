import { Info, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useProjectAnalysis } from '@/hooks/useAnalysis';
import { formatArea, formatLength } from '@/engine/units';
import { NumberField, TextField, TwoCol } from '@/components/ui/Controls';
import shared from '@/styles/shared.module.css';
import styles from './RoomPanel.module.css';

const PRESETS = [
  { label: '2.5 × 3 m', width: 2500, length: 3000 },
  { label: '3 × 3 m', width: 3000, length: 3000 },
  { label: '3 × 3.5 m', width: 3000, length: 3500 },
  { label: '3 × 4 m', width: 3000, length: 4000 },
  { label: '4 × 4 m', width: 4000, length: 4000 },
  { label: '4 × 5 m', width: 4000, length: 5000 },
];

export function RoomPanel() {
  const room = useProjectStore((state) => state.project.room);
  const unit = useProjectStore((state) => state.project.settings.unit);
  const setRoom = useProjectStore((state) => state.setRoom);
  const furnitureCount = useProjectStore((state) => state.project.furniture.length);
  const analysis = useProjectAnalysis();

  const outside = analysis.issues.filter((issue) => issue.category === 'boundary');
  const isPreset = (width: number, length: number) => room.width === width && room.length === length;

  return (
    <div className={shared.panel}>
      <div className={styles.overviewCard}>
        <div className={styles.overviewHeader}>
          <span className={shared.sectionTitle}>Floor plan</span>
          <span className={styles.areaBadge}>{formatArea(room.width * room.length)}</span>
        </div>
        <p className={styles.overviewName}>{room.name}</p>
        <div className={styles.overviewDims}>
          <span>
            {formatLength(room.width, unit)} × {formatLength(room.length, unit)}
          </span>
          <span className={styles.dot}>·</span>
          <span>{furnitureCount} objects</span>
        </div>
      </div>

      <section className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Room dimensions</h3>
        </div>
        <TextField
          label="Room name"
          value={room.name}
          onChange={(name) => setRoom({ name })}
          maxLength={48}
        />
        <TwoCol>
          <NumberField
            label="Width"
            value={room.width}
            unit={unit}
            min={1000}
            max={20000}
            onChange={(width) => setRoom({ width })}
          />
          <NumberField
            label="Length"
            value={room.length}
            unit={unit}
            min={1000}
            max={20000}
            onChange={(length) => setRoom({ length })}
          />
        </TwoCol>
        <TwoCol>
          <NumberField
            label="Ceiling height"
            hint="metadata"
            value={room.ceilingHeight}
            unit={unit}
            min={1500}
            max={6000}
            onChange={(ceilingHeight) => setRoom({ ceilingHeight })}
          />
          <NumberField
            label="Wall thickness"
            hint="visual"
            value={room.wallThickness}
            unit="mm"
            min={0}
            max={600}
            onChange={(wallThickness) => setRoom({ wallThickness })}
          />
        </TwoCol>
        <p className={shared.sectionHint}>
          Geometry uses the inner clear size. Wall thickness is drawn outside it and never changes
          the usable dimensions.
        </p>
      </section>

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Size presets</h3>
        <div className={shared.chips}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={`${shared.chip} ${isPreset(preset.width, preset.length) ? shared.chipActive : ''}`}
              onClick={() => setRoom({ width: preset.width, length: preset.length })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {outside.length > 0 ? (
        <div className={`${shared.callout} ${shared.calloutWarn}`}>
          <AlertTriangle size={14} />
          <span>
            {outside.length} {outside.length === 1 ? 'object extends' : 'objects extend'} beyond the
            room boundary. Nothing was deleted — move or resize the object, or enlarge the room.
          </span>
        </div>
      ) : (
        <div className={`${shared.callout} ${shared.calloutInfo}`}>
          <Info size={14} />
          <span>
            {formatArea(room.width * room.length)} of floor area. Clearance values are heuristics,
            not universal standards.
          </span>
        </div>
      )}
    </div>
  );
}
