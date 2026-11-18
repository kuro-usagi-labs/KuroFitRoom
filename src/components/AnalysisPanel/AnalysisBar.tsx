import { useState } from 'react';
import { ChevronUp, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useProjectAnalysis } from '@/hooks/useAnalysis';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { formatArea, formatPercent } from '@/engine/units';
import { StatusBadge } from '@/components/ui/StatusBadge';
import styles from './AnalysisBar.module.css';

export function AnalysisBar() {
  const analysis = useProjectAnalysis();
  const unit = useProjectStore((state) => state.project.settings.unit);
  const selectFurniture = useEditorStore((state) => state.selectFurniture);
  const setPanel = useEditorStore((state) => state.setPanel);
  const [expanded, setExpanded] = useState(false);

  const errors = analysis.issues.filter((issue) => issue.severity === 'error');
  const warnings = analysis.issues.filter((issue) => issue.severity === 'warning');
  const notes = analysis.issues.filter((issue) => issue.severity === 'info');

  return (
    <>
      {expanded ? (
        <div className={styles.drawer}>
          <div className={styles.drawerHead}>
            <div>
              <h3 className={styles.drawerTitle}>Analysis details</h3>
              <p className={styles.drawerSub}>
                {analysis.statusLabel} · {analysis.objectCount} objects ·{' '}
                {formatPercent(analysis.occupancyPct)} coverage
              </p>
            </div>
            <button className={styles.iconClose} onClick={() => setExpanded(false)} aria-label="Close details">
              <X size={15} />
            </button>
          </div>
          <div className={styles.drawerBody}>
            {analysis.issues.length === 0 ? (
              <p className={styles.emptyNote}>No issues to report.</p>
            ) : (
              analysis.issues.map((issue) => {
                const Icon =
                  issue.severity === 'error'
                    ? AlertCircle
                    : issue.severity === 'warning'
                      ? AlertTriangle
                      : Info;
                return (
                  <div key={issue.id} className={styles.issueRow}>
                    <Icon
                      size={15}
                      className={
                        issue.severity === 'error'
                          ? styles.errorIcon
                          : issue.severity === 'warning'
                            ? styles.warningIcon
                            : styles.infoIcon
                      }
                    />
                    <div className={styles.issueText}>
                      <span className={styles.issueTitle}>{issue.title}</span>
                      <span className={styles.issueMessage}>{issue.message}</span>
                      {issue.measurements.length > 0 ? (
                        <span className={styles.issueMeta}>
                          {issue.measurements
                            .map((m) => `${m.label}: ${Math.round(m.value)} mm`)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </div>
                    {issue.objectIds.length > 0 ? (
                      <button
                        className={styles.locate}
                        onClick={() => selectFurniture(issue.objectIds[0])}
                      >
                        Show
                      </button>
                    ) : issue.category === 'review' ? (
                      <button className={styles.locate} onClick={() => setPanel('openings')}>
                        Fix
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
            <p className={styles.footnote}>
              Clearance values are configurable heuristics. Measurements use inner room dimensions in
              millimetres internally and display in {unit}.
            </p>
          </div>
        </div>
      ) : null}

      <div className={styles.bar}>
        <div className={styles.statusGroup}>
          <StatusBadge status={analysis.status} size="sm" />
          <span className={styles.summary} title={analysis.summary}>
            {analysis.summary}
          </span>
        </div>

        <div className={styles.metrics}>
          <span className={styles.metric}>
            <span className={styles.metricLabel}>Room</span>
            <span className={styles.metricValue}>{formatArea(analysis.roomArea)}</span>
          </span>
          <span className={styles.metric}>
            <span className={styles.metricLabel}>Used</span>
            <span className={styles.metricValue}>{formatArea(analysis.occupiedArea)}</span>
          </span>
          <span className={styles.metric}>
            <span className={styles.metricLabel}>Free</span>
            <span className={styles.metricValue}>{formatArea(analysis.freeArea)}</span>
          </span>
          <span className={styles.metric}>
            <span className={styles.metricLabel}>Collisions</span>
            <span className={`${styles.metricValue} ${errors.length ? styles.metricBad : ''}`}>
              {analysis.collisions.length}
            </span>
          </span>
          <span className={styles.metric}>
            <span className={styles.metricLabel}>Warnings</span>
            <span className={`${styles.metricValue} ${warnings.length ? styles.metricWarn : ''}`}>
              {warnings.length}
            </span>
          </span>
        </div>

        <button className={styles.expand} onClick={() => setExpanded((value) => !value)}>
          {warnings.length + errors.length + notes.length} notes
          <ChevronUp
            size={14}
            style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
          />
        </button>
      </div>
    </>
  );
}
