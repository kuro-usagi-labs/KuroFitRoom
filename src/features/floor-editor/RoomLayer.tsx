import { useId } from 'react';
import type { Opening, Project } from '@/types';
import { formatLength } from '@/engine/units';
import { doorSweep, openingEnd, openingStart } from '@/engine/openings';
import styles from './RoomLayer.module.css';

interface RoomLayerProps {
  project: Project;
  scale: number;
  blockedDoorIds: Set<string>;
  selectedOpeningId: string | null;
  onOpeningPointerDown?: (event: React.PointerEvent, id: string) => void;
}

interface OpeningShapeProps {
  opening: Opening;
  project: Project;
  scale: number;
  blocked: boolean;
  selected: boolean;
  onPointerDown?: (event: React.PointerEvent, id: string) => void;
  patternId: string;
}

function OpeningShape({
  opening,
  project,
  scale,
  blocked,
  selected,
  onPointerDown,
  patternId,
}: OpeningShapeProps) {
  const { room } = project;
  const t = room.wallThickness;
  const start = openingStart(opening, room);
  const end = openingEnd(opening, room);
  const horizontal = opening.wall === 'north' || opening.wall === 'south';
  const gapRect = horizontal
    ? {
        x: Math.min(start.x, end.x),
        y: opening.wall === 'north' ? -t : room.length,
        width: opening.width,
        height: t,
      }
    : {
        x: opening.wall === 'west' ? -t : room.width,
        y: Math.min(start.y, end.y),
        width: t,
        height: opening.width,
      };

  const strokeWidth = 1.25 / scale;
  const detailStroke = 1 / scale;
  const blockedColor = '#c76259';
  const lineColor = blocked ? blockedColor : '#6f7d72';

  const sweep = doorSweep(opening, room);
  const arcEnd = {
    x: sweep.hinge.x + Math.cos(sweep.startAngle + sweep.delta) * sweep.radius,
    y: sweep.hinge.y + Math.sin(sweep.startAngle + sweep.delta) * sweep.radius,
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    onPointerDown?.(event, opening.id);
  };

  return (
    <g
      className={`${styles.opening} ${onPointerDown ? styles.selectable : ''}`}
      onPointerDown={handlePointerDown}
      role="button"
      aria-label={`${opening.name}, ${opening.width} mm`}
    >
      <rect
        x={gapRect.x}
        y={gapRect.y}
        width={gapRect.width}
        height={gapRect.height}
        fill={`url(#${patternId})`}
        className={styles.gap}
      />
      {opening.kind === 'door' ? (
        <g pointerEvents="none">
          <path
            d={`M ${sweep.hinge.x} ${sweep.hinge.y} L ${sweep.closedTip.x} ${sweep.closedTip.y} A ${sweep.radius} ${sweep.radius} 0 0 ${
              sweep.delta > 0 ? 1 : 0
            } ${arcEnd.x} ${arcEnd.y} Z`}
            fill={blocked ? 'rgba(199, 98, 89, 0.12)' : 'rgba(40, 83, 67, 0.06)'}
            stroke={lineColor}
            strokeWidth={detailStroke}
            strokeDasharray={`${5 / scale} ${4 / scale}`}
          />
          <line
            x1={sweep.hinge.x}
            y1={sweep.hinge.y}
            x2={sweep.openTip.x}
            y2={sweep.openTip.y}
            stroke={lineColor}
            strokeWidth={2.4 / scale}
            strokeLinecap="round"
          />
          <circle
            cx={sweep.hinge.x}
            cy={sweep.hinge.y}
            r={3.2 / scale}
            fill="#fff"
            stroke={lineColor}
            strokeWidth={detailStroke}
          />
        </g>
      ) : (
        <g pointerEvents="none">
          {[0.32, 0.68].map((ratio) => (
            <line
              key={ratio}
              x1={horizontal ? gapRect.x : gapRect.x + gapRect.width * ratio}
              y1={horizontal ? gapRect.y + gapRect.height * ratio : gapRect.y}
              x2={horizontal ? gapRect.x + gapRect.width : gapRect.x + gapRect.width * ratio}
              y2={horizontal ? gapRect.y + gapRect.height * ratio : gapRect.y + gapRect.height}
              stroke={lineColor}
              strokeWidth={detailStroke}
            />
          ))}
          <line
            x1={horizontal ? gapRect.x : gapRect.x + gapRect.width / 2}
            y1={horizontal ? gapRect.y + gapRect.height / 2 : gapRect.y}
            x2={horizontal ? gapRect.x + gapRect.width : gapRect.x + gapRect.width / 2}
            y2={horizontal ? gapRect.y + gapRect.height / 2 : gapRect.y + gapRect.height}
            stroke={lineColor}
            strokeWidth={2 / scale}
          />
        </g>
      )}
      {/* Jambs */}
      <line
        x1={start.x}
        y1={start.y - t / 2}
        x2={start.x}
        y2={start.y + t / 2}
        stroke={selected ? 'var(--primary)' : '#b9c4ba'}
        strokeWidth={strokeWidth}
        pointerEvents="none"
      />
      <line
        x1={end.x}
        y1={end.y - t / 2}
        x2={end.x}
        y2={end.y + t / 2}
        stroke={selected ? 'var(--primary)' : '#b9c4ba'}
        strokeWidth={strokeWidth}
        pointerEvents="none"
      />
      {selected ? (
        <rect
          x={gapRect.x - 2 / scale}
          y={gapRect.y - 2 / scale}
          width={gapRect.width + 4 / scale}
          height={gapRect.height + 4 / scale}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5 / scale}
          pointerEvents="none"
        />
      ) : null}
      <title>{`${opening.name} · ${formatLength(opening.width, project.settings.unit)}`}</title>
    </g>
  );
}

