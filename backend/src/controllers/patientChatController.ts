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
  doctorId: z.string().optional(),
  threadId: z.string().optional(),
  lang: z.enum(['en', 'hi']).optional().default('en'),
});

const DoctorReplySchema = z.object({
  reply: z.string().min(1, 'Reply cannot be empty').max(3000),
});

const ToggleAiSchema = z.object({
  action: z.enum(['takeover', 'resume']),
  reason: z.string().optional(),
});

/**
 * Checks if AI automated replies are currently paused for a given thread.
 */
async function getThreadAiStatus(threadId: string): Promise<{ isPaused: boolean; reason?: string; lastActor?: string }> {
  const stateMsg = await prisma.chatMessage.findFirst({
    where: {
      threadId,
      OR: [
        { triageTag: 'DoctorTakeover' },
        { triageTag: 'AiResumed' },
        { triageTag: 'Prescription' },
        { triageTag: 'Emergency' },
        { triageTag: 'DoctorReview' },
        { category: 'System' },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!stateMsg) return { isPaused: false };
  const isPaused = stateMsg.triageTag !== 'AiResumed';
  return {
    isPaused,
    reason: stateMsg.text,
    lastActor: stateMsg.sender,
  };
}

/**
 * POST /api/v1/patient/chat
 * Grounded clinical QA assistant with doctor connection prerequisite & safety auto-pause.
 */
export async function sendPatientMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid chat request parameters', parseResult.error.issues);
    }

    const { message, lang, doctorId: requestedDoctorId } = parseResult.data;
    const userId = (req as any).user.userId;

    // 1. Fetch patient profile
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    // 2. Connection Prerequisite Check: Patient can only ask if connected to >= 1 doctor
    const connections = await prisma.connection.findMany({
      where: { patientId: profile.id, status: 'connected' },
      include: { doctor: true },
    });

    if (connections.length === 0) {
      throw new BadRequestError('You cannot ask questions yet. You must connect with at least one doctor first before asking clinical questions.');
    }

    // 3. Resolve Target Doctor (selected by patient if multiple, or default to first)
    const targetConn = requestedDoctorId
      ? connections.find((c) => c.doctorId === requestedDoctorId || c.doctor?.id === requestedDoctorId) || connections[0]
      : connections[0];

    const targetDoctor = targetConn.doctor;
    if (!targetDoctor) {
      throw new BadRequestError('Connected doctor profile not found.');
    }

    const threadId = parseResult.data.threadId || `thread-${profile.id}-${targetDoctor.id}`;

    // 4. Check if Thread AI is currently Paused (Doctor Takeover or Auto-Paused)
    const aiStatus = await getThreadAiStatus(threadId);

    if (aiStatus.isPaused) {
      // Record patient message without automated AI intervention
      const patientMsg = await prisma.chatMessage.create({
        data: {
          patientId: profile.id,
          doctorId: targetDoctor.id,
          sender: 'patient',
          text: message,
          threadId,
          isMedicineQuestion: false,
          category: 'Doctor',
          escalated: true,
          triageTag: 'DoctorReview',
          citations: [],
        },
      });

      // Notify doctor via DB Notification & WebSocket
      await prisma.notification.create({
        data: {
          userId: targetDoctor.userId,
          type: 'patient_question',
          title: `Patient Message: ${profile.name}`,
          message: `Patient ${profile.name} sent: "${message.substring(0, 100)}..."`,
          data: { priority: 'high', patientId: profile.id, threadId },
        },
      });

      try {
        const io = getSocketIO();
        if (io) {
          io.to(`user:${targetDoctor.userId}`).emit('patient:question', {
            threadId,
            patientId: profile.id,
            patientName: profile.name,
            patientRsId: profile.rsId,
            message,
            category: 'Doctor',
            triageTag: 'DoctorReview',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (socketErr) {
        logger.debug({ err: socketErr }, 'Socket notification skipped');
      }

      res.status(200).json({
        status: 'success',
        data: {
          id: patientMsg.id,
          sender: 'assistant',
          answer: `AI responses are paused on this conversation while ${targetDoctor.name} manages your care. Your message was delivered directly to your doctor's priority queue.`,
          text: `AI responses are paused on this conversation while ${targetDoctor.name} manages your care. Your message was delivered directly to your doctor's priority queue.`,
          escalated: true,
          isAiPaused: true,
          isMedicineQuestion: false,
          category: 'Doctor',
          triageTag: 'DoctorReview',
          citations: [],
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 5. Evaluate Medical Safety Guardrails
    const safety = evaluateMedicalSafety(message, targetDoctor.name);

    // If query triggers prescription request, dosage alteration, emergency, or direct doctor request
    if (!safety.isSafe) {
      // Record patient message
      const patientMsg = await prisma.chatMessage.create({
        data: {
          patientId: profile.id,
          doctorId: targetDoctor.id,
          sender: 'patient',
          text: message,
          threadId,
          isMedicineQuestion: safety.isMedicineQuestion,
          category: safety.isMedicineQuestion ? 'Medicine' : 'General',
          escalated: true,
          triageTag: safety.triageTag,
          citations: [],
        },
      });

      // Record assistant safety auto-pause response
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          patientId: profile.id,
          doctorId: targetDoctor.id,
          sender: 'assistant',
          text: safety.responseMessage || '',
          threadId,
          isMedicineQuestion: safety.isMedicineQuestion,
          category: safety.isMedicineQuestion ? 'Medicine' : 'General',
          escalated: true,
          triageTag: safety.triageTag,
          citations: [{ isAiPaused: true, action: 'auto_paused', reason: safety.flaggedReason }],
        },
      });

      // Escalate to connected doctor
      await prisma.notification.create({
        data: {
          userId: targetDoctor.userId,
          type: 'patient_question',
          title: safety.isMedicineQuestion
            ? `Medication/Prescription Inquiry: ${profile.name}`
            : `Priority Patient Inquiry: ${profile.name}`,
          message: `Patient ${profile.name} asked: "${message.substring(0, 100)}..."`,
          data: { priority: safety.category === 'emergency' ? 'urgent' : 'high', patientId: profile.id, threadId },
        },
      });

      // Broadcast via Socket.IO to doctor
      try {
        const io = getSocketIO();
        if (io) {
          io.to(`user:${targetDoctor.userId}`).emit('patient:question', {
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

      res.status(200).json({
        status: 'success',
        data: {
          id: assistantMsg.id,
          sender: 'assistant',
          answer: safety.responseMessage,
          text: safety.responseMessage,
          escalated: true,
          isAiPaused: true,
          isMedicineQuestion: safety.isMedicineQuestion,
          category: safety.category,
          triageTag: safety.triageTag,
          citations: [],
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 6. Safe Clinical Inquiry: Build Comprehensive Grounded Context
    const context = await buildPatientContext(profile.id);

    const approvedSummaryText =
      context.approvedSummaries.length > 0
        ? context.approvedSummaries[0].summary
        : '';

    // Format appointments context
    const appointmentsSummary = context.appointments
      .slice(0, 5)
      .map((a) => `- ${a.date} at ${a.time} (${a.type}) with ${a.doctorName} [Status: ${a.status}] Reason: ${a.reason}${a.notes ? ` (Notes: ${a.notes})` : ''}`)
      .join('\n');

    // Format today's medication schedule
    const scheduleSummary = context.medicineSchedules
      .slice(0, 8)
      .map((s) => `- ${s.name} ${s.dose} at ${s.scheduledTime} (${s.timing}) [Status: ${s.state}]${s.takenAt ? ` (Taken at ${s.takenAt})` : ''}`)
      .join('\n');

    const measurementsSummary = context.measurements
      .slice(0, 15)
      .map((m) => `- ${m.testName}: ${m.value} ${m.unit} (${m.status}, Ref: ${m.referenceRange}) [Reported: ${m.reportDate}]`)
      .join('\n');

    const activeMedsSummary = context.activePrescriptions
      .map((rx) => `- ${rx.prescriptionName} (by ${rx.doctorName}): ${rx.medicines.map((med) => `${med.name} ${med.dose} (${med.timing})`).join(', ')}. Instructions: ${rx.instructions}`)
      .join('\n');

    let answerText = '';
    let shouldEscalate = false;

    const provider = getAIProvider();

    if (provider.name === 'gemini' || config.AI_PROVIDER === 'gemini') {
      try {
        const systemPrompt = `You are the ReportSetu Clinical Assistant, an empathetic, supportive, and strictly grounded medical assistant for Indian healthcare patients.
You are assisting patient ${profile.name} (Age: ${profile.age || 'Adult'}, Gender: ${profile.gender || 'Patient'}), whose primary treating doctor is ${targetDoctor.name} (${targetDoctor.specialty}).

STRICT CLINICAL BOUNDARIES:
1. Ground your response ONLY in the verified doctor summaries, lab measurements, upcoming appointments, and daily medicine schedules provided below.
2. NEVER prescribe new medicines, suggest drugs, recommend antibiotics, change dosages, or tell the patient to stop a prescribed drug.
3. If the patient asks for prescriptions or medical changes, kindly explain that only Dr. ${targetDoctor.name} can prescribe medication or adjust care.
4. If emergency symptoms (chest pain, breathlessness, collapse, heavy bleeding) are mentioned, instruct immediate emergency care (Call 108 / 112).
5. If the patient asks about appointments (dates, times, clinic), accurately report from their upcoming appointment records.
6. If the patient asks about medicine timings or daily schedule, confirm from their prescribed schedule.
7. Explain lab readings plainly and reassuringly relative to normal biological ranges.
8. Target language: ${lang === 'hi' ? 'Hindi (conversational Hindi/Hinglish suitable for Indian patients)' : 'English'}.
9. Keep answers concise (2 to 4 sentences max) suitable for a mobile screen.`;

        const promptText = `PATIENT COMPLETE CLINICAL RECORD:
Patient Name: ${profile.name}
Conditions: ${(profile.conditions || []).join(', ') || 'None declared'}
Blood Group: ${profile.bloodGroup || 'Unknown'}
Connected Treating Doctor: ${targetDoctor.name} (${targetDoctor.specialty})

UPCOMING & RECENT APPOINTMENTS:
${appointmentsSummary || 'No appointments scheduled.'}

TODAY'S PRESCRIBED MEDICATION SCHEDULE:
${scheduleSummary || 'No medication schedule records for today.'}

ACTIVE PRESCRIPTIONS:
${activeMedsSummary || 'No active prescriptions on file.'}

VERIFIED LAB MEASUREMENTS (CHRONOLOGICAL):
${measurementsSummary || 'No recent confirmed lab measurements.'}

DOCTOR-APPROVED SUMMARY & ADVICE:
${approvedSummaryText || 'No previous doctor summary on file yet.'}

PATIENT QUESTION:
"${message}"

Please provide a grounded, compassionate, and reassuring response strictly using their verified health record:`;

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

    // Extract relevant citations from confirmed measurements
    const citations: IChatCitation[] = [];
    const qLower = message.toLowerCase();

    for (const m of context.measurements) {
      const paramNameLower = m.testName.toLowerCase();
      if (
        qLower.includes(paramNameLower) ||
        (paramNameLower.includes('platelet') && (qLower.includes('plt') || qLower.includes('platelet'))) ||
        (paramNameLower.includes('haemoglobin') && (qLower.includes('hb') || qLower.includes('hemoglobin'))) ||
        (paramNameLower.includes('hba1c') && (qLower.includes('sugar') || qLower.includes('a1c') || qLower.includes('diabetes')))
      ) {
        citations.push({
          date: m.reportDate,
          testName: m.testName,
          value: m.value,
          unit: m.unit,
        });
      }
    }

    const uniqueCitations = citations.filter(
      (c, idx, arr) => arr.findIndex((x) => x.testName === c.testName) === idx
    );

    // Save patient message to DB
    await prisma.chatMessage.create({
      data: {
        patientId: profile.id,
        doctorId: targetDoctor.id,
        sender: 'patient',
        text: message,
        threadId,
        isMedicineQuestion: false,
        category: 'Report',
        escalated: shouldEscalate,
        citations: [],
      },
    });

    // Save assistant answer to DB
    const assistantMsg = await prisma.chatMessage.create({
      data: {
        patientId: profile.id,
        doctorId: targetDoctor.id,
        sender: 'assistant',
        text: answerText,
        threadId,
        isMedicineQuestion: false,
        category: 'Report',
        escalated: shouldEscalate,
        citations: uniqueCitations,
      },
    });

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
        isAiPaused: false,
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

    const { doctorId } = req.query;

    const whereClause: any = { patientId: profile.id };
    if (doctorId && typeof doctorId === 'string') {
      whereClause.OR = [{ doctorId }, { threadId: { contains: doctorId } }];
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
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
 * Returns thread overview including connected doctors and AI pause status.
 */
export async function getPatientChatThread(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    // Fetch active doctor connections
    const connections = await prisma.connection.findMany({
      where: { patientId: profile.id, status: 'connected' },
      include: { doctor: true },
    });

    const connectedDoctors = connections
      .filter((c) => Boolean(c.doctor))
      .map((c) => ({
        id: c.doctor.id,
        name: c.doctor.name,
        specialty: c.doctor.specialty,
        clinic: c.doctor.clinic,
      }));

    const requestedDoctorId = req.query.doctorId as string | undefined;
    const activeDoctor = requestedDoctorId
      ? connectedDoctors.find((d) => d.id === requestedDoctorId) || connectedDoctors[0]
      : connectedDoctors[0];

    const threadId = activeDoctor ? `thread-${profile.id}-${activeDoctor.id}` : `thread-${profile.id}`;

    const messages = await prisma.chatMessage.findMany({
      where: {
        patientId: profile.id,
        ...(activeDoctor ? { OR: [{ doctorId: activeDoctor.id }, { threadId }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.createdAt.toISOString(),
      isMedicineQuestion: m.isMedicineQuestion,
    }));

    const lastMsg = messages[messages.length - 1];
    const aiStatus = await getThreadAiStatus(threadId);

    res.status(200).json({
      status: 'success',
      data: {
        id: threadId,
        patientId: profile.id,
        patientName: profile.name,
        patientRsId: profile.rsId,
        patientAvatar: profile.avatar || '',
        reportContext: profile.lastReportName || 'Recent Lab Report',
        category: lastMsg?.isMedicineQuestion ? 'Medicine' : 'General',
        unreadCount: 0,
        isAiPaused: aiStatus.isPaused,
        activeDoctor: activeDoctor || null,
        connectedDoctors,
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

    const connections = doctorProfileId
      ? await prisma.connection.findMany({
          where: { doctorId: doctorProfileId, status: 'connected' },
        })
      : [];

    const patientIds = connections.map((c) => c.patientId);
    const profiles = await prisma.patientProfile.findMany({ where: { id: { in: patientIds } } });

    const threads = [];
    for (const p of profiles) {
      const threadId = `thread-${p.id}-${doctorProfileId}`;
      const msgs = await prisma.chatMessage.findMany({
        where: {
          patientId: p.id,
          OR: [{ doctorId: doctorProfileId }, { threadId }, { threadId: `thread-${p.id}` }],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (msgs.length === 0) continue;

      const lastMsg = msgs[msgs.length - 1];
      const hasMedQuestion = msgs.some((m) => m.isMedicineQuestion || m.triageTag === 'Prescription');
      const lastDoctorMessage = [...msgs].reverse().find((m) => m.sender === 'doctor');

      const aiStatus = await getThreadAiStatus(threadId);

      threads.push({
        id: threadId,
        patientId: p.id,
        patientName: p.name,
        patientRsId: p.rsId,
        patientAvatar: p.avatar || '',
        reportContext: p.lastReportName || 'Complete Blood Count',
        category: hasMedQuestion ? 'Medicine' : 'General',
        isAiPaused: aiStatus.isPaused,
        doctorName: doctor?.name || 'Doctor',
        unreadCount: msgs.filter(
          (m) =>
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

function extractPatientAndDoctorFromThreadId(threadId: string): { patientId: string; doctorId?: string } {
  const stripped = threadId.replace(/^thread-/, '');
  const uuidRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const match1 = stripped.match(uuidRegex);
  if (match1) {
    const patientId = match1[1];
    const remainder = stripped.slice(patientId.length).replace(/^-/, '');
    const match2 = remainder.match(uuidRegex);
    return { patientId, doctorId: match2 ? match2[1] : undefined };
  }
  const parts = stripped.split('-');
  return { patientId: parts[0] };
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
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });

    const { patientId } = extractPatientAndDoctorFromThreadId(threadId);

    const profile = await prisma.patientProfile.findUnique({ where: { id: patientId } });
    if (!profile) {
      throw new NotFoundError('Patient thread not found');
    }

    const doctorMsg = await prisma.chatMessage.create({
      data: {
        patientId: profile.id,
        doctorId: doctor?.id,
        sender: 'doctor',
        text: reply,
        threadId,
        isMedicineQuestion: false,
        category: 'General',
        escalated: false,
        citations: [],
      },
    });

    // Notify patient via Socket.IO & In-app Notification
    await prisma.notification.create({
      data: {
        userId: profile.userId,
        type: 'doctor_reply',
        title: `${doctor?.name || 'Dr.'} replied to your inquiry`,
        message: reply.substring(0, 100),
        data: { priority: 'high', patientId: profile.id, threadId },
      },
    });

    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user:${profile.userId}`).emit('chat:new', {
          id: doctorMsg.id,
          threadId,
          sender: 'doctor',
          doctorName: doctor?.name || 'Your Doctor',
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

/**
 * POST /api/v1/doctor/questions/:threadId/toggle-ai
 * Doctor takes over the conversation or hands it back to AI.
 */
export async function toggleAiTakeover(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { threadId } = req.params;
    const parseResult = ToggleAiSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid toggle parameters', parseResult.error.issues);
    }

    const { action } = parseResult.data;
    const doctorUserId = (req as any).user.userId;
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) {
      throw new NotFoundError('Doctor profile not found');
    }

    const { patientId } = extractPatientAndDoctorFromThreadId(threadId);

    const profile = await prisma.patientProfile.findUnique({ where: { id: patientId } });
    if (!profile) {
      throw new NotFoundError('Patient not found');
    }

    const isTakeover = action === 'takeover';
    const triageTag = isTakeover ? 'DoctorTakeover' : 'AiResumed';
    const systemText = isTakeover
      ? `${doctor.name} has taken over this conversation. AI Assistant is paused.`
      : `Setu AI Assistant resumed by ${doctor.name}. AI is ready to answer questions about verified lab reports and appointments.`;

    const systemMsg = await prisma.chatMessage.create({
      data: {
        patientId: profile.id,
        doctorId: doctor.id,
        sender: 'system',
        text: systemText,
        threadId,
        isMedicineQuestion: false,
        category: 'System',
        escalated: isTakeover,
        triageTag,
        citations: [{ isAiPaused: isTakeover, action, doctorId: doctor.id, doctorName: doctor.name }],
      },
    });

    // Notify patient via Socket.IO
    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user:${profile.userId}`).emit('chat:ai_status', {
          threadId,
          isAiPaused: isTakeover,
          actor: doctor.name,
          text: systemText,
          timestamp: new Date().toISOString(),
        });
        io.to(`user:${profile.userId}`).emit('chat:new', {
          id: systemMsg.id,
          threadId,
          sender: 'system',
          text: systemText,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking socket notification
    }

    res.status(200).json({
      status: 'success',
      data: {
        threadId,
        isAiPaused: isTakeover,
        message: systemText,
      },
    });
  } catch (err) {
    next(err);
  }
}
