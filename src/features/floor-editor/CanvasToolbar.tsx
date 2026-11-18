import {
  MousePointer2,
  Hand,
  Ruler,
  Magnet,
  Grid3x3,
  Undo2,
  Redo2,
  Plus,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './CanvasToolbar.module.css';

export function CanvasToolbar() {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const setPanel = useEditorStore((state) => state.setPanel);
  const settings = useProjectStore((state) => state.project.settings);
  const updateSettings = useProjectStore((state) => state.updateSettings);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const canUndo = useProjectStore((state) => state.past.length > 0);
  const canRedo = useProjectStore((state) => state.future.length > 0);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Canvas tools">
      <Tooltip label="Select  (V)" side="bottom">
        <IconButton
          aria-label="Select tool"
          active={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 size={17} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Pan  (H or Space)" side="bottom">
        <IconButton aria-label="Pan tool" active={tool === 'pan'} onClick={() => setTool('pan')}>
          <Hand size={17} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Add furniture" side="bottom">
        <IconButton aria-label="Add furniture" onClick={() => setPanel('furnish')}>
          <Plus size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Measure distance  (M)" side="bottom">
        <IconButton
          aria-label="Measure tool"
          active={tool === 'measure'}
          onClick={() => setTool('measure')}
        >
          <Ruler size={17} />
        </IconButton>
      </Tooltip>

      <span className={styles.divider} />

      <Tooltip label={settings.snapEnabled ? 'Snapping on' : 'Snapping off'} side="bottom">
        <IconButton
          aria-label="Toggle snapping"
          aria-pressed={settings.snapEnabled}
          active={settings.snapEnabled}
          onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
        >
          <Magnet size={17} />
        </IconButton>
      </Tooltip>
      <Tooltip label={settings.showGrid ? 'Hide grid' : 'Show grid'} side="bottom">
        <IconButton
          aria-label="Toggle grid"
          aria-pressed={settings.showGrid}
          active={settings.showGrid}
          onClick={() => updateSettings({ showGrid: !settings.showGrid })}
        >
          <Grid3x3 size={17} />
        </IconButton>
      </Tooltip>

      <span className={styles.divider} />

      <Tooltip label="Undo  (Ctrl+Z)" side="bottom">
        <IconButton aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={17} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Redo  (Ctrl+Shift+Z)" side="bottom">
        <IconButton aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={17} />
        </IconButton>
      </Tooltip>
    </div>
  );
}
