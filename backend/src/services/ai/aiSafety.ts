import { ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

// Common prompt injection and adversarial jailbreak signatures
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override/i,
  /reveal\s+(system\s+prompt|instructions|secret|api\s*key)/i,
  /you\s+are\s+now\s+(unfiltered|dan|evil|jailbroken)/i,
  /dan\s+mode/i,
  /forget\s+all\s+(rules|guidelines)/i,
  /bypass\s+safety/i,
  /<\|im_start\|>/i,
  /<\|endoftext\|>/i,
];

// Sensitive system markers that must never appear in generated AI outputs
const LEAK_PATTERNS = [
  /jwt_access_secret/i,
  /encryption_key/i,
  /mongo_uri/i,
  /system\s*prompt\s*version\s*1\.[0-9]/i,
];

export interface SafetyCheckResult {
  isSafe: boolean;
  sanitizedText: string;
  flaggedReason?: string;
}

/**
 * Pre-flight safety filter: Sanitizes user input and detects prompt injection attacks.
 */
export function validateAndSanitizeUserInput(input: string): SafetyCheckResult {
  if (!input || typeof input !== 'string') {
    return { isSafe: true, sanitizedText: '' };
  }

  const trimmed = input.trim();

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      logger.warn({
        message: 'Security Alert: Prompt injection attempt detected and neutralized',
        inputSnippet: trimmed.substring(0, 80),
      });
      return {
        isSafe: false,
        sanitizedText: 'I can only assist with verified laboratory reports and clinical questions.',
        flaggedReason: 'Prompt injection attempt detected',
      };
    }
  }

  // Sanitize control characters and normalize input
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .substring(0, 4000); // 4000 char maximum length boundary

  return {
    isSafe: true,
    sanitizedText: sanitized,
  };
}

/**
 * Post-flight safety filter: Scans generated AI output for accidental leakage of system instructions or secrets.
 */
export function sanitizeAIOutput(output: string): string {
  if (!output || typeof output !== 'string') {
    return '';
  }

  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(output)) {
      logger.warn({ message: 'Security Alert: AI output leak pattern detected and redacted' });
      return 'The requested information is restricted. Please consult your physician for clinical inquiries.';
    }
  }

  return output;
}

/**
 * Applies a strict timeout budget (in milliseconds) to any AI asynchronous execution.
 */
export async function withTimeoutBudget<T>(
  promise: Promise<T>,
  timeoutMs = 10000,
  operationName = 'AI Completion'
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} exceeded execution timeout budget of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}
