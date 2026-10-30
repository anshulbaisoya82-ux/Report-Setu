import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { patientProfileApi } from '../../api/client';

export const PatientOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useStore();
  const [form, setForm] = useState({
    name: currentUser?.name || '',
    age: '',
    gender: '',
    bloodGroup: '',
    conditions: '',
    location: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const age = Number(form.age);
    if (!form.name.trim() || !Number.isInteger(age) || age < 1 || !form.gender || !form.bloodGroup || !form.location.trim()) {
      setError('Please complete every required field.');
      return;
    }
    setSaving(true);
    try {
      const profile = await patientProfileApi.update({
        name: form.name.trim(),
        age,
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        conditions: form.conditions.split(',').map((condition) => condition.trim()).filter(Boolean),
        location: form.location.trim(),
      });
      setCurrentUser(profile);
      navigate('/patient', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECF2ED] p-6">
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-card border border-stone-200/60 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#172B25]">Complete your patient profile</h1>
          <p className="mt-1 text-sm text-stone-500">Tell us a few details so your health record is accurate.</p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-medium text-stone-700">Full name
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">Age
            <input required type="number" min="1" max="130" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" />
          </label>
          <label className="block text-sm font-medium text-stone-700">Gender
            <select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3">
              <option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">Blood group
            <select required value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3">
              <option value="">Select blood group</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map((group) => <option key={group}>{group}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">City / location
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" placeholder="City" />
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">Existing conditions <span className="font-normal text-stone-400">(optional)</span>
          <input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" placeholder="Separate multiple conditions with commas" />
        </label>
        <button disabled={saving} className="w-full rounded-xl bg-[#1E3F35] py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving profile...' : 'Continue to patient portal'}</button>
      </form>
    </div>
  );
};
