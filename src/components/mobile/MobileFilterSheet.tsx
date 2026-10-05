import React, { useState } from 'react';
import { X, Check, RotateCcw, Filter, SlidersHorizontal } from 'lucide-react';
import { COLLATERAL_CATEGORIES, CollateralCategory } from '../../types';

export interface MobileFilterOptions {
  category: string;
  condition: string;
  status: string;
  sortBy: 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc' | 'name_asc';
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MobileFilterOptions;
  onApplyFilters: (filters: MobileFilterOptions) => void;
  onResetFilters: () => void;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters
}) => {
  const [draft, setDraft] = useState<MobileFilterOptions>({ ...filters });

  React.useEffect(() => {
    setDraft({ ...filters });
  }, [filters, isOpen]);

  if (!isOpen) return null;

  const conditions = ['All', 'Brand New', 'Like New', 'Good Condition', 'Fair Condition', 'Refurbished'];
  const statuses = ['All', 'Available for Sale', 'Held (Active Loan)', 'Sold', 'In Repair'];
  const sortOptions = [
    { id: 'date_desc', label: 'Newest Added' },
    { id: 'date_asc', label: 'Oldest Added' },
    { id: 'price_asc', label: 'Price: Low to High' },
    { id: 'price_desc', label: 'Price: High to Low' },
    { id: 'name_asc', label: 'Product Name (A-Z)' }
  ];

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  const handleReset = () => {
    onResetFilters();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-h-[85vh] bg-slate-900/95 border-t border-white/15 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#0ABAB5]" />
            <h3 className="text-base font-extrabold text-white">Filters & Sorting</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Sort By */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              {sortOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDraft((p) => ({ ...p, sortBy: opt.id as any }))}
                  className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                    draft.sortBy === opt.id
                      ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-bold shadow-md shadow-[#0ABAB5]/20'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDraft((p) => ({ ...p, category: 'ALL' }))}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  draft.category === 'ALL'
                    ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-bold shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                All Categories
              </button>
              {COLLATERAL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDraft((p) => ({ ...p, category: cat }))}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    draft.category === cat
                      ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-bold shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Condition
            </label>
            <div className="flex flex-wrap gap-2">
              {conditions.map((cond) => (
                <button
                  key={cond}
                  onClick={() => setDraft((p) => ({ ...p, condition: cond }))}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    draft.condition === cond
                      ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-bold shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Availability Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((st) => (
                <button
                  key={st}
                  onClick={() => setDraft((p) => ({ ...p, status: st }))}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    draft.status === st
                      ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-bold shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer sticky buttons */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-3.5 px-4 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] py-3.5 px-4 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/25"
          >
            <Check className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
};
