import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { clampCenterIntoRoom, effectiveSize } from '@/engine/geometry';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

interface ShortcutOptions {
  onEscape?: () => void;
  onToggleShortcuts?: () => void;
}

/** Global editor shortcuts. Ignored while the user types in a field. */
export function useKeyboardShortcuts(options: ShortcutOptions = {}): void {
  const { onEscape } = options;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const projectStore = useProjectStore.getState();
      const editor = useEditorStore.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) projectStore.redo();
        else projectStore.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        projectStore.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('roomfit:save'));
        return;
      }
      if (mod) return;

      if (event.key === 'Escape') {
        if (editor.measureStart) editor.cancelMeasure();
        else if (editor.tool === 'measure') editor.setTool('select');
        else if (editor.selectedFurnitureId || editor.selectedOpeningId) editor.clearSelection();
        else onEscape?.();
        return;
      }

      const toolKey = event.key.toLowerCase();
      if (toolKey === 'v' || toolKey === 'h' || toolKey === 'm') {
        event.preventDefault();
        editor.setTool(toolKey === 'v' ? 'select' : toolKey === 'h' ? 'pan' : 'measure');
        return;
      }

      const selectedId = editor.selectedFurnitureId;
      if (!selectedId) return;
      const object = projectStore.project.furniture.find((f) => f.id === selectedId);
      if (!object) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        projectStore.removeFurniture(selectedId);
        editor.clearSelection();
        return;
      }

      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) {
        if (object.locked) return;
        event.preventDefault();
        projectStore.rotateFurniture(selectedId, event.shiftKey ? 'ccw' : 'cw');
        return;
      }

      const step = event.shiftKey ? 100 : 10;
      const deltas: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();
      if (object.locked) return;
      const moved = { ...object, x: object.x + delta.x, y: object.y + delta.y };
      const clamped = clampCenterIntoRoom(moved, projectStore.project.room);
      const size = effectiveSize(object);
      void size;
      projectStore.beginHistory();
      projectStore.updateFurnitureLive(selectedId, clamped);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}
