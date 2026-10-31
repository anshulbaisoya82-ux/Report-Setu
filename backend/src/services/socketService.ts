import { Server, Socket } from 'socket.io';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { PatientProfile } from '../repositories';
import { DoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import { config } from '../config/env';
import { logger } from '../utils/logger';

let socketServer: Server | null = null;

export const setSocketServer = (io: Server): void => {
  socketServer = io;
  logger.info({ message: 'Socket.IO server instance attached to socketService' });
};

export const getSocketServer = (): Server | null => {
  return socketServer;
};

export const getSocketIO = getSocketServer;

/**
 * Validates whether an authenticated user is authorized to join a specific room.
 * Enforces patient-doctor connection checks for patient/thread data rooms.
 */
export async function authorizeRoomJoin(user: TokenPayload, room: string): Promise<boolean> {
  // 1. Personal user room: only the user themselves (or admin)
  if (room === `user:${user.userId}`) {
    return true;
  }

  // Admin bypass
  if (user.role === 'admin') {
    return true;
  }

  // 2. Patient data or consultation thread rooms: "patient:<patientId>" or "thread:<threadId>"
  const match = room.match(/^(?:patient|thread):([a-zA-Z0-9_-]+)$/);
  if (match) {
    const targetPatientId = match[1];

    if (user.role === 'patient') {
      const patient = await PatientProfile.findOne({ userId: user.userId });
      return !!patient && (patient._id?.toString() === targetPatientId || patient.id === targetPatientId);
    }

    if (user.role === 'doctor') {
      const doctor = await DoctorProfile.findOne({ userId: user.userId });
      if (!doctor) return false;

      const connection = await Connection.findOne({
        doctorId: doctor._id || doctor.id,
        patientId: targetPatientId,
        status: 'active',
      });
      return !!connection;
    }
  }

  return false;
}

/**
 * Configures Socket.IO server with JWT authentication handshake middleware
 * and room authorization event handlers.
 */
export function initSocketServer(httpServer: any): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  // Handshake authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: TokenPayload = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Automatically join personal user room
    const userRoom = `user:${user.userId}`;
    socket.join(userRoom);
    logger.debug({
      message: `Socket connected: ${socket.id} (user: ${user.userId}, role: ${user.role})`,
    });

    // Handle joining restricted clinical / thread rooms
    socket.on(
      'join_room',
      async (
        data: { room: string },
        callback?: (res: { success: boolean; room?: string; error?: string }) => void
      ) => {
        try {
          if (!data || !data.room) {
            if (callback) callback({ success: false, error: 'Room identifier is required' });
            return;
          }

          const isAuthorized = await authorizeRoomJoin(user, data.room);
          if (!isAuthorized) {
            socket.emit('error', {
              code: 'FORBIDDEN',
              message: `Unauthorized to join room: ${data.room}`,
            });
            if (callback)
              callback({ success: false, error: `Unauthorized to join room: ${data.room}` });
            return;
          }

          socket.join(data.room);
          logger.debug({ message: `User ${user.userId} joined room ${data.room}` });
          if (callback) callback({ success: true, room: data.room });
        } catch (err: any) {
          if (callback) callback({ success: false, error: err.message });
        }
      }
    );

    // Handle leaving rooms
    socket.on(
      'leave_room',
      (
        data: { room: string },
        callback?: (res: { success: boolean; room?: string }) => void
      ) => {
        if (data && data.room) {
          socket.leave(data.room);
          if (callback) callback({ success: true, room: data.room });
        }
      }
    );

    socket.on('disconnect', () => {
      logger.debug({ message: `Socket disconnected: ${socket.id}` });
    });
  });

  setSocketServer(io);
  return io;
}

/**
 * Dispatches an event to an individual user's private socket room.
 */
export const emitToUser = (userId: string, event: string, payload: any): void => {
  if (socketServer) {
    socketServer.to(`user:${userId}`).emit(event, payload);
    logger.debug({ message: `Socket event '${event}' dispatched to user:${userId}` });
  }
};

