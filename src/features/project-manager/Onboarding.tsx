import { ArrowRight, CheckCircle2, Info, Ruler, Sofa, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { saveProject } from '@/storage/db';
import { pushToast } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import styles from './Onboarding.module.css';

interface OnboardingProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    Icon: Ruler,
    title: 'Measure the real room',
    text: 'Type the inner clear width and length. Add doors and windows so swing paths and access are checked.',
  },
  {
    Icon: Sofa,
    title: 'Place the furniture',
    text: 'Use a preset or the real frame size. Drag, rotate and resize it; every millimetre is tracked.',
  },
  {
    Icon: CheckCircle2,
    title: 'Check before you buy',
    text: 'Read physical fit, clearance and circulation results — with reasons, not vague comfort claims.',
  },
];

export function Onboarding({ open, onClose }: OnboardingProps) {
  const resetProject = useProjectStore((state) => state.resetProject);
  const markSaved = useProjectStore((state) => state.markSaved);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const requestFit = useEditorStore((state) => state.requestFit);
  const setMode = useEditorStore((state) => state.setMode);
  const setPanel = useEditorStore((state) => state.setPanel);

  const start = async (mode: 'blank' | 'sample') => {
    const created = resetProject(mode);
    setMode('designer');
    clearSelection();
    requestFit();
    setPanel(mode === 'sample' ? 'room' : 'furnish');
    onClose();
    try {
      await saveProject(created);
      markSaved();
      pushToast(
        mode === 'sample' ? 'Sample room ready to explore.' : 'A blank room is ready.',
        'success',
      );
    } catch {
      pushToast('The room is ready, but it could not be saved on this device yet.', 'info');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Welcome to RoomFit"
      description="Plan before you buy. Everything runs locally on this device."
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button variant="secondary" onClick={() => void start('sample')}>
            <Sparkles size={14} /> Explore a sample room
          </Button>
          <Button variant="primary" onClick={() => void start('blank')}>
            Start a blank room <ArrowRight size={14} />
          </Button>
        </>
      }
    >
      <div className={styles.hero}>
        <span className={styles.heroIcon}>
          <Sparkles size={18} />
        </span>
        <div>
          <p className={styles.heroTitle}>Real measurements. Honest answers.</p>
          <p className={styles.heroText}>
            RoomFit checks whether a piece physically fits, then tells you what still needs space —
            and why.
          </p>
        </div>
      </div>

      <div className={styles.steps}>
        {STEPS.map(({ Icon, title, text }, index) => (
          <div key={title} className={styles.step}>
            <span className={styles.stepIcon}>
              <Icon size={16} />
            </span>
            <div className={styles.stepText}>
              <span className={styles.stepTitle}>
                <span className={styles.stepIndex}>{index + 1}</span>
                {title}
              </span>
              <span className={styles.stepBody}>{text}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.callout}>
        <Info size={14} />
        <span>
          Projects autosave on this device. Export a JSON backup from the top bar at any time.
          Clearance values are configurable heuristics, not universal standards.
        </span>
      </div>
    </Modal>
  );
}
