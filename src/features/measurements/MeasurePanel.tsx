import { Ruler, Trash2, Info, RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { DEFAULT_CLEARANCES } from '@/features/furniture-library/catalog';
import { formatLength } from '@/engine/units';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, Toggle, TwoCol } from '@/components/ui/Controls';
import shared from '@/styles/shared.module.css';

export function MeasurePanel() {
  const settings = useProjectStore((state) => state.project.settings);
  const updateSettings = useProjectStore((state) => state.updateSettings);
  const updateClearances = useProjectStore((state) => state.updateClearances);
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const measurements = useEditorStore((state) => state.measurements);
  const removeMeasurement = useEditorStore((state) => state.removeMeasurement);
  const clearMeasurements = useEditorStore((state) => state.clearMeasurements);
  const showClearanceZones = useEditorStore((state) => state.showClearanceZones);
  const setShowClearanceZones = useEditorStore((state) => state.setShowClearanceZones);
  const unit = settings.unit;

  return (
    <div className={shared.panel}>
      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Point-to-point</h3>
          <span className={shared.tiny}>{measurements.length} saved</span>
        </div>
        <Button
          variant={tool === 'measure' ? 'primary' : 'secondary'}
          block
          onClick={() => setTool(tool === 'measure' ? 'select' : 'measure')}
        >
          <Ruler size={15} />
          {tool === 'measure' ? 'Measuring — click two points' : 'Start measuring'}
        </Button>
        <p className={shared.sectionHint}>
          Click two points on the plan to measure the real distance. Press Esc to cancel.
        </p>
      </div>

      {measurements.length > 0 ? (
        <div className={shared.stack}>
          {measurements.map((line) => (
            <div key={line.id} className={shared.listRow}>
              <span className={shared.listIcon}>
                <Ruler size={14} />
              </span>
              <span className={shared.listText}>
                <span className={shared.listTitle}>{formatLength(line.distance, unit)}</span>
                <span className={shared.listMeta}>
                  {formatLength(Math.round(Math.abs(line.b.x - line.a.x)), unit)} horizontal ·{' '}
                  {formatLength(Math.round(Math.abs(line.b.y - line.a.y)), unit)} vertical
                </span>
              </span>
              <IconButton aria-label="Remove measurement" onClick={() => removeMeasurement(line.id)}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          <Button variant="ghost" size="xs" onClick={clearMeasurements}>
            Clear all measurements
          </Button>
        </div>
      ) : (
        <div className={shared.empty}>
          <span className={shared.emptyIcon}>
            <Ruler size={16} />
          </span>
          <span className={shared.emptyTitle}>No measurements yet</span>
          <span className={shared.emptyText}>
            Measurements are temporary helpers and are not saved into the project.
          </span>
        </div>
      )}

      <div className={shared.divider} />

      <div className={shared.section}>
        <h3 className={shared.sectionTitle}>Display</h3>
        <Toggle
          title="Room dimensions"
          hint="Width and length on the plan"
          checked={settings.showMeasurements}
          onChange={(showMeasurements) => updateSettings({ showMeasurements })}
        />
        <Toggle
          title="Selected object size"
          hint="Width and depth labels"
          checked={settings.showObjectDimensions}
          onChange={(showObjectDimensions) => updateSettings({ showObjectDimensions })}
        />
        <Toggle
          title="Clearance zones"
          hint="Usage area of the selected object"
          checked={showClearanceZones}
          onChange={setShowClearanceZones}
        />
      </div>

      <div className={shared.divider} />

      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Clearance targets</h3>
          <IconButton
            aria-label="Reset clearance targets"
            onClick={() => updateClearances(DEFAULT_CLEARANCES)}
          >
            <RotateCcw size={13} />
          </IconButton>
        </div>
        <TwoCol>
          <NumberField
            label="Limited walkway"
            value={settings.clearances.walkwayLimited}
            unit={unit}
            min={300}
            max={2000}
            onChange={(walkwayLimited) => updateClearances({ walkwayLimited })}
          />
          <NumberField
            label="Comfortable walkway"
            value={settings.clearances.walkwayComfortable}
            unit={unit}
            min={400}
            max={2500}
            onChange={(walkwayComfortable) => updateClearances({ walkwayComfortable })}
          />
        </TwoCol>
        <TwoCol>
          <NumberField
            label="Chair space"
            value={settings.clearances.chair}
            unit={unit}
            min={400}
            max={2000}
            onChange={(chair) => updateClearances({ chair })}
          />
          <NumberField
            label="Bedside access"
            value={settings.clearances.bedside}
            unit={unit}
            min={300}
            max={1500}
            onChange={(bedside) => updateClearances({ bedside })}
          />
        </TwoCol>
        <NumberField
          label="Installation gap"
          value={settings.clearances.installationGap}
          unit={unit}
          min={0}
          max={300}
          onChange={(installationGap) => updateClearances({ installationGap })}
        />
        <div className={`${shared.callout} ${shared.calloutInfo}`}>
          <Info size={14} />
          <span>
            These are configurable heuristics for planning, not universal comfort standards. A bed
            is considered accessible when at least one side meets the target.
          </span>
        </div>
      </div>
    </div>
  );
}
