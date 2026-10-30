import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('App Factory & Health Route', () => {
  it('should initialize express app and respond on /health with standard envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      status: 'ok',
      service: 'report-setu-api',
    });
    expect(res.body.meta?.requestId).toBeDefined();
  });

  it('should return 404 for unknown endpoints with standard error envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.meta?.requestId).toBeDefined();
  });
});
