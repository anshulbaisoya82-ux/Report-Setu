import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('RequestLogger Middleware (Task 1.3)', () => {
  it('should generate an X-Request-Id header if none provided', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    // Verify valid UUID format
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should preserve and echo back an incoming X-Request-Id header', async () => {
    const app = createApp();
    const customId = 'client-provided-request-id-999';

    const res = await request(app)
      .get('/health')
      .set('X-Request-Id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });
});
