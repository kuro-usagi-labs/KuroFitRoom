import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Box,
  Check,
  Info,
  Laptop,
  Package,
  RotateCw,
  Sparkles,
  Sofa,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  FurnitureCategory,
  FurnitureKind,
  FurnitureObject,
  Project,
} from '@/types';
import {
  candidateToObject,
  findPlacements,
  recommendSizes,
  type CandidateSpec,
  type PlacementCandidate,
  type SizeOption,
} from '@/engine/layout-search';
import { analyzeProject } from '@/engine/fit-analysis';
import { footprint } from '@/engine/geometry';
import { formatArea, formatLength, formatPercent } from '@/engine/units';
import { BED_SIZE_OPTIONS } from '@/features/furniture-library/catalog';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { pushToast } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';
import { NumberField, Toggle, TwoCol } from '@/components/ui/Controls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RoomLayer } from '@/features/floor-editor/RoomLayer';
import { FurnitureLayer } from '@/features/floor-editor/Overlays';
import styles from './QuickFit.module.css';

interface KindConfig {
  key: string;
  label: string;
  Icon: LucideIcon;
  kind: FurnitureKind;
  category: FurnitureCategory;
  color: string;
  name: string;
  sizes: SizeOption[];
}

const BED_SIZES: SizeOption[] = BED_SIZE_OPTIONS.map((option) => ({
  id: option.id,
  label: option.label,
  width: option.width,
  depth: option.depth,
}));

const KIND_CONFIGS: KindConfig[] = [
  {
    key: 'bed',
    label: 'Bed',
    Icon: BedDouble,
    kind: 'bed',
    category: 'Bedroom',
    color: '#F1ECE3',
    name: 'Bed',
    sizes: BED_SIZES,
  },
  {
    key: 'wardrobe',
    label: 'Wardrobe',
    Icon: Package,
    kind: 'wardrobe',
    category: 'Bedroom',
    color: '#A6B8A8',
    name: 'Wardrobe',
    sizes: [
      { id: 'w80', label: '80 cm', width: 800, depth: 600 },
      { id: 'w100', label: '100 cm', width: 1000, depth: 600 },
      { id: 'w120', label: '120 cm', width: 1200, depth: 600 },
      { id: 'w150', label: '150 cm', width: 1500, depth: 600 },
      { id: 'w180', label: '180 cm', width: 1800, depth: 600 },
    ],
  },
  {
    key: 'desk',
    label: 'Desk',
    Icon: Laptop,
    kind: 'desk',
    category: 'Office',
    color: '#DCC8AA',
    name: 'Desk',
    sizes: [
      { id: 'd100', label: '100 cm', width: 1000, depth: 600 },
      { id: 'd120', label: '120 cm', width: 1200, depth: 600 },
      { id: 'd140', label: '140 cm', width: 1400, depth: 600 },
      { id: 'd160', label: '160 cm', width: 1600, depth: 600 },
    ],
  },
  {
    key: 'sofa',
    label: 'Sofa',
    Icon: Sofa,
    kind: 'sofa',
    category: 'Living Room',
    color: '#A6B8A8',
    name: 'Sofa',
    sizes: [
      { id: 's160', label: '160 cm', width: 1600, depth: 850 },
      { id: 's180', label: '180 cm', width: 1800, depth: 850 },
      { id: 's200', label: '200 cm', width: 2000, depth: 850 },
      { id: 's220', label: '220 cm', width: 2200, depth: 850 },
    ],
  },
  {
    key: 'custom',
    label: 'Custom',
    Icon: Box,
    kind: 'custom',
    category: 'Custom',
    color: '#D7D9D2',
    name: 'Custom piece',
    sizes: [],
  },
];

const ROOM_PRESETS = [
  { label: '2.5 × 3 m', width: 2500, length: 3000 },
  { label: '3 × 3.5 m', width: 3000, length: 3500 },
  { label: '3 × 4 m', width: 3000, length: 4000 },
  { label: '4 × 5 m', width: 4000, length: 5000 },
];

const CUSTOM_WIDTHS = [600, 800, 1000, 1200, 1400, 1600];

const CANDIDATE_ID = 'candidate_preview';

function severityRank(level: 'error' | 'warning' | 'info'): number {
  return level === 'error' ? 0 : level === 'warning' ? 1 : 2;
}

interface FitPreviewProps {
  project: Project;
  furniture: FurnitureObject[];
  candidate: FurnitureObject | null;
  blockedDoorIds: Set<string>;
  errorIds: Set<string>;
  warningIds: Set<string>;
}

