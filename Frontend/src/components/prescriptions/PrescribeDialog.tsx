import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pill, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { notify } from '../ui/Toast';

/** Reminder slots. Labels match what the backend turns into daily dose reminders. */
const SLOTS = [
  { key: 'Morning', time: '8:00 AM' },
  { key: 'Noon', time: '1:00 PM' },
  { key: 'Evening', time: '6:30 PM' },
  { key: 'Night', time: '9:00 PM' },
] as const;
type Slot = (typeof SLOTS)[number]['key'];

const FOOD = ['After food', 'Before food', 'With food', 'Empty stomach'] as const;
type Food = (typeof FOOD)[number];

/** Suggestions only — the doctor can type any medicine. */
const COMMON_MEDICINES = [
  'Metformin 500 mg', 'Metformin 1000 mg', 'Glimepiride 1 mg', 'Telmisartan 40 mg', 'Amlodipine 5 mg',
  'Atorvastatin 10 mg', 'Rosuvastatin 10 mg', 'Pantoprazole 40 mg', 'Paracetamol 650 mg', 'Amoxicillin 500 mg',
  'Vitamin D3 60,000 IU', 'Iron + Folic acid',
];

interface MedicineRow {
  id: number;
  name: string;
  dose: string;
  days: string;
  slots: Slot[];
  food: Food;
}

let rowId = 1;
const newRow = (): MedicineRow => ({ id: rowId++, name: '', dose: '1 tablet', days: '30', slots: ['Morning', 'Night'], food: 'After food' });

interface Props {
  open: boolean;
  onClose: () => void;
  patient: { id: string; name: string; rsId?: string };
}

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-stone-400 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900/15';

