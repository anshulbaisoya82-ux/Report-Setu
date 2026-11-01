import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Pill, Building2, AlertTriangle } from 'lucide-react';
import { medicationsApi } from '../../api';

export interface MedicineSuggestion {
  id: string;
  name: string;
  brandName: string;
  genericName?: string;
  composition?: string;
  strength?: string;
  dosageForm: string;
  manufacturer?: string;
  price?: number | null;
  packSize?: string | null;
  isDiscontinued: boolean;
  source: 'local_db' | 'drugdb' | 'eka_care';
}

interface MedicineAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (medicine: MedicineSuggestion) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MedicineAutocomplete: React.FC<MedicineAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'e.g. Metformin 500 mg, Dolo, Augmentin',
  autoFocus = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  // Debounced search effect
  useEffect(() => {
    const trimmed = (value || '').trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // Cancel in-flight requests if any
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }

    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const results = await medicationsApi.searchMedicines(trimmed, 8);
        setSuggestions(results || []);
        setIsOpen((results || []).length > 0);
        setHighlightedIndex(-1);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Medicine autocomplete search error:', err);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectMedicine(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelectMedicine = (medicine: MedicineSuggestion) => {
    onSelect(medicine);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Helper to highlight matching text in medicine name
  const renderHighlightedName = (name: string, query: string) => {
    if (!query || query.length < 2) return name;
    const parts = name.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="text-[#0E382F] bg-emerald-100/90 font-extrabold rounded-[2px] px-0.5">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          required
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className={`w-full h-10 px-3 pr-8 border border-stone-200 rounded-[4px] text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0E382F] focus:ring-1 focus:ring-[#0E382F] bg-white transition-all ${className}`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16A36A]" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-[6px] shadow-xl max-h-72 overflow-y-auto divide-y divide-stone-100 text-xs animate-in fade-in zoom-in-95 duration-100">
          {suggestions.length === 0 ? (
            <div className="p-3 text-center text-slate-400 font-medium">
              No matching medicines found
            </div>
          ) : (
            suggestions.map((med, index) => {
              const isHighlighted = highlightedIndex === index;
              return (
                <div
                  key={med.id || index}
                  onClick={() => handleSelectMedicine(med)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`p-2.5 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    isHighlighted ? 'bg-[#EAF6F0]/80' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {/* Brand / Medicine Name */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 leading-tight">
                        {renderHighlightedName(med.name, value)}
                      </span>

                      {/* Dosage Form Badge */}
                      <span className="px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-slate-600 font-medium text-[10px]">
                        {med.dosageForm || 'Tablet'}
                      </span>

                      {/* Strength Badge */}
                      {med.strength && (
                        <span className="px-1.5 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 font-medium text-[10px] border border-emerald-100">
                          {med.strength}
                        </span>
                      )}

                      {/* Discontinued warning tag */}
                      {med.isDiscontinued && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] bg-rose-50 text-rose-700 font-bold text-[9.5px] border border-rose-200">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          <span>Discontinued</span>
                        </span>
                      )}
                    </div>

                    {/* Generic / Composition */}
                    {(med.genericName || med.composition) && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 font-medium">
                        {med.composition || med.genericName}
                      </p>
                    )}

                    {/* Manufacturer */}
                    {med.manufacturer && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{med.manufacturer}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Select Action Icon */}
                  <div className="shrink-0 pt-0.5 text-slate-400">
                    <span className="text-[10px] text-slate-400 font-semibold bg-stone-100 px-1.5 py-0.5 rounded-[3px]">
                      Select
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

