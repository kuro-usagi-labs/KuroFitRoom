import type { ClearanceCheck, FurnitureObject, Measurement } from '@/types';
import type { UsageZone } from '@/engine/clearance';
import { footprint, rectCenter } from '@/engine/geometry';
import type { SnapGuide } from '@/engine/snapping';
import { formatLength, formatSmartLength } from '@/engine/units';
import { FurnitureGlyph } from './FurnitureGlyph';
import styles from './Overlays.module.css';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface FurnitureLayerProps {
  furniture: FurnitureObject[];
  scale: number;
  selectedId: string | null;
  errorIds: Set<string>;
  warningIds: Set<string>;
  blockedIds: Set<string>;
  onPointerDownObject: (event: React.PointerEvent, id: string) => void;
}

export function FurnitureLayer({
  furniture,
  scale,
  selectedId,
  errorIds,
  warningIds,
  blockedIds,
  onPointerDownObject,
}: FurnitureLayerProps) {
  const px = 1 / scale;
  return (
    <g>
      {furniture.map((object) => {
        const rect = footprint(object);
        const selected = object.id === selectedId;
        const hasError = errorIds.has(object.id) || blockedIds.has(object.id);
        const hasWarning = warningIds.has(object.id) && !hasError;
        return (
          <g
            key={object.id}
            className={`${styles.furniture} ${object.locked ? styles.locked : ''}`}
            onPointerDown={(event) => onPointerDownObject(event, object.id)}
            data-object-id={object.id}
            role="button"
            aria-label={`${object.name}, ${object.width} by ${object.depth} millimetres`}
          >
            <g transform={`translate(${object.x} ${object.y}) rotate(${object.rotation})`}>
              <FurnitureGlyph
                width={object.width}
                depth={object.depth}
                kind={object.kind}
                color={object.color}
              />
              <rect
                className={styles.hoverOutline}
                x={-object.width / 2 - 2 * px}
                y={-object.depth / 2 - 2 * px}
                width={object.width + 4 * px}
                height={object.depth + 4 * px}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={1.5 * px}
                rx={3 * px}
                pointerEvents="none"
              />
            </g>
            {hasError ? (
              <rect
                x={rect.x1}
                y={rect.y1}
                width={rect.x2 - rect.x1}
                height={rect.y2 - rect.y1}
                fill="rgba(199, 98, 89, 0.09)"
                stroke="var(--error)"
                strokeWidth={1.5 * px}
                strokeDasharray={`${6 * px} ${4 * px}`}
                pointerEvents="none"
                rx={2 * px}
              />
            ) : null}
            {hasWarning ? (
              <rect
                x={rect.x1}
                y={rect.y1}
                width={rect.x2 - rect.x1}
                height={rect.y2 - rect.y1}
                fill="none"
                stroke="var(--warning)"
                strokeWidth={1.2 * px}
                strokeDasharray={`${2 * px} ${4 * px}`}
                pointerEvents="none"
                rx={2 * px}
              />
            ) : null}
            {hasError || hasWarning ? (
              <g pointerEvents="none" transform={`translate(${rect.x2 - 7 * px} ${rect.y1 + 7 * px})`}>
                <circle
                  r={6 * px}
                  fill={hasError ? 'var(--error)' : 'var(--warning)'}
                  stroke="#fff"
                  strokeWidth={1.4 * px}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5 * px}
                  fontWeight={700}
                  fill="#fff"
                  y={0.4 * px}
                >
                  !
                </text>
              </g>
            ) : null}
            {selected ? null : <title>{`${object.name} · ${formatSmartLength(object.width)} × ${formatSmartLength(object.depth)}`}</title>}
          </g>
        );
      })}
    </g>
  );
}

interface SelectionLayerProps {
  object: FurnitureObject;
  scale: number;
  showHandles: boolean;
  onResizeStart: (event: React.PointerEvent, handle: ResizeHandle) => void;
}

