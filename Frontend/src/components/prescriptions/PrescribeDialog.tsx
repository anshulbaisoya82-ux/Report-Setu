import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { notify } from '../ui/Toast';

/** Reminder slots. Labels match what the backend turns into daily dose reminders. */
const SLOTS = [
  { key: 'Morning', short: 'Morn', time: '8:00 AM' },
  { key: 'Noon', short: 'Noon', time: '1:00 PM' },
  { key: 'Evening', short: 'Eve', time: '6:30 PM' },
  { key: 'Night', short: 'Night', time: '9:00 PM' },
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

interface Med {
  id: number;
  name: string;
  dose: string;
  days: string;
  slots: Slot[];
  food: Food;
}

let nextId = 1;
const blank = (slots: Slot[] = ['Morning', 'Night'], food: Food = 'After food'): Med => ({ id: nextId++, name: '', dose: '1 tablet', days: '30', slots, food });

/** Indian prescription shorthand, e.g. 1-0-0-1 for morning + night. */
const pattern = (slots: Slot[]) => SLOTS.map((s) => (slots.includes(s.key) ? '1' : '0')).join('-');
const orderSlots = (slots: Slot[]) => SLOTS.map((s) => s.key).filter((k) => slots.includes(k));

interface Props {
  open: boolean;
  onClose: () => void;
  patient: { id: string; name: string; rsId?: string };
}

const input =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900/15';

export const PrescribeDialog: React.FC<Props> = ({ open, onClose, patient }) => {
  const createPrescription = useStore((s) => s.createPrescription);
  const [meds, setMeds] = useState<Med[]>(() => [blank()]);
  // "same" = every medicine is taken together at the same times (the common case).
  const [mode, setMode] = useState<'same' | 'each'>('same');
  const [sharedSlots, setSharedSlots] = useState<Slot[]>(['Morning', 'Night']);
  const [sharedFood, setSharedFood] = useState<Food>('After food');
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const focusLast = useRef(false);
  const lastNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMeds([blank()]);
    setMode('same');
    setSharedSlots(['Morning', 'Night']);
    setSharedFood('After food');
    setShowErrors(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (focusLast.current) {
      lastNameRef.current?.focus();
      focusLast.current = false;
    }
  }, [meds.length]);

  const update = (id: number, patch: Partial<Med>) => setMeds((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // Effective timing for each medicine, whichever mode is active.
  const effective = (m: Med) => (mode === 'same' ? { slots: sharedSlots, food: sharedFood } : { slots: m.slots, food: m.food });

  const switchMode = (next: 'same' | 'each') => {
    if (next === mode) return;
    if (next === 'each') setMeds((ms) => ms.map((m) => ({ ...m, slots: [...sharedSlots], food: sharedFood }))); // start from the shared choice
    setMode(next);
  };

  const toggle = (list: Slot[], s: Slot) => orderSlots(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  const problems = (m: Med) => ({
    name: !m.name.trim(),
    dose: !m.dose.trim(),
    days: !(Number(m.days) >= 1 && Number(m.days) <= 365),
    slots: effective(m).slots.length === 0,
  });
  const valid = meds.every((m) => !Object.values(problems(m)).some(Boolean));

  /** What the patient's day will look like: medicines grouped by reminder time. */
  const day = useMemo(
    () =>
      SLOTS.map((s) => ({
        ...s,
        items: meds.filter((m) => effective(m).slots.includes(s.key)).map((m) => ({ id: m.id, name: m.name.trim() || 'Unnamed medicine', dose: m.dose, food: effective(m).food })),
      })).filter((s) => s.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meds, mode, sharedSlots, sharedFood]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    // One prescription per medicine so each keeps its own course length (the API stores one per prescription).
    const saved: number[] = [];
    for (const m of meds) {
      const { slots, food } = effective(m);
      const timing = slots.join(', ');
      try {
        await createPrescription({
          patientId: patient.id,
          name: m.name.trim(),
          instructions: `${m.dose.trim()} · ${timing} · ${food}`,
          totalDays: Number(m.days),
          medicines: [{ name: m.name.trim(), dose: m.dose.trim(), timing, instructions: food }],
        });
        saved.push(m.id);
      } catch (err: any) {
        setSaving(false);
        setMeds((ms) => ms.filter((x) => !saved.includes(x.id))); // never prescribe the saved ones twice
        notify(`${saved.length ? `${saved.length} saved. ` : ''}Could not save ${m.name.trim()}: ${err?.message || 'please try again.'}`, 'error');
        return;
      }
    }
    setSaving(false);
    notify(`Prescribed ${saved.length === 1 ? meds[0].name.trim() : `${saved.length} medicines`} to ${patient.name}. Reminders are set.`, 'success');
    onClose();
  };

  if (!open) return null;

  const SlotPicker: React.FC<{ value: Slot[]; onChange: (v: Slot[]) => void; error?: boolean }> = ({ value, onChange, error }) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Reminder times">
      {SLOTS.map((s) => {
        const on = value.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggle(value, s.key))}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
              on ? 'border-forest-900 bg-forest-50 text-forest-900' : error ? 'border-red-300 bg-white text-stone-600' : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
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
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="rx-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-modal sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
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

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          {/* STEP 1 — what */}
          <section>
            <h3 className="text-sm font-semibold text-ink">1. Medicines</h3>
            <p className="mb-3 text-sm text-stone-500">Name, how much each time, and for how many days.</p>
            <datalist id="rx-medicines">
              {COMMON_MEDICINES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="hidden grid-cols-[minmax(0,1fr)_130px_110px_36px] gap-3 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-500 sm:grid">
                <span>Medicine and strength</span>
                <span>Dose</span>
                <span>Course</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {meds.map((m, i) => {
                  const p = problems(m);
                  return (
                    <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_130px_110px_36px] sm:gap-3">
                      <div className="min-w-0">
                        <input
                          ref={i === meds.length - 1 ? lastNameRef : undefined}
                          id={`rx-name-${m.id}`}
                          list="rx-medicines"
                          autoComplete="off"
                          value={m.name}
                          onChange={(e) => update(m.id, { name: e.target.value })}
                          placeholder="e.g. Metformin 500 mg"
                          aria-label={`Medicine ${i + 1} name and strength`}
                          aria-invalid={(showErrors && p.name) || undefined}
                          className={`${input} ${showErrors && p.name ? 'border-red-400' : ''}`}
                        />
                        {showErrors && p.name && <span className="mt-1 block text-xs text-red-700">Enter the medicine name</span>}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove medicine ${i + 1}`}
                        disabled={meds.length === 1}
                        onClick={() => setMeds((ms) => ms.filter((x) => x.id !== m.id))}
                        className="row-span-2 flex h-9 w-9 items-center justify-center self-start rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 disabled:invisible sm:order-last sm:row-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <input id={`rx-dose-${m.id}`} value={m.dose} onChange={(e) => update(m.id, { dose: e.target.value })} placeholder="1 tablet" aria-label={`Medicine ${i + 1} dose`} className={`${input} ${showErrors && p.dose ? 'border-red-400' : ''}`} />
                        <span className="relative block">
                          <input
                            id={`rx-days-${m.id}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={365}
                            value={m.days}
                            onChange={(e) => update(m.id, { days: e.target.value })}
                            aria-label={`Medicine ${i + 1} course in days`}
                            className={`${input} pr-11 ${showErrors && p.days ? 'border-red-400' : ''}`}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">days</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  focusLast.current = true;
                  setMeds((ms) => [...ms, blank(ms[ms.length - 1]?.slots, ms[ms.length - 1]?.food)]);
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-3 text-sm font-semibold text-forest-800 hover:bg-forest-50"
              >
                <Plus className="h-4 w-4" /> Add another medicine
              </button>
            </div>
          </section>

          {/* STEP 2 — when */}
          <section>
            <h3 className="text-sm font-semibold text-ink">2. When to take</h3>
            <p className="mb-3 text-sm text-stone-500">The patient gets one reminder for each time, listing every medicine due then.</p>

            {meds.length > 1 && (
              <div className="mb-4 inline-grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Timing">
                {(['same', 'each'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={mode === k}
                    onClick={() => switchMode(k)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium ${mode === k ? 'bg-white text-forest-900 shadow-xs' : 'text-stone-600 hover:text-ink'}`}
                  >
                    {k === 'same' ? 'All together, same times' : 'Different time for each'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'same' || meds.length === 1 ? (
              <div className="space-y-4">
                <SlotPicker value={sharedSlots} onChange={setSharedSlots} error={showErrors && sharedSlots.length === 0} />
                {showErrors && sharedSlots.length === 0 && <p className="text-xs text-red-700">Choose at least one time</p>}
                <FoodPicker value={sharedFood} onChange={setSharedFood} />
              </div>
            ) : (
              // Prescription chart: one row per medicine, one column per time.
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-stone-50 text-xs text-stone-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Medicine</th>
                      {SLOTS.map((s) => (
                        <th key={s.key} className="px-1 py-2 text-center font-medium">
                          {s.key}
                          <span className="block font-normal text-stone-400">{s.time}</span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">Food</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {meds.map((m, i) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2.5">
                          <span className="block max-w-[170px] truncate font-medium text-ink">{m.name.trim() || `Medicine ${i + 1}`}</span>
                          <span className={`text-xs ${showErrors && m.slots.length === 0 ? 'text-red-700' : 'text-stone-400'}`}>
                            {m.slots.length ? pattern(m.slots) : 'Pick a time'}
                          </span>
                        </td>
                        {SLOTS.map((s) => {
                          const on = m.slots.includes(s.key);
                          return (
                            <td key={s.key} className="px-1 py-2.5 text-center">
                              <button
                                type="button"
                                aria-pressed={on}
                                aria-label={`${m.name || `Medicine ${i + 1}`} at ${s.key}`}
                                onClick={() => update(m.id, { slots: toggle(m.slots, s.key) })}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${on ? 'border-forest-900 bg-forest-900 text-white' : 'border-stone-300 bg-white hover:border-stone-400'}`}
                              >
                                {on && <Check className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5">
                          <select id={`rx-food-${m.id}`} value={m.food} onChange={(e) => update(m.id, { food: e.target.value as Food })} aria-label={`${m.name || `Medicine ${i + 1}`} food`} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm">
                            {FOOD.map((f) => (
                              <option key={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Preview — the patient's day */}
          {day.length > 0 && (
            <section className="rounded-xl bg-stone-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">Patient's daily reminders</h3>
              <ol className="space-y-2.5">
                {day.map((s) => (
                  <li key={s.key} className="flex gap-3 text-sm">
                    <span className="w-[4.5rem] shrink-0 font-semibold text-forest-900">{s.time}</span>
                    <span className="min-w-0 text-stone-700">
                      {s.items.map((it, idx) => (
                        <span key={it.id}>
                          {idx > 0 && <span className="font-semibold text-stone-500"> + </span>}
                          <span className="text-ink">{it.name}</span>
                          <span className="text-stone-500"> ({it.dose}, {it.food.toLowerCase()})</span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:flex-none">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-forest-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-850 disabled:opacity-60 sm:flex-none">
              {saving ? 'Saving…' : meds.length > 1 ? `Prescribe ${meds.length} medicines` : 'Prescribe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const FoodPicker: React.FC<{ value: Food; onChange: (f: Food) => void }> = ({ value, onChange }) => (
  <div>
    <span className="mb-1.5 block text-xs font-medium text-stone-600">Food</span>
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-grid sm:grid-cols-4" role="radiogroup" aria-label="Food">
      {FOOD.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === f}
          onClick={() => onChange(f)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${value === f ? 'bg-white text-forest-900 shadow-xs' : 'text-stone-600 hover:text-ink'}`}
        >
          {f}
        </button>
      ))}
    </div>
  </div>
);
