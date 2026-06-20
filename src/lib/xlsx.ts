import JSZip from 'jszip';

/**
 * Builds a minimal, valid .xlsx file (single sheet, inline strings) from a 2D
 * array of rows. Uses JSZip (already a dependency) instead of pulling in a full
 * spreadsheet library. Values are written as inline strings to keep it simple
 * and avoid locale/number formatting surprises in templates.
 */
function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(index: number): string {
  let s = '';
  let n = index;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

export async function buildXlsxBlob(rows: (string | number)[][]): Promise<Blob> {
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((cell, c) =>
      `<c r="${colLetter(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`
    ).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Plantilla" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('xl/workbook.xml', workbookXml);
  zip.file('xl/_rels/workbook.xml.rels', workbookRels);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ─── Reading ──────────────────────────────────────────────────────────────────

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Parses the first sheet of an .xlsx file into a 2D array of strings. */
async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buf);

  // Shared strings (Excel stores most text here, referenced by index)
  let shared: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const txt = await ssFile.async('string');
    shared = [...txt.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
      unescapeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))
    );
  }

  const sheetFile = zip.file(/xl\/worksheets\/sheet1\.xml/)[0] || zip.file(/xl\/worksheets\/.*\.xml/)[0];
  if (!sheetFile) return [];
  const sheetXml = await sheetFile.async('string');

  const rows: string[][] = [];
  for (const rm of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
      const colIdx = ref ? colToIndex(ref) : cells.length;
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      let val = '';
      if (t === 's') {
        val = shared[parseInt((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '-1', 10)] ?? '';
      } else if (t === 'inlineStr') {
        val = unescapeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
      } else {
        val = unescapeXml((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '');
      }
      cells[colIdx] = val;
    }
    rows.push(cells);
  }
  return rows;
}

/** Parses a CSV string into a 2D array (handles quoted fields and ; or , separators). */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const sep = (clean.split('\n')[0].match(/;/g) || []).length > (clean.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cur = '', inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** Parses an uploaded .xlsx or .csv file into rows. */
export async function parseSpreadsheet(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  return parseXlsx(await file.arrayBuffer());
}
