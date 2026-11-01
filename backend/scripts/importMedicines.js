/**
 * Production Indian Medicine Database Importer
 * Streams and batch-inserts 253,973 medicines into PostgreSQL
 * Usage: node scripts/importMedicines.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://reportsetu:reportsetu@127.0.0.1:5432/reportsetu?schema=public';
const pool = new Pool({ connectionString });

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function extractDosageForm(name, packSize) {
  const target = (name + ' ' + (packSize || '')).toLowerCase();
  if (target.includes('tablet') || target.includes('tab')) return 'Tablet';
  if (target.includes('capsule') || target.includes('cap')) return 'Capsule';
  if (target.includes('syrup') || target.includes('syr')) return 'Syrup';
  if (target.includes('injection') || target.includes('inj')) return 'Injection';
  if (target.includes('suspension') || target.includes('susp')) return 'Suspension';
  if (target.includes('drops') || target.includes('drop')) return 'Drops';
  if (target.includes('gel')) return 'Gel';
  if (target.includes('ointment')) return 'Ointment';
  if (target.includes('cream')) return 'Cream';
  if (target.includes('inhaler') || target.includes('puff') || target.includes('respules')) return 'Inhaler';
  if (target.includes('sachet')) return 'Sachet';
  return 'Tablet';
}

function extractStrength(name, comp) {
  const match = (name + ' ' + (comp || '')).match(/(\d+(\.\d+)?\s*(mg|mcg|ml|iu|gm|%|duo))/i);
  return match ? match[0].trim() : '';
}

function extractBrandName(name) {
  if (!name) return '';
  const parts = name.split(/\s+/);
  if (parts.length <= 1) return name;
  if (/^\d/.test(parts[1]) || /tablet|capsule|syrup|inj/i.test(parts[1])) {
    return parts[0];
  }
  return `${parts[0]} ${parts[1]}`;
}

async function insertBatch(rows) {
  if (rows.length === 0) return;
  const values = [];
  const valueStrings = [];
  let paramIdx = 1;

  for (const r of rows) {
    valueStrings.push(
      `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
    );
    values.push(
      r.id,
      r.name,
      r.brandName,
      r.genericName,
      r.composition,
      r.strength,
      r.dosageForm,
      r.manufacturer,
      r.price,
      r.packSize,
      r.isDiscontinued,
      r.source,
      r.sourceId
    );
  }

  const query = `
    INSERT INTO "Medicine" (
      "id", "name", "brandName", "genericName", "composition", "strength", "dosageForm", "manufacturer", "price", "packSize", "isDiscontinued", "source", "sourceId"
    )
    VALUES ${valueStrings.join(', ')}
    ON CONFLICT ("id") DO NOTHING;
  `;

  await pool.query(query, values);
}

async function run() {
  console.log('--- ReportSetu Medicine Importer ---');
  console.log('Connecting to PostgreSQL database...');

  const csvPath = path.join(__dirname, '..', 'data', 'indian_medicine_data.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: Dataset not found at ${csvPath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let batch = [];
  const BATCH_SIZE = 1000;
  let inserted = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Header row
    if (!line.trim()) continue;

    const cols = parseCsvLine(line);
    const id = cols[0] || `med_${lineCount}`;
    const name = cols[1] || '';
    if (!name) continue;

    const price = cols[2] ? parseFloat(cols[2]) : null;
    const isDiscontinued = cols[3] === 'TRUE';
    const manufacturer = cols[4] || '';
    const composition = cols[5] || '';
    const packSize = cols[6] || '';

    const dosageForm = extractDosageForm(name, packSize);
    const strength = extractStrength(name, composition);
    const brandName = extractBrandName(name);

    batch.push({
      id: `med_${id}`,
      name,
      brandName,
      genericName: composition,
      composition,
      strength,
      dosageForm,
      manufacturer,
      price: isNaN(price) ? null : price,
      packSize,
      isDiscontinued,
      source: 'indian_dataset',
      sourceId: id,
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      inserted += batch.length;
      batch = [];
      if (inserted % 20000 === 0) {
        console.log(`Progress: ${inserted.toLocaleString()} medicines imported...`);
      }
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nImport complete! Total ${inserted.toLocaleString()} medicines stored in PostgreSQL in ${durationSec}s.`);

  await pool.end();
}

run().catch((err) => {
  console.error('Import failed with error:', err);
  pool.end();
  process.exit(1);
});

