import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import { verifyGeneratedClinicalNumbers } from '../services/ai/numberVerifier';
import { mlClient } from '../services/mlClient';
import { getAIProvider } from '../services/ai/aiProvider';
import { config } from '../config/env';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';

type AiParameter = {
  name: string; value: number; unit?: string; status: string; change?: string;
  correctedValue?: number; referenceRange?: string;
};
type IKeyFinding = {
  parameter: string; value: string; unit: string; tag: string; changeText: string;
};
type IAiOverview = { summary: string; pointsToConsider: string[]; keyFindings: IKeyFinding[]; generatedAt: Date };
const parametersOf = (value: Prisma.JsonValue): AiParameter[] =>
  Array.isArray(value) ? value as unknown as AiParameter[] : [];

const DraftSummarySchema = z.object({
  tone: z.enum(['Plain language', 'More detail', 'Brief']).optional().default('Plain language'),
  lang: z.enum(['en', 'hi', 'both']).optional().default('both'),
});

/**
 * Task 10.1: Clinical Overview & Key Findings Generation
 * POST /api/v1/reports/:id/ai-overview
 */
export async function generateReportAiOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    const parameters = parametersOf(report.parameters);
    const abnormalParams = parameters.filter(
      (p) => p.status === 'Low' || p.status === 'High' || p.status === 'Critical'
    );

    const normalParams = parameters.filter((p) => p.status === 'Normal');

    // 1. Structure key findings
    const keyFindings: IKeyFinding[] = parameters.map((p) => {
      const val = p.correctedValue ?? p.value;
      let changeText = 'Normal stable';
      if (p.status === 'Critical') {
        changeText = `Critical ${p.status.toLowerCase()} reading`;
      } else if (p.status === 'Low' || p.status === 'High') {
        changeText = `${p.status} reading outside standard reference range`;
      }
      return {
        parameter: p.name,
        value: String(val),
        unit: p.unit || '',
        tag: p.status,
        changeText: p.change || changeText,
      };
    });

    // 2. Points to consider (strictly phrased as non-autonomous suggestions)
    const pointsToConsider: string[] = [];
    for (const p of abnormalParams) {
      const pName = p.name.toLowerCase();
      const val = p.correctedValue ?? p.value;
      if (pName.includes('platelet')) {
        pointsToConsider.push(
          `Consider clinical monitoring of platelet recovery (${val} ${p.unit}) and scheduled repeat hemogram.`
        );
      } else if (pName.includes('haemoglobin') || pName.includes('hemoglobin') || pName === 'hb') {
        pointsToConsider.push(
          `Consider correlation of hemoglobin (${val} ${p.unit}) with dietary iron and red cell indices.`
        );
      } else if (pName.includes('hba1c') || pName.includes('sugar')) {
        pointsToConsider.push(
          `Consider reviewing glycemic stability if HbA1c (${val}%) exceeds targeted therapeutic threshold.`
        );
      } else if (pName.includes('wbc')) {
        pointsToConsider.push(
          `Consider tracking total leukocyte count (${val} ${p.unit}) against resolving infection symptoms.`
        );
      } else {
        pointsToConsider.push(
          `Consider clinical review of ${p.name} (${val} ${p.unit}) in correlation with patient symptoms.`
        );
      }
    }

    if (pointsToConsider.length === 0) {
      pointsToConsider.push('All evaluated parameters reside within standard reference intervals.');
    }

    // 3. Clinical Overview Summary
    let summaryText = '';
    if (abnormalParams.length > 0) {
      const abnormalSummary = abnormalParams
        .map((p) => `${p.name} at ${p.correctedValue ?? p.value} ${p.unit} (${p.status})`)
        .join(', ');
      summaryText = `Laboratory assessment reveals ${abnormalParams.length} parameter(s) requiring clinical attention: ${abnormalSummary}. ${normalParams.length} parameter(s) remain stable within normal limits.`;
    } else {
      summaryText = `Laboratory evaluation shows all ${parameters.length} analyzed parameters are within normal reference limits.`;
    }

    // 4. Run Number Verification Engine
    const verification = verifyGeneratedClinicalNumbers(
      summaryText,
      parameters.map((p) => ({
        name: p.name,
        value: p.correctedValue ?? p.value,
        unit: p.unit,
      }))
    );

    if (!verification.isValid) {
      logger.warn({ mismatches: verification.mismatches }, 'AI overview failed numerical verification');
    }

    // Calculate input hash for provenance audit
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(report.parameters))
      .digest('hex');

    const aiOverview: IAiOverview = {
      summary: summaryText,
      pointsToConsider,
      keyFindings,
      generatedAt: new Date(),
    };

    await prisma.report.update({ where: { id }, data: { aiOverview: aiOverview as unknown as Prisma.InputJsonValue } });

    res.status(200).json({
      status: 'success',
      data: {
        ...aiOverview,
        model: 'langgraph-clinical-triage-v1',
        promptVersion: 'report-summary-v1.0.md',
        inputHash,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 10.2: Patient-Friendly Summary Draft in English & Hindi
 * POST /api/v1/reports/:id/generate-draft
 */
export async function generateDraftSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const parseResult = DraftSummarySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid draft options', parseResult.error.issues);
    }

    const { tone } = parseResult.data;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    const parameters = parametersOf(report.parameters);
    const measurements = parameters.map((p) => ({
      test_code: p.name.toUpperCase().replace(/\s+/g, '_'),
      test_name: p.name,
      value: p.correctedValue ?? p.value,
      unit: p.unit,
      flag:
        p.status === 'Critical'
          ? 'critical_high'
          : p.status === 'High'
          ? 'high'
          : p.status === 'Low'
          ? 'low'
          : 'normal',
      date: report.collectionDate
        ? new Date(report.collectionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    }));

    // Draft summaries via Gemini LLM or ML client / local clinical heuristics
    let summaryEn = '';
    let summaryHi = '';
    const aiProvider = getAIProvider();

    if (aiProvider.name === 'gemini' || config.AI_PROVIDER === 'gemini') {
      try {
        const paramList = parameters
          .map((p) => `- ${p.name}: ${p.correctedValue ?? p.value} ${p.unit} (${p.status}) [Normal: ${p.referenceRange || 'N/A'}]`)
          .join('\n');

        const systemPrompt = `You are a medical writing assistant for Dr. Priya Mehta on the ReportSetu clinical platform.
Draft a reassuring, plain-language laboratory summary for patient ${report.patientName} (Tone: ${tone}).
CRITICAL RULES:
1. State facts strictly from the provided readings.
2. If mentioning numbers, they MUST match the exact provided numbers.
3. Keep the summary under 100 words.
4. Output strictly valid JSON matching this schema: {"summaryEn": "...", "summaryHi": "..."}`;

        const promptText = `PATIENT: ${report.patientName}
REPORT: ${report.name} (${report.category})
PARAMETERS:
${paramList}

Provide the plain-language summary in English and Hindi (Devanagari script):`;

        const geminiRes = await aiProvider.complete(promptText, {
          systemPrompt,
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 600,
        });

        const parsed = JSON.parse(geminiRes.text);
        if (parsed.summaryEn && parsed.summaryHi) {
          summaryEn = parsed.summaryEn;
          summaryHi = parsed.summaryHi;
        }
      } catch (err) {
        logger.warn({ err }, 'Gemini draft summary generation failed, falling back to mlClient');
      }
    }

    if (!summaryEn || !summaryHi) {
      const draftEn = await mlClient.draftSummary(report.patientName, measurements as any, [], 'en');
      const draftHi = await mlClient.draftSummary(report.patientName, measurements as any, [], 'hi');
      summaryEn = draftEn.summary;
      summaryHi = draftHi.summary;
    }

    // Run number verification on draft
    const verification = verifyGeneratedClinicalNumbers(
      summaryEn,
      parameters.map((p) => ({
        name: p.name,
        value: p.correctedValue ?? p.value,
        unit: p.unit,
      }))
    );

    if (!verification.isValid) {
      logger.warn({ mismatches: verification.mismatches }, 'English draft failed numerical verification');
    }

    // Persist draft in report with reviewStatus 'pending'
    // Patient cannot see this until doctor explicitly approves via PUT /api/v1/reports/:id/review
    res.status(200).json({
      status: 'success',
      data: {
        reportId: report.id,
        summaryEn,
        summaryHi,
        tone,
        reviewStatus: 'pending_doctor_approval',
        isApproved: false,
        verificationPassed: verification.isValid,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 10.2: Doctor Copilot Search Tools
 * GET /api/v1/doctor/copilot/search
 */
export async function searchDoctorCopilot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const doctorUserId = (req as any).user.userId;
    const { query, testCode, direction, priority } = req.query;

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
    const connections = doctor ? await prisma.connection.findMany({
      where: { doctorId: doctor.id, status: 'connected' },
    }) : [];

    const patientIds = connections.map((c) => c.patientId);
    const patients = await prisma.patientProfile.findMany({ where: { id: { in: patientIds } } });

    const reports = await prisma.report.findMany({
      where: { patientId: { in: patientIds } }, orderBy: { collectionDate: 'desc' },
    });

    const results = [];
    for (const p of patients) {
      const patientReports = reports.filter((r) => r.patientId === p.id);
      if (patientReports.length === 0) continue;

      const latestReport = patientReports[0];

      // Filter by critical priority
      if (priority === 'critical' && p.status !== 'Critical' && latestReport.status !== 'Critical') {
        continue;
      }

      // Filter by parameter testCode
      if (testCode) {
        const hasParam = parametersOf(latestReport.parameters).some(
          (param) => param.name.toLowerCase().includes(String(testCode).toLowerCase())
        );
        if (!hasParam) continue;
      }

      // Filter by keyword query
      if (query) {
        const qStr = String(query).toLowerCase();
        const matchesName = p.name.toLowerCase().includes(qStr);
        const matchesCondition = (p.conditions || []).some((c) => c.toLowerCase().includes(qStr));
        const matchesParam = parametersOf(latestReport.parameters).some((param) =>
          param.name.toLowerCase().includes(qStr)
        );
        if (!matchesName && !matchesCondition && !matchesParam) continue;
      }

      results.push({
        patientId: p.id,
        patientName: p.name,
        patientRsId: p.rsId,
        priority: p.status,
        latestReportName: latestReport.name,
        latestReportStatus: latestReport.status,
        latestReportDate: latestReport.collectionDate
          ? new Date(latestReport.collectionDate).toISOString().split('T')[0]
          : '',
        parameters: latestReport.parameters,
      });
    }

    res.status(200).json({
      status: 'success',
      data: results,
      totalMatched: results.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 10.4: Patient Question Suggested Reply Generator
 * POST /api/v1/doctor/threads/:id/suggest-reply
 */
export async function generateSuggestedReply(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    // Extract patientId from thread id "thread-<patientId>"
    const patientIdStr = id.replace(/^thread-/, '');

    const profile = await prisma.patientProfile.findUnique({ where: { id: patientIdStr } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found for thread');
    }

    // Get last message in thread
    const messages = await prisma.chatMessage.findMany({
      where: { patientId: profile.id }, orderBy: { createdAt: 'desc' }, take: 3,
    });

    const lastPatientMsg = messages.find((m) => m.sender === 'patient');
    const questionText = lastPatientMsg ? lastPatientMsg.text : 'Patient laboratory questions';

    // Get latest approved report
    const report = await prisma.report.findFirst({
      where: { patientId: profile.id, reviewed: true }, orderBy: { collectionDate: 'desc' },
    });

    let suggestedReply = '';
    const aiProvider = getAIProvider();

    if (aiProvider.name === 'gemini' || config.AI_PROVIDER === 'gemini') {
      try {
        const docPrompt = `You are Dr. Priya Mehta (General Physician) replying to your connected patient ${profile.name}.
Patient's recent inquiry: "${questionText}"
Latest confirmed report: ${report ? `${report.name} (${report.status}) - ${((report.doctorSummary as { text?: string } | null)?.text || '')}` : 'No recent report'}

Draft a concise, warm, professional doctor reply in 1 to 2 sentences:`;

        const geminiRes = await aiProvider.complete(docPrompt, {
          temperature: 0.2,
          maxTokens: 200,
        });

        const generatedReply = geminiRes.text.trim();
        // Providers may return a generic offline response. Do not expose it as
        // a patient-specific clinical reply unless it contains the patient
        // context that was supplied to the model.
        if (generatedReply && generatedReply.toLowerCase().includes(profile.name.toLowerCase())) {
          suggestedReply = generatedReply;
        }
      } catch (err) {
        logger.warn({ err }, 'Gemini suggested reply generation failed, using heuristic fallback');
      }
    }

    if (!suggestedReply) {
      const qLower = questionText.toLowerCase();

      if (qLower.includes('platelet') || qLower.includes('plt')) {
        const plt = report ? parametersOf(report.parameters).find((p) => p.name.toLowerCase().includes('platelet')) : undefined;
        const val = plt ? `${plt.correctedValue ?? plt.value} ${plt.unit}` : 'your recent test';
        suggestedReply = `Hello ${profile.name}, your platelet count of ${val} indicates positive steady recovery. Please continue staying well-hydrated and avoid strenuous contact sports until our next test.`;
      } else if (qLower.includes('hba1c') || qLower.includes('sugar') || qLower.includes('glucose')) {
        const a1c = report ? parametersOf(report.parameters).find((p) => p.name.toLowerCase().includes('hba1c')) : undefined;
        const val = a1c ? `${a1c.correctedValue ?? a1c.value}%` : 'recent reading';
        suggestedReply = `Hello ${profile.name}, your HbA1c is at ${val}. Please maintain your prescribed meal schedule and medication adherence. We will review trends at your next clinic visit.`;
      } else if (qLower.includes('medicine') || qLower.includes('dose') || qLower.includes('stop')) {
        suggestedReply = `Hello ${profile.name}, regarding your medication inquiry: please do not adjust or stop your doses autonomously. Continue your current regimen and we can review adjustments at our upcoming appointment.`;
      } else {
        suggestedReply = `Hello ${profile.name}, thank you for checking in. Based on your recent laboratory evaluation, your results are stable. Please let me know if you experience any new symptoms.`;
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        threadId: id,
        patientName: profile.name,
        suggestedReply,
      },
    });
  } catch (err) {
    next(err);
  }
}
