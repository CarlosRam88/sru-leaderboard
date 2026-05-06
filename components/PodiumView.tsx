import type { LeaderboardEntry } from '@/types/leaderboard';

interface Props {
  entries: LeaderboardEntry[];
  metric: string;
}

const SLOTS = [
  {
    rankIdx:    1,
    label:      '2',
    delay:      0,
    platformH:  120,
    card:       'border-slate-400/40 bg-slate-400/[0.04]',
    platform:   'bg-slate-400/10 border-slate-400/30',
    numColor:   'text-slate-300',
    nameColor:  'text-bip-text',
    valColor:   'text-slate-300',
  },
  {
    rankIdx:    0,
    label:      '1',
    delay:      300,
    platformH:  180,
    card:       'border-yellow-400/50 bg-yellow-400/[0.05] rank-1-glow',
    platform:   'bg-yellow-400/10 border-yellow-400/30',
    numColor:   'text-yellow-400',
    nameColor:  'text-yellow-100',
    valColor:   'text-yellow-400',
  },
  {
    rankIdx:    2,
    label:      '3',
    delay:      150,
    platformH:  80,
    card:       'border-amber-600/40 bg-amber-600/[0.04]',
    platform:   'bg-amber-600/10 border-amber-600/30',
    numColor:   'text-amber-600',
    nameColor:  'text-bip-text',
    valColor:   'text-amber-500',
  },
] as const;

export default function PodiumView({ entries, metric }: Props) {
  const top3 = entries.slice(0, 3);

  return (
    <div className="flex items-end justify-center gap-6 px-4 pb-2">
      {SLOTS.map((slot) => {
        const entry: LeaderboardEntry | undefined = top3[slot.rankIdx];

        return (
          <div key={slot.label} className="flex-1 flex flex-col items-center min-w-0">

            {/* Player card */}
            {entry ? (
              <div
                className={`entry-animate w-full rounded-xl border px-5 py-6 text-center mb-3 ${slot.card}`}
                style={{ animationDelay: `${slot.delay + 150}ms` }}
              >
                <div className={`text-6xl font-black font-mono tabular-nums leading-none ${slot.valColor}`}>
                  {entry.value}
                </div>
                <div className="mt-1 text-xs text-bip-muted uppercase tracking-widest">{metric}</div>
                <div className={`mt-4 text-2xl font-bold leading-tight truncate ${slot.nameColor}`}>
                  {entry.name}
                </div>
                <div className="mt-1 text-sm text-bip-muted tracking-wide">
                  {entry.position}
                </div>
              </div>
            ) : (
              <div className="w-full mb-3 h-48" />
            )}

            {/* Podium platform */}
            <div
              className={`entry-animate w-full rounded-t-lg border border-b-0 flex items-center justify-center ${slot.platform}`}
              style={{ height: slot.platformH, animationDelay: `${slot.delay}ms` }}
            >
              <span className={`text-6xl font-black font-mono opacity-40 ${slot.numColor}`}>
                {slot.label}
              </span>
            </div>

          </div>
        );
      })}
    </div>
  );
}
