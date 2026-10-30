import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { buildPatientContext } from '../services/ai/patientContextBuilder';
import { evaluateMedicalSafety } from '../services/ai/medicalSafety';
import { mlClient } from '../services/mlClient';
import { getAIProvider } from '../services/ai/aiProvider';
import { getSocketIO } from '../services/socketService';
import { config } from '../config/env';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';

type IChatCitation = { date: string; testName: string; value: number; unit: string };

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
  threadId: z.string().optional(),
  lang: z.enum(['en', 'hi']).optional().default('en'),
});

const DoctorReplySchema = z.object({
  reply: z.string().min(1, 'Reply cannot be empty').max(3000),
});

/**
 * POST /api/v1/patient/chat
 * Grounded clinical QA assistant with safety guardrails.
 */
export async function sendPatientMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid chat request parameters', parseResult.error.issues);
    }

    const { message, lang } = parseResult.data;
    const userId = (req as any).user.userId;

    // Fetch patient profile
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    const threadId = parseResult.data.threadId || `thread-${profile.id}`;

    // 1. Evaluate Medical Safety Guardrails
    const safety = evaluateMedicalSafety(message);

    // If query triggers emergency or medication alteration
    if (!safety.isSafe) {
      // Record patient message
      const patientMsg = await prisma.chatMessage.create({ data: {
        patientId: profile.id,
        sender: 'patient',
        text: message,
        threadId,
        isMedicineQuestion: safety.isMedicineQuestion,
        category: safety.isMedicineQuestion ? 'Medicine' : 'General',
        escalated: true,
        triageTag: safety.triageTag,
        citations: [],
      }});

      // Record assistant safety response
      const assistantMsg = await prisma.chatMessage.create({ data: {
        patientId: profile.id,
        sender: 'assistant',
        text: safety.responseMessage || '',
        threadId,
        isMedicineQuestion: safety.isMedicineQuestion,
        category: safety.isMedicineQuestion ? 'Medicine' : 'General',
        escalated: true,
        triageTag: safety.triageTag,
        citations: [],
      }});

      // Escalate to connected doctor if active connection exists
      const connection = await prisma.connection.findFirst({
        where: { patientId: profile.id, status: 'connected' },
      });

      if (connection) {
        await prisma.notification.create({ data: {
          userId: connection.doctorId,
          type: 'patient_question',
          title: safety.isMedicineQuestion
            ? `Medication Inquiry: ${profile.name}`
            : `Priority Patient Inquiry: ${profile.name}`,
          message: `Patient ${profile.name} asked: "${message.substring(0, 100)}..."`,
          data: { priority: safety.category === 'emergency' ? 'urgent' : 'high', patientId: profile.id },
        }});

        // Broadcast via Socket.IO to doctor
        try {
          const io = getSocketIO();
          if (io) {
            io.to(`user:${connection.doctorId}`).emit('patient:question', {
              threadId,
              patientId: profile.id,
              patientName: profile.name,
              patientRsId: profile.rsId,
              message,
              category: safety.isMedicineQuestion ? 'Medicine' : 'General',
              triageTag: safety.triageTag,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (socketErr) {
          logger.debug({ err: socketErr }, 'Socket notification skipped');
        }
      }

      res.status(200).json({
        status: 'success',
        data: {
          id: assistantMsg.id,
          sender: 'assistant',
          answer: safety.responseMessage,
          text: safety.responseMessage,
          escalated: true,
          isMedicineQuestion: safety.isMedicineQuestion,
          category: safety.category,
          triageTag: safety.triageTag,
          citations: [],
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 2. Safe Clinical Inquiry: Build Patient Context
    const context = await buildPatientContext(profile.id);

    // Extract latest approved summary text if available
    const approvedSummaryText =
      context.approvedSummaries.length > 0
        ? context.approvedSummaries[0].summary
        : '';

    // Safe Clinical Inquiry: Grounded QA via configured AI Provider (Gemini / ML / Mock)
    let answerText = '';
    let shouldEscalate = false;

    const provider = getAIProvider();

    if (provider.name === 'gemini' || config.AI_PROVIDER === 'gemini') {
      try {
        const measurementsSummary = context.measurements
          .slice(0, 10)
          .map((m) => `- ${m.testName}: ${m.value} ${m.unit} (${m.status}) [Reported: ${m.reportDate}]`)
          .join('\n');

        const activeMedsSummary = context.activePrescriptions
          .map((rx) => `- ${rx.prescriptionName}: ${rx.medicines.map((med) => `${med.name} ${med.dose} (${med.frequency})`).join(', ')}`)
          .join('\n');

        const systemPrompt = `You are the ReportSetu Clinical Assistant, an empathetic, supportive, and grounded medical assistant for Indian healthcare patients.
You are communicating with patient ${profile.name} (Age: ${profile.age || 'Adult'}, Gender: ${profile.gender || 'Patient'}).

STRICT CLINICAL RULES:
1. Ground your response ONLY in the provided verified doctor summaries, confirmed lab measurements, and active prescriptions below.
2. NEVER prescribe new medicines, change dosages, or tell the patient to stop a prescribed drug.
3. If the patient asks about altering medicines, kindly instruct them that doctor approval is required.
4. If emergency symptoms (chest pain, severe breathing difficulty, sudden collapse) are mentioned, instruct immediate emergency care (Call 108 / visit nearest emergency department).
5. Explain lab readings in plain, accessible, reassuring language. Avoid confusing jargon.
6. Target language: ${lang === 'hi' ? 'Hindi (or simple conversational Hindi/Hinglish suitable for Indian patients)' : 'English'}.
7. Keep answers concise (2 to 4 sentences max) suitable for a mobile screen.`;

        const promptText = `PATIENT CLINICAL RECORD:
Patient Name: ${profile.name}
Conditions: ${(profile.conditions || []).join(', ') || 'None declared'}

Latest Doctor-Approved Report Summary:
${approvedSummaryText || 'No previous doctor summary on file yet.'}

Recent Verified Lab Measurements:
${measurementsSummary || 'No recent measurements on file.'}

Active Prescriptions:
${activeMedsSummary || 'No active prescriptions.'}

PATIENT QUESTION:
"${message}"

Please provide a compassionate, grounded answer addressing the patient's question based strictly on their clinical record:`;

        const aiResult = await provider.complete(promptText, {
          systemPrompt,
          temperature: 0.2,
          maxTokens: 500,
        });

        answerText = aiResult.text.trim();
        if (!answerText) {
          const fallback = await mlClient.patientChat(message, approvedSummaryText);
          answerText = fallback.answer;
          shouldEscalate = fallback.escalate;
        }
      } catch (geminiErr) {
        logger.warn({ err: geminiErr }, 'Gemini patient chat invocation failed, using fallback');
        const fallback = await mlClient.patientChat(message, approvedSummaryText);
        answerText = fallback.answer;
        shouldEscalate = fallback.escalate;
      }
    } else {
      const chatRes = await mlClient.patientChat(message, approvedSummaryText);
      answerText = chatRes.answer;
      shouldEscalate = chatRes.escalate;
    }

    // Find relevant citations from confirmed measurements
    const citations: IChatCitation[] = [];
    const qLower = message.toLowerCase();

    for (const m of context.measurements) {
      const paramNameLower = m.testName.toLowerCase();
      if (
        qLower.includes(paramNameLower) ||
        (paramNameLower.includes('platelet') && qLower.includes('plt')) ||
        (paramNameLower.includes('haemoglobin') && qLower.includes('hb')) ||
        (paramNameLower.includes('hba1c') && (qLower.includes('sugar') || qLower.includes('a1c')))
      ) {
        citations.push({
          date: m.reportDate,
          testName: m.testName,
          value: m.value,
          unit: m.unit,
        });
      }
    }

    // Deduplicate citations by testName
    const uniqueCitations = citations.filter(
      (c, idx, arr) => arr.findIndex((x) => x.testName === c.testName) === idx
    );

    // Save patient message to DB
    await prisma.chatMessage.create({ data: {
      patientId: profile.id,
      sender: 'patient',
      text: message,
      threadId,
      isMedicineQuestion: false,
      category: 'Report',
      escalated: shouldEscalate,
      citations: [],
    }});

    // Save assistant answer to DB
    const assistantMsg = await prisma.chatMessage.create({ data: {
      patientId: profile.id,
      sender: 'assistant',
      text: answerText,
      threadId,
      isMedicineQuestion: false,
      category: 'Report',
      escalated: shouldEscalate,
      citations: uniqueCitations,
    }});

    // Stream tokens over Socket.IO if client socket is listening
    try {
      const io = getSocketIO();
      if (io) {
        const chunks = answerText.split(' ');
        for (let i = 0; i < chunks.length; i += 3) {
          const chunk = chunks.slice(i, i + 3).join(' ') + ' ';
          io.to(`user:${userId}`).emit('chat:chunk', {
            threadId,
            chunk,
          });
        }
        io.to(`user:${userId}`).emit('chat:done', {
          threadId,
          messageId: assistantMsg.id,
        });
      }
    } catch {
      // Non-blocking socket broadcast
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: assistantMsg.id,
        sender: 'assistant',
        answer: answerText,
        text: answerText,
        escalated: shouldEscalate,
        isMedicineQuestion: false,
        citations: uniqueCitations,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/patient/chat/history
 * Returns chat message history formatted for frontend.
 */
export async function getPatientChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { patientId: profile.id }, orderBy: { createdAt: 'asc' },
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.createdAt.toISOString(),
      isMedicineQuestion: m.isMedicineQuestion,
      citations: m.citations || [],
    }));

    res.status(200).json({
      status: 'success',
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/patient/chat/thread
 * Returns thread overview conforming to PatientQuestionThread in frontend.
 */
export async function getPatientChatThread(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { patientId: profile.id }, orderBy: { createdAt: 'asc' },
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.createdAt.toISOString(),
      isMedicineQuestion: m.isMedicineQuestion,
    }));

    const lastMsg = messages[messages.length - 1];

    res.status(200).json({
      status: 'success',
      data: {
        id: `thread-${profile.id}`,
        patientId: profile.id,
        patientName: profile.name,
        patientRsId: profile.rsId,
        patientAvatar: profile.avatar || '',
        reportContext: profile.lastReportName || 'Recent Lab Report',
        category: lastMsg?.isMedicineQuestion ? 'Medicine' : 'General',
        unreadCount: 0,
        lastMessageTime: lastMsg ? lastMsg.createdAt.toISOString() : new Date().toISOString(),
        messages: formattedMessages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/doctor/questions
 * Returns all patient question threads for connected doctor.
 */
export async function getDoctorQuestionThreads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doctorUserId = (req as any).user.userId;
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
    const doctorProfileId = doctor?.id;

    const connections = doctorProfileId ? await prisma.connection.findMany({
      where: { doctorId: doctorProfileId, status: 'connected' },
    }) : [];

    const patientIds = connections.map((c) => c.patientId);
    const profiles = await prisma.patientProfile.findMany({ where: { id: { in: patientIds } } });

    const threads = [];
    for (const p of profiles) {
      const msgs = await prisma.chatMessage.findMany({
        where: { patientId: p.id }, orderBy: { createdAt: 'asc' },
      });

      if (msgs.length === 0) continue;

      const lastMsg = msgs[msgs.length - 1];
      const hasMedQuestion = msgs.some((m) => m.isMedicineQuestion);
      const lastDoctorMessage = [...msgs].reverse().find((m) => m.sender === 'doctor');

      threads.push({
        id: `thread-${p.id}`,
        patientId: p.id,
        patientName: p.name,
        patientRsId: p.rsId,
        patientAvatar: p.avatar || '',
        reportContext: p.lastReportName || 'Complete Blood Count',
        category: hasMedQuestion ? 'Medicine' : 'General',
        unreadCount: msgs.filter((m) =>
          m.sender === 'patient' &&
          (!lastDoctorMessage || m.createdAt > lastDoctorMessage.createdAt)
        ).length,
        lastMessageTime: lastMsg.createdAt.toISOString(),
        messages: msgs.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: m.createdAt.toISOString(),
          isMedicineQuestion: m.isMedicineQuestion,
        })),
      });
    }

    res.status(200).json({
      status: 'success',
      data: threads,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/doctor/questions/:threadId/reply
 * Doctor replies to patient question thread.
 */
export async function replyToPatientQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { threadId } = req.params;
    const parseResult = DoctorReplySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid doctor reply body', parseResult.error.issues);
    }

    const { reply } = parseResult.data;
    const doctorUserId = (req as any).user.userId;

    // Extract patientId from threadId "thread-<patientId>"
    const patientIdStr = threadId.replace(/^thread-/, '');
    const profile = await prisma.patientProfile.findUnique({ where: { id: patientIdStr } });
    if (!profile) {
      throw new NotFoundError('Patient thread not found');
    }

    const doctorMsg = await prisma.chatMessage.create({ data: {
      patientId: profile.id,
      sender: 'doctor',
      text: reply,
      threadId,
      isMedicineQuestion: false,
      category: 'General',
      escalated: false,
      citations: [],
    }});

    // Notify patient via Socket.IO & In-app Notification
    await prisma.notification.create({ data: {
      userId: profile.userId,
      type: 'doctor_reply',
      title: 'Dr. replied to your question',
      message: reply.substring(0, 100),
      data: { priority: 'high', patientId: profile.id },
    }});

    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user:${profile.userId}`).emit('chat:new', {
          id: doctorMsg.id,
          threadId,
          sender: 'doctor',
          text: reply,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking socket notification
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: doctorMsg.id,
        sender: 'doctor',
        text: reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}
