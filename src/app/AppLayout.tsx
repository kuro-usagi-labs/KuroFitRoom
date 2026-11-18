import { useCallback, useEffect, useState } from 'react';
import {
  Armchair,
  DoorOpen,
  Layers,
  Ruler,
  Settings2,
  Square,
} from 'lucide-react';
import type { PanelId } from '@/store/editorStore';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { listProjects, saveProject } from '@/storage/db';
import { useAutosave } from '@/hooks/useAutosave';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { pushToast } from '@/store/toastStore';
import { Topbar } from '@/components/Topbar/Topbar';
import { LeftNav } from '@/components/Sidebar/LeftNav';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { Inspector } from '@/components/Inspector/Inspector';
import { AnalysisBar } from '@/components/AnalysisPanel/AnalysisBar';
import { Toasts } from '@/components/ui/Toasts';
import { FloorCanvas } from '@/features/floor-editor/FloorCanvas';
import { QuickFit } from '@/features/quick-fit/QuickFit';
import { ProjectsDialog } from '@/features/project-manager/ProjectsDialog';
import { Onboarding } from '@/features/project-manager/Onboarding';
import styles from './AppLayout.module.css';

const ONBOARDING_KEY = 'roomfit:onboarding-seen';

const MOBILE_ITEMS: { id: PanelId; label: string; Icon: typeof Square }[] = [
  { id: 'room', label: 'Room', Icon: Square },
  { id: 'furnish', label: 'Furnish', Icon: Armchair },
  { id: 'openings', label: 'Openings', Icon: DoorOpen },
  { id: 'measure', label: 'Measure', Icon: Ruler },
  { id: 'layouts', label: 'Layouts', Icon: Layers },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
];

function MobileNav() {
  const activePanel = useEditorStore((state) => state.activePanel);
  const setPanel = useEditorStore((state) => state.setPanel);

  return (
    <nav className={styles.mobileNav} aria-label="Workspace sections">
      {MOBILE_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`${styles.mobileItem} ${activePanel === id ? styles.mobileActive : ''}`}
          onClick={() => setPanel(id)}
          aria-current={activePanel === id ? 'page' : undefined}
        >
          <Icon size={15} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const appMode = useEditorStore((state) => state.appMode);
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const loadProjectIntoStore = useProjectStore((state) => state.loadProject);

  const [projectsOpen, setProjectsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* storage is optional for this flag */
    }
  }, []);

  // Restore the most recently used project once on start-up.
  useEffect(() => {
    let active = true;
    listProjects()
      .then((projects) => {
        if (!active || projects.length === 0) return;
        loadProjectIntoStore(projects[0]);
      })
      .catch(() => {
        if (active) {
          pushToast('Saved projects could not be read. New work stays in memory.', 'error');
        }
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [loadProjectIntoStore]);

  useAutosave(hydrated);

  const handleEscape = useCallback(() => {
    toggleSidebar(false);
    toggleInspector(false);
  }, [toggleSidebar, toggleInspector]);

  useKeyboardShortcuts({ onEscape: handleEscape });

  // Ctrl / Cmd + S dispatches this event from the global shortcut hook.
  useEffect(() => {
    const handler = () => {
      const { project, saveStatus } = useProjectStore.getState();
      if (saveStatus === 'saving') return;
      const store = useProjectStore.getState();
      store.setSaveStatus('saving');
      saveProject(project)
        .then(() => {
          store.markSaved();
          pushToast('Project saved.', 'success');
        })
        .catch((error: unknown) => {
          store.setSaveStatus(
            'error',
            error instanceof Error ? error.message : 'Could not save the project.',
          );
          pushToast(
            error instanceof Error ? error.message : 'Could not save the project.',
            'error',
          );
        });
    };
    window.addEventListener('roomfit:save', handler);
    return () => window.removeEventListener('roomfit:save', handler);
  }, []);

  return (
    <div className={styles.app}>
      <Topbar onOpenProjects={() => setProjectsOpen(true)} />

      {appMode === 'quickfit' ? (
        <div className={styles.body}>
          <QuickFit />
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.main}>
            <LeftNav onOpenHelp={() => setOnboardingOpen(true)} />

            {sidebarOpen ? (
              <button
                type="button"
                className={styles.backdrop}
                aria-label="Close side panel"
                onClick={() => toggleSidebar(false)}
              />
            ) : null}
            {sidebarOpen ? <Sidebar onOpenProjects={() => setProjectsOpen(true)} /> : null}

            <main className={styles.center}>
              <MobileNav />
              <FloorCanvas />
            </main>

            <Inspector />
          </div>

          <AnalysisBar />
        </div>
      )}

      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <Onboarding open={onboardingOpen} onClose={closeOnboarding} />
      <Toasts lift={appMode === 'quickfit' ? 'apply' : 'bar'} />
    </div>
  );
}
