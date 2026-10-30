import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from './errorHandler';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
} from '../utils/errors';

describe('Central Error Handler Middleware (Task 1.5)', () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Test routes throwing various errors
    app.get('/error/bad-request', () => {
      throw new BadRequestError('Invalid input');
    });

    app.get('/error/unauthorized', () => {
      throw new UnauthorizedError('Session expired');
    });

    app.get('/error/forbidden', () => {
      throw new ForbiddenError('Doctor not connected to patient');
    });

    app.get('/error/not-found', () => {
      throw new NotFoundError('Report not found');
    });

    app.get('/error/conflict', () => {
      throw new ConflictError('RS ID collision');
    });

    app.get('/error/too-many-requests', () => {
      throw new TooManyRequestsError('Rate limit exceeded');
    });

    app.post('/error/zod', (req: Request, _res: Response) => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });
      schema.parse(req.body);
    });

    app.get('/error/cast-error', () => {
      const castErr = new Error('Invalid identifier');
      castErr.name = 'CastError';
      (castErr as any).path = 'patientId';
      throw castErr;
    });

    app.get('/error/duplicate-key', () => {
      const dupErr = new Error('E11000 duplicate key error');
      (dupErr as any).code = 11000;
      (dupErr as any).keyPattern = { email: 1 };
      throw dupErr;
    });

    app.get('/error/unhandled', () => {
      throw new Error('Unexpected database failure');
    });

    app.use(errorHandler);
    return app;
  };

  const app = createTestApp();

  it('should handle BadRequestError (400)', async () => {
    const res = await request(app).get('/error/bad-request');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('should handle UnauthorizedError (401)', async () => {
    const res = await request(app).get('/error/unauthorized');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should handle ForbiddenError (403)', async () => {
    const res = await request(app).get('/error/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should handle NotFoundError (404)', async () => {
    const res = await request(app).get('/error/not-found');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should handle ConflictError (409)', async () => {
    const res = await request(app).get('/error/conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should handle TooManyRequestsError (429)', async () => {
    const res = await request(app).get('/error/too-many-requests');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('should handle ZodError (422) with field-level details', async () => {
    const res = await request(app)
      .post('/error/zod')
      .send({ email: 'invalid-email', age: -5 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'age' }),
      ])
    );
  });

  it('should handle invalid database identifiers (400)', async () => {
    const res = await request(app).get('/error/cast-error');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IDENTIFIER');
    expect(res.body.error.message).toContain('patientId');
  });

  it('should handle duplicate key errors (409)', async () => {
    const res = await request(app).get('/error/duplicate-key');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_KEY_ERROR');
    expect(res.body.error.message).toContain('email');
  });

  it('should handle generic unhandled errors (500)', async () => {
    const res = await request(app).get('/error/unhandled');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
