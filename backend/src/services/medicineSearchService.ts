import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export interface MedicineSearchResult {
  id: string;
  name: string;
  brandName: string;
  genericName?: string;
  composition?: string;
  strength?: string;
  dosageForm: string;
  manufacturer?: string;
  price?: number | null;
  packSize?: string | null;
  isDiscontinued: boolean;
  source: 'local_db' | 'drugdb' | 'eka_care';
  sourceId?: string;
  relevanceScore?: number;
}

// In-memory query cache with 5-minute TTL to ensure lightning-fast autocomplete response (<5ms)
interface CacheEntry {
  timestamp: number;
  results: MedicineSearchResult[];
}
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cleanString(str?: string | null): string {
  if (!str) return '';
  return str.trim();
}

function extractDosageForm(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('tablet') || lower.includes('tab')) return 'Tablet';
  if (lower.includes('capsule') || lower.includes('cap')) return 'Capsule';
  if (lower.includes('syrup') || lower.includes('syr') || lower.includes('suspension')) return 'Syrup';
  if (lower.includes('injection') || lower.includes('inj')) return 'Injection';
  if (lower.includes('drops') || lower.includes('drop')) return 'Drops';
  if (lower.includes('inhaler') || lower.includes('puff') || lower.includes('respules')) return 'Inhaler';
  if (lower.includes('sachet')) return 'Sachet';
  if (lower.includes('cream') || lower.includes('gel') || lower.includes('ointment')) return 'Ointment';
  return 'Tablet';
}

function extractStrength(text: string): string {
  const match = text.match(/(\d+(\.\d+)?\s*(mg|mcg|ml|iu|gm|%|duo))/i);
  return match ? match[0].trim() : '';
}

/**
 * Search local PostgreSQL Medicine database (Source A)
 */
async function searchLocalDatabase(cleanQuery: string, limit: number): Promise<MedicineSearchResult[]> {
  try {
    const qLower = cleanQuery.toLowerCase();
    const prefix = `${qLower}%`;
    const contains = `%${qLower}%`;

    const rows = await (prisma as any).$queryRawUnsafe(
      `
      SELECT 
        id, 
        name, 
        "brandName", 
        "genericName", 
        composition, 
        strength, 
        "dosageForm", 
        manufacturer, 
        price, 
        "packSize", 
        "isDiscontinued", 
        source, 
        "sourceId",
        CASE 
          WHEN LOWER(name) = $1 THEN 100
          WHEN LOWER("brandName") = $1 THEN 95
          WHEN LOWER(name) LIKE $2 THEN 85
          WHEN LOWER("brandName") LIKE $2 THEN 80
          WHEN LOWER(name) LIKE $3 THEN 65
          WHEN LOWER("genericName") LIKE $3 THEN 50
          WHEN LOWER(composition) LIKE $3 THEN 45
          ELSE 30
        END AS relevance
      FROM "Medicine"
      WHERE 
        LOWER(name) LIKE $3 
        OR LOWER("brandName") LIKE $3 
        OR LOWER("genericName") LIKE $3 
        OR LOWER(composition) LIKE $3
        OR LOWER(manufacturer) LIKE $3
      ORDER BY relevance DESC, name ASC
      LIMIT $4;
      `,
      qLower,
      prefix,
      contains,
      limit * 2
    );

    return (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      brandName: r.brandName || r.name,
      genericName: r.genericName || undefined,
      composition: r.composition || undefined,
      strength: r.strength || extractStrength(r.name),
      dosageForm: r.dosageForm || extractDosageForm(r.name),
      manufacturer: r.manufacturer || undefined,
      price: r.price ? parseFloat(r.price) : null,
      packSize: r.packSize || null,
      isDiscontinued: Boolean(r.isDiscontinued),
      source: 'local_db',
      sourceId: r.sourceId || undefined,
      relevanceScore: Number(r.relevance) || 50,
    }));
  } catch (err: any) {
    logger.warn({ message: 'Local PostgreSQL medicine search error', error: err?.message });
    return [];
  }
}

/**
 * Search DrugDB API (Source B)
 * https://drugdb.in/search?q={query}&type=medicine&limit=10
 */
