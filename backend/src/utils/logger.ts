import pino from 'pino';
import { config } from '../config/env';

/**
 * List of sensitive key paths and field names that must be redacted automatically
 * to ensure that PHI (Protected Health Information), PII, and credentials never appear in logs.
 */
export const SENSITIVE_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-access-token"]',
  'password',
  'confirmPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'code',
  'connectCode',
  'vcode',
  'encryptionKey',
  // Medical readings & PHI
  'parameters',
  '*.parameters',
  '*.value',
  'medicalHistory',
  'conditions',
  'bloodGroup',
  'privateNotes',
  'notes',
];

export const createLogger = (options: { level?: string; isPretty?: boolean } = {}) => {
  const isDevelopment = config.NODE_ENV === 'development' && options.isPretty !== false;

  return pino({
    level: options.level || config.LOG_LEVEL || 'info',
    redact: {
      paths: SENSITIVE_REDACT_PATHS,
      censor: '[REDACTED]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      service: 'report-setu-api',
      env: config.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};

export const logger = createLogger();
