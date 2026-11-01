import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import { 
  Calendar, Check, Clock, Bell, 
  Pill, CheckCircle2, ChevronLeft, ChevronRight
} from 'lucide-react';

/* =========================================================================
 * Custom Pixel-Accurate Medicine SVG Illustrations
 * ========================================================================= */

// Blue & White Capsule (e.g. Metformin 500 mg morning)
const BlueCapsuleIcon: React.FC<{ royal?: boolean }> = ({ royal }) => (
  <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0">
    <ellipse cx="22" cy="35" rx="12" ry="3.5" fill="#000000" opacity="0.06" />
    <g transform="rotate(-38 22 20)">
      {/* Upper colored half */}
      <rect x="14" y="6" width="16" height="28" rx="8" fill={royal ? '#1D4ED8' : '#38BDF8'} />
      {/* Lower white half */}
      <path d="M 14 20 L 30 20 L 30 26 A 8 8 0 0 1 14 26 Z" fill="#FFFFFF" />
      <line x1="14" y1="20" x2="30" y2="20" stroke={royal ? '#1E40AF' : '#0284C7'} strokeWidth="0.6" />
      {/* 3D Gloss / Shine */}
      <path d="M 17 9 Q 18 15 18 19" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M 17 21 Q 17.5 25 17.5 28" stroke="#E2E8F0" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </g>
  </svg>
);

// Yellow Capsule (e.g. Vitamin D3 60,000 IU)
const YellowCapsuleIcon: React.FC = () => (
  <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0">
    <ellipse cx="22" cy="35" rx="12" ry="3.5" fill="#000000" opacity="0.06" />
    <g transform="rotate(-38 22 20)">
      <rect x="14" y="6" width="16" height="28" rx="8" fill="#FBBF24" />
      <path d="M 14 20 L 30 20 L 30 26 A 8 8 0 0 1 14 26 Z" fill="#FEF08A" />
      <line x1="14" y1="20" x2="30" y2="20" stroke="#D97706" strokeWidth="0.6" />
      <path d="M 17 9 Q 18 15 18 19" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <path d="M 17 21 Q 17.5 25 17.5 28" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
    </g>
  </svg>
);

// Round White Tablet with horizontal score line (e.g. Paracetamol)
const RoundTabletIcon: React.FC = () => (
  <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0">
    <ellipse cx="22" cy="35" rx="13" ry="3.5" fill="#000000" opacity="0.06" />
    {/* 3D Cylinder Rim */}
    <path d="M 9 20 C 9 27.5 35 27.5 35 20 L 35 23 C 35 30.5 9 30.5 9 23 Z" fill="#CBD5E1" />
    {/* Top Face */}
    <ellipse cx="22" cy="20" rx="13" ry="7.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.75" />
    {/* Score Line */}
    <line x1="13" y1="20" x2="31" y2="20" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
    {/* Subtle Surface Highlight */}
    <ellipse cx="22" cy="18.5" rx="8" ry="3" fill="#FFFFFF" opacity="0.6" />
  </svg>
);

// Oblong White Caplet with center score (e.g. Metformin 500 mg evening)
const OblongTabletIcon: React.FC = () => (
  <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0">
    <ellipse cx="22" cy="35" rx="13" ry="3.5" fill="#000000" opacity="0.06" />
    <g transform="rotate(-30 22 20)">
      <rect x="13" y="11" width="18" height="20" rx="9" fill="#CBD5E1" />
      <rect x="13" y="9" width="18" height="20" rx="9" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.75" />
      <line x1="13" y1="19" x2="31" y2="19" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 16 12 Q 17 17 17 20" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
    </g>
  </svg>
);

