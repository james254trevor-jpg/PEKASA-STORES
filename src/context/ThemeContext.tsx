import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

export type AccentColor = 'tiffany' | 'emerald' | 'sapphire' | 'amber' | 'purple' | 'rose';

export interface AccentConfig {
  id: AccentColor;
  name: string;
  primary: string;
  hover: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
}

export const ACCENT_COLORS: Record<AccentColor, AccentConfig> = {
  tiffany: {
    id: 'tiffany',
    name: 'Tiffany Cyan (Official)',
    primary: '#0ABAB5',
    hover: '#1FD2CD',
    glow: 'rgba(10, 186, 181, 0.25)',
    badgeBg: 'rgba(10, 186, 181, 0.12)',
    badgeBorder: 'rgba(10, 186, 181, 0.35)'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Cash',
    primary: '#10B981',
    hover: '#34D399',
    glow: 'rgba(16, 185, 129, 0.25)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)'
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Royal',
    primary: '#2563EB',
    hover: '#3B82F6',
    glow: 'rgba(37, 99, 235, 0.25)',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    badgeBorder: 'rgba(37, 99, 235, 0.35)'
  },
  amber: {
    id: 'amber',
    name: 'Sunset Gold',
    primary: '#F59E0B',
    hover: '#FBBF24',
    glow: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)'
  },
  purple: {
    id: 'purple',
    name: 'Electric Amethyst',
    primary: '#8B5CF6',
    hover: '#A78BFA',
    glow: 'rgba(139, 92, 246, 0.25)',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeBorder: 'rgba(139, 92, 246, 0.35)'
  },
  rose: {
    id: 'rose',
    name: 'Coral Ruby',
    primary: '#F43F5E',
    hover: '#FB7185',
    glow: 'rgba(244, 63, 94, 0.25)',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeBorder: 'rgba(244, 63, 94, 0.35)'
  }
};

interface ThemeContextType {
  themeMode: ThemeMode;
  accent: AccentColor;
  currentAccent: AccentConfig;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  isThemePanelOpen: boolean;
  openThemePanel: () => void;
  closeThemePanel: () => void;
  toggleThemePanel: () => void;
}

const LOCAL_STORAGE_THEME_MODE_KEY = 'pekasa_theme_mode';
const LOCAL_STORAGE_THEME_ACCENT_KEY = 'pekasa_theme_accent';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage or fallback to defaults ('dark' & 'tiffany')
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_MODE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_ACCENT_KEY) as AccentColor;
    return saved && ACCENT_COLORS[saved] ? saved : 'tiffany';
  });

  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);

  const currentAccent = ACCENT_COLORS[accent] || ACCENT_COLORS.tiffany;

  // Persist to localStorage and update CSS variables on root
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_THEME_MODE_KEY, themeMode);
    const root = document.documentElement;

    if (themeMode === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
      root.style.colorScheme = 'dark';
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_THEME_ACCENT_KEY, accent);
    const root = document.documentElement;
    root.style.setProperty('--accent-color', currentAccent.primary);
    root.style.setProperty('--accent-hover', currentAccent.hover);
    root.style.setProperty('--accent-glow', currentAccent.glow);
    root.style.setProperty('--accent-badge-bg', currentAccent.badgeBg);
    root.style.setProperty('--accent-badge-border', currentAccent.badgeBorder);
  }, [accent, currentAccent]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleThemeMode = () => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
  };

  const openThemePanel = () => setIsThemePanelOpen(true);
  const closeThemePanel = () => setIsThemePanelOpen(false);
  const toggleThemePanel = () => setIsThemePanelOpen((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        accent,
        currentAccent,
        toggleThemeMode,
        setThemeMode,
        setAccent,
        isThemePanelOpen,
        openThemePanel,
        closeThemePanel,
        toggleThemePanel
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
