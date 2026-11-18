import { useEffect, useRef } from 'react';
import { saveProject } from '@/storage/db';
import { useProjectStore } from '@/store/projectStore';

const AUTOSAVE_DELAY = 900;

/** Debounced autosave. A burst of drag updates produces a single write. */
export function useAutosave(enabled = true): void {
  const project = useProjectStore((state) => state.project);
  const setSaveStatus = useProjectStore((state) => state.setSaveStatus);
  const markSaved = useProjectStore((state) => state.markSaved);
  const timerRef = useRef<number | null>(null);
  const skipRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    setSaveStatus('saving');
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveProject(project)
        .then(() => markSaved())
        .catch((error: unknown) =>
          setSaveStatus('error', error instanceof Error ? error.message : 'Autosave failed.'),
        );
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [project, enabled, setSaveStatus, markSaved]);
}
