import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { logger } from '../utils/logger';

/**
 * Searchable catalogue of medicines sold in India (brand name, composition, pack, maker).
 * Data: backend/data/medicines/indian_medicines.json.gz (see the README there for source and licence).
 * Loaded once, on the first search, and kept in memory (~250k rows).
 */

export interface MedicineItem {
  name: string;
  composition: string;
  pack: string;
  manufacturer: string;
  discontinued: boolean;
  /** Why it matched: the brand name, or the ingredients. */
  match: 'name' | 'composition';
}

export interface MedicineSearchResult {
  total: number;
  items: MedicineItem[];
}

type Row = [string, string, string, string, number];

const DEFAULT_PATH = path.resolve(__dirname, '../../data/medicines/indian_medicines.json.gz');

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.%/+ ]+/g, ' ').replace(/\s+/g, ' ').trim();

export class MedicineCatalog {
  private rows: Row[] = [];
  private nameKey: string[] = [];
  private compKey: string[] = [];

  constructor(rows: Row[]) {
    this.rows = rows;
    this.nameKey = rows.map((r) => ` ${norm(r[0])}`);
    this.compKey = rows.map((r) => ` ${norm(r[1])}`);
  }

  get size(): number {
    return this.rows.length;
  }

  /**
   * Every word typed must appear (as a word start) in the name or the composition.
   * Ranking: name starts with the text → a name word starts with it → ingredients match.
   * Discontinued products go to the end. Ties: shorter, then alphabetical.
   */
  search(query: string, opts: { limit?: number; offset?: number } = {}): MedicineSearchResult {
    const q = norm(query);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    if (q.length < 2) return { total: 0, items: [] };

    const words = q.split(' ');
    const hits: { i: number; score: number }[] = [];

    for (let i = 0; i < this.rows.length; i++) {
      const name = this.nameKey[i];
      const comp = this.compKey[i];
      let inName = true;
      let inAny = true;
      for (const w of words) {
        const needle = ` ${w}`;
        const n = name.includes(needle);
        if (!n) inName = false;
        if (!n && !comp.includes(needle)) {
          inAny = false;
          break;
        }
      }
      if (!inAny) continue;

      // 0: name starts with the exact word(s) typed ("dolo" → "Dolo 650"), 1: name starts with the text,
      // 2: every word is in the name, 3: found through the ingredients. Discontinued: +10.
      let score: number;
      const start = ` ${q}`;
      if (name.startsWith(start)) score = /[a-z0-9]/.test(name.charAt(start.length)) ? 1 : 0;
      else if (inName) score = 2;
      else score = 3;
      if (this.rows[i][4]) score += 10;
      hits.push({ i, score });
    }

    hits.sort((a, b) => a.score - b.score || collator.compare(this.rows[a.i][0], this.rows[b.i][0]));

    // One entry per product name (same name can exist in several pack sizes).
    const seen = new Set<string>();
    const unique: { i: number; score: number }[] = [];
    for (const h of hits) {
      const k = this.rows[h.i][0].toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(h);
    }

    const items = unique.slice(offset, offset + limit).map(({ i, score }) => {
      const r = this.rows[i];
      return {
        name: r[0],
        composition: r[1],
        pack: r[2],
        manufacturer: r[3],
        discontinued: r[4] === 1,
        match: (score % 10) <= 2 ? 'name' : 'composition',
      } as MedicineItem;
    });
    return { total: unique.length, items };
  }
}

let cached: MedicineCatalog | null | undefined;

/** The shared catalogue, or null when the data file is missing or unreadable. */
export function getMedicineCatalog(filePath = process.env.MEDICINE_DB_PATH || DEFAULT_PATH): MedicineCatalog | null {
  if (cached !== undefined) return cached;
  try {
    const raw = zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf8');
    const rows = JSON.parse(raw) as Row[];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty catalogue');
    cached = new MedicineCatalog(rows);
    logger.info({ type: 'medicine_catalog_loaded', count: rows.length }, 'Medicine catalogue loaded');
  } catch (err) {
    logger.warn({ err, type: 'medicine_catalog_unavailable', filePath }, 'Medicine catalogue not available');
    cached = null;
  }
  return cached;
}
