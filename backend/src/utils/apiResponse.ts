import { Response } from 'express';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: ApiMeta;
}

/**
 * Standard success response helper
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  meta?: ApiMeta,
  statusCode = 200
): Response => {
  const envelope: ApiResponseEnvelope<T> = {
    success: true,
    data,
  };

  if (meta || res.req?.id) {
    envelope.meta = {
      ...(res.req?.id ? { requestId: res.req.id } : {}),
      ...(meta || {}),
    };
  }

  return res.status(statusCode).json(envelope);
};

/**
 * Standard 201 Created response helper
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  meta?: ApiMeta
): Response => {
  return sendSuccess(res, data, meta, 201);
};

/**
 * Standard error response helper
 */
export const sendError = (
  res: Response,
  error: ApiErrorPayload,
  statusCode = 500,
  meta?: ApiMeta
): Response => {
  const envelope: ApiResponseEnvelope = {
    success: false,
    error,
  };

  if (meta || res.req?.id) {
    envelope.meta = {
      ...(res.req?.id ? { requestId: res.req.id } : {}),
      ...(meta || {}),
    };
  }

  return res.status(statusCode).json(envelope);
};
