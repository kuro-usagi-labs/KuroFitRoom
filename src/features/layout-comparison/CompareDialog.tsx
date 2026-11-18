import type { AnalysisResult } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatArea } from '@/engine/units';
import shared from '@/styles/shared.module.css';
import styles from './CompareDialog.module.css';

interface CompareSide {
  title: string;
  analysis: AnalysisResult;
}

interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
  left: CompareSide;
  right: CompareSide;
}

function metricRows(analysis: AnalysisResult) {
  const errors = analysis.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = analysis.issues.filter((issue) => issue.severity === 'warning').length;
  return [
    { label: 'Occupied area', value: formatArea(analysis.occupiedArea) },
    { label: 'Free floor', value: formatArea(analysis.freeArea) },
    { label: 'Physical conflicts', value: String(errors) },
    { label: 'Clearance warnings', value: String(warnings) },
  ];
}

export function CompareDialog({ open, onClose, left, right }: CompareDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare layouts"
      description="Both layouts are analysed against the same room, openings and clearance targets."
      width="lg"
    >
      <div className={styles.grid}>
        {[left, right].map((side, index) => {
          const rows = metricRows(side.analysis);
          const issues = side.analysis.issues.filter((issue) => issue.severity !== 'info');
          return (
            <div key={index} className={styles.column}>
              <div className={styles.head}>
                <span className={styles.title}>{side.title}</span>
                <StatusBadge status={side.analysis.status} size="sm" />
              </div>
              {rows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <span className={styles.label}>{row.label}</span>
                  <span className={styles.value}>{row.value}</span>
                </div>
              ))}
              <div className={styles.issues}>
                <p className={styles.issueHead}>
                  {issues.length === 0 ? 'No open issues' : `${issues.length} open issues`}
                </p>
                {issues.slice(0, 5).map((issue) => (
                  <p key={issue.id} className={shared.issueText}>
                    • {issue.title}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className={shared.sectionHint}>
        Smaller occupied area is not automatically better — the layout still has to support how you
        use the room.
      </p>
    </Modal>
  );
}
