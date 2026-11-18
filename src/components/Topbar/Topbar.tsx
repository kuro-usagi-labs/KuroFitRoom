import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Download,
  FileJson,
  Image,
  FileCode2,
  Check,
  Loader2,
  AlertTriangle,
  Sparkles,
  PencilRuler,
} from 'lucide-react';
import type { Project } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { listProjects, loadProject, saveProject } from '@/storage/db';
import { exportPng, exportSvg, saveProjectAsJson } from '@/export/exporters';
import { pushToast } from '@/store/toastStore';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconButton } from '@/components/ui/Button';
import { BrandMark } from '@/components/Topbar/BrandMark';
import styles from './Topbar.module.css';

interface TopbarProps {
  onOpenProjects: () => void;
}

export function Topbar({ onOpenProjects }: TopbarProps) {
  const project = useProjectStore((state) => state.project);
  const saveStatus = useProjectStore((state) => state.saveStatus);
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt);
  const markSaved = useProjectStore((state) => state.markSaved);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const canUndo = useProjectStore((state) => state.past.length > 0);
  const canRedo = useProjectStore((state) => state.future.length > 0);
  const loadProjectIntoStore = useProjectStore((state) => state.loadProject);
  const appMode = useEditorStore((state) => state.appMode);
  const setMode = useEditorStore((state) => state.setMode);
  const requestFit = useEditorStore((state) => state.requestFit);
  const clearSelection = useEditorStore((state) => state.clearSelection);

  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [recent, setRecent] = useState<Project[]>([]);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectMenuOpen && !exportOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (projectMenuRef.current?.contains(target) || exportRef.current?.contains(target)) return;
      setProjectMenuOpen(false);
      setExportOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [projectMenuOpen, exportOpen]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    listProjects()
      .then((projects) => setRecent(projects.slice(0, 5)))
      .catch(() => setRecent([]));
  }, [projectMenuOpen]);

  const handleSave = async () => {
    try {
      await saveProject(project);
      markSaved();
      pushToast('Project saved.', 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save the project.', 'error');
    }
  };

  const handleOpenRecent = async (id: string) => {
    try {
      const loaded = await loadProject(id);
      if (!loaded) {
        pushToast('That project could not be found.', 'error');
        return;
      }
      loadProjectIntoStore(loaded);
      clearSelection();
      requestFit();
      setProjectMenuOpen(false);
      pushToast(`Opened “${loaded.name}”.`, 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not open the project.', 'error');
    }
  };

  const handleExport = async (kind: 'json' | 'svg' | 'png') => {
    setExportOpen(false);
    try {
      if (kind === 'json') saveProjectAsJson(project);
      if (kind === 'svg') exportSvg(project);
      if (kind === 'png') await exportPng(project);
      pushToast(
        kind === 'json' ? 'Project JSON exported.' : kind === 'svg' ? 'SVG plan exported.' : 'PNG plan exported.',
        'success',
      );
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Export failed.', 'error');
    }
  };

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'error'
        ? 'Save failed'
        : lastSavedAt
          ? 'Saved'
          : 'Not saved yet';

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <BrandMark />
          <div className={styles.brandText}>
            <span className={styles.brandName}>RoomFit</span>
            <span className={styles.brandTag}>Plan before you buy</span>
          </div>
        </div>

        <span className={styles.separator} />

        <div className={styles.projectMenuWrap} ref={projectMenuRef}>
          <button
            className={styles.projectButton}
            onClick={() => setProjectMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
          >
            <span className={styles.projectName}>{project.name}</span>
            <ChevronDown size={14} />
          </button>
          {projectMenuOpen ? (
            <div className={styles.menu} role="menu">
              <div className={styles.menuLabel}>Recent projects</div>
              {recent.length === 0 ? (
                <div className={styles.menuEmpty}>No saved projects yet.</div>
              ) : (
                recent.map((item) => (
                  <button
                    key={item.id}
                    className={styles.menuItem}
                    onClick={() => handleOpenRecent(item.id)}
                  >
                    <span className={styles.menuItemName}>{item.name}</span>
                    {item.id === project.id ? <Check size={13} color="var(--primary)" /> : null}
                  </button>
                ))
              )}
              <div className={styles.menuDivider} />
              <button
                className={styles.menuItem}
                onClick={() => {
                  setProjectMenuOpen(false);
                  onOpenProjects();
                }}
              >
                <FolderOpen size={14} /> All projects…
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setProjectMenuOpen(false);
                  void handleSave();
                }}
              >
                <Save size={14} /> Save now
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.modeSwitch} role="tablist" aria-label="Workspace mode">
          <button
            className={`${styles.modeButton} ${appMode === 'designer' ? styles.modeActive : ''}`}
            onClick={() => setMode('designer')}
            role="tab"
            aria-selected={appMode === 'designer'}
          >
            <PencilRuler size={13} /> Designer
          </button>
          <button
            className={`${styles.modeButton} ${appMode === 'quickfit' ? styles.modeActive : ''}`}
            onClick={() => setMode('quickfit')}
            role="tab"
            aria-selected={appMode === 'quickfit'}
          >
            <Sparkles size={13} /> Quick Fit
          </button>
        </div>
      </div>

      <div className={styles.right}>
        <span
          className={`${styles.saveStatus} ${
            saveStatus === 'error' ? styles.saveError : saveStatus === 'saving' ? styles.saveSaving : ''
          }`}
          title={
            lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Autosave is on'
          }
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={13} className={styles.spin} />
          ) : saveStatus === 'error' ? (
            <AlertTriangle size={13} />
          ) : (
            <Check size={13} />
          )}
          {saveLabel}
        </span>

        <div className={styles.iconGroup}>
          <Tooltip label="Undo  (Ctrl+Z)" side="bottom">
            <IconButton aria-label="Undo" disabled={!canUndo} onClick={undo}>
              <Undo2 size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Redo  (Ctrl+Shift+Z)" side="bottom">
            <IconButton aria-label="Redo" disabled={!canRedo} onClick={redo}>
              <Redo2 size={16} />
            </IconButton>
          </Tooltip>
        </div>

        <button className={styles.textButton} onClick={onOpenProjects} aria-label="Projects">
          <FolderOpen size={14} />
          <span>Projects</span>
        </button>

        <button className={styles.textButton} onClick={handleSave} aria-label="Save">
          <Save size={14} />
          <span>Save</span>
        </button>

        <div className={styles.exportWrap} ref={exportRef}>
          <button
            className={styles.primaryButton}
            onClick={() => setExportOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            <Download size={14} />
            <span>Export</span>
            <ChevronDown size={12} />
          </button>
          {exportOpen ? (
            <div className={`${styles.menu} ${styles.exportMenu}`} role="menu">
              <button className={styles.menuItem} onClick={() => void handleExport('json')}>
                <FileJson size={14} /> Project JSON
              </button>
              <button className={styles.menuItem} onClick={() => void handleExport('svg')}>
                <FileCode2 size={14} /> Floor plan SVG
              </button>
              <button className={styles.menuItem} onClick={() => void handleExport('png')}>
                <Image size={14} /> Floor plan PNG
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
