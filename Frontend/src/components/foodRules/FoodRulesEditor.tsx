import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Salad, X } from 'lucide-react';
import { Card, SectionTitle, EmptyState, Tag, btn } from '../ui/kit';
import { notify } from '../ui/Toast';
import { foodRulesApi, type FoodRulesInput } from '../../api/foodRules';
import { ALLERGEN_GROUPS, AVOID_GROUPS, hasAnyRule, type FoodRules } from '../../features/foodCheck/checkLabel';

const input =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900/15';

const LIMITS: { key: keyof FoodRules['limits']; label: string }[] = [
  { key: 'sugar', label: 'Sugar' },
  { key: 'salt', label: 'Salt' },
  { key: 'saturatedFat', label: 'Saturated fat' },
];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

/** Short, readable summary of a rule set (used by doctor and patient screens). */
export const FoodRulesSummary: React.FC<{ rules: FoodRules }> = ({ rules }) => {
  const limits = LIMITS.filter((l) => rules.limits[l.key] != null);
  return (
    <dl className="space-y-3 text-sm">
      {limits.length > 0 && (
        <div>
          <dt className="text-stone-500">Limits (per 100 g)</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {limits.map((l) => <Tag key={l.key} tone="info">{l.label} up to {fmt(rules.limits[l.key]!)} g</Tag>)}
          </dd>
        </div>
      )}
      {rules.allergies.length > 0 && (
        <div>
          <dt className="text-stone-500">Allergies</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">{rules.allergies.map((a) => <Tag key={a} tone="critical">{a}</Tag>)}</dd>
        </div>
      )}
      {rules.avoid.length > 0 && (
        <div>
          <dt className="text-stone-500">Avoid</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">{rules.avoid.map((a) => <Tag key={a} tone="attention">{a}</Tag>)}</dd>
        </div>
      )}
      {rules.note && (
        <div>
          <dt className="text-stone-500">Note</dt>
          <dd className="mt-1 text-ink">{rules.note}</dd>
        </div>
      )}
      {rules.updatedBy && (
        <p className="text-xs text-stone-500">
          Set by {rules.updatedBy}
          {rules.updatedAt ? ` · ${new Date(rules.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </p>
      )}
    </dl>
  );
};

/** Chip list with quick-add suggestions and free typing. */
const ChipField: React.FC<{ id: string; label: string; hint: string; values: string[]; onChange: (v: string[]) => void; options: string[] }> = ({ id, label, hint, values, onChange, options }) => {
  const [text, setText] = useState('');
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (v: string) => {
    const t = v.trim();
    if (t.length < 2 || has(t)) return;
    onChange([...values, t]);
    setText('');
  };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      <p className="mb-2 text-sm text-stone-500">{hint}</p>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-lg bg-forest-50 py-1 pl-2.5 pr-1 text-sm text-forest-900">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="rounded p-0.5 hover:bg-forest-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="Type another item and press Enter"
          maxLength={40}
          className={input}
        />
        <button type="button" onClick={() => add(text)} className={btn('secondary', 'sm')}>Add</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.filter((o) => !has(o)).map((o) => (
          <button key={o} type="button" onClick={() => add(o)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-forest-800 hover:text-forest-900">
            <Plus className="h-3 w-3" /> {o}
          </button>
        ))}
      </div>
    </div>
  );
};

const FoodRulesDialog: React.FC<{ patient: { id: string; name: string; conditions?: string[] }; initial: FoodRules | null; onClose: () => void; onSaved: (r: FoodRules) => void }> = ({ patient, initial, onClose, onSaved }) => {
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(LIMITS.map((l) => [l.key, initial?.limits[l.key] != null ? String(initial.limits[l.key]) : '']))
  );
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies || []);
  const [avoid, setAvoid] = useState<string[]>(initial?.avoid || []);
  const [note, setNote] = useState(initial?.note || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving]);

  const badLimit = LIMITS.find((l) => limits[l.key] !== '' && !(Number(limits[l.key]) >= 0 && Number(limits[l.key]) <= 100));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (badLimit) return;
    const body: FoodRulesInput = {
      limits: {
        sugar: limits.sugar === '' ? null : Number(limits.sugar),
        salt: limits.salt === '' ? null : Number(limits.salt),
        saturatedFat: limits.saturatedFat === '' ? null : Number(limits.saturatedFat),
      },
      allergies,
      avoid,
      note: note.trim(),
    };
    setSaving(true);
    try {
      const saved = await foodRulesApi.setForPatient(patient.id, body);
      notify(`Food rules saved for ${patient.name}`, 'success');
      onSaved(saved);
    } catch (err: any) {
      notify(err?.message || 'Could not save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form onSubmit={save} noValidate role="dialog" aria-modal="true" aria-labelledby="fr-title" className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-modal sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div>
            <h2 id="fr-title" className="text-lg font-semibold text-ink">Food rules</h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {patient.name}
              {patient.conditions?.length ? ` · conditions on file: ${patient.conditions.join(', ')}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
            When {patient.name.split(' ')[0]} scans a food label, the app checks it only against these rules and shows the exact words or numbers it found. It never decides from the diagnosis by itself.
          </p>

          <section>
            <h3 className="text-sm font-semibold text-ink">Limits per 100 g</h3>
            <p className="mb-3 text-sm text-stone-500">Leave empty for no limit. Compared with the nutrition table on the packet.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {LIMITS.map((l) => (
                <label key={l.key} className="block">
                  <span className="mb-1 block text-sm text-stone-600">{l.label}</span>
                  <span className="relative block">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="any"
                      value={limits[l.key]}
                      onChange={(e) => setLimits((s) => ({ ...s, [l.key]: e.target.value }))}
                      placeholder="No limit"
                      aria-invalid={badLimit?.key === l.key || undefined}
                      className={`${input} pr-24 ${badLimit?.key === l.key ? 'border-red-400' : ''}`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">g / 100 g</span>
                  </span>
                </label>
              ))}
            </div>
            {badLimit && <p className="mt-2 text-sm text-red-700">{badLimit.label}: enter a number from 0 to 100, or leave it empty.</p>}
          </section>

          <ChipField
            id="fr-allergies"
            label="Allergies"
            hint="Any matching ingredient, or a “may contain” line, is flagged. Common Indian names are included (e.g. groundnut, ghee, maida)."
            values={allergies}
            onChange={setAllergies}
            options={Object.values(ALLERGEN_GROUPS).map((g) => g.label)}
          />

          <ChipField
            id="fr-avoid"
            label="Ingredients to avoid"
            hint="Flagged when they appear in the ingredient list."
            values={avoid}
            onChange={setAvoid}
            options={Object.values(AVOID_GROUPS).map((g) => g.label)}
          />

          <label className="block">
            <span className="text-sm font-semibold text-ink">Note for the patient (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Shown with every check, e.g. “Small portions are fine on weekends.”" className={`${input} mt-2`} />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-7">
          <button type="button" onClick={onClose} disabled={saving} className={btn('secondary')}>Cancel</button>
          <button type="submit" disabled={saving || !!badLimit} className={btn('primary')}>{saving ? 'Saving…' : 'Save rules'}</button>
        </div>
      </form>
    </div>
  );
};

/** Doctor-side card: shows and edits one patient's food rules. */
export const FoodRulesCard: React.FC<{ patient: { id: string; name: string; conditions?: string[] }; className?: string }> = ({ patient, className = '' }) => {
  const [rules, setRules] = useState<FoodRules | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setState('loading');
    foodRulesApi
      .getForPatient(patient.id)
      .then((r) => {
        setRules(r.rules);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [patient.id]);

  return (
    <Card className={`p-5 ${className}`}>
      <SectionTitle
        title="Food rules"
        subtitle="Used when the patient scans a food label"
        action={state === 'ready' && hasAnyRule(rules) ? (
          <button type="button" onClick={() => setEditing(true)} className={btn('secondary', 'sm')}><Pencil className="h-4 w-4" /> Edit</button>
        ) : undefined}
      />
      {state === 'loading' && <div className="h-20 animate-pulse rounded-xl bg-stone-100" aria-label="Loading" />}
      {state === 'error' && <p className="text-sm text-stone-500">Could not load food rules. Please refresh.</p>}
      {state === 'ready' && (hasAnyRule(rules) ? (
        <FoodRulesSummary rules={rules!} />
      ) : (
        <EmptyState
          icon={Salad}
          title="No food rules yet"
          body={`Add limits, allergies or ingredients to avoid. ${patient.name.split(' ')[0]} can then check packaged food against them.`}
          action={<button type="button" onClick={() => setEditing(true)} className={btn('primary', 'sm')}><Plus className="h-4 w-4" /> Set food rules</button>}
        />
      ))}
      {editing && (
        <FoodRulesDialog
          patient={patient}
          initial={rules}
          onClose={() => setEditing(false)}
          onSaved={(r) => {
            setRules(r);
            setEditing(false);
          }}
        />
      )}
    </Card>
  );
};
