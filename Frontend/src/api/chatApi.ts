export interface ChatCitation {
  date: string;
  testName: string;
  value: number;
  unit: string;
}

export interface ChatApiResponse {
  id: string;
  sender: 'assistant' | 'patient';
  answer: string;
  text: string;
  escalated: boolean;
  isAiPaused?: boolean;
  isMedicineQuestion: boolean;
  category?: string;
  triageTag?: string;
  citations?: ChatCitation[];
  timestamp?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Sends a patient question to the ReportSetu Grounded AI Assistant (Gemini / ML).
 * Routes to selected doctor and respects safety pause boundaries.
 */
export async function askPatientAssistant(
  message: string,
  doctorId?: string,
  lang: 'en' | 'hi' = 'en'
): Promise<ChatApiResponse> {
  const token = localStorage.getItem('reportsetu_token') || '';

  const res = await fetch(`${API_BASE}/patient/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, doctorId, lang }),
  });

  if (res.ok) {
    const json = await res.json();
    if (json.data) {
      return json.data;
    }
  }

  const errJson = await res.json().catch(() => ({}));
  if (errJson.message) {
    throw new Error(errJson.message);
  }
  throw new Error('Failed to send question to assistant');
}

/**
 * Fetches the patient's active chat thread including connected doctors and AI pause state.
 */
export async function fetchPatientChatThread(doctorId?: string): Promise<any> {
  const token = localStorage.getItem('reportsetu_token') || '';
  const qs = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';

  const res = await fetch(`${API_BASE}/patient/chat/thread${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.ok) {
    const json = await res.json();
    return json.data;
  }
  return null;
}

/**
 * Fetches message history with a specific connected doctor.
 */
export async function fetchPatientChatHistory(doctorId?: string): Promise<any[]> {
  const token = localStorage.getItem('reportsetu_token') || '';
  const qs = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';

  const res = await fetch(`${API_BASE}/patient/chat/history${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.ok) {
    const json = await res.json();
    return json.data || [];
  }
  return [];
}
