import {
  X,
  Lock,
  Unlock,
  Copy,
  Trash2,
  RotateCw,
  RotateCcw,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Move,
  DoorOpen,
} from 'lucide-react';
import type { FurnitureObject, Opening } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { useProjectAnalysis } from '@/hooks/useAnalysis';
import { FURNITURE_COLORS } from '@/features/furniture-library/catalog';
import { formatArea, formatLength, formatPercent } from '@/engine/units';
import { footprint, rectDistance, rectToRoomEdges } from '@/engine/geometry';
import { effectiveSize } from '@/engine/geometry';
import { WALL_LABEL, WALL_SIDES, wallLength } from '@/engine/openings';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, SelectField, TextField, TwoCol } from '@/components/ui/Controls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { pushToast } from '@/store/toastStore';
import shared from '@/styles/shared.module.css';
import styles from './Inspector.module.css';

const KIND_LABEL: Record<string, string> = {
  bed: 'Bed',
  desk: 'Desk',
  chair: 'Chair',
  wardrobe: 'Wardrobe',
  dresser: 'Dresser',
  nightstand: 'Bedside table',
  sofa: 'Sofa',
  'coffee-table': 'Coffee table',
  'tv-cabinet': 'TV cabinet',
  'side-table': 'Side table',
  bookshelf: 'Bookshelf',
  cabinet: 'Cabinet',
  drawers: 'Drawers',
  'storage-rack': 'Storage rack',
  custom: 'Custom object',
};

