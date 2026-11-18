import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, MousePointerClick, Move, ZoomIn } from 'lucide-react';
import type { FurnitureObject, Point, Rect, Unit } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import {
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_BASE,
  useEditorStore,
} from '@/store/editorStore';
import { analysisFor } from '@/hooks/useAnalysis';
import { useElementSize } from '@/hooks/useElementSize';
import { effectiveSize, footprint } from '@/engine/geometry';
import { clamp } from '@/engine/units';
import { snapPosition } from '@/engine/snapping';
import { pointToWallOffset } from '@/engine/openings';
import { zonesForObject } from '@/engine/clearance';
import { Button } from '@/components/ui/Button';
import { RoomLayer } from './RoomLayer';
import {
  ClearanceOverlay,
  FurnitureDimensions,
  FurnitureLayer,
  GuidesLayer,
  MeasurementsLayer,
  SelectionLayer,
  type ResizeHandle,
} from './Overlays';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasControls } from './CanvasControls';
import styles from './FloorCanvas.module.css';

type DragState =
  | {
      kind: 'pan';
      pointerId: number;
      startClient: Point;
      startViewport: { scale: number; tx: number; ty: number };
    }
  | {
      kind: 'move';
      pointerId: number;
      id: string;
      startWorld: Point;
      origin: Point;
      started: boolean;
    }
  | {
      kind: 'resize';
      pointerId: number;
      id: string;
      handle: ResizeHandle;
      startWorld: Point;
      startRect: Rect;
      started: boolean;
    }
  | {
      kind: 'opening';
      pointerId: number;
      id: string;
      grabOffset: number;
      started: boolean;
    };

interface PinchState {
  startDistance: number;
  startMid: Point;
  startViewport: { scale: number; tx: number; ty: number };
}

