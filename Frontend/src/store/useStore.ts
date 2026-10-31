import { create } from 'zustand';
import {
  Patient,
  LabReport,
  MedicineScheduleItem,
  Prescription,
  Appointment,
  PatientQuestionThread,
  ChatMessage,
} from '../types';
import {
  authApi,
  doctorApi,
  reportsApi,
  medicationsApi,
  prescriptionsApi,
  appointmentsApi,
  getStoredRole,
  getStoredUser,
  getAccessToken,
  clearAccessToken,
} from '../api/client';

export interface AppState {
  currentRole: 'doctor' | 'patient' | 'admin';
  setRole: (role: 'doctor' | 'patient' | 'admin') => void;
  currentUser: any | null;
  setCurrentUser: (user: any | null) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Doctor state
  doctorInfo: {
    name: string;
    specialty: string;
    regNumber: string;
    council: string;
    clinic: string;
    email: string;
    phone: string;
  };
  patients: Patient[];
  setPatients: (patients: Patient[]) => void;
  fetchDoctorPatients: (search?: string) => Promise<void>;
  addPatient: (patient: Patient) => void;
  updatePatient: (patientId: string, updates: Partial<Patient>) => void;

  // Reports
  reports: LabReport[];
  setReports: (reports: LabReport[]) => void;
  fetchReports: (patientId?: string) => Promise<void>;
  addReport: (report: LabReport) => void;
  updateReport: (reportId: string, updates: Partial<LabReport>) => void;
  markReportReviewed: (
    reportId: string,
    summary: NonNullable<LabReport['doctorSummary']>
  ) => Promise<void>;
  markReportDoctorViewed: (reportId: string) => Promise<void>;

  // Medicines
  medicineSchedule: MedicineScheduleItem[];
  fetchMedicineSchedule: (patientId?: string) => Promise<void>;
  toggleMedicineSchedule: (id: string, state: MedicineScheduleItem['state']) => Promise<void>;
  prescriptions: Prescription[];
  fetchPrescriptions: (patientId?: string) => Promise<void>;
  addPrescription: (prescription: Prescription) => void;
  createPrescription: (data: any) => Promise<any>;

  // Appointments
  appointments: Appointment[];
  fetchAppointments: (status?: string) => Promise<void>;
  requestAppointment: (apt: Omit<Appointment, 'id'> & { doctorId?: string; notes?: string }) => Promise<any>;
  updateAppointmentStatus: (
    id: string,
    status: Appointment['status'],
    options?: { notes?: string; date?: string; time?: string }
  ) => Promise<void>;
  onAppointmentReceived: (appointment: any, eventType?: string) => void;
  appointmentToast: { message: string; type: 'success' | 'info' | 'warning'; id: string } | null;
  clearAppointmentToast: () => void;

  // Questions / Chat
  questionThreads: PatientQuestionThread[];
  fetchQuestionThreads: () => Promise<void>;
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;
  sendDoctorReply: (threadId: string, text: string) => Promise<void>;
  sendPatientQuestion: (threadId: string, text: string) => void;

  // Patient App Preferences
  patientLanguage: 'en' | 'hi';
  setPatientLanguage: (lang: 'en' | 'hi') => void;
  patientSettings: {
    medicineReminders: boolean;
    testDueReminders: boolean;
    doctorReplies: boolean;
    largeText: boolean;
  };
  updatePatientSettings: (settings: Partial<AppState['patientSettings']>) => void;

  // Global Auth Actions
  logout: () => Promise<void>;
}

// Initial stored values
const savedRole = getStoredRole() || 'doctor';
const savedUser = getStoredUser();
const hasToken = !!getAccessToken();

