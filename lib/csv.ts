import Papa from 'papaparse';
import type { ParsedSheet, SheetRow } from '@/types/leaderboard';

const MANDATORY = ['date', 'name', 'position'] as const;
const REGION_ALIASES = ['region', 'team'];

export async function fetchAndParseSheet(csvUrl: string): Promise<ParsedSheet> {
  let response: Response;
  try {
    response = await fetch(csvUrl);
  } catch {
    throw new Error('Could not reach the sheet. Check your network connection.');
  }

  if (!response.ok) {
    throw new Error(
      `Sheet returned status ${response.status}. Ensure the sheet is shared publicly.`
    );
  }

  const text = await response.text();

  if (text.trim().startsWith('<!')) {
    throw new Error(
      'Sheet returned an HTML page instead of CSV. Ensure the sheet is shared as "Anyone with the link".'
    );
  }

  return parseSheetCsv(text);
}

export function parseSheetCsv(csv: string): ParsedSheet {
  const result = Papa.parse<string[]>(csv, {
    skipEmptyLines: true,
  });

  if (result.data.length === 0) {
    throw new Error('The sheet appears to be empty.');
  }

  const [rawHeader, ...dataRows] = result.data;
  const headers = rawHeader.map((h) => h.trim());

  for (let i = 0; i < MANDATORY.length; i++) {
    const expected = MANDATORY[i];
    const actual = (headers[i] ?? '').toLowerCase();
    if (actual !== expected) {
      throw new Error(
        `Column ${i + 1} must be "${expected}" but found "${headers[i] ?? '(empty)'}" — check column order.`
      );
    }
  }

  const col3 = (headers[MANDATORY.length] ?? '').toLowerCase().trim();
  const hasRegion = REGION_ALIASES.includes(col3);
  const metricStart = MANDATORY.length + (hasRegion ? 1 : 0);

  const metricColumns = headers.slice(metricStart);
  if (metricColumns.length === 0) {
    throw new Error('No metric columns found. Add at least one column after date, name, position (and optionally region/team).');
  }

  const rows: SheetRow[] = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const obj: SheetRow = {
        date:     (row[0] ?? '').trim(),
        name:     (row[1] ?? '').trim(),
        position: (row[2] ?? '').trim(),
        region:   hasRegion ? (row[MANDATORY.length] ?? '').trim() : '',
      };
      metricColumns.forEach((col, i) => {
        obj[col] = (row[metricStart + i] ?? '').trim();
      });
      return obj;
    });

  const regions = hasRegion
    ? Array.from(new Set(rows.map((r) => r.region).filter(Boolean))).sort()
    : [];

  return { headers, rows, metricColumns, regions };
}
