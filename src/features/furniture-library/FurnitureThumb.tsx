import type { FurnitureKind } from '@/types';
import { FurnitureGlyph } from '@/features/floor-editor/FurnitureGlyph';

interface FurnitureThumbProps {
  width: number;
  depth: number;
  kind: FurnitureKind;
  color: string;
  className?: string;
}

export function FurnitureThumb({ width, depth, kind, color, className }: FurnitureThumbProps) {
  const padX = width * 0.08;
  const padY = depth * 0.08;
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox={`${-width / 2 - padX} ${-depth / 2 - padY} ${width + padX * 2} ${depth + padY * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <FurnitureGlyph width={width} depth={depth} kind={kind} color={color} />
    </svg>
  );
}
