import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import {
  helmetMiddleware,
  corsMiddleware,
  sanitizeInput,
  apiRateLimiter,
} from './middlewares/security';
import { sendSuccess } from './utils/apiResponse';
import { setupSwagger } from './config/swagger';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import connectionRoutes from './routes/connectionRoutes';
import reportRoutes from './routes/reportRoutes';
import doctorRoutes from './routes/doctorRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import medicationRoutes from './routes/medicationRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import patientChatRoutes from './routes/patientChatRoutes';
import privacyRoutes from './routes/privacyRoutes';
import patientProfileRoutes from './routes/patientProfileRoutes';
import { isDatabaseConnected } from './config/database';

export const createApp = (): Express => {
  const app: Express = express();

  // 1. Security Headers & CORS
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // 2. Cookie & Body Parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 3. NoSQL Operator & Prototype Pollution Sanitization
  app.use(sanitizeInput);

  // 4. Request Tracing & Structured Logging
  app.use(requestLogger);

  // 5. Rate Limiting on /api/ endpoints
  app.use('/api', apiRateLimiter);

  // Interactive OpenAPI / Swagger Documentation
  setupSwagger(app);

  // Health ping endpoints (Task 11.2)
  app.get('/health', (_req: Request, res: Response) => {
    return sendSuccess(res, { status: 'ok', service: 'report-setu-api' });
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', (_req: Request, res: Response) => {
    const isDbConnected = isDatabaseConnected();
    if (isDbConnected) {
      return res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      return res.status(503).json({
        status: 'unavailable',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // REST API v1 Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/connections', connectionRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/doctor', doctorRoutes);
  app.use('/api/v1/prescriptions', prescriptionRoutes);
  app.use('/api/v1/medicines', medicationRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/patient/privacy', privacyRoutes);
  app.use('/api/v1/patient', patientProfileRoutes);
  app.use('/api/v1', patientChatRoutes);

  // Catch-all 404 handler for unknown routes
  app.use(notFoundHandler);

  // Global centralized error handler
  app.use(errorHandler);

  return app;
};
