'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import { computeLeaderboard, getUniquePositions } from '@/lib/leaderboard';
import type { DateFilter, LeaderboardEntry, ParsedSheet, SortDirection } from '@/types/leaderboard';

const sel = 'h-7 text-xs rounded border border-bip-border bg-bip-bg text-bip-text px-2 focus:outline-none focus:ring-1 focus:ring-bip-accent';

export default function TableView({ sheet, presenting, refreshing, newLeader, onNewLeader }: {
  sheet: ParsedSheet;
  presenting: boolean;
  refreshing: boolean;
  newLeader: string | null;
  onNewLeader: (name: string) => void;
}) {
  const [metric, setMetric]                 = useState(sheet.metricColumns[0] ?? '');
  const [direction, setDirection]           = useState<SortDirection>('highest');
  const [positionFilter, setPositionFilter] = useState('');
  const [dateFilter, setDateFilter]         = useState<DateFilter>('all');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [rankChanges, setRankChanges]       = useState<Map<string, 'up' | 'down'>>(new Map());

  const positions = useMemo(() => getUniquePositions(sheet.rows), [sheet.rows]);

  const result = useMemo(() => computeLeaderboard(sheet.rows, {
    metric, sortDirection: direction,
    dateFilter, dateFrom, dateTo,
    positionFilter, regionFilter: '',
    mode: 'best', topN: null,
  }), [sheet.rows, metric, direction, dateFilter, dateFrom, dateTo, positionFilter]);

  const preSnap  = useRef<LeaderboardEntry[]>([]);
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(() => {
    if (refreshing) {
      preSnap.current = resultRef.current.entries;
    } else if (preSnap.current.length > 0) {
      const snap = preSnap.current;
      const next = resultRef.current.entries;
      preSnap.current = [];

      const prevMap = new Map(snap.map(e => [e.name, e.rank]));
      const changes = new Map<string, 'up' | 'down'>();
      next.forEach(e => {
        const prev = prevMap.get(e.name);
        if (prev !== undefined && prev !== e.rank) changes.set(e.name, e.rank < prev ? 'up' : 'down');
      });
      if (changes.size > 0) {
        setRankChanges(changes);
        setTimeout(() => setRankChanges(new Map()), 30_000);
      }

      const oldTop = snap[0]?.name;
      const newTop = next[0]?.name;
      if (oldTop && newTop && oldTop !== newTop) onNewLeader(newTop);
    }
  }, [refreshing, onNewLeader]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={metric} onChange={e => setMetric(e.target.value)} className={sel}>
          {sheet.metricColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>

        <button
          onClick={() => setDirection(d => d === 'highest' ? 'lowest' : 'highest')}
          className="h-7 px-2 text-xs border border-bip-border bg-bip-bg text-bip-muted rounded hover:border-bip-accent/60 hover:text-bip-accent transition-colors"
        >
          {direction === 'highest' ? '↓ High' : '↑ Low'}
        </button>

        {positions.length > 0 && (
          <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)} className={sel}>
            <option value="">All positions</option>
            {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
          </select>
        )}

        <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} className={sel}>
          <option value="all">All dates</option>
          <option value="latest">Latest date only</option>
          <option value="custom">Custom range</option>
        </select>

        {dateFilter === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={sel} />
            <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={sel} />
          </>
        )}
      </div>

      {/* Table */}
      {result.entries.length === 0 && result.excludedCount === 0 ? (
        <p className="text-center py-8 text-sm text-bip-muted">No rows match the current filters.</p>
      ) : (
        <LeaderboardTable
          entries={result.entries}
          metric={metric}
          excludedCount={result.excludedCount}
          sortDirection={direction}
          rankChanges={rankChanges}
          twoColumn={presenting}
          newLeader={newLeader}
          regions={sheet.regions}
        />
      )}
    </div>
  );
}
