import { DoorOpen, AppWindow, Trash2, AlertTriangle } from 'lucide-react';
import type { WallSide } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { useProjectAnalysis } from '@/hooks/useAnalysis';
import { WALL_LABEL, WALL_SIDES, wallLength } from '@/engine/openings';
import { formatLength } from '@/engine/units';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, SelectField, TextField, TwoCol } from '@/components/ui/Controls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import shared from '@/styles/shared.module.css';

export function OpeningsPanel() {
  const openings = useProjectStore((state) => state.project.openings);
  const room = useProjectStore((state) => state.project.room);
  const unit = useProjectStore((state) => state.project.settings.unit);
  const addOpening = useProjectStore((state) => state.addOpening);
  const updateOpening = useProjectStore((state) => state.updateOpening);
  const removeOpening = useProjectStore((state) => state.removeOpening);
  const selectedId = useEditorStore((state) => state.selectedOpeningId);
  const selectOpening = useEditorStore((state) => state.selectOpening);
  const analysis = useProjectAnalysis();

  const selected = openings.find((opening) => opening.id === selectedId) ?? null;
  const doorCheck = selected ? analysis.doorChecks.find((check) => check.openingId === selected.id) : null;
  const blockedNames =
    doorCheck?.blockedBy
      .map((id) => useProjectStore.getState().project.furniture.find((f) => f.id === id)?.name)
      .filter(Boolean) ?? [];

  return (
    <div className={shared.panel}>
      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Openings</h3>
          <span className={shared.tiny}>{openings.length} total</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => selectOpening(addOpening('door'))}
            style={{ flex: 1 }}
          >
            <DoorOpen size={14} /> Add door
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => selectOpening(addOpening('window'))}
            style={{ flex: 1 }}
          >
            <AppWindow size={14} /> Add window
          </Button>
        </div>
      </div>

      {openings.length === 0 ? (
        <div className={shared.empty}>
          <span className={shared.emptyIcon}>
            <DoorOpen size={16} />
          </span>
          <span className={shared.emptyTitle}>No openings yet</span>
          <span className={shared.emptyText}>
            Add a door to analyse entrance access, or a window for the plan.
          </span>
        </div>
      ) : (
        <div className={shared.stack}>
          {openings.map((opening) => {
            const check = analysis.doorChecks.find((c) => c.openingId === opening.id);
            return (
              <button
                key={opening.id}
                className={`${shared.listRow} ${selectedId === opening.id ? shared.listRowActive : ''}`}
                onClick={() => selectOpening(opening.id)}
              >
                <span className={shared.listIcon}>
                  {opening.kind === 'door' ? <DoorOpen size={15} /> : <AppWindow size={15} />}
                </span>
                <span className={shared.listText}>
                  <span className={shared.listTitle}>{opening.name}</span>
                  <span className={shared.listMeta}>
                    {WALL_LABEL[opening.wall]} · {formatLength(opening.width, unit)}
                    {check?.blocked ? ' · swing blocked' : ''}
                  </span>
                </span>
                {check?.blocked ? <AlertTriangle size={14} color="var(--error)" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <>
          <div className={shared.divider} />
          <div className={shared.section}>
            <div className={shared.sectionHeader}>
              <h3 className={shared.sectionTitle}>{selected.kind === 'door' ? 'Door' : 'Window'} settings</h3>
              {selected.kind === 'door' ? (
                <StatusBadge
                  status={doorCheck?.blocked ? 'no-fit' : 'comfortable'}
                  label={doorCheck?.blocked ? 'Swing blocked' : 'Swing clear'}
                  size="sm"
                />
              ) : null}
            </div>

            <TextField
              label="Name"
              value={selected.name}
              onChange={(name) => updateOpening(selected.id, { name })}
              maxLength={40}
            />

            <SelectField
              label="Wall"
              value={selected.wall}
              options={WALL_SIDES.map((wall) => ({ value: wall, label: WALL_LABEL[wall] }))}
              onChange={(wall: WallSide) =>
                updateOpening(selected.id, {
                  wall,
                  offset: Math.min(
                    selected.offset,
                    Math.max(0, wallLength(room, wall) - selected.width),
                  ),
                })
              }
            />

            <TwoCol>
              <NumberField
                label="Width"
                value={selected.width}
                unit={unit}
                min={300}
                max={wallLength(room, selected.wall)}
                onChange={(width) => updateOpening(selected.id, { width })}
              />
              <NumberField
                label="Offset"
                hint={`max ${formatLength(
                  Math.max(0, wallLength(room, selected.wall) - selected.width),
                  unit,
                )}`}
                value={selected.offset}
                unit={unit}
                min={0}
                max={Math.max(0, wallLength(room, selected.wall) - selected.width)}
                onChange={(offset) => updateOpening(selected.id, { offset })}
              />
            </TwoCol>

            <NumberField
              label="Height"
              hint="metadata"
              value={selected.height}
              unit={unit}
              min={300}
              max={4000}
              onChange={(height) => updateOpening(selected.id, { height })}
            />

            {selected.kind === 'door' ? (
              <TwoCol>
                <SelectField
                  label="Hinge side"
                  value={selected.hinge}
                  options={[
                    { value: 'start', label: 'Start of wall' },
                    { value: 'end', label: 'End of wall' },
                  ]}
                  onChange={(hinge) => updateOpening(selected.id, { hinge })}
                />
                <SelectField
                  label="Opens"
                  value={selected.swing}
                  options={[
                    { value: 'in', label: 'Into room' },
                    { value: 'out', label: 'Out of room' },
                  ]}
                  onChange={(swing) => updateOpening(selected.id, { swing })}
                />
              </TwoCol>
            ) : null}

            {selected.kind === 'door' ? (
              <div className={`${shared.callout} ${doorCheck?.blocked ? shared.calloutError : shared.calloutInfo}`}>
                <AlertTriangle size={14} />
                <span>
                  {doorCheck?.blocked
                    ? `The door leaf cannot open fully. Obstructed by ${
                        blockedNames.length ? blockedNames.join(', ') : 'furniture'
                      }.`
                    : 'Door swing is visualised with its actual 90° swept area and checked against every footprint.'}
                </span>
              </div>
            ) : null}

            <div className={shared.row}>
              <span className={shared.tiny}>Drag the symbol on the plan to move it along the wall.</span>
              <IconButton
                aria-label="Delete opening"
                onClick={() => {
                  removeOpening(selected.id);
                  selectOpening(null);
                }}
              >
                <Trash2 size={15} color="var(--error)" />
              </IconButton>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
