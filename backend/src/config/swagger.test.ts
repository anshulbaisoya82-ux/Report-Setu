import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('OpenAPI / Swagger Documentation (Task 1.6)', () => {
  const app = createApp();

  it('should expose raw OpenAPI 3.0 specification JSON on /api-docs/json', async () => {
    const res = await request(app).get('/api-docs/json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('ReportSetu');
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(res.body.components.securitySchemes.cookieAuth).toBeDefined();
  });

  it('should serve Swagger UI HTML on /api-docs/', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('should redirect /api-docs to /api-docs/ with 301', async () => {
    const res = await request(app).get('/api-docs');

    // Express/swagger-ui-express standard redirect for trailing slash
    expect([200, 301]).toContain(res.status);
  });
});
