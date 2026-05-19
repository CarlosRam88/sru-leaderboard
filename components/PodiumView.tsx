'use client';

import { useMemo, useState } from 'react';
import { computeLeaderboard, getUniquePositions } from '@/lib/leaderboard';
import type { ParsedSheet, SortDirection } from '@/types/leaderboard';

const SLOTS = [
  {
    rankIdx:    1,
    label:      '2',
    colPct:     '68%',
    delay:      0,
    card:       'border-slate-400/40 bg-slate-400/[0.04]',
    numColor:   'text-slate-300',
    nameColor:  'text-bip-text',
    valColor:   'text-slate-300',
    gradient:   'linear-gradient(to bottom, #f1f5f9 0%, #94a3b8 38%, #1e293b 100%)',
    glow:       'rgba(148,163,184,0.20)',
    glossAlpha: 'rgba(255,255,255,0.22)',
  },
  {
    rankIdx:    0,
    label:      '1',
    colPct:     '100%',
    delay:      300,
    card:       'border-yellow-400/50 bg-yellow-400/[0.05]',
    numColor:   'text-yellow-100',
    nameColor:  'text-yellow-100',
    valColor:   'text-yellow-400',
    gradient:   'linear-gradient(to bottom, #fef9c3 0%, #eab308 40%, #713f12 100%)',
    glow:       'rgba(234,179,8,0.28)',
    glossAlpha: 'rgba(255,255,255,0.30)',
  },
  {
    rankIdx:    2,
    label:      '3',
    colPct:     '50%',
    delay:      150,
    card:       'border-amber-600/40 bg-amber-600/[0.04]',
    numColor:   'text-amber-300',
    nameColor:  'text-bip-text',
    valColor:   'text-amber-500',
    gradient:   'linear-gradient(to bottom, #fbbf24 0%, #92400e 50%, #1c1917 100%)',
    glow:       'rgba(180,83,9,0.20)',
    glossAlpha: 'rgba(255,255,255,0.14)',
  },
] as const;

const sel = 'h-7 text-xs rounded border border-bip-border bg-bip-bg text-bip-text px-2 focus:outline-none focus:ring-1 focus:ring-bip-accent';

export default function PodiumView({ sheet }: { sheet: ParsedSheet }) {
  const [metric, setMetric]                 = useState(sheet.metricColumns[0] ?? '');
  const [direction, setDirection]           = useState<SortDirection>('highest');
  const [positionFilter, setPositionFilter] = useState('');

  const positions = useMemo(() => getUniquePositions(sheet.rows), [sheet.rows]);

  const top3 = useMemo(() => computeLeaderboard(sheet.rows, {
    metric, sortDirection: direction,
    dateFilter: 'all', dateFrom: '', dateTo: '',
    positionFilter, regionFilter: '',
    mode: 'best', topN: null,
  }).entries.slice(0, 3), [sheet.rows, metric, direction, positionFilter]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 15rem)' }}>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
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
      </div>

      {/* Podium */}
      <div className="flex items-end gap-6 px-2 flex-1">
        {SLOTS.map(slot => {
          const entry = top3[slot.rankIdx];
          const isFirst = slot.rankIdx === 0;

          return (
            <div key={slot.label} className="flex-1 flex flex-col items-center min-w-0" style={{ height: slot.colPct }}>

              <div className="w-full mb-3 shrink-0">
                {entry ? (
                  <div className={isFirst ? 'rank-1-glow rounded-xl' : ''}>
                    <div
                      className={`entry-animate w-full rounded-xl border px-5 py-6 text-center ${slot.card}`}
                      style={{ animationDelay: `${slot.delay + 150}ms` }}
                    >
                      <div className={`text-6xl font-black font-mono tabular-nums leading-none ${slot.valColor}`}>{entry.value}</div>
                      <div className="mt-1 text-xs text-bip-muted uppercase tracking-widest">{metric}</div>
                      <div className={`mt-4 text-5xl font-bold leading-tight truncate ${slot.nameColor}`}>{entry.name}</div>
                      {entry.region && <div className="mt-2 text-xl text-bip-muted tracking-wide">{entry.region}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="h-48" />
                )}
              </div>

              <div
                className="entry-animate w-full flex-1 rounded-t-lg relative overflow-hidden"
                style={{
                  animationDelay: `${slot.delay}ms`,
                  background: slot.gradient,
                  boxShadow: `0 0 48px ${slot.glow}, inset 0 1px 0 ${slot.glossAlpha}`,
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${slot.glossAlpha}, transparent)` }} />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-black/30 pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-[9rem] font-black font-mono select-none ${slot.numColor}`} style={{ opacity: 0.55, textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                    {slot.label}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
