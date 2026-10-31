import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { config } from '../config/env';

/**
 * 404 Not Found Middleware for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(
    res,
    {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    },
    404
  );
};

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // 1. Known AppError instances
  if (err instanceof AppError) {
    logger.warn({
      type: 'operational_error',
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      requestId: req.id,
      path: req.originalUrl,
    });

    return sendError(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      err.statusCode
    );
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const formattedDetails = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return sendError(
      res,
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or parameters',
        details: formattedDetails,
      },
      422
    );
  }

  // 3. Legacy identifier validation errors
  if (err.name === 'CastError' && 'path' in err) {
    return sendError(
      res,
      {
        code: 'INVALID_IDENTIFIER',
        message: `Invalid format for field '${(err as any).path}'`,
      },
      400
    );
  }

  // 4. Legacy duplicate-key errors
  if ('code' in err && (err as any).code === 11000) {
    const duplicateFields = Object.keys((err as any).keyPattern || {});
    return sendError(
      res,
      {
        code: 'DUPLICATE_KEY_ERROR',
        message: `Resource with provided ${duplicateFields.join(', ')} already exists`,
      },
      409
    );
  }

  // 5. Multer Upload Errors
  if (err.name === 'MulterError') {
    const isLimit = (err as any).code === 'LIMIT_FILE_SIZE';
    return sendError(
      res,
      {
        code: isLimit ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_ERROR',
        message: isLimit
          ? 'Uploaded file exceeds the maximum allowed size of 10MB.'
          : err.message,
      },
      400
    );
  }

  // 6. Unhandled / Internal Server Errors
  logger.error({
    type: 'unhandled_error',
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.originalUrl,
  });

  const isProduction = config.NODE_ENV === 'production';

  return sendError(
    res,
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected server error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
    500
  );
};
