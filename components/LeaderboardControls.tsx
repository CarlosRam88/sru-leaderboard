'use client';

import type {
  DateFilter,
  LeaderboardFilters,
  LeaderboardMode,
  SortDirection,
} from '@/types/leaderboard';

interface Props {
  metricColumns: string[];
  positions: string[];
  filters: LeaderboardFilters;
  onChange: (filters: LeaderboardFilters) => void;
}

export default function LeaderboardControls({ metricColumns, positions, filters, onChange }: Props) {
  function set<K extends keyof LeaderboardFilters>(key: K, value: LeaderboardFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <Field label="Metric">
        <select value={filters.metric} onChange={(e) => set('metric', e.target.value)} className={selectCls}>
          {metricColumns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </Field>

      <Field label="Sort">
        <select value={filters.sortDirection} onChange={(e) => set('sortDirection', e.target.value as SortDirection)} className={selectCls}>
          <option value="highest">Highest first</option>
          <option value="lowest">Lowest first</option>
        </select>
      </Field>

      <Field label="Date">
        <select value={filters.dateFilter} onChange={(e) => set('dateFilter', e.target.value as DateFilter)} className={selectCls}>
          <option value="all">All dates</option>
          <option value="latest">Latest date only</option>
          <option value="custom">Custom range</option>
        </select>
      </Field>

      {filters.dateFilter === 'custom' && (
        <>
          <Field label="From">
            <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} className={selectCls} />
          </Field>
          <Field label="To">
            <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} className={selectCls} />
          </Field>
        </>
      )}

      <Field label="Position">
        <select value={filters.positionFilter} onChange={(e) => set('positionFilter', e.target.value)} className={selectCls}>
          <option value="">All positions</option>
          {positions.map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </Field>

      <Field label="Mode">
        <select value={filters.mode} onChange={(e) => set('mode', e.target.value as LeaderboardMode)} className={selectCls}>
          <option value="best">Best per player</option>
          <option value="latest">Latest per player</option>
          <option value="all">All entries</option>
        </select>
      </Field>

      <Field label="Show">
        <select
          value={filters.topN ?? 'all'}
          onChange={(e) => set('topN', e.target.value === 'all' ? null : Number(e.target.value))}
          className={selectCls}
        >
          <option value={3}>Top 3</option>
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value="all">All</option>
        </select>
      </Field>
    </div>
  );
}

const selectCls =
  'w-full h-9 rounded border border-bip-border bg-bip-bg text-bip-text text-sm px-2 focus:outline-none focus:ring-1 focus:ring-bip-accent disabled:opacity-40 disabled:cursor-not-allowed';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-bip-muted uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}
