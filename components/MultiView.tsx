'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { computeLeaderboard } from '@/lib/leaderboard';
import { teamColor } from '@/lib/teamColors';
import type { ParsedSheet, SortDirection } from '@/types/leaderboard';

interface PanelConfig {
  id: string;
  metric: string;
  positions: string[];
  sortDirection: SortDirection;
}

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function defaultPanel(metric: string): PanelConfig {
  return { id: uid(), metric, positions: [], sortDirection: 'highest' };
}

// ── Position multi-select ────────────────────────────────────────────────────

function PositionPicker({ selected, options, onChange }: {
  selected: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = selected.length === 0 ? 'All positions'
    : selected.length === 1 ? selected[0]
    : `${selected.length} positions`;

  function toggle(pos: string) {
    onChange(selected.includes(pos) ? selected.filter(p => p !== pos) : [...selected, pos]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs border border-bip-border bg-bip-bg text-bip-text px-2 py-1 rounded hover:border-bip-accent/60 transition-colors whitespace-nowrap"
      >
        {label}
        <span className="text-bip-muted text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bip-surface border border-bip-border rounded-lg p-2 z-20 min-w-44 space-y-0.5 shadow-xl">
          <label className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-bip-panel/60 text-xs text-bip-text">
            <input type="checkbox" className="accent-[#38bdf8]" checked={selected.length === 0} onChange={() => onChange([])} />
            All positions
          </label>
          <div className="border-t border-bip-border/40 my-1" />
          {options.map(pos => (
            <label key={pos} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-bip-panel/60 text-xs text-bip-text">
              <input type="checkbox" className="accent-[#38bdf8]" checked={selected.includes(pos)} onChange={() => toggle(pos)} />
              {pos}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rank styling helpers ─────────────────────────────────────────────────────

const rankStyle: Record<number, { border: string; bg: string; glow: string; number: string; name: string; value: string; bar: string }> = {
  1: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/[0.04]', glow: 'rank-1-glow', number: 'text-yellow-400', name: 'text-yellow-100', value: 'text-yellow-400', bar: 'bg-bip-accent' },
  2: { border: 'border-slate-400/50',  bg: 'bg-slate-400/[0.04]',  glow: 'rank-2-glow', number: 'text-slate-300',  name: 'text-bip-text',   value: 'text-bip-accent', bar: 'bg-bip-accent/80' },
  3: { border: 'border-amber-700/50',  bg: 'bg-amber-700/[0.04]',  glow: 'rank-3-glow', number: 'text-amber-600',  name: 'text-bip-text',   value: 'text-bip-accent', bar: 'bg-bip-accent/65' },
};
const defaultStyle = { border: 'border-bip-border/30', bg: 'bg-bip-surface', glow: '', number: 'text-bip-border', name: 'text-bip-text', value: 'text-bip-accent', bar: 'bg-bip-accent/45' };

// ── Single panel ─────────────────────────────────────────────────────────────

function Panel({ config, entries, metricColumns, allPositions, regions, rankChanges, canRemove, glowDelay, onUpdate, onRemove }: {
  config: PanelConfig;
  entries: { rank: number; name: string; region: string; value: number }[];
  metricColumns: string[];
  allPositions: string[];
  regions: string[];
  rankChanges: Map<string, 'up' | 'down'>;
  canRemove: boolean;
  glowDelay: string;
  onUpdate: (patch: Partial<PanelConfig>) => void;
  onRemove: () => void;
}) {
  const maxValue = entries[0]?.value ?? 0;

  return (
    <div className="flex flex-col bg-bip-surface rounded-lg border border-bip-border overflow-hidden">

      {/* Panel controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bip-border flex-shrink-0 flex-wrap">
        <select
          value={config.metric}
          onChange={e => onUpdate({ metric: e.target.value })}
          className="h-7 text-xs rounded border border-bip-border bg-bip-bg text-bip-text px-2 focus:outline-none focus:ring-1 focus:ring-bip-accent"
        >
          {metricColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>

        {allPositions.length > 0 && (
          <PositionPicker
            selected={config.positions}
            options={allPositions}
            onChange={positions => onUpdate({ positions })}
          />
        )}

        <button
          onClick={() => onUpdate({ sortDirection: config.sortDirection === 'highest' ? 'lowest' : 'highest' })}
          className="flex items-center text-xs border border-bip-border bg-bip-bg text-bip-muted px-2 py-1 rounded hover:border-bip-accent/60 hover:text-bip-accent transition-colors"
        >
          {config.sortDirection === 'highest' ? '↓ High' : '↑ Low'}
        </button>

        <div className="flex-1" />

        {canRemove && (
          <button onClick={onRemove} className="text-xs text-bip-muted hover:text-red-400 transition-colors px-1" aria-label="Remove panel">
            ✕
          </button>
        )}
      </div>

      {/* Compact entry list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {entries.length === 0 ? (
          <p className="text-xs text-bip-muted text-center py-6">No entries</p>
        ) : entries.map(entry => {
          const s      = rankStyle[entry.rank] ?? defaultStyle;
          const change = rankChanges.get(entry.name);
          const pct = config.sortDirection === 'highest'
            ? (maxValue > 0 ? Math.min(100, (entry.value / maxValue) * 100) : 0)
            : (entry.value > 0 ? Math.min(100, (maxValue / entry.value) * 100) : 0);

          return (
            <div
              key={`${entry.rank}-${entry.name}`}
              className={`relative flex items-center gap-2 rounded-md border px-3 py-1.5 ${s.border} ${s.bg} ${s.glow}`}
              style={{
                animationDelay: glowDelay,
                ...(teamColor(entry.region, regions) && { borderLeftColor: teamColor(entry.region, regions)!, borderLeftWidth: '3px' }),
              }}
            >
              <div className="w-6 flex-shrink-0 flex items-center gap-0.5">
                <span className={`font-bold font-mono text-sm tabular-nums leading-none ${s.number}`}>
                  {entry.rank}
                </span>
                {change && (
                  <span className={`text-[9px] font-bold leading-none ${change === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {change === 'up' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${s.name}`}>{entry.name}</div>
                {entry.region && <div className="text-[10px] text-bip-muted truncate">{entry.region}</div>}
              </div>
              <div className="w-16 h-1 rounded-full bg-bip-panel overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full transition-all duration-700 ease-out ${s.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`w-10 flex-shrink-0 text-right font-bold font-mono tabular-nums text-sm leading-none ${s.value}`}>
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Multi view ───────────────────────────────────────────────────────────────

export default function MultiView({ sheet, allPositions, onNewLeader }: {
  sheet: ParsedSheet;
  allPositions: string[];
  onNewLeader: (name: string) => void;
}) {
  const firstMetric = sheet.metricColumns[0] ?? '';
  const [panels, setPanels] = useState<PanelConfig[]>([defaultPanel(firstMetric), defaultPanel(firstMetric)]);

  const addPanel    = () => setPanels(ps => ps.length < 6 ? [...ps, defaultPanel(firstMetric)] : ps);
  const removePanel = (id: string) => setPanels(ps => ps.length > 1 ? ps.filter(p => p.id !== id) : ps);
  const updatePanel = (id: string, patch: Partial<PanelConfig>) =>
    setPanels(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));

  const panelResults = useMemo(() =>
    panels.map(panel => {
      if (!panel.metric) return [];
      const rows = panel.positions.length > 0
        ? sheet.rows.filter(r => panel.positions.includes(r.position))
        : sheet.rows;
      return computeLeaderboard(rows, {
        metric: panel.metric,
        sortDirection: panel.sortDirection,
        dateFilter: 'all', dateFrom: '', dateTo: '',
        positionFilter: '', regionFilter: '',
        mode: 'best', topN: null,
      }).entries;
    }),
    [panels, sheet.rows]
  );

  // Detect rank-1 handovers across all panels after each data refresh.
  // prevTopRef tracks the last known leader per panel slot.
  // prevRowsRef lets us distinguish a data refresh from a filter change —
  // we only fire on data changes, not when the user tweaks panel controls.
  const prevTopRef     = useRef<(string | null)[]>([]);
  const prevRowsRef    = useRef(sheet.rows);
  const prevEntriesRef = useRef<{ rank: number; name: string }[][]>([]);
  const [panelRankChanges, setPanelRankChanges] = useState<Map<string, 'up' | 'down'>[]>([]);

  useEffect(() => {
    const rowsChanged = sheet.rows !== prevRowsRef.current;
    prevRowsRef.current = sheet.rows;

    if (rowsChanged && prevEntriesRef.current.length > 0) {
      const allChanges = panelResults.map((entries, idx) => {
        const prev    = prevEntriesRef.current[idx] ?? [];
        const prevMap = new Map(prev.map(e => [e.name, e.rank]));
        const changes = new Map<string, 'up' | 'down'>();
        entries.forEach(e => {
          const prevRank = prevMap.get(e.name);
          if (prevRank !== undefined && prevRank !== e.rank)
            changes.set(e.name, e.rank < prevRank ? 'up' : 'down');
        });
        return changes;
      });
      if (allChanges.some(m => m.size > 0)) {
        setPanelRankChanges(allChanges);
        setTimeout(() => setPanelRankChanges([]), 30_000);
      }
    }

    prevEntriesRef.current = panelResults.map(entries =>
      entries.map(e => ({ rank: e.rank, name: e.name }))
    );

    panelResults.forEach((entries, idx) => {
      const newTop  = entries[0]?.name ?? null;
      const prevTop = prevTopRef.current[idx] ?? null;
      if (rowsChanged && prevTop !== null && newTop !== null && prevTop !== newTop) {
        onNewLeader(newTop);
      }
      prevTopRef.current[idx] = newTop;
    });
  }, [panelResults, sheet.rows, onNewLeader]);

  const gridCols = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'][panels.length - 1];
  const [glowDelay] = useState(() => {
    const t = (typeof document !== 'undefined' ? (document.timeline?.currentTime as number | null) ?? 0 : 0);
    return `${-(t % 3000)}ms`;
  });

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 15rem)' }}>
      {panels.length < 6 && (
        <div className="flex justify-end flex-shrink-0">
          <button
            onClick={addPanel}
            className="text-xs border border-bip-border text-bip-muted hover:border-bip-accent/60 hover:text-bip-accent px-2.5 py-1.5 rounded transition-colors"
          >
            + Add panel
          </button>
        </div>
      )}
      <div className={`grid ${gridCols} gap-3 flex-1 min-h-0`}>
        {panels.map((panel, idx) => (
          <Panel
            key={panel.id}
            config={panel}
            entries={panelResults[idx]}
            metricColumns={sheet.metricColumns}
            allPositions={allPositions}
            regions={sheet.regions}
            rankChanges={panelRankChanges[idx] ?? new Map()}
            canRemove={panels.length > 1}
            glowDelay={glowDelay}
            onUpdate={patch => updatePanel(panel.id, patch)}
            onRemove={() => removePanel(panel.id)}
          />
        ))}
      </div>
    </div>
  );
}
