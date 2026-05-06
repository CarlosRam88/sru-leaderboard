import type { LeaderboardEntry, SortDirection } from '@/types/leaderboard';

interface Props {
  entries: LeaderboardEntry[];
  metric: string;
  excludedCount: number;
  sortDirection: SortDirection;
  rankChanges?: Map<string, 'up' | 'down'>;
  twoColumn?: boolean;
  newLeader?: string | null;
}

const rankMeta: Record<number, { number: string; bar: string; name: string }> = {
  1: { number: 'text-yellow-400', bar: 'bg-bip-accent',     name: 'text-yellow-100' },
  2: { number: 'text-slate-300',  bar: 'bg-bip-accent/80',  name: 'text-bip-text'   },
  3: { number: 'text-amber-600',  bar: 'bg-bip-accent/65',  name: 'text-bip-text'   },
};
const defaultMeta = { number: 'text-bip-border', bar: 'bg-bip-accent/45', name: 'text-bip-text' };

function computeBarPct(entry: LeaderboardEntry, entries: LeaderboardEntry[], sortDirection: SortDirection): number {
  if (!entries.length) return 0;
  if (sortDirection === 'highest') {
    const max = entries[0].value;
    return max <= 0 ? 0 : Math.min(100, (entry.value / max) * 100);
  }
  const best = entries[0].value;
  if (entry.value <= 0) return 0;
  return Math.min(100, (best / entry.value) * 100);
}

function Headers({ metric, nameWidth }: { metric: string; nameWidth: string }) {
  return (
    <div className="flex items-center gap-4 px-4 pb-2.5 border-b border-bip-border">
      <span className="w-8 flex-shrink-0 text-xs font-semibold text-bip-muted uppercase tracking-widest">#</span>
      <span className={`${nameWidth} flex-shrink-0 text-xs font-semibold text-bip-muted uppercase tracking-widest`}>Name</span>
      <span className="flex-1 text-xs font-semibold text-bip-muted uppercase tracking-widest">Performance</span>
      <span className="w-16 flex-shrink-0 text-right text-xs font-semibold text-bip-muted uppercase tracking-widest">
        {metric}
      </span>
    </div>
  );
}

export default function LeaderboardTable({
  entries, metric, excludedCount, sortDirection,
  rankChanges = new Map(), twoColumn = false, newLeader = null,
}: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-center py-8 text-sm text-bip-muted">
        No entries match the current filters.
      </p>
    );
  }

  const colCount  = twoColumn ? (entries.length >= 15 ? 3 : 2) : 1;
  const nameWidth = colCount === 3 ? 'w-32' : colCount === 2 ? 'w-40' : 'w-56';

  const renderRows = (subset: LeaderboardEntry[], startIndex: number) =>
    subset.map((entry, i) => {
      const meta        = rankMeta[entry.rank] ?? defaultMeta;
      const pct         = computeBarPct(entry, entries, sortDirection);
      const isFirst     = entry.rank === 1;
      const isNewLeader = isFirst && entry.name === newLeader;
      const change      = rankChanges.get(entry.name);

      return (
        <div
          key={`${entry.rank}-${entry.name}-${entry.date}-${entry.value}`}
          className={`relative entry-animate flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors duration-300 ${
            isFirst
              ? `border-yellow-400/50 bg-yellow-400/[0.04] ${isNewLeader ? 'new-leader-burst' : 'rank-1-glow'}`
              : 'border-bip-border/30 bg-bip-surface hover:bg-bip-panel/50'
          }`}
          style={{ animationDelay: `${(startIndex + i) * 55}ms` }}
        >
          {/* Shockwave rings for new rank-1 */}
          {isNewLeader && (
            <>
              <div className="shockwave-ring" />
              <div className="shockwave-ring" style={{ animationDelay: '0.18s' }} />
              <div className="shockwave-ring" style={{ animationDelay: '0.35s' }} />
            </>
          )}

          {/* NEW #1 badge */}
          {isNewLeader && (
            <span className="new-leader-badge absolute -top-2.5 right-3 px-1.5 py-0.5 bg-yellow-400 text-bip-bg text-[9px] font-bold uppercase tracking-widest rounded-full z-20">
              New Leader!
            </span>
          )}

          {/* Rank + change arrow */}
          <div className="w-8 flex-shrink-0 flex items-start gap-0.5">
            <span className={`font-bold font-mono text-xl tabular-nums leading-none ${meta.number}`}>
              {entry.rank}
            </span>
            {change && (
              <span className={`text-[10px] font-bold leading-none mt-0.5 ${change === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {change === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>

          {/* Name + position/date */}
          <div className={`${nameWidth} flex-shrink-0 min-w-0`}>
            <div className={`font-semibold truncate ${meta.name}`}>{entry.name}</div>
            <div className="text-xs text-bip-muted mt-0.5 truncate">
              {entry.position} &middot; {entry.date}
            </div>
          </div>

          {/* Bar track */}
          <div className="flex-1 h-2 rounded-full bg-bip-panel overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${meta.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Metric value */}
          <span className={`w-16 flex-shrink-0 text-right font-bold font-mono tabular-nums text-lg leading-none ${
            isFirst ? 'text-yellow-400' : 'text-bip-accent'
          }`}>
            {entry.value}
          </span>
        </div>
      );
    });

  const colSize = Math.ceil(entries.length / colCount);

  return (
    <div className="space-y-3">
      {excludedCount > 0 && (
        <p className="text-xs text-bip-muted/60">
          {excludedCount} row{excludedCount !== 1 ? 's' : ''} excluded — missing or non-numeric &ldquo;{metric}&rdquo; value.
        </p>
      )}

      {colCount > 1 ? (
        <div className={`flex ${colCount === 3 ? 'gap-4' : 'gap-6'}`}>
          {Array.from({ length: colCount }, (_, i) => (
            <div key={i} className="flex-1 space-y-2 min-w-0">
              <Headers metric={metric} nameWidth={nameWidth} />
              <div className="space-y-2">
                {renderRows(entries.slice(i * colSize, (i + 1) * colSize), i * colSize)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Headers metric={metric} nameWidth={nameWidth} />
          <div className="space-y-2">{renderRows(entries, 0)}</div>
        </div>
      )}
    </div>
  );
}
