import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  GridCellKind,
  getMiddleCenterBias,
  measureTextCached,
  roundedRect,
  type CustomCell,
  type CustomRenderer,
  type ProvideEditorComponent,
} from '@glideapps/glide-data-grid';
import { Check } from 'iconoir-react';

export type DropdownTone = 'neutral' | 'slate' | 'emerald' | 'amber' | 'blue' | 'purple';

export interface DropdownCellOption {
  value: string;
  label: string;
  description?: string;
  tone?: DropdownTone;
}

export interface DropdownCellData {
  readonly kind: 'valid-ex-dropdown';
  readonly value: string;
  readonly options: readonly DropdownCellOption[];
  readonly placeholder?: string;
  readonly emptyMessage?: string;
  readonly ariaLabel: string;
  readonly warnIfUnlisted?: boolean;
}

export type GridDropdownCell = CustomCell<DropdownCellData>;

const TONE_PALETTE: Record<DropdownTone, { fill: string; border: string; text: string }> = {
  neutral: { fill: '#f1f5f9', border: '#cbd5e1', text: '#0f172a' },
  slate: { fill: '#f1f5f9', border: '#cbd5e1', text: '#334155' },
  emerald: { fill: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  amber: { fill: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  blue: { fill: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  purple: { fill: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
};

function findInitialHighlight(
  options: readonly DropdownCellOption[],
  currentValue: string,
  initialValue?: string,
): number {
  if (options.length === 0) return -1;

  if (initialValue && initialValue.trim().length > 0) {
    const needle = initialValue.trim().toLowerCase();
    const typedIndex = options.findIndex(
      (opt) =>
        opt.value.toLowerCase().startsWith(needle) || opt.label.toLowerCase().startsWith(needle),
    );
    if (typedIndex >= 0) return typedIndex;
  }

  const activeIndex = options.findIndex((opt) => opt.value === currentValue);
  return activeIndex >= 0 ? activeIndex : 0;
}

const DropdownCellEditor: ProvideEditorComponent<GridDropdownCell> = ({
  value,
  initialValue,
  onFinishedEditing,
}) => {
  const { data } = value;
  const { options } = data;
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    findInitialHighlight(options, data.value, initialValue),
  );

  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    listboxRef.current?.focus();
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const commitOption = (optValue: string, movement: readonly [-1 | 0 | 1, -1 | 0 | 1] = [0, 0]) => {
    onFinishedEditing(
      {
        ...value,
        copyData: optValue,
        data: {
          ...data,
          value: optValue,
        },
      },
      movement,
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onFinishedEditing(undefined, [0, 0]);
      return;
    }

    if (options.length === 0) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onFinishedEditing(undefined, [0, 0]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev) => (prev + 1) % options.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex(options.length - 1);
      return;
    }

    // Stop propagation so DataGridOverlayEditor wrapper does not commit stale tempValue on Enter.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const target = options[highlightedIndex];
      if (target) {
        commitOption(target.value, [0, 0]);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const target = options[highlightedIndex];
      if (target) {
        commitOption(target.value, [e.shiftKey ? -1 : 1, 0]);
      } else {
        onFinishedEditing(undefined, [e.shiftKey ? -1 : 1, 0]);
      }
    }
  };

  return (
    <div
      ref={listboxRef}
      role="listbox"
      tabIndex={0}
      aria-label={data.ariaLabel}
      onKeyDown={handleKeyDown}
      className="min-w-[220px] max-w-[320px] max-h-[240px] overflow-y-auto bg-white border border-slate-500 rounded-md shadow-lg p-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      {options.length === 0 ? (
        <div className="px-3 py-2.5 text-slate-700 space-y-1.5">
          <p className="font-medium text-slate-900">No options available</p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {data.emptyMessage ?? 'Add a sample row in the Sample Table first.'}
          </p>
        </div>
      ) : (
        options.map((opt, idx) => {
          const isSelected = opt.value === data.value;
          const isHighlighted = idx === highlightedIndex;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => commitOption(opt.value, [0, 0])}
              className={`w-full text-left px-2.5 py-2 rounded flex items-start justify-between gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 ${
                isHighlighted ? 'bg-slate-100 text-slate-900' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <div className="font-mono font-semibold text-xs text-slate-900 truncate">
                  {opt.label}
                </div>
                {opt.description && (
                  <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                    {opt.description}
                  </div>
                )}
              </div>
              {isSelected && (
                <Check
                  className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })
      )}
    </div>
  );
};

export const gridDropdownRenderer: CustomRenderer<GridDropdownCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is GridDropdownCell =>
    cell.kind === GridCellKind.Custom &&
    (cell.data as Partial<DropdownCellData> | undefined)?.kind === 'valid-ex-dropdown',
  draw: (args, cell) => {
    const { ctx, rect, theme } = args;
    const { value, options, placeholder, warnIfUnlisted } = cell.data;
    const matched = options.find((opt) => opt.value === value);
    const isUnlistedWarning = Boolean(warnIfUnlisted && value && !matched);

    const padX = theme.cellHorizontalPadding;
    const arrowReserve = 18;
    const maxTextWidth = Math.max(20, rect.width - padX * 2 - arrowReserve);

    ctx.save();
    ctx.font = theme.baseFontFull;
    const centerY = rect.y + rect.height / 2;

    if (matched && matched.tone) {
      const palette = TONE_PALETTE[matched.tone];
      const textWidth = Math.min(
        maxTextWidth,
        measureTextCached(matched.label, ctx, theme.baseFontFull).width,
      );
      const pillPadX = 7;
      const pillWidth = Math.min(rect.width - padX * 2 - arrowReserve, textWidth + pillPadX * 2);
      const pillHeight = Math.min(rect.height - 8, 22);
      const pillX = rect.x + padX;
      const pillY = centerY - pillHeight / 2;

      ctx.beginPath();
      roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 4);
      ctx.fillStyle = palette.fill;
      ctx.fill();
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = palette.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        matched.label,
        pillX + pillPadX,
        centerY + getMiddleCenterBias(ctx, theme.baseFontFull),
        Math.max(10, pillWidth - pillPadX * 2),
      );
    } else if (isUnlistedWarning) {
      const palette = TONE_PALETTE.amber;
      const warningText = `! ${value}`;
      const pillWidth = Math.min(
        rect.width - padX * 2 - arrowReserve,
        measureTextCached(warningText, ctx, theme.baseFontFull).width + 14,
      );
      const pillHeight = Math.min(rect.height - 8, 22);
      const pillX = rect.x + padX;
      const pillY = centerY - pillHeight / 2;

      ctx.beginPath();
      roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 4);
      ctx.fillStyle = palette.fill;
      ctx.fill();
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = palette.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        warningText,
        pillX + 7,
        centerY + getMiddleCenterBias(ctx, theme.baseFontFull),
        Math.max(10, pillWidth - 14),
      );
    } else {
      const displayText = matched?.label || value || placeholder || 'Select...';
      ctx.fillStyle = value ? theme.textDark : '#475569';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        displayText,
        rect.x + padX,
        centerY + getMiddleCenterBias(ctx, theme.baseFontFull),
        maxTextWidth,
      );
    }

    // Draw dropdown chevron cue on the trailing edge of the cell.
    const chevronX = rect.x + rect.width - padX - 6;
    const chevronY = centerY - 1.5;
    ctx.beginPath();
    ctx.moveTo(chevronX - 4, chevronY);
    ctx.lineTo(chevronX, chevronY + 4);
    ctx.lineTo(chevronX + 4, chevronY);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  },
  provideEditor: () => ({
    editor: DropdownCellEditor,
    disablePadding: true,
    disableStyling: true,
  }),
  onPaste: (val, cellData) => {
    const clean = val.trim();
    const matched = cellData.options.find((opt) => opt.value.toLowerCase() === clean.toLowerCase());
    if (!matched) return undefined;
    return {
      ...cellData,
      value: matched.value,
    };
  },
};
