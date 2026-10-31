/**
 * ReportSetu Centralized Real API Client
 * Connects frontend directly to Express/MongoDB backend at http://localhost:5000/api/v1
 */

const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const host = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
  return `http://${host}:5000/api/v1`;
};

const API_BASE = getApiBase();

// Token Management Helpers
export const getAccessToken = (): string | null => {
  return localStorage.getItem('reportsetu_token');
};

export const setAccessToken = (token: string): void => {
  localStorage.setItem('reportsetu_token', token);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('reportsetu_refresh_token');
};

export const setRefreshToken = (token: string): void => {
  localStorage.setItem('reportsetu_refresh_token', token);
};

export const clearAccessToken = (): void => {
  localStorage.removeItem('reportsetu_token');
  localStorage.removeItem('reportsetu_refresh_token');
  localStorage.removeItem('reportsetu_user');
  localStorage.removeItem('reportsetu_role');
};

export const getStoredUser = (): any | null => {
  const user = localStorage.getItem('reportsetu_user');
  return user ? JSON.parse(user) : null;
};

export const setStoredUser = (user: any): void => {
  localStorage.setItem('reportsetu_user', JSON.stringify(user));
};

export const getStoredRole = (): 'doctor' | 'patient' | 'admin' | null => {
  return localStorage.getItem('reportsetu_role') as 'doctor' | 'patient' | 'admin' | null;
};

export const setStoredRole = (role: 'doctor' | 'patient' | 'admin'): void => {
  localStorage.setItem('reportsetu_role', role);
};

/**
 * Universal API Fetcher with automatic Authorization, Error unwrapping, and JSON handling
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 401 && !endpoint.includes('/auth/')) {
    const storedRefresh = getRefreshToken();
    try {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (refreshResponse.ok) {
        const refreshJson = await refreshResponse.json();
        const refreshedToken = refreshJson.data?.accessToken || refreshJson.accessToken;
        const rotatedRefresh = refreshJson.data?.refreshToken || refreshJson.refreshToken;
        if (refreshedToken) {
          setAccessToken(refreshedToken);
          if (rotatedRefresh) {
            setRefreshToken(rotatedRefresh);
          }
          return apiFetch<T>(endpoint, { ...options, headers: options.headers });
        }
      }
    } catch {
      // Ignore network errors during token refresh attempt
    }

    clearAccessToken();
  }

  if (!res.ok || json.success === false) {
    const errorMsg = json.error?.message || json.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

/* =======================================================================
 * Authentication API
 * ======================================================================= */
export const authApi = {
  // Doctor Auth
  loginDoctor: async (email: string, password: string) => {
    const data = await apiFetch<{ user: any; doctor: any; accessToken: string; refreshToken?: string }>('/auth/doctor/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }
    setStoredUser(data.doctor || data.user);
    setStoredRole('doctor');
    return data;
  },

  signupDoctor: async (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    specialty: string;
    registrationNumber: string;
    medicalCouncil: string;
    clinicName: string;
  }) => {
    const data = await apiFetch<{ user: any; doctor: any; message: string }>('/auth/doctor/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        phone: payload.phone.startsWith('+') ? payload.phone : `+91${payload.phone.replace(/\D/g, '')}`,
        password: payload.password,
        specialty: payload.specialty,
        registrationNumber: payload.registrationNumber,
        medicalCouncil: payload.medicalCouncil,
        clinic: {
          name: payload.clinicName,
          address: 'Clinic Address',
          city: 'Delhi NCR',
        },
      }),
    });
    return data;
  },

  // Patient Auth
  sendPatientOtp: async (phone: string) => {
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    return await apiFetch<{ phone: string; expiresAt: string; devCode: string; message: string }>('/auth/patient/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: formatted }),
    });
  },

  verifyPatientOtp: async (phone: string, otp: string, name?: string) => {
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const data = await apiFetch<{ user: any; patient: any; accessToken: string; refreshToken?: string; isNewUser: boolean; isProfileComplete: boolean }>('/auth/patient/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: formatted, otp, ...(name ? { name } : {}) }),
    });
    setAccessToken(data.accessToken);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }
    setStoredUser(data.patient || data.user);
    setStoredRole('patient');
    return data;
  },

  logout: async () => {
    try {
      const refreshToken = getRefreshToken();
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAccessToken();
    }
  },
};

