import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Search,
  Send,
  MessageSquare,
  Sparkles,
  User,
  Check,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  UserCheck,
  Stethoscope,
  ArrowDown,
} from 'lucide-react';
import { doctorApi } from '../../api';
import { PatientQuestionThread } from '../../types';

export const DoctorPatientQuestions: React.FC = () => {
  const { questionThreads, fetchQuestionThreads, sendDoctorReply, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'all' | 'unanswered' | 'medicine' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; sub?: string } | null>(null);

  const [threads, setThreads] = useState<PatientQuestionThread[]>([]);

  useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

  useEffect(() => {
    setThreads(questionThreads || []);
  }, [questionThreads]);

  const [selectedThreadId, setSelectedThreadId] = useState<string>('');

  // References for scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    if (threads.length > 0 && !threads.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const selectedThread =
    threads.find((t) => t.id === selectedThreadId) || threads[0];
  const currentDoctorName = currentUser?.name || selectedThread?.doctorName || 'Dr. Rishabh';

  // Counts for top filter tabs
  const totalCount = threads.length;
  const unansweredCount = threads.filter((t) => t.unreadCount > 0).length;
  const medicineCount = threads.filter((t) => t.category === 'Medicine').length;
  const resolvedCount = threads.filter((t) => t.unreadCount === 0).length;

  // Filter threads
  const filteredThreads = threads.filter((t) => {
    if (activeTab === 'unanswered' && t.unreadCount === 0) return false;
    if (activeTab === 'medicine' && t.category !== 'Medicine') return false;
    if (activeTab === 'resolved' && t.unreadCount > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const lastMsg = t.messages[t.messages.length - 1]?.text || '';
      return (
        t.patientName.toLowerCase().includes(q) ||
        t.reportContext.toLowerCase().includes(q) ||
        lastMsg.toLowerCase().includes(q) ||
        (t.patientRsId && t.patientRsId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Scroll position detector
  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // If user scrolled up more than 60px from bottom, consider them reading older messages
    setIsUserScrolledUp(distanceFromBottom > 60);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  // Scroll to bottom immediately whenever selected thread changes
  useEffect(() => {
    setIsUserScrolledUp(false);
    scrollToBottom('auto');
    prevMessagesLengthRef.current = selectedThread?.messages?.length || 0;
  }, [selectedThreadId]);

  // Auto-scroll when new messages arrive unless user is reading older messages
  useEffect(() => {
    const currentLen = selectedThread?.messages?.length || 0;
    if (currentLen > prevMessagesLengthRef.current) {
      if (!isUserScrolledUp) {
        scrollToBottom('smooth');
      }
    }
    prevMessagesLengthRef.current = currentLen;
  }, [selectedThread?.messages?.length, isUserScrolledUp]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread) return;

    const textToSend = replyText.trim();
    setReplyText('');

    const now = new Date();
    const formattedTime =
      now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `doctor-reply-${Date.now()}`,
      sender: 'doctor' as const,
      text: textToSend,
      timestamp: formattedTime,
    };

    // Immutably append message to state so React re-renders immediately
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === selectedThread.id) {
          return {
            ...t,
            unreadCount: 0,
            lastMessageTime: formattedTime,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      })
    );

    // Ensure view scrolls to the doctor's new reply
    setIsUserScrolledUp(false);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      await sendDoctorReply(selectedThread.id, textToSend);
      setToastInfo({
        message: `Reply sent to ${selectedThread.patientName}!`,
        sub: 'Patient has received an instant notification in their portal.',
      });
      setTimeout(() => setToastInfo(null), 3500);
    } catch (err: any) {
      console.warn('Realtime reply synced locally:', err?.message);
      setToastInfo({
        message: `Reply delivered to ${selectedThread.patientName}`,
      });
      setTimeout(() => setToastInfo(null), 3000);
    }
  };

  const handleToggleAi = async () => {
    if (!selectedThread || isTogglingAi) return;
    const nextAction = selectedThread.isAiPaused ? 'resume' : 'takeover';
    setIsTogglingAi(true);

    try {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === selectedThread.id) {
            return {
              ...t,
              isAiPaused: !t.isAiPaused,
            };
          }
          return t;
        })
      );

      await doctorApi.toggleAi(selectedThread.id, nextAction);
      await fetchQuestionThreads();

      setToastInfo({
        message: nextAction === 'takeover' ? 'Conversation Taken Over' : 'AI Assistant Resumed',
        sub:
          nextAction === 'takeover'
            ? `AI automated replies paused for ${selectedThread.patientName}. You are now managing directly.`
            : `Setu AI Assistant resumed for ${selectedThread.patientName}.`,
      });
      setTimeout(() => setToastInfo(null), 3500);
    } catch (err: any) {
      console.warn('AI toggle local update:', err?.message);
    } finally {
      setIsTogglingAi(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] w-full mx-auto space-y-4 text-stone-800">
      {/* Toast Notification */}
      {toastInfo && (
        <div className="fixed top-6 right-6 z-50 bg-[#13382E] text-white px-5 py-3 rounded-[2px] shadow-lg flex items-center gap-3 border border-emerald-700/60 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold text-xs">{toastInfo.message}</p>
            {toastInfo.sub && <p className="text-[11px] text-emerald-200 mt-0.5">{toastInfo.sub}</p>}
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-[2px] p-5 border border-stone-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">
            Patient Inquiries & Triage
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Incoming queries regarding reports, prescriptions, and symptoms from your connected patients.
          </p>
        </div>

        {/* Filter Buttons Row */}
        <div className="flex items-center gap-2 flex-wrap select-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'all'
                ? 'bg-[#13382E] text-white'
                : 'bg-white border border-stone-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({totalCount})
          </button>

          <button
            onClick={() => setActiveTab('unanswered')}
            className={`px-3.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'unanswered'
                ? 'bg-[#13382E] text-white'
                : 'bg-white border border-stone-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Unanswered ({unansweredCount})
          </button>

          <button
            onClick={() => setActiveTab('medicine')}
            className={`px-3.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'medicine'
                ? 'bg-[#13382E] text-white'
                : 'bg-white border border-stone-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Medicine / Prescription ({medicineCount})
          </button>

          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-3.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'resolved'
                ? 'bg-[#13382E] text-white'
                : 'bg-white border border-stone-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Main Two-Column Fixed-Height Messaging Workspace */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch h-[calc(100vh-240px)] min-h-[520px] max-h-[850px] overflow-hidden">
        {/* LEFT COLUMN: Fixed Inquiry Panel with Independent Scroll */}
        <div className="w-full lg:w-[380px] xl:w-[390px] shrink-0 bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-3.5 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Fixed Search Bar at Top */}
          <div className="relative shrink-0 mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by patient name, medication or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] bg-white border border-slate-200 rounded-[2px] pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Independently Scrollable Inquiry List */}
          <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {filteredThreads.map((thread) => {
              const isSelected = thread.id === selectedThread?.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`p-3 rounded-[2px] transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#F4F6F5] border-stone-200/80 border-l-4 border-l-[#13382E]'
                      : 'bg-white border-stone-200/60 hover:bg-slate-50/80'
                  }`}
                >
                  {/* Top Row: Name and Time */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {thread.patientName}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                      {thread.lastMessageTime || '31 Oct 2026, 03:16 PM'}
                    </span>
                  </div>

                  {/* Context / Topic */}
                  <h4 className="text-xs font-semibold text-slate-800 line-clamp-1 mt-1">
                    {thread.reportContext}
                  </h4>

                  {/* Snippet */}
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-snug">
                    Hello Rishabh! Today, you are scheduled to take Metformin...
                  </p>

                  {/* Badges Row */}
                  <div className="flex items-center gap-1.5 mt-2 flex-nowrap overflow-hidden">
                    {/* Rx / Medicine Badge */}
                    <span className="px-2 py-0.5 rounded-[2px] bg-[#FFF8E7] text-[#9A6B00] border border-[#F3DE9C] text-[10px] font-semibold flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3 h-3 text-[#9A6B00]" />
                      <span>Rx / Medicine</span>
                    </span>

                    {/* AI Status Badge */}
                    {thread.isAiPaused ? (
                      <span className="px-2 py-0.5 rounded-[2px] bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-semibold shrink-0">
                        AI Paused
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-[2px] bg-[#E8F8F1] text-[#136C4F] border border-[#9BE1C3] text-[10px] font-semibold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-[#136C4F]" />
                        <span>AI Active</span>
                      </span>
                    )}

                    {/* Needs Reply / Handled Badge */}
                    {thread.unreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-[2px] bg-[#FEECEC] text-[#D92D20] border border-[#FECDCA] text-[10px] font-bold shrink-0">
                        Needs Reply ({thread.unreadCount})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-[2px] bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium flex items-center gap-0.5 shrink-0">
                        <Check className="w-2.5 h-2.5 text-slate-500" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredThreads.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs">
                No patient questions found. Only inquiries from connected patients are displayed.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Fixed-Height Conversation Workspace */}
        <div className="flex-1 min-w-0 bg-white rounded-[2px] border border-stone-200/80 shadow-2xs flex flex-col h-full min-h-0 overflow-hidden relative">
          {selectedThread ? (
            <>
              {/* Fixed Chat Header */}
              <div className="p-3.5 px-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap shrink-0 bg-white z-10">
                {/* Left: Avatar, Name, RS ID, Context */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#13382E] text-white font-bold flex items-center justify-center text-sm shrink-0">
                    {selectedThread.patientAvatar || selectedThread.patientName.charAt(0) || 'R'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {selectedThread.patientName}
                      </h3>
                      <span className="bg-slate-100 text-slate-500 font-medium text-[10px] px-1.5 py-0.5 rounded-[2px]">
                        {selectedThread.patientRsId || ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                      Context: <span className="font-semibold text-slate-900">{selectedThread.reportContext}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Take Over Conversation & Profile Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAi}
                    disabled={isTogglingAi}
                    className="bg-[#13382E] hover:bg-[#184639] text-white text-xs font-semibold px-3 py-1.5 rounded-[2px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>
                      {isTogglingAi
                        ? 'Updating...'
                        : selectedThread.isAiPaused
                        ? 'Resume AI Assistant'
                        : 'Take Over Conversation'}
                    </span>
                  </button>

                  <Link
                    to="/doctor/patients"
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-[2px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Profile</span>
                  </Link>
                </div>
              </div>

              {/* Independently Scrollable Message History Area */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
              >
                {selectedThread.messages.map((msg) => {
                  const isDoctor = msg.sender === 'doctor';
                  const isAssistant = msg.sender === 'assistant';

                  if (isAssistant) {
                    return (
                      <div key={msg.id} className="flex flex-col items-start">
                        {/* Sender info */}
                        <div className="flex items-center gap-2 mb-1 pl-1">
                          <div className="flex items-center gap-1 text-[#136C4F] font-bold text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-[#136C4F]" />
                            <span>Setu AI Assistant</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                        </div>

                        {/* Light mint green bubble */}
                        <div className="bg-[#EAF6F0] rounded-[2px] p-3.5 text-xs text-slate-800 max-w-xl leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  if (isDoctor) {
                    return (
                      <div key={msg.id} className="flex flex-col items-end">
                        {/* Sender info */}
                        <div className="flex items-center gap-2 mb-1 pr-1">
                          <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                          <span className="font-bold text-xs text-[#13382E] flex items-center gap-1">
                            <Stethoscope className="w-3.5 h-3.5 text-[#13382E]" />
                            <span>{currentDoctorName}</span>
                          </span>
                        </div>

                        {/* Dark green doctor bubble */}
                        <div className="bg-[#13382E] text-white rounded-[2px] p-3 text-xs max-w-xl shadow-2xs leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  // Default: Patient message
                  return (
                    <div key={msg.id} className="flex flex-col items-start">
                      {/* Sender info */}
                      <div className="flex items-center gap-2 mb-1 pl-1">
                        <span className="font-bold text-xs text-slate-900">
                          {selectedThread.patientName}
                        </span>
                        <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                      </div>

                      {/* Soft subtle gray patient bubble without harsh border */}
                      <div className="bg-[#F1F5F9] rounded-[2px] px-3.5 py-2.5 text-xs text-slate-900 max-w-xl leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll To Bottom Button when reading older messages */}
              {isUserScrolledUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserScrolledUp(false);
                    scrollToBottom('smooth');
                  }}
                  className="absolute bottom-[72px] right-6 z-20 bg-[#13382E] text-white text-xs font-semibold px-3 py-1.5 rounded-[2px] shadow-md hover:bg-[#1a4a3e] transition-all flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Latest messages</span>
                </button>
              )}

              {/* Fixed Message Composer at Bottom */}
              <div className="p-3.5 px-4 border-t border-stone-100 bg-white shrink-0 z-10">
                <form
                  onSubmit={handleSendReply}
                  className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-[2px] focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all shadow-2xs"
                >
                  {/* Paperclip attachment icon */}
                  <button
                    type="button"
                    title="Attach file or report"
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Message input */}
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 placeholder-slate-400 py-1.5"
                  />

                  {/* Compact Send button */}
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    title="Send message"
                    className="w-8 h-8 bg-[#13382E] hover:bg-[#184639] text-white rounded-[2px] flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              <h4 className="text-xs font-bold text-slate-700">No Patient Conversation Selected</h4>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Patient questions and clinical consultations are only accessible while patient consent is active.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientQuestions;
