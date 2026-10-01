import React, { useState, useEffect, useRef } from 'react';
import { sqliteService } from '../db/sqlite';
import { Customer, Appliance } from '../types';
import { formatKES } from '../utils/numbering';
import { 
  Search, 
  X, 
  Tv, 
  User, 
  ArrowRight, 
  Command, 
  FileText, 
  Tag, 
  Hash, 
  CornerDownLeft,
  Clock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface GlobalSearchProps {
  onSelectAppliance: (applianceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onSearchInTab: (tab: string, query: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onSelectAppliance,
  onSelectCustomer,
  onSearchInTab
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const appliances = sqliteService.getAppliances();
  const customers = sqliteService.getCustomers();

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut: Cmd+K or Ctrl+K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const cleanQuery = query.trim().toLowerCase();

  // Search Customers by name, national ID, phone, address
  const matchedCustomers = cleanQuery
    ? customers.filter((c) => {
        return (
          c.name.toLowerCase().includes(cleanQuery) ||
          c.id_number.toLowerCase().includes(cleanQuery) ||
          c.phone.toLowerCase().includes(cleanQuery) ||
          (c.address && c.address.toLowerCase().includes(cleanQuery))
        );
      }).slice(0, 5)
    : [];

  // Search Appliances by appliance number (Tag), serial number, brand, model, category, or customer owner name
  const matchedAppliances = cleanQuery
    ? appliances.filter((a) => {
        const cust = customers.find((c) => c.id === a.customer_id);
        const tagMatch = a.appliance_number.toLowerCase().includes(cleanQuery);
        const serialMatch = a.serial_number && a.serial_number.toLowerCase().includes(cleanQuery);
        const brandMatch = a.brand.toLowerCase().includes(cleanQuery);
        const modelMatch = a.model.toLowerCase().includes(cleanQuery);
        const catMatch = a.category.toLowerCase().includes(cleanQuery);
        const custNameMatch = cust && cust.name.toLowerCase().includes(cleanQuery);
        const custIdMatch = cust && cust.id_number.toLowerCase().includes(cleanQuery);

        return tagMatch || serialMatch || brandMatch || modelMatch || catMatch || custNameMatch || custIdMatch;
      }).slice(0, 6)
    : [];

  const totalMatches = matchedCustomers.length + matchedAppliances.length;

  const handleSelectCustomerItem = (customerId: string) => {
    onSelectCustomer(customerId);
    setIsOpen(false);
  };

  const handleSelectApplianceItem = (applianceId: string) => {
    onSelectAppliance(applianceId);
    setIsOpen(false);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (cleanQuery) {
        if (matchedAppliances.length > 0) {
          onSearchInTab('appliances', query);
          setIsOpen(false);
        } else if (matchedCustomers.length > 0) {
          onSearchInTab('customers', query);
          setIsOpen(false);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
      {/* Search Input Bar with Glassmorphism */}
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDownInput}
          placeholder="Search name, ID, or serial number..."
          className="w-full pl-9 pr-16 py-1.5 bg-black/60 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#0ABAB5] focus:ring-1 focus:ring-[#0ABAB5] transition-all font-sans"
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-lg">
              <span>⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Dropdown with Glassmorphism */}
      {isOpen && cleanQuery && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-panel border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-white/10">
          {/* Header Bar */}
          <div className="px-3.5 py-2 bg-black/70 flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10">
            <span>
              Search results for <span className="text-[#0ABAB5] font-bold font-mono">"{query}"</span>
            </span>
            <span className="font-mono text-slate-400">{totalMatches} found</span>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {/* Customers Section */}
            {matchedCustomers.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[#0ABAB5]" />
                  <span>Verified Customers</span>
                </div>

                {matchedCustomers.map((cust) => {
                  const custApps = appliances.filter((a) => a.customer_id === cust.id);
                  const isIdMatch = cust.id_number.toLowerCase().includes(cleanQuery);

                  return (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => handleSelectCustomerItem(cust.id)}
                      className="w-full text-left p-2 rounded-xl hover:bg-white/[0.06] transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {cust.photo_url ? (
                          <img
                            src={cust.photo_url}
                            alt={cust.name}
                            className="w-8 h-8 rounded-lg object-cover border border-[#0ABAB5]/40 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-[#0ABAB5] font-bold text-xs shrink-0">
                            {cust.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white group-hover:text-[#0ABAB5] transition-colors truncate">
                            {cust.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className={isIdMatch ? 'text-[#0ABAB5] font-mono font-bold' : 'font-mono'}>
                              ID: {cust.id_number}
                            </span>
                            <span>·</span>
                            <span className="font-mono text-slate-400">{cust.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {custApps.length} item{custApps.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Appliances Section */}
            {matchedAppliances.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tv className="w-3 h-3 text-[#0ABAB5]" />
                  <span>Appliances & Collateral</span>
                </div>

                {matchedAppliances.map((app) => {
                  const cust = customers.find((c) => c.id === app.customer_id);
                  const isTagMatch = app.appliance_number.toLowerCase().includes(cleanQuery);
                  const isSerialMatch = app.serial_number && app.serial_number.toLowerCase().includes(cleanQuery);

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectApplianceItem(app.id)}
                      className="w-full text-left p-2 rounded-xl hover:bg-white/[0.06] transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${isTagMatch ? 'text-[#0ABAB5]' : 'text-slate-300'}`}>
                            {app.appliance_number}
                          </span>
                          <span className="text-xs text-white font-medium truncate">
                            {app.category} · {app.brand} {app.model}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {app.serial_number && (
                            <span className={isSerialMatch ? 'text-[#0ABAB5] font-mono font-bold' : 'font-mono'}>
                              SN: {app.serial_number}
                            </span>
                          )}
                          <span>·</span>
                          <span>Owner: {cust?.name || 'Unknown'}</span>
                          <span>·</span>
                          <span className="text-slate-300">Funded by: <strong className="text-white">{app.funder}</strong></span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono-numbers font-bold text-white block">
                          {formatKES(app.amount_received)}
                        </span>
                        <span className="text-[9px] text-[#0ABAB5] font-medium">
                          Due {app.due_date}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {totalMatches === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching customers or appliances found for "{query}".
              </div>
            )}
          </div>

          {/* Quick tab action footer */}
          <div className="p-2.5 bg-black/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3 text-[#0ABAB5]" />
              <span>Press <strong className="text-white">Enter</strong> to filter tab</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSearchInTab('appliances', query);
                  setIsOpen(false);
                }}
                className="hover:text-[#0ABAB5] transition-colors cursor-pointer"
              >
                In Appliances →
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  onSearchInTab('customers', query);
                  setIsOpen(false);
                }}
                className="hover:text-[#0ABAB5] transition-colors cursor-pointer"
              >
                In Customers →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
