import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initSocketServer, getSocketServer } from './services/socketService';
import { startReminderScheduler, stopReminderScheduler } from './services/reminderScheduler';
import { logger } from './utils/logger';

const PORT = config.PORT || 5000;
const app = createApp();
const server = http.createServer(app);

// Initialize real-time Socket.IO and background schedulers in non-test mode
if (config.NODE_ENV !== 'test') {
  (async () => {
    try {
      await connectDatabase();
      initSocketServer(server);
      startReminderScheduler();

      server.listen(PORT, () => {
        logger.info({
          message: `ReportSetu Backend service active on port ${PORT}`,
          env: config.NODE_ENV,
          apiPrefix: '/api/v1',
        });
      });
    } catch (err) {
      logger.error({ message: 'Fatal server startup error', error: (err as Error).message });
      process.exit(1);
    }
  })();
}

/**
 * Graceful Shutdown Handler (Task 11.2)
 * Drains active connections, closes sockets, stops schedulers, and disconnects PostgreSQL.
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ message: `Received ${signal}; initiating graceful shutdown` });

  stopReminderScheduler();

  const io = getSocketServer();
  if (io) {
    io.close(() => {
      logger.info({ message: 'Socket.IO connections closed' });
    });
  }

  server.close(async () => {
    logger.info({ message: 'HTTP server closed; closing database connections' });
    try {
      await disconnectDatabase();
      logger.info({ message: 'Graceful shutdown completed successfully' });
      if (config.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (err) {
      logger.error({ message: 'Error during database disconnect', error: (err as Error).message });
      if (config.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
export default app;
