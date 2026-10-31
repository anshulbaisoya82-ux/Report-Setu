import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Send, Sparkles, AlertTriangle, UserCheck, 
  ChevronDown, Stethoscope, Clock, PauseCircle,
  Calendar, Pill, FileText, ArrowRight, ShieldCheck, RotateCcw
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { askPatientAssistant, fetchPatientChatThread, fetchPatientChatHistory } from '../../api/chatApi';
import { connectionApi } from '../../api/client';

interface ConnectedDoctor {
  id: string;
  doctorId?: string;
  name?: string;
  doctorName?: string;
  specialty?: string;
  clinic?: any;
}

export const PatientAskDoctor: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load connected doctors and initialize chat
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // Fetch active connections
        const connections = await connectionApi.getMyConnections();
        if (!isMounted) return;

        const docs: ConnectedDoctor[] = connections.map((c: any) => ({
          id: c.doctorId || c.id,
          doctorId: c.doctorId || c.id,
          name: c.doctorName || c.name || c.doctor?.name || 'Doctor',
          specialty: c.specialty || c.doctor?.specialty || 'General Practitioner',
          clinic: c.clinic || c.doctor?.clinic,
        }));

        setConnectedDoctors(docs);

        if (docs.length > 0) {
          const initialDocId = docs[0].id;
          setSelectedDoctorId(initialDocId);
          await loadThreadForDoctor(initialDocId);
        }
      } catch (err: any) {
        console.warn('Error loading patient connections:', err);
        if (isMounted) setErrorMessage('Unable to load connection data. Please check your network.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch thread and history when selected doctor changes
  const loadThreadForDoctor = async (doctorId: string) => {
    try {
      const threadData = await fetchPatientChatThread(doctorId);
      if (threadData) {
        setIsAiPaused(Boolean(threadData.isAiPaused));
        if (Array.isArray(threadData.messages) && threadData.messages.length > 0) {
          setMessages(threadData.messages);
          return;
        }
      }

      // If thread had no messages, load history
      const history = await fetchPatientChatHistory(doctorId);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        const doc = connectedDoctors.find((d) => d.id === doctorId);
        const docName = doc?.name || 'your clinician';
        setMessages([
          {
            id: 'welcome-msg',
            sender: 'assistant',
            text: `Hello! I am your ReportSetu AI Medical Assistant powered by Gemini. You are connected with ${docName}. You can ask questions about your verified lab reports, upcoming appointment timings, or daily medicine schedule.`,
            timestamp: 'Just now',
          },
        ]);
      }
    } catch (err) {
      console.warn('Error loading thread:', err);
    }
  };

  const handleSelectDoctor = (docId: string) => {
    setSelectedDoctorId(docId);
    void loadThreadForDoctor(docId);
  };

  const activeDoctor = connectedDoctors.find((d) => d.id === selectedDoctorId) || connectedDoctors[0];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping || !selectedDoctorId) return;

    const query = inputText.trim();
    setInputText('');
    setErrorMessage(null);

    const isMed = query.toLowerCase().includes('stop') || query.toLowerCase().includes('medicine') || query.toLowerCase().includes('dose');
    
    // Optimistic patient message
    const patientMsg: ChatMessage = {
      id: `msg-p-${Date.now()}`,
      sender: 'patient',
      text: query,
      timestamp: 'Just now',
      isMedicineQuestion: isMed,
    };

    setMessages((prev) => [...prev, patientMsg]);
    setIsTyping(true);

    try {
      const res = await askPatientAssistant(query, selectedDoctorId, 'en');

      if (res.isAiPaused) {
        setIsAiPaused(true);
      }

      const replyMsg: ChatMessage = {
        id: res.id || `msg-ai-${Date.now()}`,
        sender: res.sender || 'assistant',
        text: res.answer || res.text,
        timestamp: 'Just now',
        isMedicineQuestion: res.isMedicineQuestion,
        citations: res.citations,
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      console.error('Chat Assistant error:', err);
      setErrorMessage(err.message || 'Failed to send question. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleUsePrompt = (prompt: string) => {
    setInputText(prompt);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DR';
    return name
      .replace(/^(Dr\.|Doctor)\s+/i, '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white animate-pulse">
        <Sparkles className="w-8 h-8 text-[#0A887D] animate-spin mb-3" />
        <span className="text-xs text-slate-500 font-medium">Connecting to your clinical care thread...</span>
      </div>
    );
  }

  // ─── EMPTY STATE: 0 Connected Doctors ────────────────────────────────────
  if (connectedDoctors.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50/50">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 sm:p-12 text-center flex flex-col items-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-5 shadow-xs">
            <Stethoscope className="w-8 h-8 text-amber-700" />
          </div>

          <h2 className="text-xl font-bold text-forest-950 font-serif mb-2">
            Connect with a Doctor to Ask Questions
          </h2>
          <p className="text-xs text-slate-600 max-w-md leading-relaxed mb-6 font-sans">
            To ensure patient safety and clinical supervision, questions are handled in direct collaboration with your connected doctor. You must connect with at least one verified clinician before submitting medical inquiries.
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 max-w-md w-full text-left space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-forest-900 text-accent-teal text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Share your Connect Code:</span> Generate your temporary 6-digit verification code to share during consultation.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-forest-900 text-accent-teal text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Doctor verifies & activates link:</span> Once approved, your doctor can review your lab reports and answer questions here.
              </p>
            </div>
          </div>

          <Link
            to="/patient/connect"
            className="inline-flex items-center gap-2 px-6 py-3 bg-forest-900 text-accent-teal font-semibold text-xs rounded-xl hover:bg-forest-800 transition-all shadow-sm"
          >
            <UserCheck className="w-4 h-4" /> Go to Connect Doctor
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    );
  }

   const handleResetChat = () => {
    const docName = activeDoctor?.name ? `Dr. ${activeDoctor.name.replace(/^(Dr\.|Doctor)\s+/i, '')}` : 'your clinician';
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Hello! I am your Setu AI Assistant connected with ${docName}. You can ask questions about your verified lab reports, upcoming appointment timings, or daily medicine schedule.`,
        timestamp: 'Just now',
      },
    ]);
  };

  // ─── FULL SCREEN CHAT TAKEOVER ───────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAF9] overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs z-10">
        {/* Doctor Information & Multi-Doctor Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-forest-900 text-accent-teal font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {getInitials(activeDoctor?.name)}
          </div>

          <div>
            {connectedDoctors.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedDoctorId}
                  onChange={(e) => handleSelectDoctor(e.target.value)}
                  className="appearance-none font-bold text-slate-900 text-xs sm:text-sm font-serif bg-transparent pr-5 py-0.5 cursor-pointer focus:outline-none"
                >
                  {connectedDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name?.replace(/^(Dr\.|Doctor)\s+/i, '')} ({doc.specialty})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                <span className="text-[10px] text-emerald-700 font-medium block">
                  Click to switch connected doctor
                </span>
              </div>
            ) : (
              <div>
                <h2 className="font-bold text-slate-900 text-xs sm:text-sm font-serif">
                  Dr. {activeDoctor?.name?.replace(/^(Dr\.|Doctor)\s+/i, '')}
                </h2>
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {activeDoctor?.specialty || 'General Physician'} · Connected Care
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Status Badge & Session Reset */}
        <div className="flex items-center gap-3">
          {isAiPaused ? (
            <div className="flex items-center gap-1.5 bg-[#FFF4E5] border border-[#FFD9A8] text-amber-950 px-3 py-1 rounded-full text-[11px] font-semibold shadow-2xs">
              <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>AI Paused · Doctor Escalated</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#E0F7F5] border border-[#80D7CE] text-[#0C736A] px-3 py-1 rounded-full text-[11px] font-semibold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#0A887D]" />
              <span>Setu AI Active</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetChat}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Start a fresh chat conversation"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span className="font-medium">New Chat</span>
          </button>
        </div>
      </div>

      {/* Error alert toast */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 text-red-800 text-xs px-6 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Full-Height Messages Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="max-w-4xl mx-auto space-y-5">
          {messages.map((msg) => {
            const isUser = msg.sender === 'patient';
            const isAssistant = msg.sender === 'assistant';
            const isDoctor = msg.sender === 'doctor';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center w-full my-2">
                  <div className="bg-slate-200/70 text-slate-600 text-[11px] font-medium px-4 py-1 rounded-full flex items-center gap-1.5 shadow-2xs border border-slate-300/60">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end w-full">
                  <div className="flex flex-col items-end max-w-[85%] sm:max-w-xl">
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-medium">
                      <span>You</span>
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="bg-[#1E3F35] text-white rounded-2xl rounded-tr-xs px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs">
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                </div>
              );
            }

            if (isDoctor) {
              return (
                <div key={msg.id} className="flex items-start gap-3 w-full">
                  <div className="w-8 h-8 rounded-full bg-forest-900 text-accent-teal font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getInitials(activeDoctor?.name)}
                  </div>
                  <div className="flex flex-col items-start max-w-[85%] sm:max-w-2xl">
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-slate-500">
                      <span className="font-bold text-forest-950 flex items-center gap-1">
                        <Stethoscope className="w-3.5 h-3.5 text-forest-700" /> Dr. {activeDoctor?.name?.replace(/^(Dr\.|Doctor)\s+/i, '')}
                      </span>
                      <span className="bg-forest-100 text-forest-800 text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase">Doctor</span>
                      <span>·</span>
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>
                    <div className="bg-[#F2FAF6] text-forest-950 border border-forest-600/30 rounded-2xl rounded-tl-xs px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs">
                      <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant Message
            return (
              <div key={msg.id} className="flex items-start gap-3 w-full">
                <div className="w-8 h-8 rounded-full bg-[#E0F7F5] border border-[#80D7CE] text-[#0A887D] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-[#0A887D]" />
                </div>
                <div className="flex flex-col items-start max-w-[85%] sm:max-w-2xl">
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-medium text-slate-500">
                    <span className="font-semibold text-[#0C736A]">Setu AI Assistant</span>
                    <span>·</span>
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>
                  <div className="bg-white text-slate-800 border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs">
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {msg.citations.map((c, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-emerald-700" /> {c.testName}: {c.value} {c.unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-start gap-3 w-full">
              <div className="w-8 h-8 rounded-full bg-[#E0F7F5] border border-[#80D7CE] text-[#0A887D] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#0A887D] animate-spin" />
              </div>
              <div className="bg-white/90 border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs text-slate-500 italic flex items-center gap-2 shadow-2xs animate-pulse">
                <span>Analyzing verified clinical records with Gemini...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestion Chips Bar */}
      <div className="bg-white/90 backdrop-blur-xs border-t border-slate-200/60 py-2.5 px-4 sm:px-8 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-slate-400 font-semibold uppercase text-[10px] shrink-0">Quick Ask:</span>
          <button
            type="button"
            onClick={() => handleUsePrompt('When is my next appointment with doctor?')}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" /> Next appointment?
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt("What are my scheduled medicines for today?")}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Pill className="w-3.5 h-3.5 text-slate-500" /> Today's medicines?
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt("Explain my latest platelet and haemoglobin readings")}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" /> Explain lab readings
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt("Can you prescribe me medicine for headache?")}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-amber-800 rounded-lg border border-amber-200 whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Can you prescribe medicine?
          </button>
        </div>
      </div>

      {/* Bottom Sticky Composer Bar */}
      <div className="bg-white border-t border-slate-200/80 px-4 sm:px-8 py-3.5 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            placeholder={
              isAiPaused
                ? `Write your message directly to Dr. ${activeDoctor?.name?.replace(/^(Dr\.|Doctor)\s+/i, '')} (AI paused)...`
                : "Ask about your verified lab reports, appointments, or medicine schedule..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/70"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-3.5 rounded-2xl transition-all ${
              inputText.trim() && !isTyping
                ? 'bg-forest-900 text-accent-teal hover:bg-forest-800 shadow-xs cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>
        <div className="max-w-4xl mx-auto mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>Grounded in verified doctor summaries & lab parameters.</span>
          <span>Prescription requests require physician evaluation.</span>
        </div>
      </div>
    </div>
  );
};
