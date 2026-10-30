import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  MessageSquare, AlertTriangle, CheckCircle, Clock, Send, 
  Sparkles, Phone, User, Check, Search
} from 'lucide-react';

export const DoctorPatientQuestions: React.FC = () => {
  const { questionThreads, fetchQuestionThreads, sendDoctorReply } = useStore();
  const [activeTab, setActiveTab] = useState<'all' | 'unanswered' | 'medicine' | 'resolved'>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(questionThreads[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  React.useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

  const selectedThread = questionThreads.find(t => t.id === selectedThreadId) || questionThreads[0];

  const filteredThreads = questionThreads.filter(t => {
    if (activeTab === 'unanswered' && t.unreadCount === 0) return false;
    if (activeTab === 'medicine' && t.category !== 'Medicine') return false;
    if (activeTab === 'resolved' && t.unreadCount > 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const lastMsg = t.messages[t.messages.length - 1]?.text || '';
      return (
        t.patientName.toLowerCase().includes(q) ||
        lastMsg.toLowerCase().includes(q) ||
        t.reportContext.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApplyAISuggestion = () => {
    if (selectedThread?.suggestedReply) {
      setReplyText(selectedThread.suggestedReply);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread) return;

    void sendDoctorReply(selectedThread.id, replyText);
    setReplyText('');
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  const insertQuickTemplate = (template: string) => {
    setReplyText(prev => prev ? `${prev}\n\n${template}` : template);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-forest-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 text-accent-teal" />
          <div>
            <p className="font-semibold text-sm">Reply sent to {selectedThread?.patientName}!</p>
            <p className="text-xs text-forest-200">Patient has received an instant push notification & WhatsApp message.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">Patient Inquiries & Triage</h1>
          <p className="text-xs text-slate-500 mt-1">
            Incoming queries regarding reports, prescriptions, and symptoms from your connected patients
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'all' 
                ? 'bg-white text-forest-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({questionThreads.length})
          </button>
          <button
            onClick={() => setActiveTab('unanswered')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'unanswered' 
                ? 'bg-white text-red-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Unanswered ({questionThreads.filter(t => t.unreadCount > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('medicine')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'medicine' 
                ? 'bg-white text-amber-800 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Medicine related ({questionThreads.filter(t => t.category === 'Medicine').length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'resolved' 
                ? 'bg-white text-forest-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resolved ({questionThreads.filter(t => t.unreadCount === 0).length})
          </button>
        </div>
      </div>

      {/* Main Grid: Thread list on left, Conversation on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Thread List */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by patient name, medication or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-forest-700"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredThreads.map(thread => {
              const isSelected = thread.id === selectedThread?.id;
              const lastMsg = thread.messages[thread.messages.length - 1];
              return (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`p-4 cursor-pointer transition-all border-l-4 ${
                    isSelected 
                      ? 'bg-forest-50/60 border-forest-700' 
                      : 'border-transparent hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-slate-900 font-serif">
                      {thread.patientName}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {thread.lastMessageTime}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-forest-950 line-clamp-1 mb-1">
                    {thread.reportContext}
                  </h4>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2 font-sans">
                    {lastMsg ? lastMsg.text : 'No messages'}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {thread.category === 'Medicine' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Medicine Alert
                      </span>
                    )}

                    {thread.unreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-200">
                        Needs Doctor Reply ({thread.unreadCount})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-medium border border-emerald-200 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Answered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredThreads.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No patient questions match this filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {selectedThread ? (
            <>
              {/* Patient Banner */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E3F35] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {selectedThread.patientAvatar || selectedThread.patientName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 font-serif">{selectedThread.patientName}</h3>
                      <span className="text-[10px] px-2 py-0.2 bg-slate-200 text-slate-700 font-mono rounded">
                        {selectedThread.patientRsId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Context: <span className="font-semibold text-slate-800">{selectedThread.reportContext}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => alert(`Initiating direct voice call to patient: +91 98765 43210`)}
                    className="p-2 text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                    title="Direct Call"
                  >
                    <Phone className="w-4 h-4 text-forest-700" />
                  </button>

                  <Link
                    to={`/doctor/patients/${selectedThread.patientId}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-forest-800 bg-forest-50 border border-forest-200 rounded-xl hover:bg-forest-100 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" /> Full Record
                  </Link>
                </div>
              </div>

              {/* Medicine Alert Warning Banner if Applicable */}
              {selectedThread.category === 'Medicine' && (
                <div className="bg-[#FFF8E6] border-b border-[#F7E7B4] px-4 py-3 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <p className="text-xs text-amber-900 leading-snug">
                    <span className="font-bold">Medicine inquiry safety protocol:</span> Patient is inquiring about stopping or changing dose. Review patient active medications before replying.
                  </p>
                </div>
              )}

              {/* Message Transcript Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
                {selectedThread.messages.map(msg => {
                  const isDoctor = msg.sender === 'doctor';
                  const isAssistant = msg.sender === 'assistant';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-600">
                          {isDoctor ? 'Dr. Priya Mehta' : isAssistant ? 'Setu Assistant' : selectedThread.patientName}
                        </span>
                        <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                      </div>

                      <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        isDoctor 
                          ? 'bg-[#1E3F35] text-white rounded-tr-none shadow-xs' 
                          : isAssistant
                          ? 'bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-tl-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-2xs'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {/* AI Assistant Suggestion Box */}
                {selectedThread.suggestedReply && selectedThread.unreadCount > 0 && (
                  <div className="mt-4 bg-[#F2FAF9] border border-[#C6ECE7] rounded-2xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-[#0A887D]" />
                        </div>
                        <span className="text-xs font-bold text-forest-950 font-serif">Setu AI Suggested Reply</span>
                        <span className="text-[10px] bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] px-2 py-0.5 rounded-full font-medium">
                          Clinical Context Verified
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAISuggestion}
                        className="text-xs font-bold text-[#0C736A] hover:text-forest-950 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-[#80D7CE] shadow-2xs transition-colors"
                      >
                        Insert into composer
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-sans bg-white/90 p-3 rounded-xl border border-[#C6ECE7]/60">
                      "{selectedThread.suggestedReply}"
                    </p>
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="p-4 border-t border-slate-100 bg-white space-y-3">
                {/* Quick Templates */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Insert:</span>
                  <button 
                    type="button" 
                    onClick={() => insertQuickTemplate("Yes, you can safely continue this regimen as prescribed.")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-medium transition-colors"
                  >
                    + Continue regimen
                  </button>
                  <button 
                    type="button" 
                    onClick={() => insertQuickTemplate("Please visit the clinic for an in-person follow-up evaluation.")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-medium transition-colors"
                  >
                    + Schedule clinic visit
                  </button>
                  <button 
                    type="button" 
                    onClick={() => insertQuickTemplate("Kindly repeat the laboratory test in 4 days and share the report.")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-medium transition-colors"
                  >
                    + Repeat lab test
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={`Write your clinical response to ${selectedThread.patientName}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-xs p-3.5 pr-12 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50 leading-relaxed"
                  />
                  <button 
                    type="submit"
                    disabled={!replyText.trim()}
                    className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                      replyText.trim() 
                        ? 'bg-[#1E3F35] text-accent-teal hover:bg-forest-800 shadow-xs cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Select an inquiry thread from the left to view and answer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
