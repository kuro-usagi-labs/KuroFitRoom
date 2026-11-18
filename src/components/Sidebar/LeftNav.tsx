import {
  Armchair,
  DoorOpen,
  Layers,
  Ruler,
  Settings2,
  Square,
  HelpCircle,
} from 'lucide-react';
import type { PanelId } from '@/store/editorStore';
import { useEditorStore } from '@/store/editorStore';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './LeftNav.module.css';

const ITEMS: { id: PanelId; label: string; Icon: typeof Square }[] = [
  { id: 'room', label: 'Room', Icon: Square },
  { id: 'furnish', label: 'Furnish', Icon: Armchair },
  { id: 'openings', label: 'Openings', Icon: DoorOpen },
  { id: 'measure', label: 'Measure', Icon: Ruler },
  { id: 'layouts', label: 'Layouts', Icon: Layers },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
];

interface LeftNavProps {
  onOpenHelp: () => void;
}

export function LeftNav({ onOpenHelp }: LeftNavProps) {
  const activePanel = useEditorStore((state) => state.activePanel);
  const setPanel = useEditorStore((state) => state.setPanel);

  return (
    <nav className={styles.nav} aria-label="Workspace sections">
      <div className={styles.items}>
        {ITEMS.map(({ id, label, Icon }) => (
          <Tooltip key={id} label={label} side="right">
            <button
              className={`${styles.item} ${activePanel === id ? styles.active : ''}`}
              onClick={() => setPanel(id)}
              aria-current={activePanel === id ? 'page' : undefined}
              aria-label={label}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span className={styles.label}>{label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
      <Tooltip label="Getting started" side="right">
        <button className={styles.item} onClick={onOpenHelp} aria-label="Help">
          <HelpCircle size={19} strokeWidth={1.8} />
          <span className={styles.label}>Help</span>
        </button>
      </Tooltip>
    </nav>
  );
}