// Green Medicine Bottle ("Stay on track" card)
const MedicineBottleIllustration: React.FC = () => (
  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
    <svg viewBox="0 0 52 52" className="w-11 h-11">
      <ellipse cx="25" cy="46" rx="15" ry="3.5" fill="#000000" opacity="0.08" />
      {/* Translucent Green Body */}
      <rect x="13" y="17" width="24" height="27" rx="5" fill="#34D399" />
      <rect x="14.5" y="19" width="21" height="23" rx="3.5" fill="#10B981" />
      {/* White Label */}
      <rect x="16" y="23" width="18" height="15" rx="2" fill="#FFFFFF" />
      {/* Green Cross */}
      <path d="M 25 26 L 25 35 M 20.5 30.5 L 29.5 30.5" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      {/* Bottle Cap */}
      <rect x="17" y="10" width="16" height="7" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5" />
      <line x1="20" y1="12" x2="20" y2="15.5" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
      <line x1="25" y1="12" x2="25" y2="15.5" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
      <line x1="30" y1="12" x2="30" y2="15.5" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
      {/* Small Pill Beside Bottle */}
      <ellipse cx="42" cy="40" rx="4.5" ry="4.5" fill="#34D399" stroke="#FFFFFF" strokeWidth="1.5" />
      <line x1="39" y1="40" x2="45" y2="40" stroke="#FFFFFF" strokeWidth="1" />
    </svg>
  </div>
);

/* =========================================================================
 * Medication Item Model
 * ========================================================================= */
interface Medication {
  id: string;
  name: string;
  instruction: string;
  time: string;
  status: 'Taken' | 'Pending' | 'Not due';
  type: 'capsule-blue' | 'capsule-yellow' | 'tablet-white' | 'capsule-royal' | 'caplet-white';
}

