import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Copy,
  Trash2,
  Pencil,
  Upload,
  Check,
  Sparkles,
} from 'lucide-react';
import type { Project } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import {
  deleteProjectRecord,
  listProjects,
  loadProject,
  saveProject,
} from '@/storage/db';
import {
  duplicateProject,
  parseProjectJSON,
} from '@/storage/schema';
import { readJsonFile } from '@/export/exporters';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { pushToast } from '@/store/toastStore';
import { formatArea } from '@/engine/units';
import shared from '@/styles/shared.module.css';
import styles from './ProjectsDialog.module.css';

interface ProjectsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectsDialog({ open, onClose }: ProjectsDialogProps) {
  const current = useProjectStore((state) => state.project);
  const loadProjectIntoStore = useProjectStore((state) => state.loadProject);
  const resetProject = useProjectStore((state) => state.resetProject);
  const renameProject = useProjectStore((state) => state.renameProject);
  const markSaved = useProjectStore((state) => state.markSaved);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const requestFit = useEditorStore((state) => state.requestFit);

  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved projects.');
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const finishOpen = (project: Project) => {
    loadProjectIntoStore(project);
    clearSelection();
    requestFit();
    onClose();
  };

  const handleOpen = async (id: string) => {
    try {
      const project = await loadProject(id);
      if (!project) {
        pushToast('That project could not be found.', 'error');
        await refresh();
        return;
      }
      finishOpen(project);
      pushToast(`Opened “${project.name}”.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not open the project.', 'error');
    }
  };

  const handleCreate = async (mode: 'blank' | 'sample') => {
    setBusy(true);
    try {
      const created = resetProject(mode);
      await saveProject(created);
      markSaved();
      onClose();
      pushToast(mode === 'sample' ? 'Sample room loaded.' : 'Blank room created.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not create the project.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (project: Project) => {
    try {
      const copy = duplicateProject(project);
      await saveProject(copy);
      await refresh();
      pushToast(`Duplicated as “${copy.name}”.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not duplicate the project.', 'error');
    }
  };

  const handleRename = async (project: Project) => {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === project.name) return;
    try {
      const updated = { ...project, name };
      await saveProject(updated);
      if (current.id === project.id) renameProject(name);
      await refresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not rename the project.', 'error');
    }
  };

  const handleDelete = async (project: Project) => {
    setPendingDelete(null);
    try {
      await deleteProjectRecord(project.id);
      await refresh();
      if (current.id === project.id) {
        const replacement = resetProject('blank');
        await saveProject(replacement);
        markSaved();
      }
      pushToast('Project deleted.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not delete the project.', 'error');
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readJsonFile(file);
      const imported = parseProjectJSON(text);
      await saveProject(imported);
      finishOpen(imported);
      pushToast(`Imported “${imported.name}”.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const filtered = projects.filter((project) =>
    project.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Projects"
      description="Everything is stored locally on this device. Export a JSON file to keep a backup."
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import JSON
          </Button>
          <Button variant="primary" onClick={() => void handleCreate('blank')} disabled={busy}>
            <Plus size={14} /> New room
          </Button>
        </>
      }
    >
      <div className={styles.topRow}>
        <div className={shared.searchWrap} style={{ flex: 1 }}>
          <Search size={14} className={shared.searchIcon} />
          <input
            className={shared.searchInput}
            placeholder="Search projects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search projects"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => void handleCreate('sample')} disabled={busy}>
          <Sparkles size={14} /> Sample room
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />

      {error ? (
        <div className={`${shared.callout} ${shared.calloutError}`}>
          <span>{error}</span>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className={shared.empty}>
          <span className={shared.emptyIcon}>
            <FolderOpen size={17} />
          </span>
          <span className={shared.emptyTitle}>No projects found</span>
          <span className={shared.emptyText}>
            Create a new room or import a RoomFit JSON file to get started.
          </span>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((project) => {
            const isCurrent = project.id === current.id;
            return (
              <div key={project.id} className={`${styles.row} ${isCurrent ? styles.current : ''}`}>
                <div className={styles.rowMain}>
                  {editingId === project.id ? (
                    <input
                      className={styles.rename}
                      value={draftName}
                      autoFocus
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => void handleRename(project)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleRename(project);
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                    />
                  ) : (
                    <button
                      className={styles.name}
                      onClick={() => void handleOpen(project.id)}
                      title="Open project"
                    >
                      {project.name}
                      {isCurrent ? <span className={styles.currentTag}>open</span> : null}
                    </button>
                  )}
                  <span className={styles.meta}>
                    {formatArea(project.room.width * project.room.length)} ·{' '}
                    {project.furniture.length} objects ·{' '}
                    {new Date(project.updatedAt).toLocaleDateString([], {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>

                {pendingDelete === project.id ? (
                  <div className={styles.confirm}>
                    <span>Delete?</span>
                    <Button size="xs" variant="dangerSolid" onClick={() => void handleDelete(project)}>
                      Delete
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setPendingDelete(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <Button size="xs" variant="secondary" onClick={() => void handleOpen(project.id)}>
                      <Check size={12} /> Open
                    </Button>
                    <IconButton
                      aria-label={`Rename ${project.name}`}
                      onClick={() => {
                        setEditingId(project.id);
                        setDraftName(project.name);
                      }}
                    >
                      <Pencil size={13} />
                    </IconButton>
                    <IconButton
                      aria-label={`Duplicate ${project.name}`}
                      onClick={() => void handleDuplicate(project)}
                    >
                      <Copy size={13} />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete ${project.name}`}
                      onClick={() => setPendingDelete(project.id)}
                    >
                      <Trash2 size={13} color={isCurrent ? 'var(--error)' : undefined} />
                    </IconButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