function FurnitureInspector({ object }: { object: FurnitureObject }) {
  const room = useProjectStore((state) => state.project.room);
  const furniture = useProjectStore((state) => state.project.furniture);
  const unit = useProjectStore((state) => state.project.settings.unit);
  const updateFurniture = useProjectStore((state) => state.updateFurniture);
  const updateFurnitureLive = useProjectStore((state) => state.updateFurnitureLive);
  const toggleLock = useProjectStore((state) => state.toggleLock);
  const rotateFurniture = useProjectStore((state) => state.rotateFurniture);
  const duplicateFurniture = useProjectStore((state) => state.duplicateFurniture);
  const removeFurniture = useProjectStore((state) => state.removeFurniture);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const selectFurniture = useEditorStore((state) => state.selectFurniture);
  const analysis = useProjectAnalysis();

  const related = analysis.issues.filter((issue) => issue.objectIds.includes(object.id));
  const errors = related.filter((issue) => issue.severity === 'error');
  const warnings = related.filter((issue) => issue.severity === 'warning');
  const checks = analysis.clearanceChecks.filter((check) => check.objectId === object.id);
  const status =
    errors.length > 0
      ? 'no-fit'
      : warnings.length > 0
        ? 'tight'
        : checks.length > 0
          ? 'comfortable'
          : 'review';
  const edges = rectToRoomEdges(footprint(object), room);
  const size = effectiveSize(object);

  const nearest = furniture
    .filter((f) => f.id !== object.id)
    .map((f) => ({ object: f, distance: rectDistance(footprint(object), footprint(f)) }))
    .sort((a, b) => a.distance - b.distance)[0];

  return (
    <div className={shared.panel}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>{KIND_LABEL[object.kind] ?? 'Furniture'}</p>
          <h2 className={styles.title}>{object.name}</h2>
        </div>
        <IconButton aria-label="Deselect object" onClick={clearSelection}>
          <X size={15} />
        </IconButton>
      </div>

      <StatusBadge status={status} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Name & finish</h3>
        <TextField
          value={object.name}
          onChange={(name) => updateFurnitureLive(object.id, { name })}
          maxLength={48}
        />
        <div className={shared.colorRow}>
          {Object.entries(FURNITURE_COLORS).map(([key, color]) => (
            <button
              key={key}
              className={`${shared.colorSwatch} ${object.color === color ? shared.colorSwatchActive : ''}`}
              style={{ background: color }}
              aria-label={`Use ${key} finish`}
              aria-pressed={object.color === color}
              onClick={() => updateFurniture(object.id, { color })}
            />
          ))}
        </div>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Size (physical footprint)</h3>
        <TwoCol>
          <NumberField
            label="Width"
            value={object.width}
            unit={unit}
            min={100}
            max={10000}
            onChange={(width) => updateFurniture(object.id, { width })}
          />
          <NumberField
            label="Depth"
            value={object.depth}
            unit={unit}
            min={100}
            max={10000}
            onChange={(depth) => updateFurniture(object.id, { depth })}
          />
        </TwoCol>
        <p className={shared.sectionHint}>
          {object.rotation % 180 === 0
            ? `Footprint on plan: ${formatLength(object.width, unit)} × ${formatLength(object.depth, unit)}.`
            : `Rotated 90°: the footprint on plan is ${formatLength(size.width, unit)} × ${formatLength(size.depth, unit)}.`}{' '}
          Dimensions describe the physical frame, not a mattress label.
        </p>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Position</h3>
        <TwoCol>
          <NumberField
            label="X from left"
            value={object.x}
            unit={unit}
            min={-10000}
            max={room.width + 10000}
            onChange={(x) => updateFurniture(object.id, { x })}
          />
          <NumberField
            label="Y from top"
            value={object.y}
            unit={unit}
            min={-10000}
            max={room.length + 10000}
            onChange={(y) => updateFurniture(object.id, { y })}
          />
        </TwoCol>
        <p className={shared.sectionHint}>Position is the centre of the object.</p>

        <div className={styles.rotationRow}>
          <span className={shared.sectionTitle}>Rotation</span>
          <div className={styles.rotateButtons}>
            <IconButton
              aria-label="Rotate counter-clockwise"
              onClick={() => rotateFurniture(object.id, 'ccw')}
            >
              <RotateCcw size={14} />
            </IconButton>
            <span className={styles.rotationValue}>{object.rotation}°</span>
            <IconButton
              aria-label="Rotate clockwise"
              onClick={() => rotateFurniture(object.id, 'cw')}
            >
              <RotateCw size={14} />
            </IconButton>
          </div>
        </div>
        <div className={styles.presetRow}>
          {([0, 90, 180, 270] as const).map((rotation) => (
            <button
              key={rotation}
              className={`${styles.presetButton} ${object.rotation === rotation ? styles.presetActive : ''}`}
              onClick={() => updateFurniture(object.id, { rotation })}
            >
              {rotation}°
            </button>
          ))}
        </div>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Fit analysis</h3>
        {related.length === 0 ? (
          <div className={`${shared.callout} ${shared.calloutSuccess}`}>
            <CheckCircle2 size={14} />
            <span>No conflicts detected for this object with the current clearance targets.</span>
          </div>
        ) : (
          <div className={shared.stack}>
            {related.slice(0, 4).map((issue) => (
              <div
                key={issue.id}
                className={`${shared.issue} ${
                  issue.severity === 'error' ? shared.issueError : shared.issueWarning
                }`}
              >
                <AlertTriangle
                  size={14}
                  className={
                    issue.severity === 'error' ? shared.issueIconError : shared.issueIconWarning
                  }
                />
                <div className={shared.issueBody}>
                  <span className={shared.issueTitle}>{issue.title}</span>
                  <span className={shared.issueText}>{issue.message}</span>
                  {issue.measurements.map((measurement) => (
                    <span key={measurement.label} className={shared.issueMeasure}>
                      {measurement.label}: {formatLength(measurement.value, unit)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {checks.length > 0 ? (
          <div className={styles.checkList}>
            {checks.map((check) => {
              const pct = Math.min(100, Math.round((check.available / check.target) * 100));
              return (
                <div key={check.id} className={styles.checkRow}>
                  <div className={styles.checkHead}>
                    <span>{check.label}</span>
                    <span className={check.ok ? styles.checkOk : styles.checkBad}>
                      {formatLength(check.available, unit)} / {formatLength(check.target, unit)}
                    </span>
                  </div>
                  <div className={styles.bar}>
                    <div
                      className={`${styles.barFill} ${check.ok ? styles.barOk : styles.barBad}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Distances</h3>
        <div className={styles.wallGrid}>
          {(
            [
              ['Top wall', edges.top],
              ['Right wall', edges.right],
              ['Bottom wall', edges.bottom],
              ['Left wall', edges.left],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className={styles.wallCell}>
              <span className={styles.wallLabel}>{label}</span>
              <span className={value < 0 ? styles.wallBad : styles.wallValue}>
                {value < 0 ? 'Outside' : formatLength(Math.round(value), unit)}
              </span>
            </div>
          ))}
        </div>
        {nearest ? (
          <p className={shared.sectionHint}>
            <Move size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />
            Nearest object: {nearest.object.name} at {formatLength(Math.round(nearest.distance), unit)}.
          </p>
        ) : null}
      </section>

      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={() => toggleLock(object.id)}>
          {object.locked ? <Unlock size={14} /> : <Lock size={14} />}
          {object.locked ? 'Unlock position' : 'Lock position'}
        </Button>
      </div>
      <div className={styles.actionRow}>
        <Button
          variant="secondary"
          size="sm"
          block
          onClick={() => {
            const id = duplicateFurniture(object.id);
            if (id) selectFurniture(id);
          }}
        >
          <Copy size={14} /> Duplicate
        </Button>
        <Button
          variant="danger"
          size="sm"
          block
          onClick={() => {
            removeFurniture(object.id);
            clearSelection();
            pushToast('Object deleted. Use Undo to restore it.', 'info');
          }}
        >
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}

function OpeningInspector({ opening }: { opening: Opening }) {
  const room = useProjectStore((state) => state.project.room);
  const unit = useProjectStore((state) => state.project.settings.unit);
  const updateOpening = useProjectStore((state) => state.updateOpening);
  const removeOpening = useProjectStore((state) => state.removeOpening);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const analysis = useProjectAnalysis();
  const check = analysis.doorChecks.find((item) => item.openingId === opening.id);

  return (
    <div className={shared.panel}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>{opening.kind === 'door' ? 'Door' : 'Window'}</p>
          <h2 className={styles.title}>{opening.name}</h2>
        </div>
        <IconButton aria-label="Deselect opening" onClick={clearSelection}>
          <X size={15} />
        </IconButton>
      </div>

      {opening.kind === 'door' ? (
        <StatusBadge
          status={check?.blocked ? 'no-fit' : 'comfortable'}
          label={check?.blocked ? 'Door swing blocked' : 'Swing clear'}
        />
      ) : null}

      <TextField
        label="Name"
        value={opening.name}
        onChange={(name) => updateOpening(opening.id, { name })}
      />
      <SelectField
        label="Wall"
        value={opening.wall}
        options={WALL_SIDES.map((wall) => ({ value: wall, label: WALL_LABEL[wall] }))}
        onChange={(wall) =>
          updateOpening(opening.id, {
            wall,
            offset: Math.min(opening.offset, Math.max(0, wallLength(room, wall) - opening.width)),
          })
        }
      />
      <TwoCol>
        <NumberField
          label="Width"
          value={opening.width}
          unit={unit}
          min={300}
          max={wallLength(room, opening.wall)}
          onChange={(width) => updateOpening(opening.id, { width })}
        />
        <NumberField
          label="Offset"
          value={opening.offset}
          unit={unit}
          min={0}
          max={Math.max(0, wallLength(room, opening.wall) - opening.width)}
          onChange={(offset) => updateOpening(opening.id, { offset })}
        />
      </TwoCol>
      {opening.kind === 'door' ? (
        <TwoCol>
          <SelectField
            label="Hinge"
            value={opening.hinge}
            options={[
              { value: 'start', label: 'Start' },
              { value: 'end', label: 'End' },
            ]}
            onChange={(hinge) => updateOpening(opening.id, { hinge })}
          />
          <SelectField
            label="Swing"
            value={opening.swing}
            options={[
              { value: 'in', label: 'Into room' },
              { value: 'out', label: 'Outward' },
            ]}
            onChange={(swing) => updateOpening(opening.id, { swing })}
          />
        </TwoCol>
      ) : null}

      {check?.blocked ? (
        <div className={`${shared.callout} ${shared.calloutError}`}>
          <AlertTriangle size={14} />
          <span>The door leaf is obstructed. Clear the swing area or change hinge / direction.</span>
        </div>
      ) : null}

      <Button
        variant="danger"
        size="sm"
        block
        onClick={() => {
          removeOpening(opening.id);
          clearSelection();
        }}
      >
        <Trash2 size={14} /> Delete {opening.kind}
      </Button>
    </div>
  );
}

export function Inspector() {
  const project = useProjectStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedFurnitureId);
  const selectedOpeningId = useEditorStore((state) => state.selectedOpeningId);
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const selectFurniture = useEditorStore((state) => state.selectFurniture);
  const analysis = useProjectAnalysis();
  const unit = project.settings.unit;

  const selected = project.furniture.find((f) => f.id === selectedId) ?? null;
  const selectedOpening = project.openings.find((o) => o.id === selectedOpeningId) ?? null;
  const topIssues = analysis.issues.filter((issue) => issue.severity !== 'info').slice(0, 3);

  return (
    <aside
      className={`${styles.inspector} ${inspectorOpen ? '' : styles.closed}`}
      aria-label="Inspector"
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>
            {selected || selectedOpening ? 'Selection' : 'Inspector'}
          </h2>
          <p className={styles.headerHint}>
            {selected
              ? 'Object properties & fit'
              : selectedOpening
                ? 'Opening properties'
                : 'Plan overview & analysis'}
          </p>
        </div>
        <IconButton
          aria-label="Close inspector"
          className={styles.close}
          onClick={() => toggleInspector(false)}
        >
          <X size={16} />
        </IconButton>
      </div>

      <div className={styles.scroll}>
        {selected ? (
          <FurnitureInspector object={selected} />
        ) : selectedOpening ? (
          <OpeningInspector opening={selectedOpening} />
        ) : (
          <div className={shared.panel}>
            <div className={styles.overviewStatus}>
              <StatusBadge status={analysis.status} />
              <p className={styles.overviewSummary}>{analysis.summary}</p>
            </div>

            <div className={shared.statGrid}>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Room area</span>
                <span className={shared.statValue}>{formatArea(analysis.roomArea)}</span>
              </div>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Free floor</span>
                <span className={shared.statValue}>{formatArea(analysis.freeArea)}</span>
              </div>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Occupied</span>
                <span className={shared.statValue}>{formatArea(analysis.occupiedArea)}</span>
              </div>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Coverage</span>
                <span className={shared.statValue}>{formatPercent(analysis.occupancyPct)}</span>
              </div>
            </div>

            <div className={shared.statGrid}>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Furniture</span>
                <span className={shared.statValue}>{analysis.objectCount}</span>
              </div>
              <div className={shared.stat}>
                <span className={shared.statLabel}>Collisions</span>
                <span className={shared.statValue}>{analysis.collisions.length}</span>
              </div>
            </div>

            <div className={shared.divider} />

            <section className={shared.section}>
              <div className={shared.sectionHeader}>
                <h3 className={shared.sectionTitle}>Analysis summary</h3>
                <span className={shared.tiny}>{analysis.issues.length} notes</span>
              </div>
              {topIssues.length === 0 ? (
                <div className={`${shared.callout} ${shared.calloutSuccess}`}>
                  <CheckCircle2 size={14} />
                  <span>No physical or clearance conflicts detected.</span>
                </div>
              ) : (
                <div className={shared.stack}>
                  {topIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`${shared.issue} ${
                        issue.severity === 'error' ? shared.issueError : shared.issueWarning
                      }`}
                    >
                      <AlertTriangle
                        size={14}
                        className={
                          issue.severity === 'error'
                            ? shared.issueIconError
                            : shared.issueIconWarning
                        }
                      />
                      <div className={shared.issueBody}>
                        <span className={shared.issueTitle}>{issue.title}</span>
                        <span className={shared.issueText}>{issue.message}</span>
                        {issue.objectIds.length > 0 ? (
                          <button
                            className={shared.linkButton}
                            onClick={() => selectFurniture(issue.objectIds[0])}
                          >
                            Show object
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className={shared.divider} />

            <section className={shared.section}>
              <div className={shared.sectionHeader}>
                <h3 className={shared.sectionTitle}>Room</h3>
                <span className={shared.tiny}>{project.room.name}</span>
              </div>
              <div className={styles.wallGrid}>
                <div className={styles.wallCell}>
                  <span className={styles.wallLabel}>Width</span>
                  <span className={styles.wallValue}>{formatLength(project.room.width, unit)}</span>
                </div>
                <div className={styles.wallCell}>
                  <span className={styles.wallLabel}>Length</span>
                  <span className={styles.wallValue}>{formatLength(project.room.length, unit)}</span>
                </div>
                <div className={styles.wallCell}>
                  <span className={styles.wallLabel}>Ceiling</span>
                  <span className={styles.wallValue}>
                    {formatLength(project.room.ceilingHeight, unit)}
                  </span>
                </div>
                <div className={styles.wallCell}>
                  <span className={styles.wallLabel}>Openings</span>
                  <span className={styles.wallValue}>{project.openings.length}</span>
                </div>
              </div>
              <p className={shared.sectionHint}>
                Click an object to edit it. Drag on the plan to reposition; changes sync instantly.
              </p>
            </section>

            <div className={shared.divider} />

            <section className={shared.section}>
              <h3 className={shared.sectionTitle}>Recent objects</h3>
              {project.furniture.length === 0 ? (
                <div className={shared.empty}>
                  <span className={shared.emptyIcon}>
                    <DoorOpen size={15} />
                  </span>
                  <span className={shared.emptyTitle}>Nothing placed yet</span>
                  <span className={shared.emptyText}>Add furniture from the Furnish panel.</span>
                </div>
              ) : (
                <div className={shared.stack}>
                  {project.furniture.slice(-4).reverse().map((object) => (
                    <button
                      key={object.id}
                      className={shared.listRow}
                      onClick={() => selectFurniture(object.id)}
                    >
                      <span className={shared.listIcon}>
                        <ChevronRight size={14} />
                      </span>
                      <span className={shared.listText}>
                        <span className={shared.listTitle}>{object.name}</span>
                        <span className={shared.listMeta}>
                          {formatLength(object.width, unit)} × {formatLength(object.depth, unit)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
