type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote cells with separators, quotes or line breaks; neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Builds a CSV file in the browser and starts the download */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]): void {
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