export const useStore = create<AppState>((set, get) => ({
  currentRole: savedRole,
  setRole: (role) => set({ currentRole: role }),
  currentUser: savedUser,
  setCurrentUser: (user) => set({ currentUser: user, isAuthenticated: !!user }),
  isAuthenticated: hasToken,
  isLoading: false,
  error: null,

  doctorInfo: {
    name: savedUser?.name || '',
    specialty: savedUser?.specialty || '',
    regNumber: savedUser?.registrationNumber || '',
    council: savedUser?.medicalCouncil || '',
    clinic: savedUser?.clinic?.name || '',
    email: savedUser?.email || '',
    phone: savedUser?.phone || '',
  },

  // Real Patients loaded from database (zero mock defaults)
  patients: [],
  setPatients: (patients) => set({ patients }),
  fetchDoctorPatients: async (search?: string) => {
    try {
      set({ isLoading: true, error: null });
      const res = await doctorApi.getPatients({ search });
      if (res && Array.isArray(res.patients)) {
        set({ patients: res.patients });
      }
    } catch (err: any) {
      console.warn('Failed to fetch doctor patients from API:', err.message);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },
  addPatient: (patient) =>
    set((state) => ({
      patients: [patient, ...state.patients],
    })),
  updatePatient: (patientId, updates) =>
    set((state) => ({
      patients: state.patients.map((p) => (p.id === patientId ? { ...p, ...updates } : p)),
    })),

  // Real Reports loaded from database (zero mock defaults)
  reports: [],
  setReports: (reports) => set({ reports }),
  fetchReports: async (patientId?: string) => {
    try {
      set({ isLoading: true, error: null });
      const role = get().currentRole;
      let fetchedReports: any[] = [];
      if (role === 'doctor') {
        const inboxRes: any = await doctorApi.getInbox();
        fetchedReports = inboxRes?.reports || (Array.isArray(inboxRes) ? inboxRes : []);
      } else {
        const patientRes: any = await reportsApi.getPatientReports(patientId);
        fetchedReports = patientRes?.reports || (Array.isArray(patientRes) ? patientRes : []);
      }
      set({ reports: fetchedReports });
    } catch (err: any) {
      console.warn('Failed to fetch reports from API:', err.message);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },
  addReport: (report) =>
    set((state) => ({
      reports: [report, ...state.reports],
    })),
  updateReport: (reportId, updates) =>
    set((state) => ({
      reports: state.reports.map((r) => (r.id === reportId ? { ...r, ...updates } : r)),
    })),
  markReportReviewed: async (reportId, summary) => {
    try {
      await reportsApi.reviewReport(reportId, {
        summaryText: summary.text,
        hindiText: summary.hindiText,
        tone: summary.tone,
        nextTestDate: summary.nextTestDate,
        medicinesStatus: summary.medicinesStatus,
        sentVia: summary.sentVia as string[],
      });
    } catch (err) {
      console.warn('Backend review sync note:', err);
    }

    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              reviewed: true,
              reviewStatus: 'approved',
              doctorViewed: true,
              reviewedAt: new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              reviewedBy: summary.doctorName,
              doctorSummary: summary,
            }
          : r
      ),
    }));
  },
  markReportDoctorViewed: async (reportId) => {
    // 1. Optimistically update local store immediately
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId || (r as any)._id === reportId
          ? {
              ...r,
              doctorViewed: true,
              doctorViewedAt: new Date().toISOString(),
              reviewStatus: r.reviewStatus === 'pending' ? 'in_review' : r.reviewStatus,
            }
          : r
      ),
    }));

    // 2. Sync with backend API
    try {
      await reportsApi.markReportViewed(reportId);
    } catch (err) {
      console.warn('Backend mark viewed sync (non-fatal):', err);
    }
  },

  // Real Medicines loaded from database (zero mock defaults)
  medicineSchedule: [],
  fetchMedicineSchedule: async (patientId?: string) => {
    try {
      const res = await medicationsApi.getTodaySchedule(patientId);
      const list = Array.isArray(res) ? res : (res as any)?.schedule || [];
      set({ medicineSchedule: list });
    } catch (err: any) {
      console.warn('Failed to fetch medication schedule:', err.message);
    }
  },
  toggleMedicineSchedule: async (id, newState) => {
    try {
      await medicationsApi.recordDoseAction(id, newState);
    } catch (err) {
      console.warn('Backend medicine adherence sync note:', err);
    }

    set((state) => ({
      medicineSchedule: state.medicineSchedule.map((item) =>
        item.id === id
          ? {
              ...item,
              state: newState,
              takenAt:
                newState === 'taken'
                  ? `Taken at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : undefined,
            }
          : item
      ),
    }));
  },

  prescriptions: [],
  fetchPrescriptions: async (patientId?: string) => {
    try {
      const res = await prescriptionsApi.getPrescriptions(patientId ? { patientId } : undefined);
      const list = Array.isArray(res) ? res : (res as any)?.prescriptions || [];
      set({ prescriptions: list });
    } catch (err: any) {
      console.warn('Failed to fetch prescriptions:', err.message);
    }
  },
  addPrescription: (prescription) =>
    set((state) => ({
      prescriptions: [prescription, ...state.prescriptions],
    })),
  createPrescription: async (data: any) => {
    const res = await prescriptionsApi.createPrescription(data);
    const created = (res as any)?.data || res;
    if (created && created.id) {
      set((state) => ({
        prescriptions: [created, ...state.prescriptions.filter((p) => p.id !== created.id)],
      }));
    }
    // Refresh schedule immediately
    get().fetchMedicineSchedule(data.patientId);
    return created;
  },

  // Real Appointments loaded from database (zero mock defaults)
  appointments: [],
  appointmentToast: null,
  clearAppointmentToast: () => set({ appointmentToast: null }),

  fetchAppointments: async (statusFilter?: string) => {
    try {
      const res = await appointmentsApi.getAppointments(statusFilter);
      const list = Array.isArray(res) ? res : (res as any)?.appointments || [];
      set({ appointments: list });
    } catch (err: any) {
      console.warn('Failed to fetch appointments:', err.message);
    }
  },

  requestAppointment: async (apt) => {
    try {
      const res = await appointmentsApi.requestAppointment({
        patientId: apt.patientId,
        doctorId: (apt as any).doctorId,
        doctorName: apt.doctorName,
        date: apt.date,
        time: apt.time,
        type: apt.type,
        reason: apt.reason,
        status: apt.status,
        notes: (apt as any).notes,
      });

      const created = (res as any)?.data || res;
      if (created && (created.id || created._id)) {
        set((state) => ({
          appointments: [created, ...state.appointments.filter((a) => a.id !== created.id && a.id !== created._id)],
        }));
        return created;
      }
    } catch (err: any) {
      console.warn('Backend appointment booking note:', err);
      throw err;
    }

    const fallbackApt: Appointment = {
      ...apt,
      id: `apt-${Date.now()}`,
      requestedAt: 'Just now',
      status: apt.status || 'Pending',
    };
    set((state) => ({
      appointments: [fallbackApt, ...state.appointments],
    }));
    return fallbackApt;
  },

  updateAppointmentStatus: async (id, status, options) => {
    try {
      const res = await appointmentsApi.updateStatus(id, status, options);
      const updated = (res as any)?.data || res;
      if (updated && (updated.id || updated._id)) {
        set((state) => ({
          appointments: state.appointments.map((a) => (a.id === id ? { ...a, ...updated } : a)),
        }));
        return;
      }
    } catch (err: any) {
      console.warn('Backend appointment update note:', err);
      throw err;
    }

    set((state) => ({
      appointments: state.appointments.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              ...(options?.notes ? { notes: options.notes } : {}),
              ...(options?.date ? { date: options.date } : {}),
              ...(options?.time ? { time: options.time } : {}),
            }
          : a
      ),
    }));
  },

  onAppointmentReceived: (appointment: any, eventType?: string) => {
    if (!appointment || (!appointment.id && !appointment._id)) return;
    const normId = appointment.id || appointment._id;
    const normalized = { ...appointment, id: normId };

    const isDoctor = get().currentRole === 'doctor';
    let toastMsg = '';
    let toastType: 'success' | 'info' | 'warning' = 'info';

    if (eventType === 'created' || normalized.status === 'Pending') {
      toastMsg = isDoctor
        ? `🔔 New appointment request from ${normalized.patientName} for ${normalized.date} at ${normalized.time}`
        : `Appointment request submitted for ${normalized.date} at ${normalized.time}`;
      toastType = 'info';
    } else if (eventType === 'confirmed' || normalized.status === 'Confirmed') {
      toastMsg = isDoctor
        ? `Appointment confirmed with ${normalized.patientName} (${normalized.date} · ${normalized.time})`
        : `🎉 Your appointment with ${normalized.doctorName} for ${normalized.date} at ${normalized.time} is CONFIRMED!`;
      toastType = 'success';
    } else if (eventType === 'cancelled' || normalized.status === 'Cancelled') {
      toastMsg = `Appointment for ${normalized.date} at ${normalized.time} was cancelled`;
      toastType = 'warning';
    } else if (eventType === 'completed' || normalized.status === 'Completed') {
      toastMsg = `Appointment for ${normalized.date} completed`;
      toastType = 'success';
    }

    set((state) => {
      const exists = state.appointments.some((a) => a.id === normId);
      const updatedList = exists
        ? state.appointments.map((a) => (a.id === normId ? { ...a, ...normalized } : a))
        : [normalized, ...state.appointments];

      return {
        appointments: updatedList,
        appointmentToast: toastMsg
          ? { message: toastMsg, type: toastType, id: `toast-${Date.now()}` }
          : state.appointmentToast,
      };
    });

    if (toastMsg) {
      setTimeout(() => {
        set({ appointmentToast: null });
      }, 5500);
    }
  },

  // Questions / Real Patient Threads (zero mock defaults)
  questionThreads: [],
  fetchQuestionThreads: async () => {
    if (get().currentRole !== 'doctor' || !getAccessToken()) return;
    try {
      const threads = await doctorApi.getQuestionThreads();
      set({ questionThreads: Array.isArray(threads) ? threads : [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },
  activeThreadId: '',
  setActiveThreadId: (id) => set({ activeThreadId: id }),

  sendDoctorReply: async (threadId, text) => {
    await doctorApi.replyToQuestion(threadId, text);
    await get().fetchQuestionThreads();
  },

  sendPatientQuestion: (threadId, text) =>
    set((state) => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isMedicineQuestion =
        text.toLowerCase().includes('stop') ||
        text.toLowerCase().includes('medicine') ||
        text.toLowerCase().includes('dose') ||
        text.toLowerCase().includes('metformin') ||
        text.toLowerCase().includes('tablet');

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'patient',
        text,
        timestamp: now,
        isMedicineQuestion,
      };

      const thread = state.questionThreads.find((t) => t.id === threadId);
      const newMessages = [...(thread?.messages || []), userMsg];

      return {
        questionThreads: state.questionThreads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                unreadCount: isMedicineQuestion ? t.unreadCount + 1 : t.unreadCount,
                lastMessageTime: `Today · ${now}`,
                messages: newMessages,
              }
            : t
        ),
      };
    }),

  patientLanguage: 'en',
  setPatientLanguage: (lang) => set({ patientLanguage: lang }),

  patientSettings: {
    medicineReminders: true,
    testDueReminders: true,
    doctorReplies: true,
    largeText: false,
  },
  updatePatientSettings: (settings) =>
    set((state) => ({
      patientSettings: { ...state.patientSettings, ...settings },
    })),

  logout: async () => {
    await authApi.logout();
    set({
      currentUser: null,
      isAuthenticated: false,
      patients: [],
      reports: [],
      appointments: [],
      medicineSchedule: [],
      prescriptions: [],
      questionThreads: [],
    });
  },
}));
