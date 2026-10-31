import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import {
  validateFileSignature,
  defaultScanBuffer,
  BufferScannerHook,
} from '../utils/fileSignature';
import { BadRequestError, AppError } from '../utils/errors';

export const MAX_REPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
]);

// Pluggable Antivirus / Malware scanning hook
let currentScannerHook: BufferScannerHook = defaultScanBuffer;

export const setScannerHook = (hook: BufferScannerHook): void => {
  currentScannerHook = hook;
};

export const resetScannerHook = (): void => {
  currentScannerHook = defaultScanBuffer;
};

/**
 * Multer in-memory storage configuration
 */
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new BadRequestError(
        `Unsupported file extension '${ext}'. Only PDF, PNG, and JPG files are accepted.`
      )
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(
      new BadRequestError(
        `Unsupported MIME type '${file.mimetype}'. Only PDF, PNG, and JPG formats are accepted.`
      )
    );
  }

  cb(null, true);
};

export const uploadSingleReport = multer({
  storage,
  limits: {
    fileSize: MAX_REPORT_FILE_SIZE,
    files: 1,
  },
  fileFilter,
}).single('file');

/**
 * Post-upload security validation middleware:
 * 1. Confirms file presence
 * 2. Magic-byte signature verification to block disguised files (.exe, scripts, etc.)
 * 3. Executes pluggable antivirus scan hook
 */
export const validateUploadedDocument = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new BadRequestError('No lab report file was provided in the upload request.');
    }

    // 1. Magic bytes signature verification
    const sigCheck = validateFileSignature(req.file.buffer, req.file.mimetype);
    if (!sigCheck.isValid) {
      throw new BadRequestError(sigCheck.error || 'Invalid file content signature.');
    }

    // 2. Antivirus security scanning hook
    const scanResult = await currentScannerHook(req.file.buffer, req.file.originalname);
    if (!scanResult.clean) {
      throw new AppError(
        scanResult.reason || 'Security threat detected in uploaded document buffer.',
        400,
        'SECURITY_SCAN_FAILED'
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};
