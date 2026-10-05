import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Package, 
  X, 
  Tag, 
  SlidersHorizontal 
} from 'lucide-react';
import { CollateralItem } from '../../types';
import { sqliteService } from '../../db/sqlite';
import { formatKES } from '../../utils/numbering';
import { MobileFilterSheet, MobileFilterOptions } from './MobileFilterSheet';
import { useTheme } from '../../context/ThemeContext';

interface MobileInventoryViewProps {
  onSelectProduct: (product: CollateralItem) => void;
  onOpenAddItem: () => void;
}

export const MobileInventoryView: React.FC<MobileInventoryViewProps> = ({
  onSelectProduct,
  onOpenAddItem
}) => {
  const { currentAccent } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [filters, setFilters] = useState<MobileFilterOptions>({
    category: 'ALL',
    condition: 'All',
    status: 'All',
    sortBy: 'date_desc'
  });

  const allItems = sqliteService.getCollaterals();

  // Search & Filtered items
  const filteredProducts = useMemo(() => {
    return allItems
      .filter((item) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            item.item_name.toLowerCase().includes(q) ||
            item.collateral_number.toLowerCase().includes(q) ||
            (item.brand && item.brand.toLowerCase().includes(q)) ||
            (item.model && item.model.toLowerCase().includes(q)) ||
            (item.category && item.category.toLowerCase().includes(q));
          if (!matches) return false;
        }

        // Category filter
        if (filters.category !== 'ALL' && item.category !== filters.category) {
          return false;
        }

        // Condition filter
        if (filters.condition !== 'All') {
          if (
            !item.condition ||
            !item.condition.toLowerCase().includes(filters.condition.toLowerCase())
          ) {
            return false;
          }
        }

        // Status filter
        if (filters.status !== 'All') {
          if (item.status !== filters.status) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.estimated_resale_value) || Number(a.market_value) || 0;
        const priceB = Number(b.estimated_resale_value) || Number(b.market_value) || 0;

        if (filters.sortBy === 'price_asc') return priceA - priceB;
        if (filters.sortBy === 'price_desc') return priceB - priceA;
        if (filters.sortBy === 'name_asc') return a.item_name.localeCompare(b.item_name);
        if (filters.sortBy === 'date_asc') return (a.created_at || '').localeCompare(b.created_at || '');
        // default: date_desc
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [allItems, searchQuery, filters]);

  const activeFiltersCount = 
    (filters.category !== 'ALL' ? 1 : 0) +
    (filters.condition !== 'All' ? 1 : 0) +
    (filters.status !== 'All' ? 1 : 0) +
    (filters.sortBy !== 'date_desc' ? 1 : 0);

  return (
    <div className="space-y-5 pb-28 pt-2">
      {/* 1. Header with Page Title & Add Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Inventory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredProducts.length} items in catalogue
          </p>
        </div>

        <button
          onClick={onOpenAddItem}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-xs shadow-md shadow-[#0ABAB5]/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* 2. Prominent Search Field */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products, brands, model, tag..."
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0ABAB5] shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Filter & Sort Buttons Row */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border text-xs font-bold transition-all ${
            activeFiltersCount > 0
              ? 'bg-[#0ABAB5]/15 border-[#0ABAB5] text-[#0ABAB5]'
              : 'bg-white/60 dark:bg-slate-900/70 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white/90'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black text-[10px] font-black flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border bg-white/60 dark:bg-slate-900/70 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-white/90 transition-all"
        >
          <ArrowUpDown className="w-4 h-4" />
          <span className="truncate">
            {filters.sortBy === 'price_asc'
              ? 'Price: Low'
              : filters.sortBy === 'price_desc'
              ? 'Price: High'
              : filters.sortBy === 'name_asc'
              ? 'Name A-Z'
              : 'Sort'}
          </span>
        </button>
      </div>

      {/* 4. Product Cards List (Spacious, Minimal, Clear) */}
      {filteredProducts.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white/40 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-center space-y-3">
          <Package className="w-12 h-12 text-slate-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">No products found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Try adjusting your search query or reset active filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({ category: 'ALL', condition: 'All', status: 'All', sortBy: 'date_desc' });
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredProducts.map((product) => {
            const price = Number(product.estimated_resale_value) || Number(product.market_value) || 0;
            const isAvailable = product.status === 'Available for Sale';

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 hover:border-[#0ABAB5]/50 flex items-center gap-4 transition-all cursor-pointer shadow-sm active:scale-[0.99] backdrop-blur-md"
              >
                {/* Product Image Thumbnail */}
                <div className="w-20 h-20 rounded-xl bg-slate-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {product.photo_front ? (
                    <img
                      src={product.photo_front}
                      alt={product.item_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-[#0ABAB5] stroke-1" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#0ABAB5] uppercase tracking-wider truncate">
                      {product.category} · {product.condition}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        isAvailable
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : product.status === 'Sold'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {product.status === 'Available for Sale' ? 'Available' : product.status}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                    {product.item_name}
                  </h3>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {formatKES(price)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {product.collateral_number}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        filters={filters}
        onApplyFilters={(f) => setFilters(f)}
        onResetFilters={() =>
          setFilters({ category: 'ALL', condition: 'All', status: 'All', sortBy: 'date_desc' })
        }
      />
    </div>
  );
};
