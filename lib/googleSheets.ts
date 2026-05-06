export interface SheetUrlParts {
  sheetId: string;
  gid: string;
}

export function parseSheetUrl(url: string): SheetUrlParts | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;

  const sheetId = idMatch[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { sheetId, gid };
}

export function buildCsvUrl({ sheetId, gid }: SheetUrlParts): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}
