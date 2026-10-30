import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc, { Options } from 'swagger-jsdoc';
import { config } from './env';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'ReportSetu Healthcare API',
    version: '1.0.0',
    description:
      'Production-grade REST and Real-Time API for the ReportSetu medical lab-report platform. Powers Doctor Triage and Patient Care portals with end-to-end security, deterministic clinical evaluation, and dual AI agents.',
    contact: {
      name: 'ReportSetu Team',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API Version 1 Endpoint',
    },
    {
      url: '/',
      description: 'Root Server Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your 15-minute access token as: Bearer <token>',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Rotating httpOnly refresh token cookie',
      },
    },
    schemas: {
      ApiEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            },
          },
        },
      },
      ApiErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid parameter provided' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
};

const swaggerOptions: Options = {
  swaggerDefinition,
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * Attaches Swagger UI and raw OpenAPI JSON endpoints to the Express app.
 */
export const setupSwagger = (app: Express): void => {
  // Expose raw OpenAPI JSON spec
  app.get('/api-docs/json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'ReportSetu API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );
};
