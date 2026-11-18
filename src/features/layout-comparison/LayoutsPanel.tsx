import { useMemo, useState } from 'react';
import { LayoutGrid, Copy, Trash2, Check, GitCompare, Pencil, Save } from 'lucide-react';
import type { LayoutSnapshot } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { analyzeProject } from '@/engine/fit-analysis';
import { Button, IconButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Controls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatArea, formatPercent } from '@/engine/units';
import { pushToast } from '@/store/toastStore';
import { CompareDialog } from './CompareDialog';
import shared from '@/styles/shared.module.css';
import styles from './LayoutsPanel.module.css';

export function LayoutsPanel() {
  const project = useProjectStore((state) => state.project);
  const saveLayout = useProjectStore((state) => state.saveLayout);
  const applyLayout = useProjectStore((state) => state.applyLayout);
  const duplicateLayout = useProjectStore((state) => state.duplicateLayout);
  const renameLayout = useProjectStore((state) => state.renameLayout);
  const deleteLayout = useProjectStore((state) => state.deleteLayout);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const currentAnalysis = useMemo(() => analyzeProject(project), [project]);
  const layoutAnalyses = useMemo(
    () =>
      new Map(
        project.layouts.map((layout) => [
          layout.id,
          analyzeProject({ ...project, furniture: layout.furniture }),
        ]),
      ),
    [project],
  );

  const handleSave = () => {
    saveLayout(name || `Layout ${project.layouts.length + 1}`);
    setName('');
    pushToast('Layout saved. Current arrangement was kept.', 'success');
  };

  const compareLayout: LayoutSnapshot | null =
    project.layouts.find((layout) => layout.id === compareId) ?? null;
  const compareAnalysis = compareId ? layoutAnalyses.get(compareId) : undefined;

  return (
    <div className={shared.panel}>
      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Save this arrangement</h3>
          <span className={shared.tiny}>{project.furniture.length} objects</span>
        </div>
        <TextField
          value={name}
          onChange={setName}
          placeholder={`Layout ${project.layouts.length + 1}`}
          onEnter={handleSave}
        />
        <Button variant="primary" size="sm" block onClick={handleSave}>
          <Save size={14} /> Save current layout
        </Button>
        <p className={shared.sectionHint}>
          Layouts store furniture positions only. Room size, openings and clearance settings remain
          shared, so comparisons are always like-for-like.
        </p>
      </div>

      <div className={shared.divider} />

      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Alternatives</h3>
          <span className={shared.tiny}>{project.layouts.length} saved</span>
        </div>

        {project.layouts.length === 0 ? (
          <div className={shared.empty}>
            <span className={shared.emptyIcon}>
              <LayoutGrid size={16} />
            </span>
            <span className={shared.emptyTitle}>No saved layouts</span>
            <span className={shared.emptyText}>
              Save an arrangement, move the furniture, then save another to compare the options.
            </span>
          </div>
        ) : (
          <div className={shared.stack}>
            {project.layouts.map((layout) => {
              const result = layoutAnalyses.get(layout.id);
              const active = project.activeLayoutId === layout.id;
              return (
                <div key={layout.id} className={`${styles.card} ${active ? styles.cardActive : ''}`}>
                  <div className={styles.cardHead}>
                    {editingId === layout.id ? (
                      <input
                        className={styles.renameInput}
                        value={draftName}
                        autoFocus
                        onChange={(event) => setDraftName(event.target.value)}
                        onBlur={() => {
                          renameLayout(layout.id, draftName);
                          setEditingId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            renameLayout(layout.id, draftName);
                            setEditingId(null);
                          }
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        className={styles.nameButton}
                        onClick={() => {
                          setEditingId(layout.id);
                          setDraftName(layout.name);
                        }}
                        title="Rename layout"
                      >
                        {layout.name}
                        <Pencil size={11} />
                      </button>
                    )}
                    {active ? <span className={styles.activeTag}>Current</span> : null}
                  </div>

                  {result ? (
                    <div className={styles.metrics}>
                      <StatusBadge status={result.status} size="sm" />
                      <span className={styles.metric}>{formatArea(result.occupiedArea)} used</span>
                      <span className={styles.metric}>
                        {formatPercent(result.occupancyPct)} occupied
                      </span>
                    </div>
                  ) : null}

                  {pendingDelete === layout.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Delete this layout?</span>
                      <Button
                        size="xs"
                        variant="dangerSolid"
                        onClick={() => {
                          deleteLayout(layout.id);
                          setPendingDelete(null);
                          pushToast('Layout deleted.', 'info');
                        }}
                      >
                        Delete
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setPendingDelete(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <Button size="xs" variant="secondary" onClick={() => applyLayout(layout.id)}>
                        <Check size={12} /> Apply
                      </Button>
                      <IconButton
                        aria-label="Duplicate layout"
                        title="Duplicate layout"
                        onClick={() => duplicateLayout(layout.id)}
                      >
                        <Copy size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Compare with current"
                        title="Compare with current"
                        onClick={() => setCompareId(layout.id)}
                      >
                        <GitCompare size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete layout"
                        title="Delete layout"
                        onClick={() => setPendingDelete(layout.id)}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {compareLayout && compareAnalysis ? (
        <CompareDialog
          open
          onClose={() => setCompareId(null)}
          left={{ title: 'Current arrangement', analysis: currentAnalysis }}
          right={{ title: compareLayout.name, analysis: compareAnalysis }}
        />
      ) : null}
    </div>
  );
}
