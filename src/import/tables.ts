/**
 * Minimal readers that turn an .xlsx or .csv file into rows of strings.
 * Used by the lineup import screen (browser) and by tests (node). Only the
 * first worksheet of a workbook is read; dates come back as ISO YYYY-MM-DD.
 */
import { unzipSync, strFromU8 } from 'fflate';

export type TableRows = string[][];

export function parseCsv(text: string): TableRows {
  const rows: TableRows = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function textOf(xml: string): string {
  // Concatenate every <t> run (rich text has several).
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += decodeXml(m[1]);
  return out;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel serial day (1900 system) to ISO date. */
export function serialToIsoDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Reads the first worksheet of an .xlsx file into string rows. */
export function parseXlsx(bytes: Uint8Array): TableRows {
  const files = unzipSync(bytes);
  // Some writers prefix every element with a namespace (<x:row>); drop the prefixes so one set of patterns works.
  const read = (name: string): string | null => (files[name] ? strFromU8(files[name]).replace(/<(\/?)[A-Za-z0-9_]+:(?=[A-Za-z])/g, '<$1') : null);

  const shared: string[] = [];
  const sst = read('xl/sharedStrings.xml');
  if (sst) {
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sst))) shared.push(textOf(m[1]));
  }

  // Which cell styles are dates? Map style index -> numFmtId, and treat the
  // built-in date formats (14-22, 45-47) or custom formats with y/m/d as dates.
  const dateStyles = new Set<number>();
  const styles = read('xl/styles.xml');
  if (styles) {
    const custom = new Map<number, string>();
    const nf = /<numFmt\s[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = nf.exec(styles))) custom.set(Number(m[1]), decodeXml(m[2]));
    const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
    const xf = /<xf\s[^>]*?numFmtId="(\d+)"/g;
    let i = 0;
    while ((m = xf.exec(xfs))) {
      const id = Number(m[1]);
      const fmt = custom.get(id);
      const builtin = (id >= 14 && id <= 22) || (id >= 45 && id <= 47);
      if (builtin || (fmt && /[ymd]/i.test(fmt.replace(/\[[^\]]*\]/g, '')) && !/#|0\.0/.test(fmt))) dateStyles.add(i);
      i++;
    }
  }

  // First sheet by workbook order.
  const workbook = read('xl/workbook.xml') ?? '';
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const firstRid = /<sheet\s[^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (firstRid) {
    const rel = new RegExp(`<Relationship\\s[^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
    if (rel) sheetPath = rel.startsWith('/') ? rel.slice(1) : `xl/${rel}`;
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new Error('Workbook has no readable worksheet.');

  const rows: TableRows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheet))) {
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1];
      const inner = cm[2] ?? '';
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? '';
      const col = ref ? columnIndex(ref) : cells.length;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const style = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? '-1');
      let value = '';
      if (type === 's') value = shared[Number(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? '-1')] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'str' || type === 'b' || type === 'e') value = decodeXml(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? '');
      else {
        const raw = /<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? '';
        if (raw === '') value = '';
        else if (dateStyles.has(style)) value = serialToIsoDate(Number(raw));
        else value = String(Number(raw));
      }
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Picks the reader from the file name (or sniffs the zip signature). */
export function parseTableFile(name: string, bytes: Uint8Array): TableRows {
  const isZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || /\.xlsx$/i.test(name)) return parseXlsx(bytes);
  return parseCsv(new TextDecoder('utf-8').decode(bytes));
}
