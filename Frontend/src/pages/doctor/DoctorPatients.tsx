import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Search,
  Plus,
  Bell,
  ChevronDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const DoctorPatients: React.FC = () => {
  const navigate = useNavigate();
  const { patients, fetchDoctorPatients } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Needs review' | 'Follow-up due' | 'Up to date'>('All');
  const [sortBy, setSortBy] = useState<'Criticality' | 'Name' | 'Recent'>('Criticality');

  React.useEffect(() => {
    fetchDoctorPatients(searchQuery);
  }, [searchQuery]);

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.rsId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.conditions.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'Needs review') return patient.status === 'Critical';
    if (activeFilter === 'Follow-up due') return patient.status === 'Unbalanced';
    if (activeFilter === 'Up to date') return patient.status === 'Normal';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">Patients</h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {patients.length} registered patient{patients.length === 1 ? '' : 's'} under your care
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-600 shadow-sm">
            <Bell className="w-4 h-4" />
          </div>
          <div className="w-10 h-10 rounded-full bg-forest-900 text-white flex items-center justify-center font-semibold text-xs shadow-sm">
            {patients.length > 0 ? patients[0].avatar : 'DR'}
          </div>
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-card border border-stone-200/70 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient by name, RS ID, or condition..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-forest-900/20 focus:border-forest-900 text-sm text-ink"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold py-2.5 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-900/20 cursor-pointer"
              >
                <option value="Criticality">Sort by: Criticality</option>
                <option value="Name">Sort by: Name</option>
                <option value="Recent">Sort by: Recent</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveFilter('All')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex-shrink-0 ${
              activeFilter === 'All'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All patients · {patients.length}
          </button>
          <button
            onClick={() => setActiveFilter('Needs review')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex-shrink-0 ${
              activeFilter === 'Needs review'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Needs review · {patients.filter((patient) => patient.status === 'Critical').length}
          </button>
          <button
            onClick={() => setActiveFilter('Follow-up due')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex-shrink-0 ${
              activeFilter === 'Follow-up due'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Follow-up due · {patients.filter((patient) => patient.status === 'Unbalanced').length}
          </button>
          <button
            onClick={() => setActiveFilter('Up to date')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all flex-shrink-0 ${
              activeFilter === 'Up to date'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Up to date · {patients.filter((patient) => patient.status === 'Normal').length}
          </button>
        </div>
      </div>

      {/* Patient Cards List */}
      <div className="space-y-3">
        {filteredPatients.map((patient) => {
          const isCritical = patient.status === 'Critical';
          const isUnbalanced = patient.status === 'Unbalanced';

          return (
            <div
              key={patient.id}
              onClick={() => navigate(`/doctor/patients/${patient.id}`)}
              className="bg-white rounded-2xl p-4 sm:p-5 shadow-card border border-stone-200/70 hover:border-forest-900/40 hover:shadow-hover transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {patient.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-base text-ink">{patient.name}</h3>
                    <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                      {patient.rsId}
                    </span>
                    <span className="text-xs text-stone-400">
                      {patient.gender}, {patient.age} yrs · {patient.bloodGroup}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {patient.conditions.map((cond) => (
                      <span
                        key={cond}
                        className="text-xs font-medium bg-forest-50 text-forest-800 px-2.5 py-0.5 rounded-full"
                      >
                        {cond}
                      </span>
                    ))}
                    <span className="text-xs text-stone-400">
                      Last report: <strong className="text-stone-600">{patient.lastReportName}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    isCritical
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : isUnbalanced
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-forest-50 text-forest-800'
                  }`}
                >
                  {patient.status}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/doctor/patients/${patient.id}`);
                  }}
                  className="bg-forest-900 hover:bg-forest-950 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>View file</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-stone-500 pt-2 px-1">
        <span>Showing {filteredPatients.length} of {patients.length} patients</span>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-stone-800">1 / 31</span>
          <button className="w-8 h-8 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:text-stone-900">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
