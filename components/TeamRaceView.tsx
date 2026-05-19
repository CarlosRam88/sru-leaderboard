'use client';

import { useEffect, useMemo, useState } from 'react';
import { teamColor } from '@/lib/teamColors';
import type { ParsedSheet, SortDirection } from '@/types/leaderboard';

interface TeamStat {
  region: string;
  avg: number;
  count: number;
  rank: number;
  color: string;
}

const rankBadge: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
};

export default function TeamRaceView({ sheet }: { sheet: ParsedSheet }) {
  const firstMetric = sheet.metricColumns[0] ?? '';
  const [metric, setMetric] = useState(firstMetric);
  const [direction, setDirection] = useState<SortDirection>('highest');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo<TeamStat[]>(() => {
    if (!metric || sheet.regions.length === 0) return [];

    const groups = new Map<string, number[]>();
    for (const row of sheet.rows) {
      if (!row.region) continue;
      const raw = row[metric];
      if (!raw || raw.trim() === '' || isNaN(Number(raw))) continue;
      const arr = groups.get(row.region) ?? [];
      arr.push(Number(raw));
      groups.set(row.region, arr);
    }

    const result = Array.from(groups.entries())
      .filter(([, values]) => values.length > 0)
      .map(([region, values]) => ({
        region,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length,
        color: teamColor(region, sheet.regions) ?? '#38bdf8',
        rank: 0,
      }));

    result.sort((a, b) => direction === 'highest' ? b.avg - a.avg : a.avg - b.avg);
    result.forEach((t, i) => { t.rank = i + 1; });
    return result;
  }, [sheet, metric, direction]);

  if (sheet.regions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-bip-muted">No team / region data in this sheet.</p>
      </div>
    );
  }

  const leader = stats[0]?.avg ?? 1;

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 15rem)' }}>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <select
          value={metric}
          onChange={e => setMetric(e.target.value)}
          className="h-8 text-sm rounded border border-bip-border bg-bip-bg text-bip-text px-2 focus:outline-none focus:ring-1 focus:ring-bip-accent"
        >
          {sheet.metricColumns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
        <button
          onClick={() => setDirection(d => d === 'highest' ? 'lowest' : 'highest')}
          className="text-sm border border-bip-border bg-bip-bg text-bip-muted px-3 py-1.5 rounded hover:border-bip-accent/60 hover:text-bip-accent transition-colors"
        >
          {direction === 'highest' ? '↓ Highest avg' : '↑ Lowest avg'}
        </button>
        <span className="text-xs text-bip-muted">Team averages</span>
      </div>

      {/* Race bars */}
      <div className="flex flex-col flex-1 justify-evenly">
        {stats.map(team => {
          const pct = direction === 'highest'
            ? (leader > 0 ? (team.avg / leader) * 100 : 0)
            : (team.avg > 0 ? (leader / team.avg) * 100 : 0);

          const badge = rankBadge[team.rank] ?? 'text-bip-muted';
          const avgDisplay = Number.isInteger(team.avg) ? String(team.avg) : team.avg.toFixed(1);

          return (
            <div key={team.region} className="flex items-center gap-5">

              {/* Rank */}
              <span className={`w-12 text-right font-bold font-mono text-4xl tabular-nums flex-shrink-0 ${badge}`}>
                {team.rank}
              </span>

              {/* Team name */}
              <span
                className="w-48 flex-shrink-0 font-bold text-2xl leading-tight truncate"
                style={{ color: team.color }}
              >
                {team.region}
              </span>

              {/* Bar track */}
              <div className="flex-1 h-14 rounded-2xl bg-bip-panel overflow-hidden self-center relative">
                <div
                  className="h-full rounded-2xl transition-all duration-1000 ease-out"
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    backgroundColor: team.color,
                    opacity: 0.6,
                    boxShadow: `0 0 32px 4px ${team.color}55`,
                  }}
                />
              </div>

              {/* Avg value + entry count */}
              <div className="w-32 flex-shrink-0 text-right">
                <div
                  className="font-bold font-mono tabular-nums text-3xl leading-none"
                  style={{ color: team.color }}
                >
                  {avgDisplay}
                </div>
                <div className="text-xs text-bip-muted mt-1">{team.count} entries</div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