/**
 * Dispatches an event to a broadcast / clinical room.
 */
export const emitToRoom = (room: string, event: string, payload: any): void => {
  if (socketServer) {
    socketServer.to(room).emit(event, payload);
    logger.debug({ message: `Socket event '${event}' dispatched to room '${room}'` });
  }
};

/**
 * Evicts a doctor from all patient live rooms when connection is revoked,
 * and notifies the doctor with 'access:revoked'.
 */
export async function revokeDoctorAccessFromRooms(
  doctorId: string,
  patientId: string
): Promise<void> {
  if (!socketServer) return;

  const doctor = await DoctorProfile.findById(doctorId);
  if (!doctor) return;

  const doctorUserRoom = `user:${doctor.userId}`;
  const targetRooms = [`patient:${patientId}`, `thread:${patientId}`];

  // Notify doctor's personal room of immediate access revocation
  socketServer.to(doctorUserRoom).emit('access:revoked', {
    patientId,
    doctorId,
    message: 'Patient has revoked clinical access. Active thread sessions terminated.',
  });

  // Evict all doctor sockets from the patient's rooms
  const sockets = await socketServer.in(doctorUserRoom).fetchSockets();
  for (const s of sockets) {
    for (const r of targetRooms) {
      s.leave(r);
    }
  }

  logger.info({
    message: `Doctor ${doctorId} evicted from patient ${patientId} rooms on revocation`,
  });
}

/**
 * Broadcasts critical lab report alert to patient room and all active connected doctors.
 */
export async function broadcastCriticalAlert(
  patientId: string,
  reportId: string,
  criticalParameters: any[]
): Promise<void> {
  const patient = await PatientProfile.findById(patientId);
  if (!patient) return;

  const activeConnections = await Connection.find({
    patientId: patient._id,
    status: 'active',
  });

  const alertPayload = {
    patientId: patient._id.toString(),
    patientName: patient.name,
    patientRsId: patient.rsId,
    reportId,
    criticalParameters,
    alertedAt: new Date().toISOString(),
  };

  // Broadcast to patient room
  emitToRoom(`patient:${patientId}`, 'critical:alert', alertPayload);

  // Broadcast to each connected doctor's personal room
  for (const conn of activeConnections) {
    const doctor = await DoctorProfile.findById(conn.doctorId);
    if (doctor) {
      emitToUser(doctor.userId.toString(), 'critical:alert', alertPayload);
    }
  }
}

/**
 * Dispatches real-time appointment updates to doctor personal room,
 * patient personal room, and patient data room.
 */
export async function notifyAppointmentEvent(
  appointment: any,
  event:
    | 'appointment:created'
    | 'appointment:confirmed'
    | 'appointment:cancelled'
    | 'appointment:completed'
    | 'appointment:rescheduled'
    | 'appointment:updated',
  doctorUserId?: string,
  patientUserId?: string
): Promise<void> {
  if (!socketServer) return;

  const payload = {
    appointment,
    event,
    timestamp: new Date().toISOString(),
  };

  if (doctorUserId) {
    socketServer.to(`user:${doctorUserId}`).emit('appointment:event', payload);
    socketServer.to(`user:${doctorUserId}`).emit('appointment:updated', appointment);
    socketServer.to(`user:${doctorUserId}`).emit(event, appointment);
  }

  if (patientUserId) {
    socketServer.to(`user:${patientUserId}`).emit('appointment:event', payload);
    socketServer.to(`user:${patientUserId}`).emit('appointment:updated', appointment);
    socketServer.to(`user:${patientUserId}`).emit(event, appointment);
  }

  if (appointment.patientId) {
    socketServer.to(`patient:${appointment.patientId}`).emit('appointment:updated', appointment);
    socketServer.to(`patient:${appointment.patientId}`).emit(event, appointment);
  }

  logger.info({
    message: `Dispatched ${event} for appointment ${appointment.id || appointment._id} via Socket.IO`,
  });
}