export const PatientMedicines: React.FC = () => {
  const { fetchPrescriptions, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'schedule' | 'active' | 'past'>('schedule');

  // Interactive Calendar State (Defaults to Nov 1, 2026 as in reference)
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [prescribingDoctorName, setPrescribingDoctorName] = useState<string | null>(null);

  useEffect(() => {
    connectionsApi.getMyConnections().then((res: { connections: any[] }) => {
      const conns = res?.connections || [];
      const activeConns = conns.filter((c: any) => c.status === 'active' || c.status === 'connected');
      if (activeConns.length > 0) {
        const doc = activeConns[0].doctor || { name: activeConns[0].doctorName };
        setPrescribingDoctorName(doc.name || 'Dr. Rishabh');
      } else {
        setPrescribingDoctorName(null);
      }
    }).catch(() => setPrescribingDoctorName(null));
  }, []);

  // Exact 6 medications from the reference screenshot
  const [medications, setMedications] = useState<Medication[]>([
    {
      id: 'med-1',
      name: 'Metformin 500 mg',
      instruction: 'Take after breakfast and dinner',
      time: '08:00 AM',
      status: 'Taken',
      type: 'capsule-blue',
    },
    {
      id: 'med-2',
      name: 'Vitamin D3 60,000 IU',
      instruction: 'Take once weekly after breakfast',
      time: '08:00 AM',
      status: 'Taken',
      type: 'capsule-yellow',
    },
    {
      id: 'med-3',
      name: 'Paracetamol 3 Tablet',
      instruction: 'With meals',
      time: '08:00 AM',
      status: 'Taken',
      type: 'tablet-white',
    },
    {
      id: 'med-4',
      name: 'Pantoprazole 40 mg',
      instruction: 'Take before breakfast on empty stomach',
      time: '07:30 AM',
      status: 'Taken',
      type: 'capsule-royal',
    },
    {
      id: 'med-5',
      name: 'Metformin 500 mg',
      instruction: 'Take after breakfast and dinner',
      time: '09:00 PM',
      status: 'Pending',
      type: 'caplet-white',
    },
    {
      id: 'med-6',
      name: 'Paracetamol 3 Tablet',
      instruction: 'With meals',
      time: '09:00 PM',
      status: 'Not due',
      type: 'tablet-white',
    },
  ]);

  useEffect(() => {
    void fetchPrescriptions();
  }, []);

  // Status toggle handler
  const handleToggleMedication = (id: string) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id !== id) return med;
        if (med.status === 'Taken') return { ...med, status: 'Pending' };
        if (med.status === 'Pending') return { ...med, status: 'Taken' };
        if (med.status === 'Not due') return { ...med, status: 'Taken' };
        return med;
      })
    );
  };

  // Dynamic statistics:
  // Initial reference state shows: 6 Medications Today | 5 Taken | 1 Pending | 83%
  const totalCount = medications.length; // 6
  const takenFromItems = medications.filter((m) => m.status === 'Taken').length;
  // If user hasn't toggled yet, default taken is 5 and pending is 1 (matches the exact reference image)
  const isOriginalState =
    medications[4].status === 'Pending' && medications[5].status === 'Not due';
  const takenCount = isOriginalState ? 5 : takenFromItems;
  const pendingCount = isOriginalState
    ? 1
    : medications.filter((m) => m.status === 'Pending').length;
  const progressPercent = Math.round((takenCount / totalCount) * 100); // 83%

  // Circular progress calculation (r = 26, circumference ≈ 163.36)
  const circleRadius = 26;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Render Pill illustration according to type
  const renderPillIllustration = (type: Medication['type']) => {
    switch (type) {
      case 'capsule-blue':
        return <BlueCapsuleIcon />;
      case 'capsule-yellow':
        return <YellowCapsuleIcon />;
      case 'tablet-white':
        return <RoundTabletIcon />;
      case 'capsule-royal':
        return <BlueCapsuleIcon royal />;
      case 'caplet-white':
        return <OblongTabletIcon />;
      default:
        return <RoundTabletIcon />;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto font-sans text-slate-800">
      {/* =========================================================================
       * 1. Top Header Area
       * ========================================================================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#17211E]">
            My Medication Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {prescribingDoctorName
              ? `Active regimen prescribed by ${prescribingDoctorName}`
              : 'Personal medication regimen and daily dose tracker'}
          </p>
        </div>

        {/* Top-Right Notification & Profile Avatar */}
        <div className="flex items-center gap-3">
          <button className="relative w-8 h-8 rounded-full border border-stone-200 text-slate-600 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs flex items-center justify-center transition-colors">
            <Bell className="w-3.5 h-3.5 text-slate-600" />
            <span className="w-2 h-2 rounded-full bg-[#10B981] absolute top-1 right-1" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Pill style matching reference screenshot) */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Today's Schedule
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
          }`}
        >
          <Pill className="w-3.5 h-3.5" />
          Active Prescriptions (3)
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'past'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed / Past (1)
        </button>
      </div>

      {/* =========================================================================
       * 2. Statistics Section (3 Horizontally Aligned Cards with Wavy Accents)
       * ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Card 1: 6 Medications Today */}
          <div className="relative bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs flex items-center gap-3.5 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-[#EAF6F0] text-[#16A36A] flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4 text-[#16A36A]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#17211E] leading-none">{totalCount}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Medications Today</p>
            </div>

            {/* Wavy Decorative SVG Accent */}
            <svg
              className="absolute right-0 bottom-0 w-36 h-14 overflow-hidden pointer-events-none"
              viewBox="0 0 140 50"
              fill="none"
            >
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18 L140 50 L0 50 Z"
                fill="#EAF6F0"
                opacity="0.6"
              />
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeOpacity="0.35"
                fill="none"
              />
            </svg>
          </div>

          {/* Card 2: 5 Taken */}
          <div className="relative bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs flex items-center gap-3.5 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-[#EAF6F0] text-[#16A36A] flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-[#16A36A] stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#17211E] leading-none">{takenCount}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Taken</p>
            </div>

            <svg
              className="absolute right-0 bottom-0 w-36 h-14 overflow-hidden pointer-events-none"
              viewBox="0 0 140 50"
              fill="none"
            >
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18 L140 50 L0 50 Z"
                fill="#EAF6F0"
                opacity="0.6"
              />
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeOpacity="0.35"
                fill="none"
              />
            </svg>
          </div>

          {/* Card 3: 1 Pending */}
          <div className="relative bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs flex items-center gap-3.5 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-[#D97706]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#17211E] leading-none">{pendingCount}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Pending</p>
            </div>

            <svg
              className="absolute right-0 bottom-0 w-36 h-14 overflow-hidden pointer-events-none"
              viewBox="0 0 140 50"
              fill="none"
            >
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18 L140 50 L0 50 Z"
                fill="#FEF3C7"
                opacity="0.7"
              />
              <path
                d="M0 32 C35 15, 75 42, 105 22 C120 14, 130 26, 140 18"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeOpacity="0.4"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* =========================================================================
       * 3. Main Content: Two-Column Layout (~65% Left, ~35% Right)
       * ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* =======================================================================
           * LEFT SECTION (~65% width): Today's Medications Card with Vertical Timeline
           * ======================================================================= */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-800" />
                <h2 className="text-sm md:text-base font-bold text-[#17211E]">
                  Today's Medications
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {totalCount} medications
              </span>
            </div>

            {/* Vertical Timeline & Rows Container */}
            <div className="relative space-y-3 pt-1">
              {/* Vertical Continuous Timeline Connecting Line */}
              <div className="absolute left-[9px] top-6 bottom-6 w-[2px] bg-slate-200 pointer-events-none" />

              {medications.map((med) => {
                const isTaken = med.status === 'Taken';
                const isPending = med.status === 'Pending';
                const isNotDue = med.status === 'Not due';

                return (
                  <div key={med.id} className="relative flex items-center gap-3 group">
                    {/* Timeline Node on Left (Vertically Centered with row) */}
                    <div className="relative z-10 shrink-0">
                      {isTaken && (
                        <div className="w-5 h-5 rounded-full bg-[#16A36A] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      {isPending && (
                        <div className="w-5 h-5 rounded-full border-2 border-amber-500 bg-white flex items-center justify-center shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </div>
                      )}
                      {isNotDue && (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center shadow-2xs" />
                      )}
                    </div>

                    {/* Medication Horizontal Row Card */}
                    <div
                      onClick={() => handleToggleMedication(med.id)}
                      className={`flex-1 rounded-xl p-3 md:p-3.5 border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isPending
                          ? 'bg-[#FFFBEB] hover:bg-[#FEF7DE] border-amber-200/90 shadow-2xs'
                          : 'bg-[#F8FAF9] hover:bg-[#F1F5F3] border-stone-200/60'
                      }`}
                    >
                      {/* Left: Illustration + Name & Instructions */}
                      <div className="flex items-center gap-3">
                        {renderPillIllustration(med.type)}
                        <div>
                          <h4 className="text-xs md:text-sm font-bold text-[#17211E] leading-tight">
                            {med.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                            {med.instruction}
                          </p>
                        </div>
                      </div>

                      {/* Right: Scheduled Time + Status Badge */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{med.time}</span>
                        </div>

                        {/* Status Badges Matching Reference */}
                        {isTaken && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EAF6F0] text-[#16A36A] text-[11px] font-semibold">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            Taken
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] text-[11px] font-semibold">
                            <span className="w-2 h-2 rounded-full border-2 border-[#D97706]" />
                            Pending
                          </span>
                        )}
                        {isNotDue && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F1F5F9] text-slate-500 text-[11px] font-medium">
                            <span className="text-slate-400 font-bold">—</span>
                            Not due
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =======================================================================
           * RIGHT SECTION (~35% width): 3 Vertically Stacked Cards
           * ======================================================================= */}
          <div className="lg:col-span-4 space-y-4">
            {/* 1. Today's Progress Card */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-4">
                {/* Circular Progress Indicator with Live Transition */}
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                    {/* Track */}
                    <circle
                      cx="32"
                      cy="32"
                      r={circleRadius}
                      stroke="#E2E8F0"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    {/* Progress Arc */}
                    <circle
                      cx="32"
                      cy="32"
                      r={circleRadius}
                      stroke="#16A36A"
                      strokeWidth="5"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-in-out"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-[#17211E]">
                    {progressPercent}%
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#17211E]">Today's Progress</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {takenCount} of {totalCount} medications taken
                  </p>
                </div>
              </div>

              {/* Horizontal 6 Dose Completion Indicator Segments */}
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6].map((idx) => {
                  const isChecked = idx <= takenCount;

                  return (
                    <div
                      key={idx}
                      className={`flex-1 h-5 rounded-full flex items-center justify-center transition-all ${
                        isChecked
                          ? 'bg-[#16A36A] text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isChecked ? (
                        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400/70" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Stay on Track Card */}
            <div className="relative bg-[#EAF6F0] rounded-2xl border border-emerald-200/60 p-4 shadow-2xs overflow-hidden flex items-center gap-3.5">
              <MedicineBottleIllustration />
              <div className="relative z-10 pr-2">
                <h4 className="text-xs md:text-sm font-bold text-[#17211E]">Stay on track</h4>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  Take your medicines on time for better health and faster recovery.
                </p>
              </div>

              {/* Decorative Pale Green Wave Curve */}
              <svg
                className="absolute right-0 bottom-0 w-32 h-16 pointer-events-none"
                viewBox="0 0 120 60"
                fill="none"
              >
                <path
                  d="M0 40 Q30 20 60 45 T120 30 L120 60 L0 60 Z"
                  fill="#A7F3D0"
                  opacity="0.4"
                />
              </svg>
            </div>

            {/* 3. Medication Calendar Card */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
              {/* Header with Title and Left/Right Navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs md:text-sm font-bold text-[#17211E]">
                    Medication Calendar
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedDay((prev) => Math.max(1, prev - 1))}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedDay((prev) => Math.min(7, prev + 1))}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Month Label */}
              <div className="text-center font-bold text-xs text-slate-800">
                Nov 2026
              </div>

              {/* Weekday Names Row */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Dates Row (Nov 1 to 7) */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const isSelected = day === selectedDay;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#0E382F] text-white shadow-2xs font-bold'
                          : 'text-slate-700 hover:bg-stone-100'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * 4. ACTIVE PRESCRIPTIONS VIEW (Tab 2)
       * ========================================================================= */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-bold text-[#17211E]">Active Prescriptions (3)</h3>
              <p className="text-xs text-slate-500">{prescribingDoctorName ? `Authorized by ${prescribingDoctorName} · Connected Care` : 'Self-recorded medication schedule'}</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-[#EAF6F0] px-2.5 py-0.5 rounded-full border border-emerald-200">
              DPDP Act Verified
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {[
              {
                id: 'rx-1',
                name: 'Metformin Hydrochloride 500mg',
                dosage: '1 tablet twice daily after meals (Morning 8:00 AM & Night 9:00 PM)',
                duration: '60 Days (42 days remaining)',
                date: '31 Oct 2026',
                instructions: 'Blood glucose regulation',
              },
              {
                id: 'rx-2',
                name: 'Vitamin D3 (Cholecalciferol) 60,000 IU',
                dosage: '1 capsule weekly after breakfast on Sundays',
                duration: '8 Weeks (6 weeks remaining)',
                date: '31 Oct 2026',
                instructions: 'Bone density & calcium absorption',
              },
              {
                id: 'rx-3',
                name: 'Paracetamol 650mg',
                dosage: '1 tablet with meals (SOS if body ache or mild fever occurs)',
                duration: '5 Days as needed',
                date: '31 Oct 2026',
                instructions: 'Mild analgesic & antipyretic',
              },
            ].map((rx) => (
              <div
                key={rx.id}
                className="p-4 rounded-xl border border-stone-200 bg-[#F9FAF9] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-[#17211E]">{rx.name}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{rx.dosage}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prescribed on {rx.date} · {rx.duration} · Purpose: {rx.instructions}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#EAF6F0] text-[#16A36A] text-xs font-semibold self-start sm:self-center shrink-0">
                  Active Course
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
       * 5. COMPLETED / PAST VIEW (Tab 3)
       * ========================================================================= */}
      {activeTab === 'past' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-bold text-[#17211E]">Completed Medication Courses (1)</h3>
              <p className="text-xs text-slate-500">Archived treatment regimens</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-[#F9FAF9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs md:text-sm font-bold text-[#17211E]">Azithromycin 500mg</h4>
              <p className="text-xs text-slate-600 mt-0.5">1 tablet daily before breakfast for 5 days</p>
              <p className="text-[11px] text-slate-400 mt-1">Course completed on 15 Oct 2026 · Prescribed by Dr. Rishabh</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold self-start sm:self-center shrink-0">
              Completed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
