import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { config } from '../config/env';
import { ForbiddenError, TooManyRequestsError } from '../utils/errors';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// 1. Helmet Security Headers
// ---------------------------------------------------------------------------

/**
 * Configure Helmet with secure CSP and strict transport headers.
 * Swagger UI paths are exempted from strict CSP to allow interactive asset rendering.
 */
export const helmetMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Allow Swagger UI assets on doc routes
  if (req.path.startsWith('/api-docs')) {
    return helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })(req, res, next);
  }

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", config.CORS_ORIGIN, 'ws:', 'wss:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  })(req, res, next);
};

// ---------------------------------------------------------------------------
// 2. Strict Origin-Checked CORS
// ---------------------------------------------------------------------------

const parseAllowedOrigins = (): string[] => {
  return config.CORS_ORIGIN.split(',').map((origin) => origin.trim());
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, mobile apps, curl) with no origin
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = parseAllowedOrigins();

    // Allow localhost/127.0.0.1 in non-production environments
    if (config.NODE_ENV !== 'production') {
      if (
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new ForbiddenError(`Origin '${origin}' not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
    'Accept',
    'X-Admin-Key',
    'x-admin-key',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
  ],
  maxAge: 86400, // 24 hours preflight cache
};

export const corsMiddleware = cors(corsOptions);

// ---------------------------------------------------------------------------
// 3. NoSQL Query & Prototype Pollution Sanitization
// ---------------------------------------------------------------------------

const SENSITIVE_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips keys starting with '$', containing '.', or prototype pollution keys.
 */
export const sanitizeData = (target: unknown): boolean => {
  if (!target || typeof target !== 'object') {
    return false;
  }

  let modified = false;

  if (Array.isArray(target)) {
    for (const item of target) {
      if (sanitizeData(item)) {
        modified = true;
      }
    }
    return modified;
  }

  const record = target as Record<string, unknown>;

  // Strip dangerous prototype keys if present as own properties
  for (const prop of SENSITIVE_PROPS) {
    if (Object.prototype.hasOwnProperty.call(record, prop)) {
      delete record[prop];
      modified = true;
    }
  }

  const keys = Object.getOwnPropertyNames(record);

  for (const key of keys) {
    if (key.startsWith('$') || key.includes('.') || SENSITIVE_PROPS.has(key)) {
      delete record[key];
      modified = true;
    } else if (typeof record[key] === 'object' && record[key] !== null) {
      if (sanitizeData(record[key])) {
        modified = true;
      }
    }
  }

  return modified;
};

/**
 * Express middleware that removes NoSQL injection operators ($gt, $ne, $regex, etc.)
 * and prototype pollution properties from request body, query, and params.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  let wasSanitized = false;

  if (req.body) {
    wasSanitized = sanitizeData(req.body) || wasSanitized;
  }
  if (req.query) {
    wasSanitized = sanitizeData(req.query) || wasSanitized;
  }
  if (req.params) {
    wasSanitized = sanitizeData(req.params) || wasSanitized;
  }

  if (wasSanitized) {
    logger.warn({
      type: 'nosql_injection_sanitized',
      path: req.path,
      ip: req.ip,
      method: req.method,
      message: 'Suspicious NoSQL operators or prototype properties stripped from request payload',
    });
  }

  next();
};

// ---------------------------------------------------------------------------
// 4. Rate Limiting (Sliding Window Algorithm)
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  windowMs: number; // Duration of window in ms
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitStoreEntry {
  timestamps: number[];
}

/**
 * Creates an Express rate-limiting middleware using a sliding window algorithm.
 * Sets RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, and Retry-After headers.
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  const store = new Map<string, RateLimitStoreEntry>();
  const { windowMs, max, message = 'Too many requests, please try again later' } = options;

  const keyGenerator =
    options.keyGenerator ||
    ((req: Request): string => {
      return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        '127.0.0.1'
      );
    });

  const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Filter timestamps to current window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const currentHits = entry.timestamps.length;
    const remaining = Math.max(0, max - currentHits - 1);
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetTimeSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    // Standard rate limit headers
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.max(1, resetTimeSeconds));

    if (currentHits >= max) {
      const retryAfterSeconds = Math.max(1, resetTimeSeconds);
      res.setHeader('Retry-After', retryAfterSeconds);

      logger.warn({
        type: 'rate_limit_exceeded',
        ip: key,
        path: req.path,
        method: req.method,
        limit: max,
        windowMs,
      });

      return next(new TooManyRequestsError(message, { retryAfterSeconds }));
    }

    entry.timestamps.push(now);
    next();
  };

  // Utility to clear store for testing
  rateLimiterMiddleware.reset = () => {
    store.clear();
  };

  return rateLimiterMiddleware;
};

// General API rate limiter (300 requests per 15 minutes)
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'API rate limit exceeded. Please try again later.',
});

// Sensitive Auth / Login / Signup rate limiter (3 requests per 15 seconds)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 1000,
  max: 3,
  message: 'Too many authentication attempts. Please try again after 15 seconds.',
});

// OTP request / verification rate limiter (3 requests per 15 seconds)
export const otpRateLimiter = createRateLimiter({
  windowMs: 15 * 1000,
  max: 3,
  message: 'Too many OTP attempts. Please wait 15 seconds before trying again.',
  keyGenerator: (req: Request): string => {
    const mobile = req.body?.mobile || (req.query?.mobile as string) || '';
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    return `${ip}:${mobile}`;
  },
});

// Connection request rate limiter (20 requests per 15 minutes to prevent RS ID enumeration)
export const connectionRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many connection attempts. Please try again after 15 minutes.',
});