async function searchDrugDB(cleanQuery: string, limit: number): Promise<MedicineSearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s strict timeout

    const url = `https://drugdb.in/search?q=${encodeURIComponent(cleanQuery)}&type=medicine&limit=${limit}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ReportSetu-Healthcare/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const data: any = await response.json();
    if (!data || !Array.isArray(data.results)) {
      return [];
    }

    const results: MedicineSearchResult[] = [];

    for (const item of data.results) {
      const medName = cleanString(item.medicineName);
      if (!medName) continue;

      const brand = cleanString(item['brand.brandName']) || medName.split(' ')[0];
      const generic = cleanString(item['generic.genericName']);
      const manufacturer = cleanString(item['manufacturer.manufacturerName']);
      const sctid = cleanString(item.medicineSctid);
      const form = extractDosageForm(medName);
      const strength = extractStrength(medName);

      const qLower = cleanQuery.toLowerCase();
      let score = 60;
      if (medName.toLowerCase().startsWith(qLower) || brand.toLowerCase().startsWith(qLower)) {
        score = 80;
      }

      results.push({
        id: `drugdb-${sctid || Math.random().toString(36).slice(2, 9)}`,
        name: medName,
        brandName: brand,
        genericName: generic || undefined,
        composition: generic || undefined,
        strength: strength || undefined,
        dosageForm: form,
        manufacturer: manufacturer || undefined,
        price: null,
        packSize: null,
        isDiscontinued: false,
        source: 'drugdb',
        sourceId: sctid,
        relevanceScore: score,
      });

      // Asynchronously cache item in PostgreSQL for permanent availability
      cacheDrugDbResultLocally(medName, brand, generic, strength, form, manufacturer, sctid).catch(() => { });
    }

    return results;
  } catch (err: any) {
    // Network failure or timeout: fail gracefully without crashing
    logger.info({ message: 'DrugDB external search skipped/timed out', error: err?.message });
    return [];
  }
}

/**
 * Cache an external DrugDB result into PostgreSQL asynchronously
 */
async function cacheDrugDbResultLocally(
  name: string,
  brandName: string,
  genericName: string,
  strength: string,
  dosageForm: string,
  manufacturer: string,
  sctid: string
): Promise<void> {
  try {
    const id = `drugdb-${sctid}`;
    await (prisma as any).$queryRawUnsafe(
      `
      INSERT INTO "Medicine" (
        "id", "name", "brandName", "genericName", "composition", "strength", "dosageForm", "manufacturer", "source", "sourceId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'drugdb', $9)
      ON CONFLICT ("id") DO NOTHING;
      `,
      id,
      name,
      brandName,
      genericName,
      genericName,
      strength,
      dosageForm,
      manufacturer,
      sctid
    );
  } catch { }
}

/**
 * Search Eka Care API (Source C - Configurable)
 * https://api.dev.eka.care/medical-db/v1/drugs-and-labs
 */
async function searchEkaCare(cleanQuery: string, limit: number): Promise<MedicineSearchResult[]> {
  const apiKey = process.env.EKA_CARE_API_KEY;
  if (!apiKey) {
    // Graceful skip when credentials are not configured
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const url = `https://api.dev.eka.care/medical-db/v1/drugs-and-labs?query=${encodeURIComponent(cleanQuery)}&type=drug&limit=${limit}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const data: any = await response.json();
    if (!data || !Array.isArray(data.drugs)) return [];

    return data.drugs.map((d: any) => ({
      id: `eka-${d.id || Math.random().toString(36).slice(2, 9)}`,
      name: d.name,
      brandName: d.brand_name || d.name,
      genericName: d.generic_name,
      composition: d.composition || d.generic_name,
      strength: d.strength || extractStrength(d.name),
      dosageForm: d.dosage_form || extractDosageForm(d.name),
      manufacturer: d.manufacturer,
      price: d.mrp ? parseFloat(d.mrp) : null,
      isDiscontinued: Boolean(d.is_discontinued),
      source: 'eka_care' as const,
      sourceId: d.id,
      relevanceScore: 75,
    }));
  } catch (err: any) {
    logger.warn({ message: 'Eka Care API search error', error: err?.message });
    return [];
  }
}

/**
 * Centralized Medicine Search Service
 * Combines Local PostgreSQL, DrugDB, and Eka Care with smart ranking & deduplication
 */
export async function searchMedicines(
  rawQuery: string,
  limit: number = 8
): Promise<MedicineSearchResult[]> {
  const query = (rawQuery || '').trim();
  if (query.length < 2) {
    return [];
  }

  const cacheKey = `${query.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const boundedLimit = Math.min(Math.max(limit, 1), 12);

  // Run local PostgreSQL and external DrugDB searches in parallel
  const [localResults, drugDbResults, ekaResults] = await Promise.all([
    searchLocalDatabase(query, boundedLimit),
    searchDrugDB(query, boundedLimit),
    searchEkaCare(query, boundedLimit),
  ]);

  // Merge and deduplicate by clean name
  const combined: MedicineSearchResult[] = [];
  const seenNames = new Set<string>();

  const allCandidates = [...localResults, ...drugDbResults, ...ekaResults];

  // Sort candidates by relevance score
  allCandidates.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  for (const item of allCandidates) {
    const norm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenNames.has(norm)) {
      seenNames.add(norm);
      combined.push(item);
    }
    if (combined.length >= boundedLimit) {
      break;
    }
  }

  // Save in cache
  searchCache.set(cacheKey, {
    timestamp: Date.now(),
    results: combined,
  });

  return combined;
}

/**
 * Get Medicine details by ID
 */
export async function getMedicineById(id: string): Promise<MedicineSearchResult | null> {
  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM "Medicine" WHERE id = $1 LIMIT 1;`,
      id
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        name: r.name,
        brandName: r.brandName || r.name,
        genericName: r.genericName || undefined,
        composition: r.composition || undefined,
        strength: r.strength || undefined,
        dosageForm: r.dosageForm || 'Tablet',
        manufacturer: r.manufacturer || undefined,
        price: r.price ? parseFloat(r.price) : null,
        packSize: r.packSize || null,
        isDiscontinued: Boolean(r.isDiscontinued),
        source: 'local_db',
        sourceId: r.sourceId || undefined,
      };
    }

    return null;
  } catch (err: any) {
    logger.error({ message: 'Error retrieving medicine by id', error: err?.message });
    return null;
  }
}

/**
 * Admin Cache & Telemetry Management
 */
export function clearMedicineCache(): number {
  const count = searchCache.size;
  searchCache.clear();
  return count;
}

export function getMedicineCacheStats(): { size: number; ttlMinutes: number } {
  return {
    size: searchCache.size,
    ttlMinutes: CACHE_TTL_MS / 60000,
  };
}
