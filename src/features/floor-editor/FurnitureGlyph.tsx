import type { FurnitureKind } from '@/types';

interface GlyphProps {
  width: number;
  depth: number;
  kind: FurnitureKind;
  color: string;
}

const INK = '#7c887e';
const SOFT_INK = '#9aa59b';

function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const value =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(value || 'dcc8aa', 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  const nr = Math.round(r + (mix - r) * ratio);
  const ng = Math.round(g + (mix - g) * ratio);
  const nb = Math.round(b + (mix - b) * ratio);
  return `#${((1 << 24) | (nr << 16) | (ng << 8) | nb).toString(16).slice(1)}`;
}

/**
 * Top-down furniture illustrations. Coordinates are local (centre at 0,0) and
 * follow the object's real footprint, so the illustration never disagrees with
 * the geometry.
 */
export function FurnitureGlyph({ width: w, depth: d, kind, color }: GlyphProps) {
  const x = -w / 2;
  const y = -d / 2;
  const stroke = {
    stroke: INK,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const soft = {
    stroke: SOFT_INK,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke' as const,
    fill: 'none',
    strokeDasharray: '3 3',
  };
  const radius = Math.min(18, Math.min(w, d) * 0.035);

  switch (kind) {
    case 'bed': {
      const head = Math.max(40, d * 0.055);
      const pillowW = w * 0.33;
      const pillowH = d * 0.11;
      const duvetY = y + d * 0.3;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={radius} fill={shade(color, 0.12)} {...stroke} />
          <rect x={x} y={y} width={w} height={head} rx={radius} fill={shade(color, -0.18)} {...stroke} />
          {[0, 1].map((i) => {
            if (i === 1 && w < 1350) return null;
            const px = w >= 1350 ? x + w * 0.1 + i * (w * 0.44) : x + w * 0.16;
            return (
              <rect
                key={i}
                x={px}
                y={y + head + d * 0.03}
                width={w >= 1350 ? pillowW * 1.05 : pillowW * 1.5}
                height={pillowH}
                rx={Math.min(pillowH / 2, 18)}
                fill="#fbfaf5"
                {...stroke}
              />
            );
          })}
          <line x1={x} y1={duvetY} x2={x + w} y2={duvetY} {...soft} />
          <line x1={x + w / 2} y1={duvetY + (y + d - duvetY) * 0.5} x2={x + w} y2={duvetY + (y + d - duvetY) * 0.5} {...soft} />
        </g>
      );
    }
    case 'desk': {
      const drawerW = Math.min(w * 0.24, 360);
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={4} fill={shade(color, 0.16)} {...stroke} />
          <rect x={x + 22} y={y + 20} width={w - drawerW - 40} height={d - 40} rx={3} fill="none" stroke={SOFT_INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <rect x={x + w - drawerW} y={y + 6} width={drawerW} height={d - 12} rx={3} fill={shade(color, -0.1)} {...stroke} />
          <line x1={x + w - drawerW} y1={y + d * 0.5} x2={x + w - 8} y2={y + d * 0.5} {...soft} />
          <rect x={x + w - drawerW * 0.5 - 30} y={y + d * 0.62} width={60} height={5} rx={2.5} fill={INK} />
        </g>
      );
    }
    case 'chair': {
      const inset = Math.min(w, d) * 0.12;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={Math.min(40, w * 0.16)} fill={color} {...stroke} />
          <rect
            x={x + inset}
            y={y + inset * 1.6}
            width={w - inset * 2}
            height={d - inset * 2.6}
            rx={Math.min(30, w * 0.14)}
            fill={shade(color, 0.22)}
            {...stroke}
          />
          <rect x={x + w * 0.18} y={y + d * 0.06} width={w * 0.64} height={d * 0.1} rx={6} fill={shade(color, -0.12)} {...stroke} />
          {[0, 1].map((i) => (
            <circle
              key={i}
              cx={i === 0 ? x + 10 : x + w - 10}
              cy={y + d / 2}
              r={4}
              fill={shade(color, -0.2)}
              stroke={INK}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      );
    }
    case 'wardrobe': {
      const split = x + w / 2;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          <rect x={x + 14} y={y + 12} width={w / 2 - 20} height={d - 24} rx={2} fill={shade(color, 0.16)} {...stroke} />
          <rect x={split + 6} y={y + 12} width={w / 2 - 20} height={d - 24} rx={2} fill={shade(color, 0.16)} {...stroke} />
          <line x1={split} y1={y + 4} x2={split} y2={y + d - 4} {...stroke} />
          <rect x={split - 26} y={y + d * 0.46} width={4} height={60} rx={2} fill={INK} />
          <rect x={split + 22} y={y + d * 0.46} width={4} height={60} rx={2} fill={INK} />
          <line x1={x + 14} y1={y + d * 0.24} x2={split - 6} y2={y + d * 0.24} {...soft} />
          <line x1={split + 6} y1={y + d * 0.24} x2={x + w - 14} y2={y + d * 0.24} {...soft} />
        </g>
      );
    }
    case 'sofa': {
      const arm = Math.min(w * 0.12, 190);
      const back = Math.min(d * 0.28, 260);
      const seats = w > 1500 ? 3 : 2;
      const seatW = (w - arm * 2 - 12) / seats;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={Math.min(16, d * 0.06)} fill={color} {...stroke} />
          <rect x={x} y={y} width={w} height={back} rx={Math.min(16, d * 0.06)} fill={shade(color, -0.14)} {...stroke} />
          <rect x={x} y={y} width={arm} height={d} fill={shade(color, -0.1)} {...stroke} />
          <rect x={x + w - arm} y={y} width={arm} height={d} fill={shade(color, -0.1)} {...stroke} />
          {Array.from({ length: seats }).map((_, index) => (
            <rect
              key={index}
              x={x + arm + 6 + index * seatW}
              y={y + back + 8}
              width={seatW - 12}
              height={d - back - 24}
              rx={8}
              fill={shade(color, 0.18)}
              {...stroke}
            />
          ))}
        </g>
      );
    }
    case 'coffee-table': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={8} fill={color} {...stroke} />
          <rect x={x + 16} y={y + 16} width={w - 32} height={d - 32} rx={5} fill={shade(color, 0.22)} {...stroke} />
          <line x1={x + w * 0.25} y1={y + 24} x2={x + w * 0.25} y2={y + d - 24} {...soft} />
          <line x1={x + w * 0.72} y1={y + 24} x2={x + w * 0.72} y2={y + d - 24} {...soft} />
        </g>
      );
    }
    case 'tv-cabinet': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={4} fill={color} {...stroke} />
          <rect
            x={x + w * 0.12}
            y={y + d * 0.14}
            width={w * 0.76}
            height={d * 0.42}
            rx={3}
            fill="#3a453e"
            stroke={INK}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line x1={x + w * 0.5} y1={y + d * 0.62} x2={x + w * 0.5} y2={y + d - 10} {...stroke} />
          <rect x={x + w * 0.5 - 40} y={y + d * 0.78} width={80} height={4} rx={2} fill={INK} />
        </g>
      );
    }
    case 'side-table': {
      const r = Math.min(w, d) * 0.36;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={Math.min(20, w * 0.1)} fill={color} {...stroke} />
          <circle cx={0} cy={0} r={r} fill={shade(color, 0.24)} {...stroke} />
          <circle cx={0} cy={0} r={r * 0.24} fill={shade(color, -0.18)} {...stroke} />
        </g>
      );
    }
    case 'bookshelf': {
      const shelves = 3;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          {Array.from({ length: shelves - 1 }).map((_, index) => {
            const sy = y + ((index + 1) * d) / shelves;
            return <line key={index} x1={x + 8} y1={sy} x2={x + w - 8} y2={sy} {...stroke} />;
          })}
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const bw = (w - 40) / 9;
            const bh = d * (0.4 + (index % 3) * 0.08);
            return (
              <rect
                key={index}
                x={x + 14 + index * (bw + 3)}
                y={y + d - 14 - bh}
                width={bw}
                height={bh}
                fill={index % 2 === 0 ? shade(color, 0.35) : shade(color, -0.2)}
                stroke={SOFT_INK}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
      );
    }
    case 'cabinet': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          <line x1={x + w / 2} y1={y + 8} x2={x + w / 2} y2={y + d - 8} {...stroke} />
          <circle cx={x + w / 2 - 34} cy={y + d / 2} r={9} fill="none" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <circle cx={x + w / 2 + 34} cy={y + d / 2} r={9} fill="none" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <rect x={x + 12} y={y + 10} width={w / 2 - 24} height={d - 20} rx={2} fill={shade(color, 0.14)} {...stroke} />
          <rect x={x + w / 2 + 12} y={y + 10} width={w / 2 - 24} height={d - 20} rx={2} fill={shade(color, 0.14)} {...stroke} />
        </g>
      );
    }
    case 'drawers': {
      const rows = 3;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          {Array.from({ length: rows }).map((_, index) => {
            const rh = (d - 16) / rows;
            const ry = y + 8 + index * rh;
            return (
              <g key={index}>
                <rect
                  x={x + 10}
                  y={ry + 3}
                  width={w - 20}
                  height={rh - 6}
                  rx={2}
                  fill={shade(color, 0.14)}
                  stroke={SOFT_INK}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <rect x={x + w / 2 - 50} y={ry + rh / 2 - 2} width={100} height={4} rx={2} fill={INK} />
              </g>
            );
          })}
        </g>
      );
    }
    case 'nightstand': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          <line x1={x + 8} y1={y + d / 2} x2={x + w - 8} y2={y + d / 2} {...stroke} />
          <rect x={x + w / 2 - 22} y={y + d * 0.68} width={44} height={4} rx={2} fill={INK} />
          <rect x={x + 12} y={y + 10} width={w - 24} height={d * 0.26} rx={2} fill={shade(color, 0.2)} fillOpacity={0.6} stroke="none" />
        </g>
      );
    }
    case 'storage-rack': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={2} fill={shade(color, 0.32)} {...stroke} />
          {[0.25, 0.5, 0.75].map((ratio, index) => (
            <line key={index} x1={x + 6} y1={y + d * ratio} x2={x + w - 6} y2={y + d * ratio} {...stroke} />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, index) => (
            <line key={index} x1={x + w * ratio} y1={y + 6} x2={x + w * ratio} y2={y + d - 6} stroke={SOFT_INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      );
    }
    case 'dresser': {
      const rows = 2;
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={3} fill={color} {...stroke} />
          {Array.from({ length: rows }).map((_, index) => {
            const rh = (d - 16) / rows;
            const ry = y + 8 + index * rh;
            return (
              <g key={index}>
                <line x1={x + 8} y1={ry} x2={x + w - 8} y2={ry} {...stroke} />
                <rect x={x + w / 2 - 45} y={ry + rh / 2 - 2} width={90} height={4} rx={2} fill={INK} />
              </g>
            );
          })}
        </g>
      );
    }
    case 'custom':
    default:
      return (
        <g>
          <rect x={x} y={y} width={w} height={d} rx={4} fill={color} fillOpacity={0.85} {...stroke} />
          <rect x={x + 18} y={y + 18} width={w - 36} height={d - 36} rx={3} {...soft} />
          <line x1={x + 18} y1={y + 18} x2={x + w - 18} y2={y + d - 18} {...soft} />
          <line x1={x + w - 18} y1={y + 18} x2={x + 18} y2={y + d - 18} {...soft} />
        </g>
      );
  }
}
