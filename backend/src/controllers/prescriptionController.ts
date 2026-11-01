import { Request, Response, NextFunction } from 'express';
import { createPrescription, getPrescriptions } from '../services/prescriptionService';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError, ValidationError, ServiceUnavailableError } from '../utils/errors';
import { mlClient } from '../services/mlClient';
import { getMedicineCatalog } from '../services/medicineCatalog';
import { logger } from '../utils/logger';

/**
 * Controller: Doctor issues a new prescription for a connected patient.
 */
export const handleCreatePrescription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor authorization required to issue prescriptions');
    }

    const {
      patientId,
      name,
      prescriptionName,
      instructions,
      startDate,
      endDate,
      totalDays,
      advice,
      medicines,
      medications,
    } = req.body;

    const resolvedName = (
      name ||
      prescriptionName ||
      medications?.[0]?.name ||
      medicines?.[0]?.name
    )?.trim();

    const rawMedicines = medicines || medications || [];
    const resolvedMedicines = rawMedicines.map((m: any) => ({
      name: m.name || resolvedName,
      dose: m.dose || m.dosage || '1 tablet',
      timing: Array.isArray(m.timing) ? m.timing.join(', ') : m.timing || m.frequency || 'Morning and Night',
      frequency: m.frequency,
      instructions: m.instructions,
    }));

    let resolvedInstructions = instructions?.trim();
    if (!resolvedInstructions) {
      if (resolvedMedicines.length > 0) {
        resolvedInstructions = resolvedMedicines
          .map((m: any) => `${m.dose} · ${m.timing}${m.instructions ? ` · ${m.instructions}` : ''}`)
          .join('; ');
      } else {
        resolvedInstructions = 'Take as prescribed';
      }
    }

    if (!patientId || !resolvedName) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'patientId and medicine name are required fields',
        },
      });
      return;
    }

    const result = await createPrescription(req.user.userId, {
      patientId,
      name: resolvedName,
      instructions: resolvedInstructions,
      startDate,
      endDate,
      totalDays: totalDays ? Number(totalDays) : undefined,
      advice: Array.isArray(advice) ? advice : advice ? [advice] : [],
      medicines: resolvedMedicines,
    });

    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves prescriptions for patient or doctor.
 */
export const handleGetPrescriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { patientId, status } = req.query;

    const list = await getPrescriptions(req.user.userId, req.user.role, {
      patientId: patientId as string,
      status: status as 'Active' | 'Ended',
    });

    sendSuccess(res, { prescriptions: list, total: list.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Medicine-name suggestions for the prescription form (doctor only).
 * Source 1: the bundled Indian medicine catalogue (~250k products, brand + composition).
 * Source 2 (only if the catalogue file is missing, or MEDICINE_SEARCH_SOURCE=ml): ML service /drug/suggest.
 * Only the typed text is used, never patient data. If no source works we answer 503, never made-up names.
 */
export const handleSuggestMedicines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = String(req.query.q ?? '').trim();
    const num = (v: unknown, def: number, min: number, max: number) => {
      const n = Number(v ?? def);
      return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : def;
    };
    const limit = num(req.query.limit, 30, 1, 100);
    const offset = num(req.query.offset, 0, 0, 100000);

    if (q.length > 80) {
      throw new ValidationError('Search text is too long (max 80 characters)');
    }
    if (q.length < 2) {
      sendSuccess(res, { query: q, total: 0, offset, suggestions: [], items: [], source: 'none' });
      return;
    }

    const catalog = process.env.MEDICINE_SEARCH_SOURCE === 'ml' ? null : getMedicineCatalog();
    if (catalog) {
      const { total, items } = catalog.search(q, { limit, offset });
      sendSuccess(res, { query: q, total, offset, suggestions: items.map((i) => i.name), items, source: 'india-medicine-db' });
      return;
    }

    let suggestions: string[];
    try {
      suggestions = offset > 0 ? [] : await mlClient.suggestMedicines(q, Math.min(limit, 50));
    } catch (err) {
      logger.warn({ err, type: 'medicine_suggest_unavailable' }, 'ML medicine suggestions unavailable');
      throw new ServiceUnavailableError('Medicine suggestions are unavailable right now. You can still type the name.');
    }
    sendSuccess(res, {
      query: q,
      total: suggestions.length,
      offset,
      suggestions,
      items: suggestions.map((name) => ({ name, composition: '', pack: '', manufacturer: '', discontinued: false, match: 'name' })),
      source: 'ml-service',
    });
  } catch (err) {
    next(err);
  }
};
