import React from 'react';
import { useTheme, ACCENT_COLORS, AccentColor, ThemeMode } from '../context/ThemeContext';
import { 
  Palette, 
  Sun, 
  Moon, 
  Check, 
  X, 
  Monitor, 
  Sparkles, 
  RotateCcw, 
  ShieldCheck,
  Eye,
  CheckCircle2
} from 'lucide-react';

export const ThemeSettingsPanel: React.FC = () => {
  const { 
    themeMode, 
    setThemeMode, 
    accent, 
    setAccent, 
    currentAccent, 
    isThemePanelOpen, 
    closeThemePanel 
  } = useTheme();

  if (!isThemePanelOpen) return null;

  const handleResetDefaults = () => {
    setThemeMode('dark');
    setAccent('tiffany');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
      <div className="w-full max-w-lg glass-panel border border-white/20 rounded-3xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Panel Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ backgroundColor: currentAccent.badgeBg, border: `1px solid ${currentAccent.badgeBorder}`, color: currentAccent.primary }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Display & Theme Settings
              </h2>
              <p className="text-xs text-slate-400">
                Daytime readability & counter color preferences (Saved to LocalStorage)
              </p>
            </div>
          </div>

          <button
            onClick={closeThemePanel}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
          {/* SECTION 1: DISPLAY MODE (TIFFANY DARK vs PROFESSIONAL LIGHT) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-slate-400" />
                <span>Shop Operating Mode</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                Current: <strong className="text-white capitalize">{themeMode === 'dark' ? 'Tiffany Dark' : 'Professional Light'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tiffany Dark Option */}
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative group ${
                  themeMode === 'dark'
                    ? 'bg-black/90 border-[#0ABAB5] shadow-lg shadow-[#0ABAB5]/20 ring-1 ring-[#0ABAB5]'
                    : 'bg-black/40 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-[#0ABAB5]">
                    <Moon className="w-4 h-4" />
                  </div>
                  {themeMode === 'dark' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 px-2 py-0.5 rounded-full border border-[#0ABAB5]/30">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <span className="font-black text-sm text-white block">Tiffany Dark</span>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Deep obsidian black & frosted glass. Ideal for evening counter shifts and reduced glare.
                </p>
              </button>

              {/* Professional Light Option */}
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative group ${
                  themeMode === 'light'
                    ? 'bg-slate-100 border-[#0ABAB5] shadow-lg shadow-black/10 ring-2 ring-[#0ABAB5] text-slate-900'
                    : 'bg-white/10 border-white/15 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                    <Sun className="w-4 h-4" />
                  </div>
                  {themeMode === 'light' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <span className={`font-black text-sm block ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Professional Light
                </span>
                <p className={`text-[11px] mt-1 leading-snug ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  High-contrast bright mode. Optimized for direct daytime shop sunlight & serial readability.
                </p>
              </button>
            </div>
          </div>

          {/* SECTION 2: ACCENT COLOUR SETTING PANEL */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-slate-400" />
                <span>Theme Accent Color</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                Active: <strong style={{ color: currentAccent.primary }}>{currentAccent.name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((key) => {
                const conf = ACCENT_COLORS[key];
                const isSelected = accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccent(key)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-black/60 border-white/40 shadow-md ring-1'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                    style={isSelected ? { borderColor: conf.primary } : {}}
                  >
                    <div 
                      className="w-5 h-5 rounded-full shrink-0 shadow-sm flex items-center justify-center text-black"
                      style={{ backgroundColor: conf.primary }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white text-[11px] block truncate">
                        {conf.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 block truncate">
                        {conf.primary}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: LIVE COMPONENT PREVIEW */}
          <div className="space-y-2 pt-2">
            <label className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Live Visual Component Preview</span>
            </label>

            <div 
              className={`p-4 rounded-2xl border transition-all ${
                themeMode === 'light' ? 'bg-white border-slate-300 text-slate-900 shadow-md' : 'bg-black/40 border-white/10 text-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-current/10">
                <span className="font-mono font-bold text-xs">
                  SAMPLE TAG: APP-2026-00128
                </span>
                <span 
                  className="px-2 py-0.5 rounded-full font-mono text-[10px] font-extrabold"
                  style={{ backgroundColor: currentAccent.badgeBg, color: currentAccent.primary, border: `1px solid ${currentAccent.badgeBorder}` }}
                >
                  Samsung 55" 4K Smart TV
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Collateral Advance:</span>
                  <span className="font-black text-sm font-mono" style={{ color: currentAccent.primary }}>
                    KES 24,000
                  </span>
                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl font-extrabold text-xs text-black shadow-md cursor-default transition-all"
                  style={{ backgroundColor: currentAccent.primary }}
                >
                  Counter Action
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 4: LOCAL STORAGE STATUS */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Settings automatically saved to browser <strong>LocalStorage</strong></span>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold cursor-pointer underline text-[10px] shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/50 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={closeThemePanel}
            className="px-5 py-2 rounded-xl text-black font-extrabold text-xs transition-all shadow-md cursor-pointer"
            style={{ backgroundColor: currentAccent.primary }}
          >
            Apply & Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
