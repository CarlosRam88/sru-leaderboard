export interface SheetRow {
  date: string;
  name: string;
  position: string;
  region: string;
  [key: string]: string;
}

export interface ParsedSheet {
  headers: string[];
  rows: SheetRow[];
  metricColumns: string[];
  regions: string[];
}

export type SortDirection = 'highest' | 'lowest';
export type DateFilter = 'all' | 'latest' | 'custom';
export type LeaderboardMode = 'best' | 'latest' | 'all';

export interface LeaderboardFilters {
  metric: string;
  sortDirection: SortDirection;
  dateFilter: DateFilter;
  dateFrom: string;
  dateTo: string;
  positionFilter: string;
  regionFilter: string;
  mode: LeaderboardMode;
  topN: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  region: string;
  value: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  excludedCount: number;
}
