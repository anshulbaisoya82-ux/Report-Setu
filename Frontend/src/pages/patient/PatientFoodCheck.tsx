import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CircleCheck, AlertTriangle, AlertOctagon, Info, Keyboard, Loader2, RotateCcw, Salad } from 'lucide-react';
import { PageHeader, Card, SectionTitle, EmptyState, btn } from '../../components/ui/kit';
import { notify } from '../../components/ui/Toast';
import { FoodRulesSummary } from '../../components/foodRules/FoodRulesEditor';
import { foodRulesApi } from '../../api/foodRules';
import { checkLabel, conditionFacts, hasAnyRule, type CheckResult, type ConditionFacts, type FoodRules } from '../../features/foodCheck/checkLabel';
import { isDemoMode } from '../../demo/flags';

const input =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900/15';

type Nutri = { sugars: string; salt: string; saturatedFat: string };
const EMPTY_NUTRI: Nutri = { sugars: '', salt: '', saturatedFat: '' };
const toNum = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) || Number(s) < 0 ? null : Number(s));

const VERDICT = {
  avoid: { icon: AlertOctagon, title: 'Contains something your doctor asked you to avoid', cls: 'border-red-200 bg-red-50 text-red-900' },
  check: { icon: AlertTriangle, title: 'Check with your doctor', cls: 'border-amber-200 bg-amber-50 text-amber-900' },
  ok: { icon: CircleCheck, title: 'Matches your doctor’s food rules', cls: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  no_rules: { icon: Info, title: 'Your doctor hasn’t set food rules yet', cls: 'border-stone-200 bg-stone-50 text-ink' },
} as const;

/**
 * Patient › Food check. Photo (or typed text) of a packet label → patient checks what was read →
 * compared with the food rules their doctor set. The app never decides from a disease on its own.
 */
export const PatientFoodCheck: React.FC = () => {
  const [rules, setRules] = useState<FoodRules | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [facts, setFacts] = useState<ConditionFacts[]>([]);
  const [progress, setProgress] = useState<{ stage: string; pct: number } | null>(null);
  const [readBy, setReadBy] = useState<string>('');
  const [rulesState, setRulesState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = useState<'start' | 'review' | 'result'>('start');
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState('');
  const [nutri, setNutri] = useState<Nutri>(EMPTY_NUTRI);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    foodRulesApi
      .getMine()
      .then((r) => {
        setRules(r.rules);
        setConditions(r.conditions);
        setRulesState('ready');
      })
      .catch(() => setRulesState('error'));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    setMode('start');
    setIngredients('');
    setNutri(EMPTY_NUTRI);
    setWarnings([]);
    setResult(null);
    setFromPhoto(false);
    setPreview(null);
    setFacts([]);
    setReadBy('');
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Please choose a photo (JPG or PNG).', 'error');
    if (file.size > 15 * 1024 * 1024) return notify('That photo is larger than 15 MB. Try a smaller one.', 'error');
    setPreview(URL.createObjectURL(file));
    setReading(true);
    setProgress({ stage: 'Reading the label', pct: 1 });
    const s = (n: number | null | undefined) => (n == null ? '' : String(n));
    try {
      // 1. Server reader (Gemini Vision) when it is set up; 2. otherwise read on this device.
      let done = false;
      if (!isDemoMode && file.size <= 10 * 1024 * 1024) {
        try {
          const r = await foodRulesApi.readLabel(file);
          setIngredients(r.ingredientsText);
          setNutri({ sugars: s(r.per100g.sugars), salt: s(r.per100g.salt), saturatedFat: s(r.per100g.saturatedFat) });
          setWarnings([...(r.warnings || []), ...(r.convertedFromServing ? ['Nutrition was printed per serving; we converted it to per 100 g using the serving size.'] : [])]);
          setReadBy('Read by the ReportSetu server');
          done = !!r.ingredientsText;
        } catch {
          done = false;
        }
      }
      if (!done) {
        const { readLabelOnDevice } = await import('../../features/foodCheck/deviceOcr');
        const r = await readLabelOnDevice(file, setProgress);
        setIngredients(r.ingredientsText);
        setNutri({ sugars: s(r.per100g.sugars), salt: s(r.per100g.salt), saturatedFat: s(r.per100g.saturatedFat) });
        setWarnings(r.warnings);
        setReadBy(`Read on this device · ${r.confidence}% confidence · ${r.variant}`);
      }
      setFromPhoto(true);
      setMode('review');
    } catch (err: any) {
      notify('Could not read this photo. You can type the ingredients instead.', 'error');
      console.warn('Label reading failed:', err?.message);
      setFromPhoto(false);
      setMode('review');
    } finally {
      setReading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const per100 = { sugars: toNum(nutri.sugars), salt: toNum(nutri.salt), saturatedFat: toNum(nutri.saturatedFat) };
    setResult(checkLabel(ingredients, per100, rules));
    setFacts(conditionFacts(ingredients, per100, conditions));
    setMode('result');
  };

  const firstName = rules?.updatedBy || 'your doctor';

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <PageHeader title="Food check" subtitle="Check a food packet’s label against the food rules your doctor set for you." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          {mode === 'start' && (
            <>
              <SectionTitle title="1. Add the label" subtitle="A clear photo of the ingredient list, and the nutrition table if there is one." />
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" id="food-photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label htmlFor="food-photo" className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-10 text-center hover:border-forest-800 ${reading ? 'pointer-events-none opacity-70' : ''}`}>
                  {reading ? <Loader2 className="h-7 w-7 animate-spin text-forest-800" /> : <Camera className="h-7 w-7 text-forest-800" />}
                  <span className="text-[15px] font-semibold text-ink">{reading ? 'Reading the label…' : 'Take or choose a photo'}</span>
                  <span className="text-sm text-stone-500">Read automatically. The photo is not saved.</span>
                </label>
                <button type="button" disabled={reading} onClick={() => { setFromPhoto(false); setMode('review'); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line px-4 py-10 text-center hover:bg-stone-50">
                  <Keyboard className="h-7 w-7 text-forest-800" />
                  <span className="text-[15px] font-semibold text-ink">Type the ingredients</span>
                  <span className="text-sm text-stone-500">Copy them from the packet</span>
                </button>
              </div>
              {reading && progress && (
                <div className="mt-4" role="status" aria-live="polite">
                  <div className="flex justify-between text-sm text-stone-600"><span>{progress.stage}…</span><span>{progress.pct}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-800 transition-all" style={{ width: `${progress.pct}%` }} /></div>
                </div>
              )}
              {preview && reading && <img src={preview} alt="Label photo being read" className="mt-4 max-h-56 rounded-xl object-contain" />}
              <p className="mt-4 text-sm text-stone-500">Tips: fill the frame with the ingredient list, hold the phone straight, and tilt the packet so the shine is not on the text. Dotted and shiny print is cleaned up automatically.</p>
            </>
          )}

          {mode === 'review' && (
            <form onSubmit={runCheck}>
              <SectionTitle title="2. Check what we read" subtitle={fromPhoto ? 'Read from your photo. Compare with the packet and fix anything that is wrong.' : 'Type the ingredient list as printed on the packet.'} />
              {readBy && <p className="-mt-2 mb-3 text-xs text-stone-500">{readBy}</p>}
              <div className={preview ? 'grid grid-cols-1 gap-4 sm:grid-cols-[160px_minmax(0,1fr)]' : ''}>
                {preview && <img src={preview} alt="Your label photo" className="max-h-60 w-full rounded-xl border border-line object-contain" />}
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-ink">Ingredients</span>
                    <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={6} maxLength={4000} placeholder="e.g. Wheat flour, sugar, edible vegetable oil (palm), milk solids, salt. May contain peanut." className={input} />
                  </label>
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold text-ink">Nutrition per 100 g <span className="font-normal text-stone-500">(optional, from the table)</span></legend>
                    <div className="grid grid-cols-3 gap-2">
                      {([['sugars', 'Sugar'], ['salt', 'Salt'], ['saturatedFat', 'Saturated fat']] as const).map(([k, label]) => (
                        <label key={k} className="block">
                          <span className="mb-1 block text-xs text-stone-500">{label} (g)</span>
                          <input type="number" inputMode="decimal" min={0} step="any" value={nutri[k]} onChange={(e) => setNutri((s) => ({ ...s, [k]: e.target.value }))} placeholder="—" className={input} />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {warnings.length > 0 && (
                    <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={reset} className={btn('secondary')}>Start again</button>
                <button type="submit" disabled={!ingredients.trim() && !nutri.sugars && !nutri.salt && !nutri.saturatedFat} className={btn('primary')}>Check this food</button>
              </div>
            </form>
          )}

          {mode === 'result' && result && (() => {
            const v = VERDICT[result.verdict];
            const Icon = v.icon;
            return (
              <div>
                <SectionTitle title="3. Result" />
                <div className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${v.cls}`} role="status">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0" />
                  <div>
                    <p className="text-[17px] font-semibold">{v.title}</p>
                    {result.verdict === 'ok' && <p className="mt-0.5 text-sm">Nothing on this label goes against the rules {firstName} set. This only covers those rules.</p>}
                    {result.verdict === 'check' && <p className="mt-0.5 text-sm">Some of the label could not be checked. Look at the packet or ask your doctor.</p>}
                    {result.verdict === 'no_rules' && <p className="mt-0.5 text-sm">We can’t say anything about this food until your doctor adds rules. You can ask them in Ask doctor.</p>}
                  </div>
                </div>

                {result.findings.length > 0 && (
                  <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                    {result.findings.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 px-4 py-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.severity === 'avoid' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium text-ink">{f.evidence}</span>
                          <span className="block text-sm text-stone-500">{f.rule}{f.trace ? ' · listed under “may contain”' : ''}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {result.cleared.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-sm font-semibold text-ink">Also checked</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {result.cleared.map((c) => <li key={c} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{c}</li>)}
                    </ul>
                  </div>
                )}

                {facts.length > 0 && (
                  <div className="mt-4 rounded-xl border border-line px-4 py-3">
                    <p className="text-sm font-semibold text-ink">From your health record</p>
                    <p className="mb-2 text-xs text-stone-500">Label facts to discuss with your doctor. These are not a judgement by the app.</p>
                    {facts.map((f) => (
                      <div key={f.condition} className="mt-2">
                        <p className="text-sm font-medium text-ink">{f.condition}</p>
                        <ul className="mt-1 space-y-0.5 text-sm text-stone-600">
                          {f.facts.map((x) => <li key={x}>• {x}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {rules?.note && <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm text-ink"><span className="font-semibold">{firstName}:</span> {rules.note}</p>}

                <p className="mt-4 text-xs text-stone-500">
                  {fromPhoto ? 'Read from your photo, then checked against your doctor’s rules. Always compare with the packet. ' : 'Checked against your doctor’s rules. '}
                  This is not medical advice. Emergency or allergic reaction: call 108.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Link to="/patient/ask-doctor" className={btn('secondary')}>Ask your doctor</Link>
                  <button type="button" onClick={() => setMode('review')} className={btn('secondary')}>Edit text</button>
                  <button type="button" onClick={reset} className={btn('primary')}><RotateCcw className="h-4 w-4" /> Check another food</button>
                </div>
              </div>
            );
          })()}
        </Card>

        <Card className="p-5 lg:col-span-5">
          {conditions.length > 0 && (
            <div className="mb-5 border-b border-line pb-4">
              <p className="text-sm text-stone-500">Your health record</p>
              <p className="mt-1 text-[15px] font-medium text-ink">{conditions.join(', ')}</p>
            </div>
          )}
          <SectionTitle title="Your doctor’s food rules" />
          {rulesState === 'loading' && <div className="h-24 animate-pulse rounded-xl bg-stone-100" aria-label="Loading" />}
          {rulesState === 'error' && <p className="text-sm text-stone-500">Could not load your food rules. Please refresh.</p>}
          {rulesState === 'ready' && (hasAnyRule(rules) ? (
            <FoodRulesSummary rules={rules!} />
          ) : (
            <EmptyState
              icon={Salad}
              title="No food rules yet"
              body="Your doctor hasn’t set food rules for you. Until they do, the check can’t give a result."
              action={<Link to="/patient/ask-doctor" className={btn('secondary', 'sm')}>Ask your doctor</Link>}
            />
          ))}
        </Card>
      </div>
    </div>
  );
};
