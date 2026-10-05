import React, { createContext, useContext, useState, useEffect } from 'react';
import { CustomThemeConfig } from '../types';

export type ThemeMode = 'dark' | 'light' | 'system';

export type AccentColor = 'tiffany' | 'emerald' | 'sapphire' | 'amber' | 'purple' | 'rose' | 'orange' | 'teal';

export interface AccentConfig {
  id: AccentColor;
  name: string;
  primary: string;
  hover: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
  secondary: string;
}

export const THEME_PRESETS: Record<string, {
  name: string;
  primary: string;
  secondary: string;
  darkBg: string;
  lightBg: string;
  sidebar: string;
  button: string;
  accent: AccentColor;
}> = {
  default: {
    name: 'Professional / Default (Pekasa Gold & Teal)',
    primary: '#0ABAB5',
    secondary: '#FFD700',
    darkBg: '#0f172a',
    lightBg: '#f8fafc',
    sidebar: '#090e17',
    button: '#0ABAB5',
    accent: 'tiffany'
  },
  blue: {
    name: 'Sapphire Royal Blue',
    primary: '#2563EB',
    secondary: '#60A5FA',
    darkBg: '#0b1329',
    lightBg: '#eff6ff',
    sidebar: '#080d1c',
    button: '#2563EB',
    accent: 'sapphire'
  },
  green: {
    name: 'Emerald Prosperity',
    primary: '#10B981',
    secondary: '#34D399',
    darkBg: '#062016',
    lightBg: '#f0fdf4',
    sidebar: '#041710',
    button: '#10B981',
    accent: 'emerald'
  },
  purple: {
    name: 'Electric Amethyst',
    primary: '#8B5CF6',
    secondary: '#C084FC',
    darkBg: '#150d2a',
    lightBg: '#faf5ff',
    sidebar: '#0d071c',
    button: '#8B5CF6',
    accent: 'purple'
  },
  orange: {
    name: 'Sunset Ember',
    primary: '#F97316',
    secondary: '#FBBF24',
    darkBg: '#1c1007',
    lightBg: '#fff7ed',
    sidebar: '#140a04',
    button: '#F97316',
    accent: 'orange'
  },
  red: {
    name: 'Coral Crimson',
    primary: '#EF4444',
    secondary: '#F87171',
    darkBg: '#1c0909',
    lightBg: '#fef2f2',
    sidebar: '#140505',
    button: '#EF4444',
    accent: 'rose'
  },
  teal: {
    name: 'Coastal Mint',
    primary: '#0D9488',
    secondary: '#2DD4BF',
    darkBg: '#081c1a',
    lightBg: '#f0fdfa',
    sidebar: '#051412',
    button: '#0D9488',
    accent: 'teal'
  }
};

export const ACCENT_COLORS: Record<AccentColor, AccentConfig> = {
  tiffany: {
    id: 'tiffany',
    name: 'Tiffany Cyan (Official)',
    primary: '#0ABAB5',
    hover: '#1FD2CD',
    glow: 'rgba(10, 186, 181, 0.25)',
    badgeBg: 'rgba(10, 186, 181, 0.12)',
    badgeBorder: 'rgba(10, 186, 181, 0.35)',
    secondary: '#FFD700'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Cash',
    primary: '#10B981',
    hover: '#34D399',
    glow: 'rgba(16, 185, 129, 0.25)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)',
    secondary: '#34D399'
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Royal',
    primary: '#2563EB',
    hover: '#3B82F6',
    glow: 'rgba(37, 99, 235, 0.25)',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    badgeBorder: 'rgba(37, 99, 235, 0.35)',
    secondary: '#60A5FA'
  },
  amber: {
    id: 'amber',
    name: 'Sunset Gold',
    primary: '#F59E0B',
    hover: '#FBBF24',
    glow: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    secondary: '#FBBF24'
  },
  purple: {
    id: 'purple',
    name: 'Electric Amethyst',
    primary: '#8B5CF6',
    hover: '#A78BFA',
    glow: 'rgba(139, 92, 246, 0.25)',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeBorder: 'rgba(139, 92, 246, 0.35)',
    secondary: '#C084FC'
  },
  rose: {
    id: 'rose',
    name: 'Coral Ruby',
    primary: '#F43F5E',
    hover: '#FB7185',
    glow: 'rgba(244, 63, 94, 0.25)',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeBorder: 'rgba(244, 63, 94, 0.35)',
    secondary: '#FB7185'
  },
  orange: {
    id: 'orange',
    name: 'Sunset Orange',
    primary: '#F97316',
    hover: '#FB923C',
    glow: 'rgba(249, 115, 22, 0.25)',
    badgeBg: 'rgba(249, 115, 22, 0.12)',
    badgeBorder: 'rgba(249, 115, 22, 0.35)',
    secondary: '#FBBF24'
  },
  teal: {
    id: 'teal',
    name: 'Coastal Teal',
    primary: '#0D9488',
    hover: '#14B8A6',
    glow: 'rgba(13, 148, 136, 0.25)',
    badgeBg: 'rgba(13, 148, 136, 0.12)',
    badgeBorder: 'rgba(13, 148, 136, 0.35)',
    secondary: '#2DD4BF'
  }
};