export const patientProfileApi = {
  get: async () => apiFetch<any>('/patient/profile'),
  update: async (profile: {
    name?: string;
    age?: number;
    gender?: string;
    bloodGroup?: string;
    conditions?: string[];
    location?: string;
    avatar?: string;
    email?: string;
    emergencyContact?: { name?: string; relation?: string; phone?: string };
  }) => apiFetch<any>('/patient/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  }),
};

export const doctorProfileApi = {
  get: async () => apiFetch<any>('/doctor/profile'),
  update: async (doctor: {
    name?: string;
    specialty?: string;
    phone?: string;
    medicalCouncil?: string;
    registrationNumber?: string;
    clinic?: {
      name?: string;
      address?: string;
      phone?: string;
      timings?: string;
      consultationFee?: number | string;
    };
    bio?: string;
    qualifications?: string;
  }) => apiFetch<any>('/doctor/profile', {
    method: 'PUT',
    body: JSON.stringify(doctor),
  }),
};

/* =======================================================================
 * Doctor Portal API
 * ======================================================================= */
export const doctorApi = {
  getQuestionThreads: async () => {
    return await apiFetch<any[]>('/doctor/questions');
  },

  replyToQuestion: async (threadId: string, reply: string) => {
    return await apiFetch<any>(`/doctor/questions/${threadId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  },

  toggleAi: async (threadId: string, action: 'takeover' | 'resume') => {
    return await apiFetch<any>(`/doctor/questions/${threadId}/toggle-ai`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  getPatients: async (params: { search?: string; condition?: string; status?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.condition) query.append('condition', params.condition);
    if (params.status && params.status !== 'All') query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    return await apiFetch<{ patients: any[]; total: number }>(`/doctor/patients?${query.toString()}`);
  },

  getInbox: async (params?: { reviewStatus?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.reviewStatus) query.append('reviewStatus', params.reviewStatus);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString();
    return await apiFetch<any[]>(`/reports/doctor/inbox${qs ? `?${qs}` : ''}`);
  },

  addPrivateNote: async (patientId: string, noteData: { note: string; priority?: string; category?: string; reportId?: string }) => {
    return await apiFetch(`/doctor/patients/${patientId}/private-notes`, {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  },

  getPrivateNotes: async (patientId: string) => {
    return await apiFetch<any[]>(`/doctor/patients/${patientId}/private-notes`);
  },

  generateDraftSummary: async (reportId: string, options: { tone?: string; language?: string } = {}) => {
    const raw = await apiFetch<any>(`/reports/${reportId}/generate-draft`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return {
      draftText: raw?.summaryEn || raw?.draftText || '',
      hindiDraftText: raw?.summaryHi || raw?.hindiDraftText || '',
      summaryEn: raw?.summaryEn || raw?.draftText || '',
      summaryHi: raw?.summaryHi || raw?.hindiDraftText || '',
      tone: raw?.tone || options.tone || 'Plain language',
      verificationPassed: raw?.verificationPassed ?? true,
      citations: raw?.citations || [],
    };
  },

  generateReportAiOverview: async (reportId: string) => {
    return await apiFetch<any>(`/reports/${reportId}/ai-overview`, {
      method: 'POST',
    });
  },
};

/* =======================================================================
 * Lab Reports API
 * ======================================================================= */
export const reportsApi = {
  uploadReport: async (file: File, patientId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (patientId) {
      formData.append('patientId', patientId);
    }
    return await apiFetch<any>('/reports/upload', {
      method: 'POST',
      body: formData,
    });
  },

  confirmReport: async (reportId: string, payload: {
    name?: string;
    category?: string;
    labName?: string;
    collectionDate?: string;
    parameters: any[];
  }) => {
    return await apiFetch(`/reports/${reportId}/confirm`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getPatientReports: async (patientId?: string) => {
    const endpoint = patientId ? `/reports/patient/${patientId}` : '/reports';
    return await apiFetch<any[]>(endpoint);
  },

  getReportById: async (reportId: string) => {
    return await apiFetch<any>(`/reports/${reportId}`);
  },

  markReportViewed: async (reportId: string) => {
    return await apiFetch<any>(`/reports/${reportId}/view`, {
      method: 'POST',
    });
  },

  reviewReport: async (reportId: string, reviewData: {
    text?: string;
    summaryText?: string;
    hindiText?: string;
    tone?: string;
    nextTestDate?: string;
    medicinesStatus?: string;
    sentVia?: string[];
    doctorNotes?: string;
  }) => {
    return await apiFetch(`/reports/${reportId}/review`, {
      method: 'PUT',
      body: JSON.stringify({
        ...reviewData,
        text: reviewData.text || reviewData.summaryText,
      }),
    });
  },

  getTrends: async (patientId?: string) => {
    const endpoint = patientId ? `/reports/patient/${patientId}/trends` : '/reports/trends';
    return await apiFetch<any>(endpoint);
  },
};

/* =======================================================================
 * Medications & Prescriptions API
 * ======================================================================= */
export const medicationsApi = {
  getTodaySchedule: async (patientId?: string) => {
    const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await apiFetch<any>(`/medicines/today${qs}`);
    return Array.isArray(res) ? res : res?.schedule || [];
  },

  recordDoseAction: async (scheduleId: string, action: 'taken' | 'due' | 'snoozed' | 'missed') => {
    return await apiFetch(`/medicines/${scheduleId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, state: action }),
    });
  },

  getAdherence: async () => {
    return await apiFetch<any>('/medicines/adherence');
  },
};

