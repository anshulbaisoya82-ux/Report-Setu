import { Request, Response, NextFunction } from 'express';
import { searchMedicines, getMedicineById } from '../services/medicineSearchService';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/errors';

/**
 * Controller: Search medicines by name, brand, generic, composition, or manufacturer.
 * GET /api/v1/medicines/search?q=paracetamol&limit=8
 */
export const handleSearchMedicines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 8;

    if (!q || q.trim().length < 2) {
      sendSuccess(res, { medicines: [], count: 0, query: q });
      return;
    }

    const results = await searchMedicines(q, limit);
    sendSuccess(res, {
      medicines: results,
      count: results.length,
      query: q,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Get full medicine details by ID.
 * GET /api/v1/medicines/:id
 */
export const handleGetMedicineDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const medicine = await getMedicineById(id);

    if (!medicine) {
      throw new NotFoundError(`Medicine with id '${id}' not found`);
    }

    sendSuccess(res, { medicine });
  } catch (err) {
    next(err);
  }
};