const HINT_KEY = 'roomfit:canvas-hint-dismissed';

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function FloorCanvas() {
  const project = useProjectStore((state) => state.project);
  const analysis = useMemo(() => analysisFor(project), [project]);
  const selectedId = useEditorStore((state) => state.selectedFurnitureId);
  const selectedOpeningId = useEditorStore((state) => state.selectedOpeningId);
  const tool = useEditorStore((state) => state.tool);
  const viewport = useEditorStore((state) => state.viewport);
  const fitRequest = useEditorStore((state) => state.fitRequest);
  const showClearanceZones = useEditorStore((state) => state.showClearanceZones);
  const guides = useEditorStore((state) => state.guides);
  const measurements = useEditorStore((state) => state.measurements);
  const measureStart = useEditorStore((state) => state.measureStart);
  const measureDraft = useEditorStore((state) => state.measureDraft);

  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<PinchState | null>(null);
  const spaceRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const didFit = useRef(false);
  const userAdjusted = useRef(false);
  const lastFitRequest = useRef(-1);
  const [showHint, setShowHint] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const fitView = useCallback(() => {
    if (size.width < 60 || size.height < 60) return;
    const t = project.room.wallThickness;
    const outerW = project.room.width + t * 2;
    const outerH = project.room.length + t * 2;
    const padX = size.width < 720 ? 40 : 54;
    // The floating toolbar and the width dimension share the top edge, so the
    // fitted room is always centred below both of them.
    const padTop = 104;
    const padBottom = 56;
    const availableH = Math.max(120, size.height - padTop - padBottom);
    const scale = clamp(
      Math.min((size.width - padX * 2) / outerW, availableH / outerH),
      MIN_SCALE,
      MAX_SCALE,
    );
    useEditorStore.getState().setViewport({
      scale,
      tx: (size.width - outerW * scale) / 2 + t * scale,
      ty: padTop + (availableH - outerH * scale) / 2 + t * scale,
    });
  }, [size.width, size.height, project.room.wallThickness, project.room.width, project.room.length]);

  useEffect(() => {
    if (size.width < 60 || size.height < 60) return;
    if (!didFit.current) {
      didFit.current = true;
      fitView();
      return;
    }
    // Re-fit while the user has not taken over the view. This covers window
    // resizes and the first layout pass, where the measured canvas can still
    // be smaller than its final size.
    if (!userAdjusted.current) fitView();
  }, [size.width, size.height, fitView]);

  useEffect(() => {
    if (fitRequest === lastFitRequest.current) return;
    lastFitRequest.current = fitRequest;
    if (fitRequest === 0) return;
    userAdjusted.current = false;
    fitView();
  }, [fitRequest, fitView]);

  const zoomAt = useCallback((factor: number, anchor: Point) => {
    userAdjusted.current = true;
    const state = useEditorStore.getState();
    const current = state.viewport;
    const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = nextScale / current.scale;
    state.setViewport({
      scale: nextScale,
      tx: anchor.x - (anchor.x - current.tx) * ratio,
      ty: anchor.y - (anchor.y - current.ty) * ratio,
    });
  }, []);

  const zoomCenter = useCallback(
    (factor: number) => {
      zoomAt(factor, { x: size.width / 2, y: size.height / 2 });
    },
    [zoomAt, size.width, size.height],
  );

  const resetView = useCallback(() => {
    userAdjusted.current = true;
    useEditorStore.getState().setViewport({
      scale: ZOOM_BASE,
      tx: (size.width - project.room.width * ZOOM_BASE) / 2,
      ty: (size.height - project.room.length * ZOOM_BASE) / 2 + 8,
    });
  }, [size.width, size.height, project.room.width, project.room.length]);

  // Wheel zoom (non-passive so the page never scrolls while editing).
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, [zoomAt]);

  // Space-to-pan.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTextInput(event.target)) return;
      spaceRef.current = true;
      setSpaceDown(true);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setSpaceDown(false);
      pinchRef.current = null;
      dragRef.current = null;
      setPanning(false);
    };
    const blur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const element = svgRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const vp = useEditorStore.getState().viewport;
    return {
      x: (clientX - rect.left - vp.tx) / vp.scale,
      y: (clientY - rect.top - vp.ty) / vp.scale,
    };
  }, []);

  const capturePointer = (pointerId: number) => {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  };

  const beginPan = (event: React.PointerEvent) => {
    event.preventDefault();
    const vp = useEditorStore.getState().viewport;
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startViewport: { ...vp },
    };
    setPanning(true);
    capturePointer(event.pointerId);
  };

  const performMeasureClick = (event: React.PointerEvent) => {
    const point = toWorld(event.clientX, event.clientY);
    const editor = useEditorStore.getState();
    if (!editor.measureStart) {
      editor.startMeasure(point);
      editor.updateMeasure(point);
    } else {
      editor.updateMeasure(point);
      editor.finishMeasure(point);
    }
  };

  const handlePointerDownObject = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    const editor = useEditorStore.getState();
    if (editor.tool === 'pan' || spaceRef.current) {
      event.stopPropagation();
      beginPan(event);
      return;
    }
    if (editor.tool === 'measure') {
      event.stopPropagation();
      performMeasureClick(event);
      return;
    }
    const object = useProjectStore.getState().project.furniture.find((f) => f.id === id);
    editor.selectFurniture(id);
    event.stopPropagation();
    if (!object || object.locked) return;
    dragRef.current = {
      kind: 'move',
      pointerId: event.pointerId,
      id,
      startWorld: toWorld(event.clientX, event.clientY),
      origin: { x: object.x, y: object.y },
      started: false,
    };
    capturePointer(event.pointerId);
  };

  const handlePointerDownOpening = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    const state = useProjectStore.getState();
    const editor = useEditorStore.getState();
    const opening = state.project.openings.find((o) => o.id === id);
    if (!opening) return;
    editor.selectOpening(id);
    if (editor.tool === 'measure' || editor.tool === 'pan' || spaceRef.current) return;
    const world = toWorld(event.clientX, event.clientY);
    const along = pointToWallOffset(world.x, world.y, opening.wall, state.project.room);
    dragRef.current = {
      kind: 'opening',
      pointerId: event.pointerId,
      id,
      grabOffset: along - opening.offset,
      started: false,
    };
    capturePointer(event.pointerId);
  };

  const handlePointerDownCanvas = (event: React.PointerEvent) => {
    if (event.button === 1) {
      event.preventDefault();
      beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    const editor = useEditorStore.getState();
    if (editor.tool === 'pan' || spaceRef.current) {
      beginPan(event);
      return;
    }
    if (editor.tool === 'measure') {
      performMeasureClick(event);
      return;
    }
    editor.clearSelection();
    editor.setGuides([]);
  };

  const snapScalar = (value: number, candidates: number[], threshold: number) => {
    let best = value;
    let bestDistance = threshold;
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - value);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return { value: best, snapped: bestDistance < threshold };
  };

  const applyResize = (
    drag: Extract<DragState, { kind: 'resize' }>,
    world: Point,
    projectState: ReturnType<typeof useProjectStore.getState>,
  ) => {
    const settings = projectState.project.settings;
    const minSize = 200;
    let x1 = drag.startRect.x1;
    let y1 = drag.startRect.y1;
    let x2 = drag.startRect.x2;
    let y2 = drag.startRect.y2;
    const handle = drag.handle;
    const threshold = 8 / useEditorStore.getState().viewport.scale;

    if (settings.snapEnabled) {
      const others = projectState.project.furniture.filter((f) => f.id !== drag.id).map(footprint);
      const xCandidates = [0, projectState.project.room.width, ...others.flatMap((r) => [r.x1, r.x2])];
      const yCandidates = [0, projectState.project.room.length, ...others.flatMap((r) => [r.y1, r.y2])];
      if (handle.includes('w')) {
        const snapped = snapScalar(world.x, xCandidates, threshold);
        x1 = snapped.snapped ? snapped.value : Math.round(world.x / settings.gridSize) * settings.gridSize;
      }
      if (handle.includes('e')) {
        const snapped = snapScalar(world.x, xCandidates, threshold);
        x2 = snapped.snapped ? snapped.value : Math.round(world.x / settings.gridSize) * settings.gridSize;
      }
      if (handle.includes('n')) {
        const snapped = snapScalar(world.y, yCandidates, threshold);
        y1 = snapped.snapped ? snapped.value : Math.round(world.y / settings.gridSize) * settings.gridSize;
      }
      if (handle.includes('s')) {
        const snapped = snapScalar(world.y, yCandidates, threshold);
        y2 = snapped.snapped ? snapped.value : Math.round(world.y / settings.gridSize) * settings.gridSize;
      }
    } else {
      if (handle.includes('w')) x1 = world.x;
      if (handle.includes('e')) x2 = world.x;
      if (handle.includes('n')) y1 = world.y;
      if (handle.includes('s')) y2 = world.y;
    }

    if (x2 - x1 < minSize) {
      if (handle.includes('w')) x1 = x2 - minSize;
      else x2 = x1 + minSize;
    }
    if (y2 - y1 < minSize) {
      if (handle.includes('n')) y1 = y2 - minSize;
      else y2 = y1 + minSize;
    }

    const width = Math.round(x2 - x1);
    const height = Math.round(y2 - y1);
    const object = projectState.project.furniture.find((f) => f.id === drag.id);
    if (!object) return;
    const isRotated = object.rotation % 180 !== 0;
    projectState.updateFurnitureLive(drag.id, {
      x: Math.round((x1 + x2) / 2),
      y: Math.round((y1 + y2) / 2),
      width: isRotated ? height : width,
      depth: isRotated ? width : height,
    });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinchRef.current && pointersRef.current.size === 2) {
      const points = [...pointersRef.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const mid = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect && pinchRef.current.startDistance > 0) {
        const start = pinchRef.current;
        const ratio = distance / start.startDistance;
        const scale = clamp(start.startViewport.scale * ratio, MIN_SCALE, MAX_SCALE);
        const anchor = {
          x: start.startMid.x - rect.left,
          y: start.startMid.y - rect.top,
        };
        const currentMid = { x: mid.x - rect.left, y: mid.y - rect.top };
        const scaleRatio = scale / start.startViewport.scale;
        userAdjusted.current = true;
        useEditorStore.getState().setViewport({
          scale,
          tx: currentMid.x - (anchor.x - start.startViewport.tx) * scaleRatio,
          ty: currentMid.y - (anchor.y - start.startViewport.ty) * scaleRatio,
        });
        return;
      }
    }

    const drag = dragRef.current;
    const projectState = useProjectStore.getState();
    const settings = projectState.project.settings;

    if (!drag) {
      if (tool === 'measure' && useEditorStore.getState().measureStart) {
        useEditorStore.getState().updateMeasure(toWorld(event.clientX, event.clientY));
      }
      return;
    }

    if (drag.kind === 'pan') {
      userAdjusted.current = true;
      useEditorStore.getState().setViewport({
        tx: drag.startViewport.tx + (event.clientX - drag.startClient.x),
        ty: drag.startViewport.ty + (event.clientY - drag.startClient.y),
      });
      return;
    }

    const world = toWorld(event.clientX, event.clientY);

    if (drag.kind === 'move') {
      const object = projectState.project.furniture.find((f) => f.id === drag.id);
      if (!object) return;
      const size = effectiveSize(object);
      const proposed = {
        x: drag.origin.x + (world.x - drag.startWorld.x),
        y: drag.origin.y + (world.y - drag.startWorld.y),
      };
      const threshold = 9 / useEditorStore.getState().viewport.scale;
      const snapped = settings.snapEnabled
        ? snapPosition(
            proposed,
            size.width,
            size.depth,
            projectState.project.room,
            projectState.project.furniture,
            {
              threshold,
              gridSize: settings.gridSize,
              snapGrid: true,
              snapWalls: true,
              snapObjects: true,
            },
            drag.id,
          )
        : { ...proposed, guides: [], snappedX: false, snappedY: false };
      const clamped = {
        x: clamp(snapped.x, -size.width / 2, projectState.project.room.width + size.width / 2),
        y: clamp(snapped.y, -size.depth / 2, projectState.project.room.length + size.depth / 2),
      };
      if (!drag.started) {
        drag.started = true;
        projectState.beginHistory();
      }
      projectState.moveFurnitureLive(drag.id, clamped.x, clamped.y);
      useEditorStore.getState().setGuides(snapped.guides);
      return;
    }

    if (drag.kind === 'resize') {
      if (!drag.started) {
        drag.started = true;
        projectState.beginHistory();
      }
      applyResize(drag, world, projectState);
      return;
    }

    if (drag.kind === 'opening') {
      const opening = projectState.project.openings.find((o) => o.id === drag.id);
      if (!opening) return;
      const along = pointToWallOffset(world.x, world.y, opening.wall, projectState.project.room);
      const wallLength =
        opening.wall === 'north' || opening.wall === 'south'
          ? projectState.project.room.width
          : projectState.project.room.length;
      let offset = along - drag.grabOffset;
      if (settings.snapEnabled) {
        offset = Math.round(offset / Math.max(50, settings.gridSize / 2)) * Math.max(50, settings.gridSize / 2);
      }
      offset = clamp(offset, 0, wallLength - opening.width);
      if (!drag.started) {
        drag.started = true;
        projectState.beginHistory();
      }
      projectState.updateOpeningLive(drag.id, { offset: Math.round(offset) });
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    setPanning(false);
    useEditorStore.getState().setGuides([]);
    try {
      if (svgRef.current?.hasPointerCapture(event.pointerId)) {
        svgRef.current.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const beginPinch = () => {
    const points = [...pointersRef.current.values()];
    if (points.length !== 2) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = null;
    pinchRef.current = {
      startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      startMid: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      startViewport: { ...useEditorStore.getState().viewport },
    };
  };

  const handleResizeStart = (event: React.PointerEvent, handle: ResizeHandle) => {
    event.stopPropagation();
    if (!selectedId) return;
    const object = project.furniture.find((f) => f.id === selectedId);
    if (!object) return;
    dragRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      id: selectedId,
      handle,
      startWorld: toWorld(event.clientX, event.clientY),
      startRect: footprint(object),
      started: false,
    };
    capturePointer(event.pointerId);
  };

  const selectedObject: FurnitureObject | null =
    project.furniture.find((f) => f.id === selectedId) ?? null;
  const selectedZones = selectedObject
    ? zonesForObject(selectedObject, project.settings.clearances)
    : [];
  const selectedChecks = analysis.clearanceChecks.filter((c) => c.objectId === selectedId);

  const errorIds = new Set<string>();
  const warningIds = new Set<string>();
  for (const issue of analysis.issues) {
    if (issue.severity === 'error') issue.objectIds.forEach((id) => errorIds.add(id));
    if (issue.severity === 'warning') issue.objectIds.forEach((id) => warningIds.add(id));
  }
  const blockedDoorIds = new Set(
    analysis.doorChecks.filter((check) => check.blocked).map((check) => check.openingId),
  );

  const cursor =
    panning || dragRef.current?.kind === 'pan'
      ? 'grabbing'
      : tool === 'pan' || spaceDown
        ? 'grab'
        : tool === 'measure'
          ? 'crosshair'
          : 'default';

  const zoomPercent = Math.round((viewport.scale / ZOOM_BASE) * 100);
  const unit: Unit = project.settings.unit;

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={styles.wrap} ref={containerRef}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        style={{ cursor }}
        onPointerDown={handlePointerDownCanvas}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={(event) => {
          if (event.buttons === 0) handlePointerUp(event);
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDownCapture={(event) => {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (event.pointerType === 'touch' && pointersRef.current.size === 2) beginPinch();
        }}
        role="application"
        aria-label="Room floor plan editor"
      >
        <g transform={`translate(${viewport.tx} ${viewport.ty}) scale(${viewport.scale})`}>
          <RoomLayer
            project={project}
            scale={viewport.scale}
            blockedDoorIds={blockedDoorIds}
            selectedOpeningId={selectedOpeningId}
            onOpeningPointerDown={handlePointerDownOpening}
          />

          {selectedObject && showClearanceZones ? (
            <ClearanceOverlay
              zones={selectedZones}
              checks={selectedChecks}
              scale={viewport.scale}
              unit={unit}
            />
          ) : null}

          <FurnitureLayer
            furniture={project.furniture}
            scale={viewport.scale}
            selectedId={selectedId}
            errorIds={errorIds}
            warningIds={warningIds}
            blockedIds={new Set()}
            onPointerDownObject={handlePointerDownObject}
          />

          {selectedObject ? (
            <>
              {project.settings.showObjectDimensions ? (
                <FurnitureDimensions object={selectedObject} scale={viewport.scale} unit={unit} />
              ) : null}
              <SelectionLayer
                object={selectedObject}
                scale={viewport.scale}
                showHandles={!selectedObject.locked}
                onResizeStart={handleResizeStart}
              />
            </>
          ) : null}

          <GuidesLayer
            guides={guides}
            roomWidth={project.room.width}
            roomLength={project.room.length}
            scale={viewport.scale}
          />

          {project.settings.showMeasurements ? (
            <MeasurementsLayer
              lines={measurements}
              draft={{
                a: measureStart,
                b: measureDraft,
              }}
              scale={viewport.scale}
              unit={unit}
              onRemove={(id) => useEditorStore.getState().removeMeasurement(id)}
            />
          ) : null}
        </g>
      </svg>

      <CanvasToolbar />
      <CanvasControls
        zoomPercent={zoomPercent}
        onZoomIn={() => zoomCenter(1.2)}
        onZoomOut={() => zoomCenter(1 / 1.2)}
        onFit={fitView}
        onReset={resetView}
      />

      {project.furniture.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Plus size={20} />
          </div>
          <div>
            <p className={styles.emptyTitle}>This room is empty</p>
            <p className={styles.emptyText}>
              Add furniture from the library to check physical fit and clearance in real time.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => useEditorStore.getState().setPanel('furnish')}
          >
            Add furniture
          </Button>
        </div>
      ) : null}

      {showHint && project.furniture.length > 0 ? (
        <div className={styles.hint}>
          <div className={styles.hintItem}>
            <Move size={13} /> Drag to move
          </div>
          <div className={styles.hintItem}>
            <MousePointerClick size={13} /> Click to select
          </div>
          <div className={styles.hintItem}>
            <ZoomIn size={13} /> Scroll to zoom
          </div>
          <button className={styles.hintClose} onClick={dismissHint} aria-label="Dismiss tips">
            <X size={13} />
          </button>
        </div>
      ) : null}

      {tool === 'measure' ? (
        <div className={styles.measureHint}>
          {measureStart
            ? 'Click the second point to finish the measurement · Esc to cancel'
            : 'Click two points to measure the real distance'}
        </div>
      ) : null}
    </div>
  );
}
