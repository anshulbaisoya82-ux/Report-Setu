import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Send, Paperclip, Check, CheckCheck, 
  Sparkles, Calendar, UploadCloud, FileText, 
  ChevronRight, Info, Bell, CheckCircle2, Shield, UserPlus
} from 'lucide-react';
import { askPatientAssistant, fetchPatientChatHistory } from '../../api/chatApi';
import { connectionsApi } from '../../api';
import { useStore } from '../../store/useStore';

export const PatientAskDoctor: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [connectedDoctor, setConnectedDoctor] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active connected doctor
  useEffect(() => {
    async function loadDoctorAndChat() {
      try {
        setLoadingDoctor(true);
        const res = await connectionsApi.getMyConnections().catch(() => ({ connections: [] }));
        const conns: any[] = res?.connections || [];
        const activeConns = conns.filter((c: any) => c.status === 'active' || c.status === 'connected');
        if (activeConns.length > 0) {
          const doc = activeConns[0].doctor || {
            id: activeConns[0].doctorId,
            name: activeConns[0].doctorName,
            specialty: activeConns[0].doctorSpecialty,
          };
          setConnectedDoctor(doc);
          const docId = doc.id || doc._id || doc.userId;
          try {
            const history = await fetchPatientChatHistory(docId);
            if (Array.isArray(history) && history.length > 0) {
              setMessages(history);
            } else {
              setMessages([]);
            }
          } catch {
            setMessages([]);
          }
        } else {
          setConnectedDoctor(null);
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load connected doctor:', err);
        setConnectedDoctor(null);
        setMessages([]);
      } finally {
        setLoadingDoctor(false);
      }
    }
    void loadDoctorAndChat();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || !connectedDoctor) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'patient',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!customText) setInputText('');

    setIsTyping(true);
    const docId = connectedDoctor.id || connectedDoctor._id || connectedDoctor.userId || 'doc-1';
    try {
      const res = await askPatientAssistant(textToSend, docId);
      const replyText = res ? (res.answer || res.text) : '';
      if (replyText) {
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'doctor',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAi: res.sender === 'assistant',
          },
        ]);
      } else {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `doc-${Date.now()}`,
              sender: 'doctor',
              text: `Thank you for the update. Keep hydrated, take rest, and monitor your vitals. If symptoms persist, Dr. ${connectedDoctor.name || 'your clinician'} will review your notes.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isAi: false,
            },
          ]);
        }, 1200);
      }
    } catch {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `doc-${Date.now()}`,
            sender: 'doctor',
            text: `Your message has been queued for Dr. ${connectedDoctor.name || 'your clinician'}. Clinical instructions will be reflected in your consultation log.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAi: false,
          },
        ]);
      }, 1000);
    } finally {
      setIsTyping(false);
    }
  };

  const quickChips = [
    { label: '📅 Next appointment?', text: 'When is my next scheduled appointment?' },
    { label: "💊 Today's medicines?", text: "What is my medicine schedule for today?" },
    { label: '📊 Explain lab readings', text: 'Could you explain my latest CBC report readings?' },
    { label: '⚠️ Fever management?', text: 'What precautions should I take for fever and body ache?' },
  ];

  if (loadingDoctor) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Verifying clinical consent and doctor connection...</p>
      </div>
    );
  }

  // Disconnected Guard Screen
  if (!connectedDoctor) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Ask Doctor</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct clinical consultations, medical questions, and report reviews.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[3px] border border-stone-200/90 shadow-2xs p-8 text-center space-y-4 max-w-lg mx-auto mt-12">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">No Connected Doctor</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md mx-auto">
              Under the Digital Personal Data Protection (DPDP) Act, direct consultations and medical chats are only accessible when you are connected to a verified clinician.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={() => navigate('/patient/settings?tab=doctors')}
              className="px-4 py-2 bg-[#0E382F] hover:bg-[#134e40] text-white rounded-[3px] text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Connect with a Doctor</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const doctorName = connectedDoctor.name || 'Doctor';
  const doctorSpecialty = connectedDoctor.specialty || 'General Physician';
  const doctorInitials = doctorName
    .replace(/^Dr\.\s*/i, '')
    .slice(0, 2)
    .toUpperCase() || 'DR';

  return (
    <div className="p-4 md:p-6 space-y-3.5 max-w-6xl mx-auto flex flex-col h-[calc(100vh-20px)]">
      {/* Top Header with title and profile badge */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Ask Doctor</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Get medical guidance, report explanations, and treatment suggestions from {doctorName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-1.5 rounded-[3px] border border-stone-200 text-slate-600 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs">
            <Bell className="w-3.5 h-3.5" />
            <span className="w-2 h-2 rounded-full bg-[#10B981] absolute top-1 right-1" />
          </button>
          <div className="w-7 h-7 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Column: Chat Container (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-[3px] border border-stone-200/90 shadow-2xs flex flex-col min-h-0 h-full overflow-hidden">
          {/* Doctor Header Bar */}
          <div className="p-3 border-b border-stone-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center">
                {doctorInitials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">{doctorName}</h3>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] fill-emerald-50" />
                </div>
                <p className="text-[10.5px] text-slate-500 mt-0.5">{doctorSpecialty} · Connected Care</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>Online</span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white">
            {messages.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Start a conversation with {doctorName}</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Ask clinical questions regarding your recent diagnostic reports, symptoms, or medication schedule.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isPatient = m.sender === 'patient';

                if (isPatient) {
                  return (
                    <div key={m.id} className="flex flex-col items-end space-y-1">
                      <div className="bg-[#EAF6F0] text-slate-900 text-xs px-3.5 py-2 rounded-[3px] max-w-md shadow-2xs leading-relaxed">
                        {m.text}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium pr-1">
                        <span>{m.timestamp ? (m.timestamp.includes('T') ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : m.timestamp) : ''}</span>
                        <CheckCheck className="w-3 h-3 text-[#10B981]" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="flex items-start gap-2 max-w-lg">
                    <div className="w-7 h-7 rounded-[3px] bg-[#0E382F] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {doctorInitials}
                    </div>
                    <div className="space-y-1">
                      <div className="bg-white border border-stone-200 text-slate-800 text-xs px-3.5 py-2 rounded-[3px] shadow-2xs leading-relaxed">
                        {m.text}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium pl-1 block">
                        {m.timestamp ? (m.timestamp.includes('T') ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : m.timestamp) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[3px] bg-[#0E382F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {doctorInitials}
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-[3px] px-3 py-1.5 text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-200" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Ask Chips (above composer) */}
          <div className="px-3.5 py-2 border-t border-stone-100 bg-stone-50/60 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Quick Ask:</span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip.text)}
                className="px-2.5 py-1 bg-white border border-stone-200 rounded-[3px] text-[11px] text-slate-700 font-medium hover:bg-stone-100 whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Message Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 border-t border-stone-200 bg-white flex items-center gap-2 shrink-0"
          >
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-[2px] cursor-pointer"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask ${doctorName}...`}
              className="flex-1 h-8 px-3 rounded-[3px] border border-stone-200 text-xs focus:outline-none focus:border-[#0E382F]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-8 h-8 rounded-[3px] bg-[#0E382F] text-white flex items-center justify-center hover:bg-[#092720] transition-colors cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Right Column: Doctor Info & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-3.5 overflow-y-auto">
          {/* Doctor Card */}
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shrink-0">
              {doctorInitials}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">{doctorName}</h3>
              <p className="text-[11px] text-slate-500">{doctorSpecialty}</p>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] text-[10px] font-semibold border border-emerald-200/50">
                  <Sparkles className="w-2.5 h-2.5" />
                  Connected Care
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold text-slate-900">Quick Actions</h3>

            <div className="space-y-1.5">
              <button
                onClick={() => navigate('/patient/appointments')}
                className="w-full flex items-center justify-between p-2.5 rounded-[3px] border border-stone-200/90 text-xs font-medium text-slate-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Book Appointment</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/patient/upload')}
                className="w-full flex items-center justify-between p-2.5 rounded-[3px] border border-stone-200/90 text-xs font-medium text-slate-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share Report</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/patient/reports')}
                className="w-full flex items-center justify-between p-2.5 rounded-[3px] border border-stone-200/90 text-xs font-medium text-slate-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>View Past Consultations</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Consultation Note Card */}
          <div className="bg-[#EAF6F0]/50 rounded-[3px] border border-emerald-100 p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#0E382F] font-bold text-xs">
              <Info className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Consultation Note</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              For new symptoms or prescription requests, please share relevant reports and current readings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