const HANDLE_POSITIONS: { handle: ResizeHandle; ax: 0 | 0.5 | 1; ay: 0 | 0.5 | 1 }[] = [
  { handle: 'nw', ax: 0, ay: 0 },
  { handle: 'n', ax: 0.5, ay: 0 },
  { handle: 'ne', ax: 1, ay: 0 },
  { handle: 'e', ax: 1, ay: 0.5 },
  { handle: 'se', ax: 1, ay: 1 },
  { handle: 's', ax: 0.5, ay: 1 },
  { handle: 'sw', ax: 0, ay: 1 },
  { handle: 'w', ax: 0, ay: 0.5 },
];

export function SelectionLayer({
  object,
  scale,
  showHandles,
  onResizeStart,
}: SelectionLayerProps) {
  const rect = footprint(object);
  const px = 1 / scale;
  return (
    <g pointerEvents="none">
      <rect
        x={rect.x1 - 2 * px}
        y={rect.y1 - 2 * px}
        width={rect.x2 - rect.x1 + 4 * px}
        height={rect.y2 - rect.y1 + 4 * px}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.6 * px}
        rx={2 * px}
      />
      {showHandles
        ? HANDLE_POSITIONS.map(({ handle, ax, ay }) => {
            const cx = rect.x1 + (rect.x2 - rect.x1) * ax;
            const cy = rect.y1 + (rect.y2 - rect.y1) * ay;
            const isEdge = ax === 0.5 || ay === 0.5;
            return (
              <g
                key={handle}
                transform={`translate(${cx} ${cy})`}
                style={{ cursor: cursorForHandle(handle) }}
                pointerEvents="all"
                onPointerDown={(event) => onResizeStart(event, handle)}
              >
                <rect
                  x={-(isEdge ? 7 : 5) * px}
                  y={-(isEdge ? 5 : 5) * px}
                  width={(isEdge ? 14 : 10) * px}
                  height={10 * px}
                  rx={2 * px}
                  fill="#fff"
                  stroke="var(--primary)"
                  strokeWidth={1.4 * px}
                />
              </g>
            );
          })
        : null}
      <g transform={`translate(${rect.x1} ${rect.y2 + 14 * px})`} pointerEvents="none">
        <rect
          x={0}
          y={-7 * px}
          width={measureTextWidth(object.name) * px}
          height={15 * px}
          rx={3 * px}
          fill="rgba(40, 83, 67, 0.92)"
        />
        <text x={5 * px} y={0.5 * px} dominantBaseline="central" fontSize={9.5 * px} fill="#fff" fontWeight={500}>
          {object.name}
        </text>
      </g>
      {object.locked ? (
        <g transform={`translate(${rect.x2 + 10 * px} ${rect.y2 + 8 * px})`} pointerEvents="none">
          <circle r={5 * px} fill="#fff" stroke="var(--primary)" strokeWidth={1.2 * px} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={6.5 * px} fill="var(--primary)" fontWeight={700}>
            L
          </text>
        </g>
      ) : null}
    </g>
  );
}

function measureTextWidth(text: string): number {
  return Math.max(24, text.length * 5.6 + 10);
}

function cursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    default:
      return 'ew-resize';
  }
}

interface FurnitureDimensionsProps {
  object: FurnitureObject;
  scale: number;
  unit: 'mm' | 'cm' | 'm';
}

