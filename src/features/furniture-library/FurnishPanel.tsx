import { useMemo, useState } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import type { FurnitureCategory, Unit } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';
import { CATEGORY_ORDER, FURNITURE_COLORS, FURNITURE_PRESETS } from './catalog';
import { FurnitureThumb } from './FurnitureThumb';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { NumberField, TextField, TwoCol } from '@/components/ui/Controls';
import { formatLength, formatNumber } from '@/engine/units';
import { pushToast } from '@/store/toastStore';
import shared from '@/styles/shared.module.css';

type CategoryFilter = FurnitureCategory | 'All';

export function FurnishPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('Custom furniture');
  const [customWidth, setCustomWidth] = useState(1000);
  const [customDepth, setCustomDepth] = useState(600);
  const [customColor, setCustomColor] = useState(FURNITURE_COLORS.oak);

  const unit = useProjectStore((state) => state.project.settings.unit);
  const addFurniture = useProjectStore((state) => state.addFurniture);
  const selectFurniture = useEditorStore((state) => state.selectFurniture);

  const presets = useMemo(() => {
    const search = query.trim().toLowerCase();
    return FURNITURE_PRESETS.filter((preset) => {
      if (category !== 'All' && preset.category !== category) return false;
      if (!search) return true;
      return (
        preset.name.toLowerCase().includes(search) ||
        preset.category.toLowerCase().includes(search)
      );
    });
  }, [query, category]);

  const handleAddPreset = (key: string) => {
    const preset = FURNITURE_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    const object = addFurniture({
      name: preset.name,
      kind: preset.kind,
      category: preset.category,
      width: preset.width,
      depth: preset.depth,
      color: preset.color,
    });
    selectFurniture(object.id);
    pushToast(`${preset.name} added — drag it into position.`, 'success');
  };

  const handleAddCustom = () => {
    if (customWidth < 100 || customDepth < 100) {
      pushToast('Custom furniture must be at least 10 × 10 cm.', 'error');
      return;
    }
    const object = addFurniture({
      name: customName.trim() || 'Custom furniture',
      kind: 'custom',
      category: 'Custom',
      width: customWidth,
      depth: customDepth,
      color: customColor,
    });
    selectFurniture(object.id);
    setCustomOpen(false);
    pushToast('Custom furniture added.', 'success');
  };

  return (
    <div className={shared.panel}>
      <div className={shared.searchWrap}>
        <Search size={14} className={shared.searchIcon} />
        <input
          className={shared.searchInput}
          placeholder="Search furniture…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search furniture"
        />
      </div>

      <div className={shared.chips}>
        {(['All', ...CATEGORY_ORDER] as CategoryFilter[]).map((item) => (
          <button
            key={item}
            className={`${shared.chip} ${category === item ? shared.chipActive : ''}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {presets.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {presets.map((preset) => (
            <button
              key={preset.key}
              className={shared.thumbCard}
              onClick={() => handleAddPreset(preset.key)}
              title={`Add ${preset.name}`}
            >
              <div className={shared.thumbCanvas}>
                <div style={{ width: '78%', height: '78%' }}>
                  <FurnitureThumb
                    width={preset.width}
                    depth={preset.depth}
                    kind={preset.kind}
                    color={preset.color}
                  />
                </div>
                <span className={shared.thumbAdd}>
                  <Plus size={13} />
                </span>
              </div>
              <span className={shared.thumbBody}>
                <span className={shared.thumbTitle}>{preset.name}</span>
                <span className={shared.thumbMeta}>
                  {formatLength(preset.width, unit)} × {formatLength(preset.depth, unit)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={shared.empty}>
          <span className={shared.emptyTitle}>No furniture matches</span>
          <span className={shared.emptyText}>Try another name or category.</span>
        </div>
      )}

      <div className={shared.section}>
        <div className={shared.sectionHeader}>
          <h3 className={shared.sectionTitle}>Something else?</h3>
        </div>
        <Button variant="secondary" size="sm" block onClick={() => setCustomOpen(true)}>
          <Sparkles size={14} />
          Create custom furniture
        </Button>
        <p className={shared.sectionHint}>
          Sizes are editable at any time. A bed preset uses a typical mattress size — adjust it to
          match the real frame.
        </p>
      </div>

      <Modal
        open={customOpen}
        title="Custom furniture"
        description="Create an object with its real footprint. You can rename and resize it later."
        onClose={() => setCustomOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddCustom}>
              Add to room
            </Button>
          </>
        }
      >
        <TextField label="Name" value={customName} onChange={setCustomName} maxLength={48} />
        <TwoCol>
          <NumberField
            label="Width"
            value={customWidth}
            unit={unit}
            min={100}
            max={8000}
            onChange={setCustomWidth}
          />
          <NumberField
            label="Depth"
            value={customDepth}
            unit={unit}
            min={100}
            max={8000}
            onChange={setCustomDepth}
          />
        </TwoCol>
        <div>
          <p className={shared.sectionTitle} style={{ marginBottom: 7 }}>
            Finish
          </p>
          <div className={shared.colorRow}>
            {Object.entries(FURNITURE_COLORS).map(([key, color]) => (
              <button
                key={key}
                className={`${shared.colorSwatch} ${customColor === color ? shared.colorSwatchActive : ''}`}
                style={{ background: color }}
                aria-label={`Use ${key} finish`}
                aria-pressed={customColor === color}
                onClick={() => setCustomColor(color)}
              />
            ))}
          </div>
        </div>
        <p className={shared.sectionHint}>
          Footprint: {formatNumber(customWidth, unit as Unit)} × {formatNumber(customDepth, unit as Unit)}{' '}
          {unit}
        </p>
      </Modal>
    </div>
  );
}