export const prescriptionsApi = {
  getPrescriptions: async (params?: { patientId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString();
    const res = await apiFetch<any>(`/prescriptions${qs ? `?${qs}` : ''}`);
    return Array.isArray(res) ? res : res?.prescriptions || [];
  },

  createPrescription: async (data: {
    patientId: string;
    name?: string;
    prescriptionName?: string;
    instructions?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    totalDays?: number;
    advice?: string[];
    medicines?: any[];
    medications?: any[];
  }) => {
    return await apiFetch('/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/* =======================================================================
 * Appointments API
 * ======================================================================= */
export const appointmentsApi = {
  getAppointments: async (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiFetch<any>(`/appointments${query}`);
    return Array.isArray(res) ? res : res?.appointments || [];
  },

  requestAppointment: async (payload: {
    patientId?: string;
    doctorId?: string;
    doctorName?: string;
    date: string;
    time: string;
    type?: string;
    reason: string;
    status?: string;
    notes?: string;
  }) => {
    return await apiFetch('/appointments/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStatus: async (
    appointmentId: string,
    status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled',
    options?: { notes?: string; date?: string; time?: string }
  ) => {
    return await apiFetch(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        notes: options?.notes,
        date: options?.date,
        time: options?.time,
      }),
    });
  },
};

/* =======================================================================
 * Patient-Doctor Connections API
 * ======================================================================= */
export const connectionsApi = {
  // Patient: Get active connected doctors
  getMyConnections: async () => {
    return await apiFetch<{ connections: any[] }>('/connections/my');
  },

  // Patient: Get pending connection requests from doctors
  getPendingRequests: async () => {
    return await apiFetch<{ requests: any[] }>('/connections/patient/pending');
  },

  // Patient: Approve a pending connection request → returns 2-min code
  approveRequest: async (connectionId: string) => {
    return await apiFetch<{ code: string; expiresAt: string; connectionId: string; doctorName: string; message: string }>(
      '/connections/patient/approve',
      { method: 'POST', body: JSON.stringify({ connectionId }) }
    );
  },

  // Patient: Reject a pending connection request
  rejectRequest: async (connectionId: string) => {
    return await apiFetch<{ message: string }>(
      '/connections/patient/reject',
      { method: 'POST', body: JSON.stringify({ connectionId }) }
    );
  },

  // Patient: Revoke an active doctor connection
  revokeDoctorConnection: async (doctorId: string) => {
    return await apiFetch(`/connections/patient/revoke/${doctorId}`, {
      method: 'POST',
    });
  },

  // Patient: Generate standalone connect code (legacy compat)
  generatePatientCode: async () => {
    return await apiFetch<{ code: string; expiresAt: string }>('/connections/patient/generate-code', {
      method: 'POST',
    });
  },

  // Doctor: Send connection request to a patient
  sendRequest: async (rsId: string) => {
    return await apiFetch<{ connectionId: string; patient: any; doctor: any; status: string; message: string }>(
      '/connections/doctor/request',
      { method: 'POST', body: JSON.stringify({ rsId }) }
    );
  },

  // Doctor: Get pending requests sent by this doctor
  getDoctorPendingRequests: async () => {
    return await apiFetch<{ requests: any[] }>('/connections/doctor/pending');
  },

  // Doctor: Verify connect code to establish connection
  verifyDoctorConnectCode: async (patientRsId: string, code: string) => {
    return await apiFetch<{ connection: any; patient: any }>('/connections/doctor/verify-code', {
      method: 'POST',
      body: JSON.stringify({ patientRsId, code }),
    });
  },

  // Legacy alias
  requestDoctorVCode: async (rsId: string) => {
    return await apiFetch<{ connectionId: string; message: string }>('/connections/doctor/request', {
      method: 'POST',
      body: JSON.stringify({ rsId }),
    });
  },
};

/* =======================================================================
 * Notifications API
 * ======================================================================= */
export const notificationsApi = {
  getNotifications: async () => {
    return await apiFetch<any[]>('/notifications');
  },

  markAsRead: async (id: string) => {
    return await apiFetch(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  },
};

/* =======================================================================
 * Admin API
 * ======================================================================= */
export const adminApi = {
  getStats: async () => {
    return await apiFetch<{
      totalDoctors: number;
      pendingDoctors: number;
      verifiedDoctors: number;
      rejectedDoctors: number;
      totalPatients: number;
      totalReports: number;
    }>('/admin/stats?adminKey=reportsetu_admin_secret_key_12345', {
      headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' },
    });
  },

  getDoctors: async (params: { status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    query.append('adminKey', 'reportsetu_admin_secret_key_12345');
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    return await apiFetch<{ doctors: any[]; total: number }>(`/admin/doctors?${query.toString()}`, {
      headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' },
    });
  },

  verifyDoctor: async (doctorId: string) => {
    return await apiFetch<{ doctor: any; message: string }>(`/admin/doctors/${doctorId}/verify?adminKey=reportsetu_admin_secret_key_12345`, {
      method: 'POST',
      headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' },
    });
  },

  rejectDoctor: async (doctorId: string, reason?: string) => {
    return await apiFetch<{ doctor: any; message: string }>(`/admin/doctors/${doctorId}/reject?adminKey=reportsetu_admin_secret_key_12345`, {
      method: 'POST',
      headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' },
      body: JSON.stringify({ reason }),
    });
  },

  verifyAllDoctors: async () => {
    return await apiFetch<{ message: string; count: number }>('/admin/doctors/verify-all?adminKey=reportsetu_admin_secret_key_12345', {
      method: 'POST',
      headers: { 'x-admin-key': 'reportsetu_admin_secret_key_12345' },
    });
  },
};

/* =======================================================================
 * Connections API
 * ======================================================================= */
export const connectionApi = {
  getMyConnections: async () => {
    const res = await apiFetch<{ connections: any[] }>('/connections/my');
    return res?.connections || [];
  },
  getPatientPendingRequests: async () => {
    return await apiFetch<any[]>('/connections/patient/pending');
  },
  approveConnection: async (connectionId: string) => {
    return await apiFetch<any>('/connections/patient/approve', {
      method: 'POST',
      body: JSON.stringify({ connectionId }),
    });
  },
  generateCode: async () => {
    return await apiFetch<any>('/connections/patient/generate-code', {
      method: 'POST',
    });
  },
};
