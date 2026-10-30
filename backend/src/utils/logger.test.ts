import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { SENSITIVE_REDACT_PATHS } from './logger';

describe('Pino Logger PHI/PII Redaction (Task 1.3)', () => {
  it('should redact authorization headers, passwords, OTPs, and medical parameters', () => {
    let loggedOutput = '';

    const testStream = {
      write: (chunk: string) => {
        loggedOutput += chunk;
      },
    };

    const testLogger = pino(
      {
        level: 'info',
        redact: {
          paths: SENSITIVE_REDACT_PATHS,
          censor: '[REDACTED]',
        },
      },
      testStream
    );

    testLogger.info({
      message: 'Processing patient upload',
      password: 'superSecretPassword123!',
      otp: '987654',
      token: 'jwt.token.secret',
      parameters: [
        { name: 'Hemoglobin', value: 13.2 },
        { name: 'Platelets', value: 1.2 },
      ],
      bloodGroup: 'B+',
      conditions: ['Hypertension', 'Type 2 Diabetes'],
      safeField: 'harmless_metric',
    });

    const parsedLog = JSON.parse(loggedOutput);

    // Verify redactions
    expect(parsedLog.password).toBe('[REDACTED]');
    expect(parsedLog.otp).toBe('[REDACTED]');
    expect(parsedLog.token).toBe('[REDACTED]');
    expect(parsedLog.parameters).toBe('[REDACTED]');
    expect(parsedLog.bloodGroup).toBe('[REDACTED]');
    expect(parsedLog.conditions).toBe('[REDACTED]');

    // Verify non-sensitive field is intact
    expect(parsedLog.safeField).toBe('harmless_metric');
  });
});
