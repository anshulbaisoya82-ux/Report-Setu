/**
 * DEMO MODE ONLY. Same ranking as backend/src/services/medicineCatalog.ts, run over a
 * ~2,600-row slice of the Indian medicine dataset (demoMedicines.json) so the demo shows
 * realistic suggestions without a server.
 */
type Row = [string, string, string, string, number];

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.%/+ ]+/g, ' ').replace(/\s+/g, ' ').trim();

let index: { rows: Row[]; names: string[]; comps: string[] } | null = null;

async function load() {
  if (!index) {
    const rows = (await import('./demoMedicines.json')).default as unknown as Row[];
    index = { rows, names: rows.map((r) => ` ${norm(r[0])}`), comps: rows.map((r) => ` ${norm(r[1])}`) };
  }
  return index;
}

export async function demoSearchMedicines(query: string, limit: number, offset: number) {
  const { rows, names, comps } = await load();
  const q = norm(query);
  if (q.length < 2) return { total: 0, items: [] };
  const words = q.split(' ');
  const hits: { i: number; score: number }[] = [];
  rows.forEach((r, i) => {
    let inName = true;
    for (const w of words) {
      const n = names[i].includes(` ${w}`);
      if (!n) inName = false;
      if (!n && !comps[i].includes(` ${w}`)) return;
    }
    const start = ` ${q}`;
    let score = names[i].startsWith(start) ? (/[a-z0-9]/.test(names[i].charAt(start.length)) ? 1 : 0) : inName ? 2 : 3;
    if (r[4]) score += 10;
    hits.push({ i, score });
  });
  hits.sort((a, b) => a.score - b.score || collator.compare(rows[a.i][0], rows[b.i][0]));
  const items = hits.slice(offset, offset + limit).map(({ i, score }) => ({
    name: rows[i][0],
    composition: rows[i][1],
    pack: rows[i][2],
    manufacturer: rows[i][3],
    discontinued: rows[i][4] === 1,
    match: score % 10 <= 2 ? 'name' : 'composition',
  }));
  return { total: hits.length, items };
}