export const PrescribeDialog: React.FC<Props> = ({ open, onClose, patient }) => {
  const createPrescription = useStore((s) => s.createPrescription);
  const [rows, setRows] = useState<MedicineRow[]>(() => [newRow()]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const focusNewRow = useRef(false);

  useEffect(() => {
    if (open) {
      setRows([newRow()]);
      setShowErrors(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (focusNewRow.current) {
      lastNameRef.current?.focus();
      focusNewRow.current = false;
    }
  }, [rows.length]);

  const update = (id: number, patch: Partial<MedicineRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggleSlot = (r: MedicineRow, s: Slot) =>
    update(r.id, { slots: r.slots.includes(s) ? r.slots.filter((x) => x !== s) : SLOTS.map((x) => x.key).filter((k) => k === s || r.slots.includes(k)) });

  const problems = (r: MedicineRow) => ({
    name: !r.name.trim(),
    dose: !r.dose.trim(),
    days: !(Number(r.days) >= 1 && Number(r.days) <= 365),
    slots: r.slots.length === 0,
  });
  const valid = rows.every((r) => !Object.values(problems(r)).some(Boolean));

  const reminderTimes = useMemo(() => {
    const used = new Set(rows.flatMap((r) => r.slots));
    return SLOTS.filter((s) => used.has(s.key)).map((s) => s.time);
  }, [rows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    // One prescription per medicine, so each keeps its own course length (the API stores one per prescription).
    const saved: string[] = [];
    for (const r of rows) {
      const timing = r.slots.join(', ');
      try {
        await createPrescription({
          patientId: patient.id,
          name: r.name.trim(),
          instructions: `${r.dose.trim()} · ${timing} · ${r.food}`,
          totalDays: Number(r.days),
          medicines: [{ name: r.name.trim(), dose: r.dose.trim(), timing, instructions: r.food }],
        });
        saved.push(r.name.trim());
      } catch (err: any) {
        setSaving(false);
        // Keep only the medicines that still need saving so nothing is prescribed twice.
        setRows((rs) => rs.filter((x) => !saved.includes(x.name.trim())));
        notify(
          `${saved.length ? `Saved ${saved.join(', ')}. ` : ''}Could not save ${r.name.trim()}: ${err?.message || 'please try again.'}`,
          'error'
        );
        return;
      }
    }
    setSaving(false);
    notify(`Prescribed ${saved.length === 1 ? saved[0] : `${saved.length} medicines`} to ${patient.name}. Reminders are set.`, 'success');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-modal sm:rounded-3xl"
        noValidate
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 id="rx-title" className="text-lg font-semibold text-ink">New prescription</h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {patient.name}
              {patient.rsId ? <span className="text-stone-400"> · {patient.rsId}</span> : null}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Medicines */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-stone-50 px-5 py-5 sm:px-7">
          <datalist id="rx-medicines">
            {COMMON_MEDICINES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          {rows.map((r, i) => {
            const p = problems(r);
            const err = (k: keyof typeof p) => showErrors && p[k];
            return (
              <fieldset key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                <legend className="sr-only">Medicine {i + 1}</legend>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-500/15 text-terracotta-600">
                      <Pill className="h-3.5 w-3.5" />
                    </span>
                    Medicine {i + 1}
                  </span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_140px_120px] sm:gap-4">
                  <label className="col-span-2 block min-w-0 sm:col-span-1">
                    <span className="mb-1.5 block text-xs font-medium text-stone-600">Medicine and strength</span>
                    <input
                      ref={i === rows.length - 1 ? lastNameRef : undefined}
                      id={`rx-name-${r.id}`}
                      list="rx-medicines"
                      value={r.name}
                      onChange={(e) => update(r.id, { name: e.target.value })}
                      placeholder="e.g. Metformin 500 mg"
                      autoComplete="off"
                      aria-invalid={err('name') || undefined}
                      className={`${field} ${err('name') ? 'border-red-400' : ''}`}
                    />
                    {err('name') && <span className="mt-1 block text-xs text-red-700">Enter the medicine name</span>}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-stone-600">Dose</span>
                    <input id={`rx-dose-${r.id}`} value={r.dose} onChange={(e) => update(r.id, { dose: e.target.value })} placeholder="1 tablet" aria-invalid={err('dose') || undefined} className={`${field} ${err('dose') ? 'border-red-400' : ''}`} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-stone-600">Course</span>
                    <span className="relative block">
                      <input
                        id={`rx-days-${r.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={365}
                        value={r.days}
                        onChange={(e) => update(r.id, { days: e.target.value })}
                        aria-invalid={err('days') || undefined}
                        className={`${field} pr-12 ${err('days') ? 'border-red-400' : ''}`}
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">days</span>
                    </span>
                  </label>
                </div>

                <div className="mt-4">
                  <span className="mb-1.5 block text-xs font-medium text-stone-600">When to take</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="When to take">
                    {SLOTS.map((s) => {
                      const on = r.slots.includes(s.key);
                      return (
                        <button
                          key={s.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleSlot(r, s.key)}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                            on ? 'border-forest-900 bg-forest-50 text-forest-900' : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-semibold">{s.key}</span>
                            <span className="block text-xs opacity-70">{s.time}</span>
                          </span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? 'border-forest-900 bg-forest-900 text-white' : 'border-stone-300'}`}>
                            {on && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {err('slots') && <span className="mt-1 block text-xs text-red-700">Choose at least one time</span>}
                </div>

                <div className="mt-4">
                  <span className="mb-1.5 block text-xs font-medium text-stone-600">Food</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-grid sm:grid-cols-4" role="radiogroup" aria-label="Food">
                    {FOOD.map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={r.food === f}
                        onClick={() => update(r.id, { food: f })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${r.food === f ? 'bg-white text-forest-900 shadow-xs' : 'text-stone-600 hover:text-ink'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>
            );
          })}

          <button
            type="button"
            onClick={() => {
              focusNewRow.current = true;
              setRows((rs) => [...rs, newRow()]);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-3.5 text-sm font-semibold text-forest-900 hover:border-forest-900 hover:bg-forest-50"
          >
            <Plus className="h-4 w-4" /> Add another medicine
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-stone-500">
            {rows.length} {rows.length === 1 ? 'medicine' : 'medicines'}
            {reminderTimes.length ? ` · patient reminders at ${reminderTimes.join(', ')}` : ''}
          </p>
          <div className="flex gap-2 sm:shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:flex-none">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-forest-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-850 disabled:opacity-60 sm:flex-none">
              {saving ? 'Saving…' : rows.length > 1 ? `Prescribe ${rows.length} medicines` : 'Prescribe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
