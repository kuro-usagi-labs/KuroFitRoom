import { X } from 'lucide-react';
import type { PanelId } from '@/store/editorStore';
import { useEditorStore } from '@/store/editorStore';
import { IconButton } from '@/components/ui/Button';
import { RoomPanel } from '@/features/room-builder/RoomPanel';
import { FurnishPanel } from '@/features/furniture-library/FurnishPanel';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { MeasurePanel } from '@/features/measurements/MeasurePanel';
import { LayoutsPanel } from '@/features/layout-comparison/LayoutsPanel';
import { SettingsPanel } from '@/features/project-manager/SettingsPanel';
import styles from './Sidebar.module.css';

const TITLES: Record<PanelId, { title: string; hint: string }> = {
  room: { title: 'Room', hint: 'Dimensions, presets and area' },
  furnish: { title: 'Furnish', hint: 'Furniture library and custom objects' },
  openings: { title: 'Openings', hint: 'Doors, windows and swings' },
  measure: { title: 'Measure', hint: 'Distances and clearance targets' },
  layouts: { title: 'Layouts', hint: 'Saved alternatives and comparison' },
  settings: { title: 'Settings', hint: 'Units, data and shortcuts' },
};

interface SidebarProps {
  onOpenProjects: () => void;
}

export function Sidebar({ onOpenProjects }: SidebarProps) {
  const activePanel = useEditorStore((state) => state.activePanel);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const meta = TITLES[activePanel];

  return (
    <aside className={styles.sidebar} aria-label={`${meta.title} panel`}>
      <div className={styles.header}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{meta.title}</h2>
          <p className={styles.hint}>{meta.hint}</p>
        </div>
        <IconButton
          aria-label="Close panel"
          className={styles.close}
          onClick={() => toggleSidebar(false)}
        >
          <X size={16} />
        </IconButton>
      </div>
      <div className={styles.scroll}>
        {activePanel === 'room' ? <RoomPanel /> : null}
        {activePanel === 'furnish' ? <FurnishPanel /> : null}
        {activePanel === 'openings' ? <OpeningsPanel /> : null}
        {activePanel === 'measure' ? <MeasurePanel /> : null}
        {activePanel === 'layouts' ? <LayoutsPanel /> : null}
        {activePanel === 'settings' ? <SettingsPanel onOpenProjects={onOpenProjects} /> : null}
      </div>
    </aside>
  );
}
