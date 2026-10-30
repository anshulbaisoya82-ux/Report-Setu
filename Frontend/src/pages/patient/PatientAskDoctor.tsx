import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Send, Sparkles, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { askPatientAssistant } from '../../api/chatApi';

export const PatientAskDoctor: React.FC = () => {
  const { questionThreads, sendPatientQuestion } = useStore();
  const thread = questionThreads.find(t => t.id === 'thread-rohan') || questionThreads[0];

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (thread?.messages && thread.messages.length > 0) return thread.messages;
    return [
      {
        id: 'welcome-msg',
        sender: 'assistant',
        text: 'Hello! I am your ReportSetu AI Medical Assistant powered by Gemini. You can ask me questions about your verified lab results, biological reference ranges, or medicine timings.',
        timestamp: 'Just now',
      },
    ];
  });
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const query = inputText.trim();
    setInputText('');
    if (thread) {
      sendPatientQuestion(thread.id, query);
    }
    
    // Add locally for instant responsive feel
    const isMed = query.toLowerCase().includes('stop') || query.toLowerCase().includes('medicine') || query.toLowerCase().includes('dose');
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'patient',
      text: query,
      timestamp: 'Just now',
      isMedicineQuestion: isMed
    };

    setMessages(prev => [...prev, newMsg]);
    setIsTyping(true);

    try {
      const res = await askPatientAssistant(query, 'en');
      const aiReply: ChatMessage = {
        id: res.id || `msg-ai-${Date.now()}`,
        sender: 'assistant',
        text: res.answer || res.text,
        timestamp: 'Just now',
        isMedicineQuestion: res.isMedicineQuestion,
        citations: res.citations,
      };
      setMessages(prev => [...prev, aiReply]);
    } catch (err) {
      console.error('Chat Assistant error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleUsePrompt = (prompt: string) => {
    setInputText(prompt);
  };

  const lastMsgIsMed = messages.some(m => m.isMedicineQuestion);

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">Ask your doctor</h1>
          <p className="text-xs text-slate-500 mt-1">
            Clinical communication bridge for your connected care team
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-forest-900 text-accent-teal font-bold text-xs flex items-center justify-center shrink-0">
            PM
          </div>
          <div className="text-left text-xs">
            <span className="font-bold text-slate-900 block font-serif">Your care team</span>
            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active · Replies in ~2 hrs
            </span>
          </div>
        </div>
      </div>

      {/* Safety Protocol Banner */}
      <div className="bg-[#F2FAF9] bg-gradient-to-r from-[#F2FAF9] to-[#E8F6F4] border border-[#C6ECE7] rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-700 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-[#0A887D]" />
        </div>
        <div className="space-y-1">
          <span className="font-bold text-forest-950 font-serif block">Clinician Safety Guardrail Active</span>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            General report questions receive instant AI explanations. Questions regarding stopping, changing, or adding medications are forwarded to your connected clinician without automated intervention.
          </p>
        </div>
      </div>

      {/* Flagged Medication Alert if triggered */}
      {lastMsgIsMed && (
        <div className="bg-[#FFF4E5] border border-[#FFD9A8] rounded-xl p-4 flex items-center gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold block">Medication Query Flagged for Clinician Review</span>
            <span>Your inquiry regarding medications has been flagged for clinician review.</span>
          </div>
        </div>
      )}

      {/* Chat Thread Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col h-[520px] overflow-hidden">
        {/* Messages scroll area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40">
          {messages.map(msg => {
            const isUser = msg.sender === 'patient';
            const isAssistant = msg.sender === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-600">
                    {isUser ? (
                      'You'
                    ) : isAssistant ? (
                      <span className="text-[#0C736A] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#0A887D]" /> Setu AI Assistant
                      </span>
                    ) : (
                      'Your doctor'
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-forest-900 text-white rounded-tr-none shadow-xs'
                      : isAssistant
                      ? 'bg-[#F2FAF9] text-[#0C736A] border border-[#C6ECE7] rounded-tl-none shadow-2xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-2xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#C6ECE7]/60 flex flex-wrap gap-1.5">
                      {msg.citations.map((c, idx) => (
                        <span
                          key={idx}
                          className="bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] text-[10px] px-2 py-0.5 rounded-md font-medium"
                        >
                          📋 {c.testName}: {c.value} {c.unit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/60 w-fit animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-[#0A887D] animate-spin" />
              <span>Gemini Clinical Assistant is analyzing your verified health records...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-semibold uppercase text-[10px] shrink-0">Suggestions:</span>
          <button
            type="button"
            onClick={() => handleUsePrompt('Can I safely stop or change this medicine?')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap"
          >
            Can I stop or change a medicine?
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt("What does my 1.2 Lakh platelet count mean?")}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap"
          >
            What does 1.2L platelet mean?
          </button>
          <button
            type="button"
            onClick={() => handleUsePrompt("Do I need fasting before repeat CBC on 26 Oct?")}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap"
          >
            Is fasting required for CBC?
          </button>
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your health or medication question here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/60"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`p-3 rounded-xl transition-all ${
              inputText.trim()
                ? 'bg-forest-900 text-accent-teal hover:bg-forest-800 shadow-xs cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
