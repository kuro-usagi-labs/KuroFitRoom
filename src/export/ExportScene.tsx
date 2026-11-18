import type { Project } from '@/types';
import { RoomLayer } from '@/features/floor-editor/RoomLayer';
import { FurnitureLayer } from '@/features/floor-editor/Overlays';

interface ExportSceneProps {
  project: Project;
}

/** Scale used for exported artwork: 1 unit = 1 mm. */
export const EXPORT_SCALE = 1;
const MARGIN = 70;

const SVG_STYLE = `
  svg {
    --primary: #285343;
    --canvas-bg: #ffffff;
    --canvas-floor: #fdfdfb;
    --canvas-wall: #dbe1d9;
    --canvas-wall-line: #b7c2b7;
    --canvas-grid: #e8ece4;
    --canvas-grid-major: #dce2d7;
    --border-strong: #d7ddd3;
    --text: #28352e;
    --text-2: #788179;
    --success: #4d8667;
    --warning: #c49345;
    --error: #c76259;
    font-family: Inter, 'Segoe UI', system-ui, sans-serif;
  }
  text { font-family: Inter, 'Segoe UI', system-ui, sans-serif; }
  .hoverOutline { display: none; }
`;

export function exportDimensions(project: Project) {
  const t = project.room.wallThickness;
  return {
    width: project.room.width + t * 2 + MARGIN * 2,
    height: project.room.length + t * 2 + MARGIN * 2,
  };
}

/** Pure SVG scene markup — no editor chrome, no selection, no overlays. */
export function ExportScene({ project }: ExportSceneProps) {
  const t = project.room.wallThickness;
  const { width, height } = exportDimensions(project);
  const sceneProject: Project = {
    ...project,
    settings: {
      ...project.settings,
      showGrid: false,
      showMeasurements: true,
      showObjectDimensions: false,
    },
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <style>{SVG_STYLE}</style>
      </defs>
      <rect width={width} height={height} fill="#ffffff" />
      <g transform={`translate(${MARGIN + t} ${MARGIN + t})`}>
        <RoomLayer
          project={sceneProject}
          scale={EXPORT_SCALE}
          blockedDoorIds={new Set()}
          selectedOpeningId={null}
        />
        <FurnitureLayer
          furniture={project.furniture}
          scale={EXPORT_SCALE}
          selectedId={null}
          errorIds={new Set()}
          warningIds={new Set()}
          blockedIds={new Set()}
          onPointerDownObject={() => undefined}
        />
      </g>
      <text
        x={MARGIN}
        y={height - 26}
        fontSize={16}
        fill="#788179"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {project.name} · {Math.round(project.room.width / 10)} × {Math.round(project.room.length / 10)} cm
        · RoomFit
      </text>
    </svg>
  );
}
