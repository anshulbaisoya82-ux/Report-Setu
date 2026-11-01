import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { getOwnFoodRules, getPatientFoodRules, setPatientFoodRules } from '../services/foodRulesService';
import { readFoodLabel } from '../services/foodLabelReader';

const user = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

/** Patient: the food rules their doctor set (null when none yet) and the conditions in their record. */
export const handleGetOwnFoodRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, await getOwnFoodRules(user(req).userId));
  } catch (err) {
    next(err);
  }
};

/** Doctor: one connected patient's food rules. */
export const handleGetPatientFoodRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, await getPatientFoodRules(user(req).userId, req.params.patientId));
  } catch (err) {
    next(err);
  }
};

/** Doctor: replace one connected patient's food rules. */
export const handleSetPatientFoodRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, { rules: await setPatientFoodRules(user(req).userId, req.params.patientId, req.body) });
  } catch (err) {
    next(err);
  }
};

/** Patient: read the text and numbers from a food-label photo. Nothing is stored. */
export const handleReadFoodLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    user(req);
    if (!req.file?.buffer) throw new BadRequestError('Attach a photo of the label');
    if (!req.file.mimetype.startsWith('image/')) throw new BadRequestError('Please upload a photo (JPG or PNG)');
    sendSuccess(res, { reading: await readFoodLabel(req.file.buffer, req.file.mimetype) });
  } catch (err) {
    next(err);
  }
};
