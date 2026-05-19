import type {
  SheetRow,
  LeaderboardEntry,
  LeaderboardFilters,
  LeaderboardMode,
  LeaderboardResult,
} from '@/types/leaderboard';

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getLatestDateKey(rows: SheetRow[]): string | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const d = parseDate(row.date);
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest ? dateKey(latest) : null;
}

function applyDateFilter(rows: SheetRow[], filters: LeaderboardFilters): SheetRow[] {
  if (filters.dateFilter === 'all') return rows;

  if (filters.dateFilter === 'latest') {
    const key = getLatestDateKey(rows);
    if (!key) return rows;
    return rows.filter((row) => {
      const d = parseDate(row.date);
      return d !== null && dateKey(d) === key;
    });
  }

  if (filters.dateFilter === 'custom') {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);
    return rows.filter((row) => {
      const d = parseDate(row.date);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  return rows;
}

function applyPositionFilter(rows: SheetRow[], position: string): SheetRow[] {
  if (!position) return rows;
  return rows.filter((row) => row.position === position);
}

function applyRegionFilter(rows: SheetRow[], region: string): SheetRow[] {
  if (!region) return rows;
  return rows.filter((row) => row.region === region);
}

function partitionByMetric(
  rows: SheetRow[],
  metric: string
): { valid: SheetRow[]; excluded: number } {
  let excluded = 0;
  const valid: SheetRow[] = [];
  for (const row of rows) {
    const raw = row[metric];
    if (!raw || raw.trim() === '' || isNaN(Number(raw))) {
      excluded++;
    } else {
      valid.push(row);
    }
  }
  return { valid, excluded };
}

function applyMode(
  rows: SheetRow[],
  metric: string,
  mode: LeaderboardMode,
  sortDesc: boolean
): SheetRow[] {
  if (mode === 'all') return rows;

  const grouped = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.name) ?? [];
    bucket.push(row);
    grouped.set(row.name, bucket);
  }

  const result: SheetRow[] = [];
  for (const playerRows of grouped.values()) {
    if (mode === 'best') {
      const best = playerRows.reduce((acc, row) => {
        const av = Number(acc[metric]);
        const bv = Number(row[metric]);
        return sortDesc ? (bv > av ? row : acc) : (bv < av ? row : acc);
      });
      result.push(best);
    } else {
      // latest
      const latest = playerRows.reduce((acc, row) => {
        const ad = parseDate(acc.date);
        const bd = parseDate(row.date);
        if (!bd) return acc;
        if (!ad) return row;
        return bd > ad ? row : acc;
      });
      result.push(latest);
    }
  }
  return result;
}

export function computeLeaderboard(
  allRows: SheetRow[],
  filters: LeaderboardFilters
): LeaderboardResult {
  if (!filters.metric) return { entries: [], excludedCount: 0 };

  let rows = applyDateFilter(allRows, filters);
  rows = applyPositionFilter(rows, filters.positionFilter);
  rows = applyRegionFilter(rows, filters.regionFilter);

  const { valid, excluded } = partitionByMetric(rows, filters.metric);

  const sortDesc = filters.sortDirection === 'highest';
  const moded = applyMode(valid, filters.metric, filters.mode, sortDesc);

  const sorted = [...moded].sort((a, b) => {
    const av = Number(a[filters.metric]);
    const bv = Number(b[filters.metric]);
    return sortDesc ? bv - av : av - bv;
  });

  const sliced = filters.topN !== null ? sorted.slice(0, filters.topN) : sorted;

  const entries: LeaderboardEntry[] = sliced.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    region: row.region,
    value: Number(row[filters.metric]),
  }));

  return { entries, excludedCount: excluded };
}

export function getUniquePositions(rows: SheetRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.position) seen.add(row.position);
  }
  return Array.from(seen).sort();
}
