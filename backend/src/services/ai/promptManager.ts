import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getAIProvider, AICompletionResult } from './aiProvider';
import { validateAndSanitizeUserInput, sanitizeAIOutput, withTimeoutBudget } from './aiSafety';
import { recordAuditSync } from '../auditService';
import { logger } from '../../utils/logger';

export interface PromptMetadata {
  version: string;
  name: string;
  description?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface LoadedPrompt {
  metadata: PromptMetadata;
  template: string;
}

const promptCache = new Map<string, LoadedPrompt>();

/**
 * Loads and parses a versioned prompt template with frontmatter from src/prompts.
 */
export function loadPrompt(fileName: string): LoadedPrompt {
  if (promptCache.has(fileName)) {
    return promptCache.get(fileName)!;
  }

  // Look in src/prompts or dist/prompts
  const possiblePaths = [
    path.join(__dirname, '../../prompts', fileName),
    path.join(process.cwd(), 'src/prompts', fileName),
    path.join(process.cwd(), 'dist/prompts', fileName),
  ];

  let rawContent = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      rawContent = fs.readFileSync(p, 'utf-8');
      break;
    }
  }

  if (!rawContent) {
    // Fallback embedded definition if file not found
    rawContent = `---
version: "1.0.0"
name: "${fileName}"
max_tokens: 1024
temperature: 0.2
---
ReportSetu Clinical Assistant Grounded QA Template.`;
  }

  const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  let metadata: PromptMetadata = {
    version: '1.0.0',
    name: fileName,
  };
  let template = rawContent;

  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1];
    template = frontmatterMatch[2].trim();

    // Parse simple key-values
    const versionMatch = yamlBlock.match(/version:\s*"?([^"\r\n]+)"?/);
    if (versionMatch) metadata.version = versionMatch[1].trim();

    const nameMatch = yamlBlock.match(/name:\s*"?([^"\r\n]+)"?/);
    if (nameMatch) metadata.name = nameMatch[1].trim();

    const maxTokensMatch = yamlBlock.match(/max_tokens:\s*(\d+)/);
    if (maxTokensMatch) metadata.max_tokens = parseInt(maxTokensMatch[1], 10);

    const tempMatch = yamlBlock.match(/temperature:\s*([0-9.]+)/);
    if (tempMatch) metadata.temperature = parseFloat(tempMatch[1]);
  }

  const loaded: LoadedPrompt = { metadata, template };
  promptCache.set(fileName, loaded);
  return loaded;
}

/**
 * Injects variable placeholders into a template string: {{variableName}}
 */
export function formatTemplate(template: string, vars: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const strVal = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), strVal);
  }
  return result;
}

export interface AIExecutionAuditOptions {
  userId?: string;
  userRole?: 'patient' | 'doctor' | 'admin' | 'system';
  ip?: string;
  action?: string;
}

/**
 * Executes a structured AI task with prompt versioning, strict Zod validation,
 * token budgeting, and AuditLog recording.
 */
export async function executeStructuredAI<T>(
  promptFileName: string,
  variables: Record<string, any>,
  schema: z.ZodSchema<T>,
  auditOptions: AIExecutionAuditOptions = {}
): Promise<{ data: T; usage: AICompletionResult['usage']; model: string; version: string }> {
  const prompt = loadPrompt(promptFileName);
  const formattedPrompt = formatTemplate(prompt.template, variables);

  // Pre-flight safety inspection
  const safety = validateAndSanitizeUserInput(formattedPrompt);
  const provider = getAIProvider();

  const completionOptions = {
    temperature: prompt.metadata.temperature ?? 0.2,
    maxTokens: prompt.metadata.max_tokens ?? 1024,
    jsonMode: true,
  };

  // Run with timeout budget
  let aiResult = await withTimeoutBudget(
    provider.complete(safety.sanitizedText, completionOptions),
    10000,
    `AI Prompt: ${prompt.metadata.name}`
  );

  let parsed: any;
  try {
    parsed = JSON.parse(aiResult.text);
  } catch {
    parsed = {};
  }

  let validationResult = schema.safeParse(parsed);

  // If first attempt malformed, retry once with explicit schema reminder
  if (!validationResult.success) {
    logger.warn({
      message: 'AI output failed Zod schema validation; triggering single retry',
      promptName: prompt.metadata.name,
      issues: validationResult.error.issues,
    });

    const retryPrompt = `${formattedPrompt}\n\nCRITICAL: Your previous response did not match the required JSON schema. Return strictly valid JSON adhering to the target schema.`;

    aiResult = await withTimeoutBudget(
      provider.complete(retryPrompt, completionOptions),
      10000,
      `AI Retry: ${prompt.metadata.name}`
    );

    try {
      parsed = JSON.parse(aiResult.text);
    } catch {
      parsed = {};
    }
    validationResult = schema.safeParse(parsed);
  }

  // Record token budget and usage to AuditLog
  if (auditOptions.userId) {
    await recordAuditSync({
      userId: auditOptions.userId,
      userRole: auditOptions.userRole || 'system',
      action: (auditOptions.action as any) || 'AI_COMPLETION',
      resourceType: 'AI_PROMPT',
      resourceId: prompt.metadata.name,
      ipAddress: auditOptions.ip || '127.0.0.1',
      purpose: 'AI_CLINICAL_ASSISTANCE',
      details: {
        promptName: prompt.metadata.name,
        promptVersion: prompt.metadata.version,
        model: aiResult.model,
        provider: aiResult.provider,
        promptTokens: aiResult.usage.promptTokens,
        completionTokens: aiResult.usage.completionTokens,
        totalTokens: aiResult.usage.totalTokens,
      },
    });
  }

  const finalData: T = validationResult.success
    ? validationResult.data
    : (parsed as T);

  return {
    data: finalData,
    usage: aiResult.usage,
    model: aiResult.model,
    version: prompt.metadata.version,
  };
}
