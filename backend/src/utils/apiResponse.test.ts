import { describe, it, expect, vi } from 'vitest';
import { Response } from 'express';
import { sendSuccess, sendCreated, sendError } from './apiResponse';

const mockResponse = () => {
  const res: Partial<Response> = {
    req: { id: 'test-req-id-123' } as any,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
};

describe('API Response Envelope Utility (Task 1.5)', () => {
  it('should format 200 success response with data, success=true, and meta requestId', () => {
    const res = mockResponse();
    const data = { message: 'Success payload' };

    sendSuccess(res, data);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data,
      meta: { requestId: 'test-req-id-123' },
    });
  });

  it('should format 201 created response', () => {
    const res = mockResponse();
    const data = { id: 'created-id-456' };

    sendCreated(res, data, { customField: 'customMeta' });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data,
      meta: {
        requestId: 'test-req-id-123',
        customField: 'customMeta',
      },
    });
  });

  it('should format error response with error object and success=false', () => {
    const res = mockResponse();
    const errorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Field name is required',
      details: [{ field: 'name', message: 'Required' }],
    };

    sendError(res, errorPayload, 422);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: errorPayload,
      meta: { requestId: 'test-req-id-123' },
    });
  });
});
