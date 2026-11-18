import { useRef, useState } from 'react';
import { Download, Upload, FolderOpen, Save, Keyboard, Info, RotateCcw } from 'lucide-react';
import type { Unit } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { parseProjectJSON } from '@/storage/schema';
import { saveProject } from '@/storage/db';
import { saveProjectAsJson, readJsonFile } from '@/export/exporters';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField, Toggle, TwoCol } from '@/components/ui/Controls';
import { Modal } from '@/components/ui/Modal';
import { pushToast } from '@/store/toastStore';
import shared from '@/styles/shared.module.css';

const SHORTCUTS = [
  ['Ctrl / Cmd + Z', 'Undo'],
  ['Ctrl / Cmd + Shift + Z', 'Redo'],
  ['Ctrl / Cmd + S', 'Save now'],
  ['Delete', 'Delete selection'],
  ['Arrow keys', 'Nudge 10 mm'],
  ['Shift + Arrows', 'Nudge 100 mm'],
  ['R / Shift + R', 'Rotate 90°'],
  ['V / H / M', 'Select / pan / measure'],
  ['Space + drag', 'Pan canvas'],
  ['Esc', 'Deselect or cancel'],
];

interface SettingsPanelProps {
  onOpenProjects: () => void;
}

export function SettingsPanel({ onOpenProjects }: SettingsPanelProps) {
  const project = useProjectStore((state) => state.project);
  const updateSettings = useProjectStore((state) => state.updateSettings);
  const resetProject = useProjectStore((state) => state.resetProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const markSaved = useProjectStore((state) => state.markSaved);
  const saveStatus = useProjectStore((state) => state.saveStatus);
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMode, setResetMode] = useState<'blank' | 'sample'>('blank');

  const handleSaveNow = async () => {
    try {
      await saveProject(project);
      markSaved();
      pushToast('Project saved.', 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save the project.', 'error');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readJsonFile(file);
      const imported = parseProjectJSON(text);
      loadProject(imported);
      await saveProject(imported);
      markSaved();
      pushToast(`Imported “${imported.name}”.`, 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Import failed.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={shared.panel}>
      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Project</h3>
        <div className={shared.statGrid}>
          <div className={shared.stat}>
            <span className={shared.statLabel}>Objects</span>
            <span className={shared.statValue}>{project.furniture.length}</span>
          </div>
          <div className={shared.stat}>
            <span className={shared.statLabel}>Saved layouts</span>
            <span className={shared.statValue}>{project.layouts.length}</span>
          </div>
        </div>
        <div className={shared.row}>
          <span className={shared.tiny}>
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'error'
                ? 'Save failed'
                : lastSavedAt
                  ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Not saved yet'}
          </span>
          <Button size="xs" variant="secondary" onClick={handleSaveNow}>
            <Save size={12} /> Save now
          </Button>
        </div>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Display & units</h3>
        <SelectField
          label="Measurement unit"
          value={project.settings.unit}
          options={[
            { value: 'mm' as Unit, label: 'Millimetres (mm)' },
            { value: 'cm' as Unit, label: 'Centimetres (cm)' },
            { value: 'm' as Unit, label: 'Metres (m)' },
          ]}
          onChange={(unit) => updateSettings({ unit })}
        />
        <NumberField
          label="Grid size"
          value={project.settings.gridSize}
          unit={project.settings.unit}
          min={10}
          max={1000}
          onChange={(gridSize) => updateSettings({ gridSize })}
        />
        <TwoCol>
          <Toggle
            title="Grid"
            checked={project.settings.showGrid}
            onChange={(showGrid) => updateSettings({ showGrid })}
          />
          <Toggle
            title="Snapping"
            checked={project.settings.snapEnabled}
            onChange={(snapEnabled) => updateSettings({ snapEnabled })}
          />
        </TwoCol>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Data</h3>
        <Button size="sm" variant="secondary" block onClick={onOpenProjects}>
          <FolderOpen size={14} /> Open project manager
        </Button>
        <TwoCol>
          <Button size="sm" variant="secondary" onClick={() => saveProjectAsJson(project)}>
            <Download size={13} /> Export JSON
          </Button>
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Import JSON
          </Button>
        </TwoCol>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <p className={shared.sectionHint}>
          Imported files are validated as data only. Projects are stored locally on this device.
        </p>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Start over</h3>
        <TwoCol>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setResetMode('blank');
              setConfirmReset(true);
            }}
          >
            <RotateCcw size={13} /> Blank room
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setResetMode('sample');
              setConfirmReset(true);
            }}
          >
            Sample room
          </Button>
        </TwoCol>
        <p className={shared.sectionHint}>
          This creates a new project. The current one stays available in the project manager.
        </p>
      </section>

      <div className={shared.divider} />

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>
          <Keyboard size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Keyboard shortcuts
        </h3>
        <div className={shared.stack}>
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className={shared.row}>
              <span className={shared.tiny}>{action}</span>
              <kbd
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-2)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      <div className={`${shared.callout} ${shared.calloutInfo}`}>
        <Info size={14} />
        <span>RoomFit 1.0 · Real measurements, real decisions. All calculations are local.</span>
      </div>

      <Modal
        open={confirmReset}
        title={resetMode === 'sample' ? 'Load the sample room?' : 'Start a blank room?'}
        description="The current project is saved on this device and stays in the project manager."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const created = resetProject(resetMode);
                void saveProject(created).then(() => markSaved());
                setConfirmReset(false);
                pushToast(
                  resetMode === 'sample' ? 'Sample room loaded.' : 'Blank room created.',
                  'success',
                );
              }}
            >
              {resetMode === 'sample' ? 'Load sample' : 'Create blank room'}
            </Button>
          </>
        }
      >
        <p className={shared.sectionHint}>
          {resetMode === 'sample'
            ? 'A 2.8 × 3.2 m bedroom with a 160 × 200 cm bed, desk, wardrobe, door and window.'
            : 'A 3 × 3.6 m room with one door. Furniture starts empty.'}
        </p>
      </Modal>
    </div>
  );
}
