import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import { useStore } from '../store/useStore';

let socket: Socket | null = null;

const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  const host = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
  return `http://${host}:5000`;
};

/**
 * Initializes and connects the Socket.IO client with JWT handshake authentication.
 */
export const initSocketClient = (): Socket | null => {
  const token = getAccessToken();
  if (!token) {
    // Cannot authenticate socket without token
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  // Disconnect any stale instance
  if (socket) {
    socket.disconnect();
  }

  const socketUrl = getSocketUrl();
  console.log('[Socket.IO] Connecting to', socketUrl);

  socket = io(socketUrl, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected successfully with ID:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  // Real-time appointment event listeners
  const handleAppointmentEvent = (appointment: any, eventType?: string) => {
    if (!appointment) return;
    console.log('[Socket.IO] Received appointment event:', eventType || 'updated', appointment);
    useStore.getState().onAppointmentReceived(appointment, eventType);
  };

  socket.on('appointment:created', (data) => handleAppointmentEvent(data, 'created'));
  socket.on('appointment:updated', (data) => handleAppointmentEvent(data, 'updated'));
  socket.on('appointment:confirmed', (data) => handleAppointmentEvent(data, 'confirmed'));
  socket.on('appointment:cancelled', (data) => handleAppointmentEvent(data, 'cancelled'));
  socket.on('appointment:completed', (data) => handleAppointmentEvent(data, 'completed'));
  socket.on('appointment:event', (payload) => {
    if (payload?.appointment) {
      handleAppointmentEvent(payload.appointment, payload.event);
    }
  });

  // Real-time prescription & medication updates
  socket.on('prescription:created', (data) => {
    console.log('[Socket.IO] Prescription created:', data);
    useStore.getState().fetchPrescriptions();
    useStore.getState().fetchMedicineSchedule();
  });
  socket.on('prescription:updated', (data) => {
    console.log('[Socket.IO] Prescription updated:', data);
    useStore.getState().fetchPrescriptions();
    useStore.getState().fetchMedicineSchedule();
  });
  socket.on('medication:schedule_updated', () => {
    console.log('[Socket.IO] Medication schedule updated');
    useStore.getState().fetchMedicineSchedule();
  });
  socket.on('notification:received', (notif) => {
    console.log('[Socket.IO] Notification received:', notif);
    if (notif?.type === 'medicine_reminder') {
      useStore.getState().fetchMedicineSchedule();
    }
  });

  return socket;
};

/**
 * Returns active socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Disconnects socket on logout
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Joins a specific clinical room e.g. patient:<patientId>
 */
export const joinRoom = (room: string): void => {
  if (socket && socket.connected) {
    socket.emit('join_room', { room });
  }
};

/**
 * Leaves a clinical room
 */
export const leaveRoom = (room: string): void => {
  if (socket && socket.connected) {
    socket.emit('leave_room', { room });
  }
};