/** Width/depth dimensions drawn outside the selected footprint. */
export function FurnitureDimensions({ object, scale, unit }: FurnitureDimensionsProps) {
  const rect = footprint(object);
  const px = 1 / scale;
  const offset = 14 * px;
  const width = rect.x2 - rect.x1;
  const depth = rect.y2 - rect.y1;
  const widthLabel = formatLength(Math.round(width), unit);
  const depthLabel = formatLength(Math.round(depth), unit);
  return (
    <g pointerEvents="none" className={styles.dimLabel}>
      <line
        x1={rect.x1}
        y1={rect.y1 - offset}
        x2={rect.x2}
        y2={rect.y1 - offset}
        stroke="var(--primary)"
        strokeWidth={px}
        strokeDasharray={`${4 * px} ${3 * px}`}
      />
      <line x1={rect.x1} y1={rect.y1 - offset - 4 * px} x2={rect.x1} y2={rect.y1 - offset + 4 * px} stroke="var(--primary)" strokeWidth={px} />
      <line x1={rect.x2} y1={rect.y1 - offset - 4 * px} x2={rect.x2} y2={rect.y1 - offset + 4 * px} stroke="var(--primary)" strokeWidth={px} />
      <rect
        x={(rect.x1 + rect.x2) / 2 - (widthLabel.length * 5.6 + 12) * px * 0.5}
        y={rect.y1 - offset - 15 * px}
        width={(widthLabel.length * 5.6 + 12) * px}
        height={14 * px}
        rx={3 * px}
        fill="#fff"
        stroke="var(--border-strong)"
        strokeWidth={px}
      />
      <text
        x={(rect.x1 + rect.x2) / 2}
        y={rect.y1 - offset - 8 * px}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9 * px}
        fontWeight={600}
        fill="var(--text)"
      >
        {widthLabel}
      </text>

      <line
        x1={rect.x1 - offset}
        y1={rect.y1}
        x2={rect.x1 - offset}
        y2={rect.y2}
        stroke="var(--primary)"
        strokeWidth={px}
        strokeDasharray={`${4 * px} ${3 * px}`}
      />
      <line x1={rect.x1 - offset - 4 * px} y1={rect.y1} x2={rect.x1 - offset + 4 * px} y2={rect.y1} stroke="var(--primary)" strokeWidth={px} />
      <line x1={rect.x1 - offset - 4 * px} y1={rect.y2} x2={rect.x1 - offset + 4 * px} y2={rect.y2} stroke="var(--primary)" strokeWidth={px} />
      <g transform={`translate(${rect.x1 - offset - 8 * px} ${(rect.y1 + rect.y2) / 2}) rotate(-90)`}>
        <rect
          x={-(depthLabel.length * 5.6 + 12) * px * 0.5}
          y={-7 * px}
          width={(depthLabel.length * 5.6 + 12) * px}
          height={14 * px}
          rx={3 * px}
          fill="#fff"
          stroke="var(--border-strong)"
          strokeWidth={px}
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9 * px}
          fontWeight={600}
          fill="var(--text)"
        >
          {depthLabel}
        </text>
      </g>
    </g>
  );
}

interface ClearanceOverlayProps {
  zones: UsageZone[];
  checks: ClearanceCheck[];
  scale: number;
  unit: 'mm' | 'cm' | 'm';
}

/** Clearance zones for the selected object, tinted when below target. */
export function ClearanceOverlay({ zones, checks, scale, unit }: ClearanceOverlayProps) {
  const px = 1 / scale;
  return (
    <g pointerEvents="none">
      {zones.map((zone) => {
        const check = checks.find((c) => c.id === zone.id);
        const failed = check ? !check.ok : false;
        const center = rectCenter(zone.rect);
        const width = zone.rect.x2 - zone.rect.x1;
        const depth = zone.rect.y2 - zone.rect.y1;
        const label = check
          ? `${failed ? 'Needs' : 'Has'} ${formatLength(check.available, unit)} / ${formatLength(zone.target, unit)}`
          : `${formatLength(zone.target, unit)}`;
        const showLabel = Math.min(width, depth) > 120 && Math.max(width, depth) > 350;
        return (
          <g key={zone.id}>
            <rect
              x={zone.rect.x1}
              y={zone.rect.y1}
              width={width}
              height={depth}
              fill={failed ? 'rgba(196, 147, 69, 0.14)' : 'rgba(77, 134, 103, 0.1)'}
              stroke={failed ? 'var(--warning)' : 'var(--success)'}
              strokeWidth={px}
              strokeDasharray={`${5 * px} ${4 * px}`}
            />
            {showLabel ? (
              <text
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8.5 * px}
                fontWeight={600}
                fill={failed ? '#946a26' : '#346b51'}
              >
                {label}
              </text>
            ) : null}
            <title>{`${zone.label}: target ${Math.round(zone.target)} mm`}</title>
          </g>
        );
      })}
    </g>
  );
}

