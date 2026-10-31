import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { searchMedicines, medicineSearchSource } from '../../api/medicineSearch';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  ariaLabel: string;
  invalid?: boolean;
}

/**
 * Plain text field: the doctor types the name freely. After 2+ letters a short list of
 * suggestions appears underneath; picking one is optional.
 */
export const MedicineNameInput = forwardRef<HTMLInputElement, Props>(({ id, value, onChange, className, ariaLabel, invalid }, ref) => {
  const listId = useId();
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false); // only suggest after the user types, not after picking

  useEffect(() => {
    if (!typed.current) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      const res = await searchMedicines(value, ctrl.signal);
      const filtered = res.filter((r) => r.toLowerCase() !== value.trim().toLowerCase());
      setItems(filtered);
      setActive(-1);
      setOpen(filtered.length > 0);
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [value]);

  const pick = (v: string) => {
    typed.current = false;
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Type a medicine, e.g. Metformin 500 mg"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        className={className}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {items.map((it, i) => (
              <li
                key={it}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-forest-50 text-forest-900' : 'text-ink'}`}
              >
                {it}
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-xs text-stone-400">Suggestions from {medicineSearchSource} · you can type any name</p>
        </div>
      )}
    </div>
  );
});
MedicineNameInput.displayName = 'MedicineNameInput';