export function RoomLayer({
  project,
  scale,
  blockedDoorIds,
  selectedOpeningId,
  onOpeningPointerDown,
}: RoomLayerProps) {
  const { room, settings } = project;
  const patternId = useId().replace(/:/g, '');
  const t = room.wallThickness;
  const px = 1 / scale;
  const dimensionOffset = 26 * px;
  const unit = settings.unit;

  return (
    <g>
      <defs>
        <pattern
          id={`${patternId}-grid`}
          width={settings.gridSize}
          height={settings.gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${settings.gridSize} 0 L 0 0 0 ${settings.gridSize}`}
            fill="none"
            stroke="var(--canvas-grid)"
            strokeWidth={px}
          />
        </pattern>
        <pattern
          id={`${patternId}-grid-major`}
          width={400}
          height={400}
          patternUnits="userSpaceOnUse"
        >
          <path d="M 400 0 L 0 0 0 400" fill="none" stroke="var(--canvas-grid-major)" strokeWidth={px} />
        </pattern>
        <pattern
          id={`${patternId}-outside`}
          width={12 * px}
          height={12 * px}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={12 * px} height={12 * px} fill="var(--canvas-bg)" />
          <rect width={1.2 * px} height={12 * px} fill="#e3e7df" />
        </pattern>
      </defs>

      {/* Floor */}
      <rect x={0} y={0} width={room.width} height={room.length} fill="var(--canvas-floor)" />

      {settings.showGrid && settings.gridSize * scale >= 5 ? (
        <>
          <rect
            x={0}
            y={0}
            width={room.width}
            height={room.length}
            fill={`url(#${patternId}-grid-major)`}
          />
          <rect
            x={0}
            y={0}
            width={room.width}
            height={room.length}
            fill={`url(#${patternId}-grid)`}
          />
        </>
      ) : null}

      {/* Wall ring */}
      <path
        d={`M ${-t} ${-t} H ${room.width + t} V ${room.length + t} H ${-t} Z M 0 0 H ${room.width} V ${room.length} H 0 Z`}
        fillRule="evenodd"
        fill="var(--canvas-wall)"
        stroke="var(--canvas-wall-line)"
        strokeWidth={1.5 * px}
        pointerEvents="none"
      />

      {/* Openings cut through the wall ring */}
      {project.openings.map((opening) => (
        <OpeningShape
          key={opening.id}
          opening={opening}
          project={project}
          scale={scale}
          blocked={blockedDoorIds.has(opening.id)}
          selected={selectedOpeningId === opening.id}
          onPointerDown={onOpeningPointerDown}
          patternId={`${patternId}-outside`}
        />
      ))}

      {/* Dimension lines */}
      {settings.showMeasurements ? (
        <g pointerEvents="none" className={styles.dimensions}>
          <g>
            <line
              x1={0}
              y1={-t - dimensionOffset}
              x2={room.width}
              y2={-t - dimensionOffset}
              stroke="#9aa59b"
              strokeWidth={px}
            />
            {[0, room.width].map((x) => (
              <line
                key={x}
                x1={x}
                y1={-t - dimensionOffset - 5 * px}
                x2={x}
                y2={-t - dimensionOffset + 5 * px}
                stroke="#9aa59b"
                strokeWidth={px}
              />
            ))}
            <text
              x={room.width / 2}
              y={-t - dimensionOffset - 5 * px}
              textAnchor="middle"
              fontSize={11 * px}
              fontWeight={600}
              fill="#6f7a71"
            >
              {formatLength(room.width, unit)}
            </text>
          </g>
          <g>
            <line
              x1={-t - dimensionOffset}
              y1={0}
              x2={-t - dimensionOffset}
              y2={room.length}
              stroke="#9aa59b"
              strokeWidth={px}
            />
            {[0, room.length].map((y) => (
              <line
                key={y}
                x1={-t - dimensionOffset - 5 * px}
                y1={y}
                x2={-t - dimensionOffset + 5 * px}
                y2={y}
                stroke="#9aa59b"
                strokeWidth={px}
              />
            ))}
            <text
              x={-t - dimensionOffset - 5 * px}
              y={room.length / 2}
              textAnchor="middle"
              fontSize={11 * px}
              fontWeight={600}
              fill="#6f7a71"
              transform={`rotate(-90 ${-t - dimensionOffset - 5 * px} ${room.length / 2})`}
            >
              {formatLength(room.length, unit)}
            </text>
          </g>
        </g>
      ) : null}

      {/* Inner wall outline on top for crispness */}
      <rect
        x={0}
        y={0}
        width={room.width}
        height={room.length}
        fill="none"
        stroke="var(--canvas-wall-line)"
        strokeWidth={1.25 * px}
        pointerEvents="none"
      />
    </g>
  );
}