interface GuidesLayerProps {
  guides: SnapGuide[];
  roomWidth: number;
  roomLength: number;
  scale: number;
}

export function GuidesLayer({ guides, roomWidth, roomLength, scale }: GuidesLayerProps) {
  const px = 1 / scale;
  return (
    <g pointerEvents="none">
      {guides.map((guide, index) => {
        if (guide.axis === 'x') {
          return (
            <line
              key={`${guide.axis}-${guide.value}-${index}`}
              x1={guide.value}
              y1={-60 * px}
              x2={guide.value}
              y2={roomLength + 60 * px}
              stroke="var(--primary)"
              strokeWidth={px}
              strokeDasharray={`${3 * px} ${3 * px}`}
              opacity={0.75}
            />
          );
        }
        return (
          <line
            key={`${guide.axis}-${guide.value}-${index}`}
            x1={-60 * px}
            y1={guide.value}
            x2={roomWidth + 60 * px}
            y2={guide.value}
            stroke="var(--primary)"
            strokeWidth={px}
            strokeDasharray={`${3 * px} ${3 * px}`}
            opacity={0.75}
          />
        );
      })}
    </g>
  );
}

interface MeasurementLabelProps {
  a: { x: number; y: number };
  b: { x: number; y: number };
  scale: number;
  unit: 'mm' | 'cm' | 'm';
  draft?: boolean;
}

export function MeasurementLabel({ a, b, scale, unit, draft }: MeasurementLabelProps) {
  const px = 1 / scale;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const label = formatLength(Math.round(distance), unit);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const boxW = (label.length * 5.8 + 14) * px;
  return (
    <g pointerEvents="none">
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="var(--primary)"
        strokeWidth={1.4 * px}
        strokeDasharray={draft ? `${5 * px} ${4 * px}` : undefined}
      />
      {[a, b].map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={3.2 * px}
          fill="#fff"
          stroke="var(--primary)"
          strokeWidth={1.2 * px}
        />
      ))}
      <rect
        x={mid.x - boxW / 2}
        y={mid.y - 8 * px}
        width={boxW}
        height={16 * px}
        rx={4 * px}
        fill="#fff"
        stroke="var(--border-strong)"
        strokeWidth={px}
      />
      <text
        x={mid.x}
        y={mid.y + 0.5 * px}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9.5 * px}
        fontWeight={600}
        fill="var(--text)"
      >
        {label}
      </text>
    </g>
  );
}

export function MeasurementsLayer({
  lines,
  draft,
  scale,
  unit,
  onRemove,
}: {
  lines: { id: string; a: { x: number; y: number }; b: { x: number; y: number } }[];
  draft: { a: { x: number; y: number } | null; b: { x: number; y: number } | null };
  scale: number;
  unit: 'mm' | 'cm' | 'm';
  onRemove?: (id: string) => void;
}) {
  const px = 1 / scale;
  return (
    <g>
      {lines.map((line) => (
        <g key={line.id}>
          <MeasurementLabel a={line.a} b={line.b} scale={scale} unit={unit} />
          {onRemove ? (
            <circle
              cx={(line.a.x + line.b.x) / 2}
              cy={(line.a.y + line.b.y) / 2}
              r={9 * px}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onRemove(line.id);
              }}
            >
              <title>Remove measurement</title>
            </circle>
          ) : null}
        </g>
      ))}
      {draft.a && draft.b ? (
        <MeasurementLabel a={draft.a} b={draft.b} scale={scale} unit={unit} draft />
      ) : null}
    </g>
  );
}

export function measurementSummary(measurements: Measurement[]): string {
  return measurements.map((m) => `${m.label}: ${Math.round(m.value)}`).join(' · ');
}