function FitPreview({
  project,
  furniture,
  candidate,
  blockedDoorIds,
  errorIds,
  warningIds,
}: FitPreviewProps) {
  const { width, length, wallThickness } = project.room;
  const maxDimension = Math.max(width, length, 1000);
  // Millimetres represented by one screen pixel at the fitted size.
  const mmPerPx = maxDimension / 620;
  const scale = 1 / mmPerPx;
  const dimensionOffset = 26 * mmPerPx;
  const pad = wallThickness + dimensionOffset + 58 * mmPerPx;
  const candidateRect = candidate ? footprint(candidate) : null;

  return (
    <svg
      className={styles.previewSvg}
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${length + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Preview of ${project.room.name}: ${furniture.length} objects placed`}
    >
      <RoomLayer
        project={{ ...project, settings: { ...project.settings, showGrid: true } }}
        scale={scale}
        blockedDoorIds={blockedDoorIds}
        selectedOpeningId={null}
      />
      <FurnitureLayer
        furniture={furniture}
        scale={scale}
        selectedId={null}
        errorIds={errorIds}
        warningIds={warningIds}
        blockedIds={new Set()}
        onPointerDownObject={() => undefined}
      />
      {candidate && candidateRect ? (
        <g pointerEvents="none">
          <rect
            x={candidateRect.x1 - 4 * mmPerPx}
            y={candidateRect.y1 - 4 * mmPerPx}
            width={candidateRect.x2 - candidateRect.x1 + 8 * mmPerPx}
            height={candidateRect.y2 - candidateRect.y1 + 8 * mmPerPx}
            rx={4 * mmPerPx}
            fill="rgba(40, 83, 67, 0.06)"
            stroke="var(--primary)"
            strokeWidth={2.2 * mmPerPx}
          />
          <g transform={`translate(${candidateRect.x1} ${candidateRect.y1 - 16 * mmPerPx})`}>
            <rect
              x={0}
              y={-12 * mmPerPx}
              width={92 * mmPerPx}
              height={17 * mmPerPx}
              rx={3 * mmPerPx}
              fill="var(--primary)"
            />
            <text
              x={7 * mmPerPx}
              y={-3.2 * mmPerPx}
              fontSize={9 * mmPerPx}
              fontWeight={600}
              fill="#ffffff"
            >
              Proposed position
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

export function QuickFit() {
  const project = useProjectStore((state) => state.project);
  const applyQuickFit = useProjectStore((state) => state.applyQuickFit);
  const setMode = useEditorStore((state) => state.setMode);
  const selectFurniture = useEditorStore((state) => state.selectFurniture);
  const requestFit = useEditorStore((state) => state.requestFit);
  const unit = project.settings.unit;

  const [kindKey, setKindKey] = useState('bed');
  const [width, setWidth] = useState(BED_SIZES[2]?.width ?? 1600);
  const [depth, setDepth] = useState(BED_SIZES[2]?.depth ?? 2000);
  const [roomWidth, setRoomWidth] = useState(project.room.width);
  const [roomLength, setRoomLength] = useState(project.room.length);
  // Starting from an empty room gives first-time users a result instead of a
  // conflict with the sample furniture. Keeping existing pieces stays opt-in.
  const [includeExisting, setIncludeExisting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const config = KIND_CONFIGS.find((item) => item.key === kindKey) ?? KIND_CONFIGS[0];
  const activeSize = config.sizes.find(
    (option) => option.width === width && option.depth === depth,
  );

  useEffect(() => {
    setRoomWidth(project.room.width);
    setRoomLength(project.room.length);
  }, [project.id, project.room.width, project.room.length]);

  const handleKind = (next: KindConfig) => {
    setKindKey(next.key);
    const first = next.sizes[0];
    if (first) {
      setWidth(first.width);
      setDepth(first.depth);
    }
    setSelectedIndex(0);
  };

  const handleSize = (option: SizeOption) => {
    setWidth(option.width);
    setDepth(option.depth);
    setSelectedIndex(0);
  };

  const spec: CandidateSpec = useMemo(
    () => ({
      name:
        config.key === 'bed'
          ? `${activeSize?.label ?? 'Custom'} bed`
          : config.name,
      kind: config.kind,
      category: config.category,
      width,
      depth,
      color: config.color,
    }),
    [config, activeSize, width, depth],
  );

  const previewProject: Project = useMemo(
    () => ({
      ...project,
      room: { ...project.room, width: roomWidth, length: roomLength },
      furniture: includeExisting ? project.furniture : [],
    }),
    [project, roomWidth, roomLength, includeExisting],
  );

  const result = useMemo(
    () =>
      findPlacements(previewProject, spec, {
        maxResults: 24,
        gridStep: 100,
      }),
    [previewProject, spec],
  );

  const alternatives = useMemo(() => {
    const chosen: PlacementCandidate[] = [];
    for (const candidate of result.candidates) {
      if (
        chosen.some(
          (existing) => Math.hypot(existing.x - candidate.x, existing.y - candidate.y) < 160,
        )
      ) {
        continue;
      }
      chosen.push(candidate);
      if (chosen.length >= 4) break;
    }
    return chosen;
  }, [result]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [alternatives]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, alternatives.length - 1));
  const selected = alternatives[safeIndex] ?? null;

  const selectedObject: FurnitureObject | null = useMemo(
    () => (selected ? candidateToObject(spec, selected, CANDIDATE_ID) : null),
    [selected, spec],
  );

  const previewFurniture = useMemo(
    () =>
      selectedObject
        ? [...previewProject.furniture, selectedObject]
        : previewProject.furniture,
    [previewProject.furniture, selectedObject],
  );

  const selectedAnalysis = useMemo(
    () => analyzeProject({ ...previewProject, furniture: previewFurniture }),
    [previewProject, previewFurniture],
  );

  const blockedDoorIds = new Set(
    selectedAnalysis.doorChecks.filter((check) => check.blocked).map((check) => check.openingId),
  );
  const errorIds = new Set<string>();
  const warningIds = new Set<string>();
  for (const issue of selectedAnalysis.issues) {
    if (issue.severity === 'error') issue.objectIds.forEach((id) => errorIds.add(id));
    if (issue.severity === 'warning') issue.objectIds.forEach((id) => warningIds.add(id));
  }

  const reasons = [...selectedAnalysis.issues]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 4);

  const sizeOptions: SizeOption[] = useMemo(() => {
    if (config.sizes.length > 0) return config.sizes;
    return CUSTOM_WIDTHS.map((value) => ({
      id: `custom-${value}`,
      label: `${formatLength(value, unit)} wide`,
      width: value,
      depth,
    }));
  }, [config.sizes, depth, unit]);

  const recommendations = useMemo(
    () =>
      recommendSizes(
        previewProject,
        {
          name: spec.name,
          kind: spec.kind,
          category: spec.category,
          color: spec.color,
        },
        sizeOptions,
      ),
    [previewProject, spec, sizeOptions],
  );

  const canApply = Boolean(selected && selectedObject);
  const rotationsTested = result.evaluated > 0;

  const handleApply = () => {
    if (!selected) return;
    const object = candidateToObject(spec, selected);
    applyQuickFit({
      width: roomWidth,
      length: roomLength,
      keepExisting: includeExisting,
      object,
    });
    selectFurniture(object.id);
    setMode('designer');
    requestFit();
    pushToast(
      includeExisting
        ? `${spec.name} placed. Review the whole room in Designer.`
        : `${spec.name} placed in a cleared room. Review it in Designer.`,
      'success',
    );
  };

  return (
    <div className={styles.root}>
      <aside className={styles.config} aria-label="Quick Fit settings">
        <div className={styles.configHead}>
          <span className={styles.eyebrow}>
            <Sparkles size={12} /> Quick Fit
          </span>
          <h1 className={styles.heading}>Can it fit?</h1>
          <p className={styles.sub}>
            Enter the real room and the piece you are considering. RoomFit searches for a valid
            position and explains every result.
          </p>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Room to fill</h2>
            <span className={styles.areaHint}>{formatArea(roomWidth * roomLength)}</span>
          </div>
          <TwoCol>
            <NumberField
              label="Width"
              value={roomWidth}
              unit={unit}
              min={1500}
              max={15000}
              onChange={setRoomWidth}
            />
            <NumberField
              label="Length"
              value={roomLength}
              unit={unit}
              min={1500}
              max={15000}
              onChange={setRoomLength}
            />
          </TwoCol>
          <div className={styles.chips}>
            {ROOM_PRESETS.map((preset) => {
              const active = roomWidth === preset.width && roomLength === preset.length;
              return (
                <button
                  key={preset.label}
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  onClick={() => {
                    setRoomWidth(preset.width);
                    setRoomLength(preset.length);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <p className={styles.note}>
            Uses the inner clear size. The room changes are applied only when you open the result in
            Designer.
          </p>
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Furniture</h2>
          <div className={styles.kindGrid}>
            {KIND_CONFIGS.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`${styles.kindButton} ${kindKey === key ? styles.kindActive : ''}`}
                onClick={() => handleKind(KIND_CONFIGS.find((item) => item.key === key) ?? config)}
                aria-pressed={kindKey === key}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {config.sizes.length > 0 ? (
            <div className={styles.chips}>
              {config.sizes.map((option) => {
                const active = option.width === width && option.depth === depth;
                return (
                  <button
                    key={option.id}
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                    onClick={() => handleSize(option)}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <TwoCol>
            <NumberField
              label="Width"
              value={width}
              unit={unit}
              min={100}
              max={10000}
              onChange={setWidth}
            />
            <NumberField
              label="Depth"
              value={depth}
              unit={unit}
              min={100}
              max={10000}
              onChange={setDepth}
            />
          </TwoCol>
          <p className={styles.note}>
            Measure the actual frame, not the mattress label. Clearances are configurable heuristics.
          </p>
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Search options</h2>
          <Toggle
            title="Place around existing furniture"
            hint={
              includeExisting
                ? `${project.furniture.length} object${
                    project.furniture.length === 1 ? '' : 's'
                  } stay in the room`
                : 'Current furniture is ignored and replaced when applied'
            }
            checked={includeExisting}
            onChange={setIncludeExisting}
          />
          <div className={`${styles.callout} ${styles.calloutInfo}`}>
            <Info size={14} />
            <span>
              Door swings are checked automatically. The search samples positions on a 10 cm grid;
              finding none is not proof that the piece cannot fit.
            </span>
          </div>
        </section>

        <div className={styles.configFoot}>
          <Button variant="ghost" size="sm" block onClick={() => setMode('designer')}>
            <ArrowLeft size={14} /> Back to Designer
          </Button>
        </div>
      </aside>

      <main className={styles.preview} aria-label="Placement preview">
        <div className={styles.previewHead}>
          <div>
            <h2 className={styles.previewTitle}>{spec.name}</h2>
            <p className={styles.previewMeta}>
              {formatLength(width, unit)} × {formatLength(depth, unit)} ·{' '}
              {formatArea(width * depth)} footprint
            </p>
          </div>
          {selected ? <StatusBadge status={selectedAnalysis.status} size="sm" /> : null}
        </div>

        <div className={styles.canvasWrap}>
          <FitPreview
            project={previewProject}
            furniture={previewFurniture}
            candidate={selectedObject}
            blockedDoorIds={blockedDoorIds}
            errorIds={errorIds}
            warningIds={warningIds}
          />

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendExisting}`} /> Existing
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendProposed}`} /> Proposed
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDoor}`} /> Door swing
            </span>
          </div>

          {!selected ? (
            <div className={styles.previewEmpty}>
              <span className={styles.emptyIcon}>
                <Box size={18} />
              </span>
              <div>
                <p className={styles.emptyTitle}>No placement found</p>
                <p className={styles.emptyText}>{result.note}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.alternatives}>
          <div className={styles.altHead}>
            <h3 className={styles.altTitle}>Alternatives</h3>
            <span className={styles.altMeta}>
              {rotationsTested
                ? `${result.evaluated.toLocaleString()} positions sampled`
                : 'No sampled positions'}
            </span>
          </div>
          {alternatives.length > 0 ? (
            <div className={styles.altList}>
              {alternatives.map((candidate, index) => {
                const active = index === safeIndex;
                return (
                  <button
                    key={`${candidate.x}-${candidate.y}-${candidate.rotation}`}
                    className={`${styles.altCard} ${active ? styles.altActive : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    aria-pressed={active}
                  >
                    <span className={styles.altTop}>
                      <span className={styles.altIndex}>{index === 0 ? 'Best' : index + 1}</span>
                      {active ? <Check size={13} /> : null}
                    </span>
                    <span className={styles.altPos}>
                      {formatLength(candidate.x, unit)} from left
                      <br />
                      {formatLength(candidate.y, unit)} from top
                    </span>
                    <span className={styles.altTags}>
                      <span className={styles.altTag}>
                        <RotateCw size={10} /> {candidate.rotation}°
                      </span>
                      {candidate.touchesWall ? <span className={styles.altTag}>wall</span> : null}
                      {candidate.blockedDoor ? (
                        <span className={`${styles.altTag} ${styles.altTagWarn}`}>door</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.note}>
              Try a smaller size or turn the piece. The grid search is heuristic and can miss
              unusual layouts.
            </p>
          )}
        </div>
      </main>

      <aside className={styles.results} aria-label="Fit result">
        <div className={styles.resultsScroll}>
          <div className={styles.resultHead}>
            <span className={styles.eyebrow}>Fit analysis</span>
            <h2 className={styles.resultTitle}>
              {selected ? selectedAnalysis.statusLabel : 'No sampled placement'}
            </h2>
            <p className={styles.resultSummary}>
              {selected
                ? selectedAnalysis.summary
                : 'No valid position was found in the sampled grid. This is not proof the piece cannot fit.'}
            </p>
          </div>

          {selected ? (
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Position</span>
                <span className={styles.statValue}>
                  {formatLength(selected.x, unit)} · {formatLength(selected.y, unit)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Rotation</span>
                <span className={styles.statValue}>{selected.rotation}°</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Free floor</span>
                <span className={styles.statValue}>{formatArea(selectedAnalysis.freeArea)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Coverage</span>
                <span className={styles.statValue}>
                  {formatPercent(selectedAnalysis.occupancyPct)}
                </span>
              </div>
            </div>
          ) : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Why this result</h3>
              <span className={styles.countHint}>
                {selectedAnalysis.issues.length} note{selectedAnalysis.issues.length === 1 ? '' : 's'}
              </span>
            </div>

            {selectedAnalysis.status === 'comfortable' &&
            selectedAnalysis.clearanceChecks.length > 0 ? (
              <div className={`${styles.callout} ${styles.calloutSuccess}`}>
                <Check size={14} />
                <span>
                  All {selectedAnalysis.clearanceChecks.length} checked clearance zone
                  {selectedAnalysis.clearanceChecks.length === 1 ? '' : 's'} meet the current
                  targets.
                </span>
              </div>
            ) : null}

            {reasons.length > 0 ? (
              <div className={styles.reasonList}>
                {reasons.map((issue) => (
                  <div
                    key={issue.id}
                    className={`${styles.reason} ${
                      issue.severity === 'error'
                        ? styles.reasonError
                        : issue.severity === 'warning'
                          ? styles.reasonWarning
                          : styles.reasonInfo
                    }`}
                  >
                    <span className={styles.reasonDot} />
                    <div>
                      <p className={styles.reasonTitle}>{issue.title}</p>
                      <p className={styles.reasonText}>{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.note}>No issues were detected for this placement.</p>
            )}

            {selectedAnalysis.issues.length > reasons.length ? (
              <p className={styles.note}>
                +{selectedAnalysis.issues.length - reasons.length} more notes in the full analysis.
              </p>
            ) : null}
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Size comparison</h3>
              <span className={styles.countHint}>Same orientation set</span>
            </div>
            <div className={styles.sizeList}>
              {recommendations.map((recommendation) => {
                const active =
                  recommendation.option.width === width && recommendation.option.depth === depth;
                const status = recommendation.analysis?.status;
                return (
                  <button
                    key={recommendation.option.id}
                    className={`${styles.sizeRow} ${active ? styles.sizeActive : ''}`}
                    onClick={() => handleSize(recommendation.option)}
                    aria-pressed={active}
                  >
                    <span className={styles.sizeText}>
                      <span className={styles.sizeLabel}>{recommendation.option.label}</span>
                      <span className={styles.sizeDims}>
                        {formatLength(recommendation.option.width, unit)} ×{' '}
                        {formatLength(recommendation.option.depth, unit)}
                      </span>
                    </span>
                    {recommendation.fits && status ? (
                      <StatusBadge
                        status={status}
                        label={
                          status === 'comfortable'
                            ? 'Fits'
                            : status === 'tight'
                              ? 'Tight'
                              : status === 'no-fit'
                                ? 'Conflicts'
                                : 'Review'
                        }
                        size="sm"
                        showIcon={false}
                      />
                    ) : (
                      <span className={styles.noFit}>No position</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.note}>
              Each size is tested with the same room and existing furniture. A result describes the
              sampled positions, not a guarantee.
            </p>
          </section>
        </div>

        <div className={styles.applyBar}>
          <Button variant="primary" block onClick={handleApply} disabled={!canApply}>
            Open in Designer <ArrowRight size={15} />
          </Button>
          <p className={styles.applyNote}>
            {canApply
              ? includeExisting
                ? 'Adds the piece and keeps the current furniture.'
                : 'Replaces the current furniture with this piece.'
              : 'Choose a placement first.'}
          </p>
        </div>
      </aside>
    </div>
  );
}