export const DEFAULT_THEME_CONFIG: CustomThemeConfig = {
  themeMode: 'dark',
  primaryColor: '#0ABAB5',
  secondaryColor: '#FFD700',
  backgroundColor: '#0f172a',
  sidebarColor: '#090e17',
  buttonColor: '#0ABAB5',
  textColor: '#f8fafc',
  presetName: 'default',
  sidebarStyle: 'standard',
  density: 'comfortable',
  fontSize: 'normal'
};

interface ThemeContextType {
  themeMode: ThemeMode;
  effectiveTheme: 'dark' | 'light';
  customTheme: CustomThemeConfig;
  accent: AccentColor;
  currentAccent: AccentConfig;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  applyTheme: (config: Partial<CustomThemeConfig>) => void;
  resetTheme: () => void;
  isThemePanelOpen: boolean;
  openThemePanel: () => void;
  closeThemePanel: () => void;
  toggleThemePanel: () => void;
}

const LOCAL_STORAGE_THEME_MODE_KEY = 'pekasa_theme_mode';
const LOCAL_STORAGE_THEME_CONFIG_KEY = 'pekasa_custom_theme_config';
const LOCAL_STORAGE_THEME_ACCENT_KEY = 'pekasa_theme_accent';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved theme configuration
  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(() => {
    try {
      const savedConfig = localStorage.getItem(LOCAL_STORAGE_THEME_CONFIG_KEY);
      if (savedConfig) {
        return { ...DEFAULT_THEME_CONFIG, ...JSON.parse(savedConfig) };
      }
      const legacyMode = localStorage.getItem(LOCAL_STORAGE_THEME_MODE_KEY) as ThemeMode;
      return {
        ...DEFAULT_THEME_CONFIG,
        themeMode: legacyMode === 'light' ? 'light' : 'dark'
      };
    } catch {
      return DEFAULT_THEME_CONFIG;
    }
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);

  // Listen to OS dark mode changes if system theme selected
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const effectiveTheme: 'dark' | 'light' =
    customTheme.themeMode === 'system'
      ? systemIsDark
        ? 'dark'
        : 'light'
      : customTheme.themeMode === 'light'
      ? 'light'
      : 'dark';

  // Apply to documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-light', effectiveTheme === 'light');
    root.classList.toggle('theme-dark', effectiveTheme === 'dark');
    root.classList.toggle('dark', effectiveTheme === 'dark');
    root.dataset.theme = effectiveTheme;
    root.dataset.mode = customTheme.themeMode;
    root.dataset.density = customTheme.density;
    root.dataset.fontSize = customTheme.fontSize;
    root.style.colorScheme = effectiveTheme;

    // Apply custom color CSS variables
    root.style.setProperty('--color-primary', customTheme.primaryColor);
    root.style.setProperty('--color-secondary', customTheme.secondaryColor);
    if (customTheme.buttonColor) {
      root.style.setProperty('--color-btn-custom', customTheme.buttonColor);
    }
    if (customTheme.sidebarColor) {
      root.style.setProperty('--color-sidebar-custom', customTheme.sidebarColor);
    }
    if (customTheme.backgroundColor) {
      root.style.setProperty('--color-bg-custom', customTheme.backgroundColor);
    }

    // Set font size attribute
    if (customTheme.fontSize === 'small') {
      root.style.fontSize = '14px';
    } else if (customTheme.fontSize === 'large') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '16px';
    }

    localStorage.setItem(LOCAL_STORAGE_THEME_MODE_KEY, customTheme.themeMode);
    localStorage.setItem(LOCAL_STORAGE_THEME_CONFIG_KEY, JSON.stringify(customTheme));
  }, [customTheme, effectiveTheme]);

  // Determine current accent config
  const currentAccent: AccentConfig =
    ACCENT_COLORS[customTheme.presetName as AccentColor] || {
      id: 'tiffany',
      name: 'Custom',
      primary: customTheme.primaryColor,
      hover: customTheme.primaryColor,
      glow: `${customTheme.primaryColor}40`,
      badgeBg: `${customTheme.primaryColor}20`,
      badgeBorder: `${customTheme.primaryColor}60`,
      secondary: customTheme.secondaryColor
    };

  const setThemeMode = (mode: ThemeMode) => {
    applyTheme({ themeMode: mode });
  };

  const toggleThemeMode = () => {
    setThemeMode(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  const setAccent = (newAccent: AccentColor) => {
    const preset = THEME_PRESETS[newAccent] || THEME_PRESETS.default;
    applyTheme({
      presetName: newAccent,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      buttonColor: preset.button
    });
  };

  const applyTheme = (config: Partial<CustomThemeConfig>) => {
    setCustomTheme((prev) => {
      const next = { ...prev, ...config };
      localStorage.setItem(LOCAL_STORAGE_THEME_CONFIG_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetTheme = () => {
    setCustomTheme(DEFAULT_THEME_CONFIG);
    localStorage.removeItem(LOCAL_STORAGE_THEME_CONFIG_KEY);
    localStorage.setItem(LOCAL_STORAGE_THEME_MODE_KEY, 'dark');
  };

  const openThemePanel = () => setIsThemePanelOpen(true);
  const closeThemePanel = () => setIsThemePanelOpen(false);
  const toggleThemePanel = () => setIsThemePanelOpen((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{
        themeMode: customTheme.themeMode,
        effectiveTheme,
        customTheme,
        accent: (customTheme.presetName as AccentColor) || 'tiffany',
        currentAccent,
        toggleThemeMode,
        setThemeMode,
        setAccent,
        applyTheme,
        resetTheme,
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
