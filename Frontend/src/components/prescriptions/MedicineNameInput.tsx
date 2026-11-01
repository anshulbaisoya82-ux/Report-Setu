import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { searchMedicines, type MedicineOption, type SuggestionSource } from '../../api/medicineSearch';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  ariaLabel: string;
  invalid?: boolean;
}

/** Bold the typed words inside a suggestion so the doctor sees why it matched. */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const words = query.trim().split(/\s+/).filter((w) => w.length > 0).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.join('|')})`, 'ig');
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? <mark key={i} className="rounded-sm bg-amber-100 px-0 text-inherit">{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};

/**
 * Free-text medicine field. After 2+ letters a list of matching medicines opens underneath:
 * brand names first, then products that contain the typed ingredient, 30 at a time with
 * "Show more". Each row shows composition, pack and maker. Picking is optional; any name can be typed.
 */
export const MedicineNameInput = forwardRef<HTMLInputElement, Props>(({ id, value, onChange, className, ariaLabel, invalid }, ref) => {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [items, setItems] = useState<MedicineOption[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [source, setSource] = useState<SuggestionSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<MedicineOption | null>(null);
  const typed = useRef(false); // only search after the user types, not after picking
  const query = value.trim();

  useEffect(() => {
    if (!typed.current) return;
    if (query.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      const res = await searchMedicines(query, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setItems(res.items);
      setTotal(res.total);
      setHasMore(res.hasMore);
      setSource(res.source);
      setActive(-1);
      setLoading(false);
      setOpen(true);
      listRef.current?.scrollTo({ top: 0 });
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await searchMedicines(query, { offset: items.length });
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.name.toLowerCase()));
      return [...prev, ...res.items.filter((r) => !seen.has(r.name.toLowerCase()))];
    });
    setHasMore(res.hasMore && res.items.length > 0);
    setLoadingMore(false);
  };

  const pick = (opt: MedicineOption) => {
    typed.current = false;
    setPicked(opt);
    onChange(opt.name);
    setOpen(false);
  };

  const scrollIntoView = (i: number) => document.getElementById(`${listId}-${i}`)?.scrollIntoView({ block: 'nearest' });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = Math.min(active + 1, items.length - 1);
      setActive(n);
      scrollIntoView(n);
      if (n >= items.length - 3) loadMore();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = Math.max(active - 1, 0);
      setActive(n);
      scrollIntoView(n);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const onScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 80) loadMore();
  };

  const firstIngredientMatch = items.findIndex((it) => it.match === 'composition');
  const showPickedInfo = picked && picked.name === value && (picked.composition || picked.pack);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => {
            typed.current = true;
            setPicked(null);
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && typed.current && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Type a brand or ingredient, e.g. Dolo 650 or paracetamol"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          className={`${className} pr-9`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </span>
      </div>

      {showPickedInfo && (
        <p className="mt-1 truncate text-xs text-stone-500" title={[picked!.composition, picked!.pack].filter(Boolean).join(' · ')}>
          {picked!.composition && <>Contains {picked!.composition}</>}
          {picked!.composition && picked!.pack && ' · '}
          {picked!.pack}
        </p>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(600px,calc(100vw-56px))] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-stone-50 px-3 py-2 text-xs text-stone-500">
            <span aria-live="polite">
              {items.length === 0
                ? `No matches for “${query}”. You can still type the name.`
                : total > items.length
                  ? `Showing ${items.length} of ${total.toLocaleString('en-IN')} matches`
                  : `${total.toLocaleString('en-IN')} match${total === 1 ? '' : 'es'}`}
            </span>
            <span className="hidden sm:inline">↑ ↓ to move · Enter to pick</span>
          </div>

          {items.length > 0 && (
            <ul id={listId} ref={listRef} role="listbox" onScroll={onScroll} className="max-h-[360px] overflow-y-auto py-1">
              {items.map((it, i) => (
                <React.Fragment key={`${it.name}-${i}`}>
                  {i === 0 && it.match === 'name' && firstIngredientMatch !== 0 && (
                    <li role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Brand names</li>
                  )}
                  {i === firstIngredientMatch && (
                    <li role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Contains “{query}”</li>
                  )}
                  <li
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(it);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-forest-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-sm font-medium ${it.discontinued ? 'text-stone-500' : 'text-ink'}`}>
                        <Highlight text={it.name} query={query} />
                      </span>
                      {it.discontinued && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">Discontinued</span>}
                    </div>
                    {(it.composition || it.pack || it.manufacturer) && (
                      <div className="mt-0.5 text-xs leading-snug text-stone-500">
                        {it.composition && (
                          <span className="text-stone-600">
                            <Highlight text={it.composition} query={query} />
                          </span>
                        )}
                        {[it.pack, it.manufacturer].filter(Boolean).map((x) => (
                          <span key={x}> · {x}</span>
                        ))}
                      </div>
                    )}
                  </li>
                </React.Fragment>
              ))}
              {hasMore && (
                <li role="presentation" className="px-3 py-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={loadMore}
                    className="w-full rounded-lg border border-line py-2 text-sm font-medium text-forest-800 hover:bg-stone-50"
                  >
                    {loadingMore ? 'Loading…' : `Show more (${(total - items.length).toLocaleString('en-IN')} left)`}
                  </button>
                </li>
              )}
            </ul>
          )}

          <p className="border-t border-line px-3 py-1.5 text-[11px] text-stone-400">
            {source ? `From ${source}. ` : ''}Check the name before prescribing. You can type any name.
          </p>
        </div>
      )}
    </div>
  );
});
MedicineNameInput.displayName = 'MedicineNameInput';
