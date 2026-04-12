import { ConfigProvider, theme as antdTheme } from 'antd'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ThemeConfig } from 'antd/es/config-provider/context'

const STORAGE_KEY = 'sct_color_mode'

export type ColorMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ColorMode
  setMode: (m: ColorMode) => void
  toggleMode: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): ColorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

function buildAntdTheme(mode: ColorMode): ThemeConfig {
  if (mode === 'dark') {
    return {
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: '#38bdf8',
        borderRadius: 6,
        colorBgBase: '#030712',
        colorTextBase: '#e2e8f0',
        colorBorder: '#1e293b',
        colorBorderSecondary: '#1e293b',
        colorBgContainer: '#0b1220',
        colorBgElevated: '#0f172a',
        colorFillAlter: 'rgba(15, 23, 42, 0.45)',
        fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
      },
      components: {
        Layout: {
          headerBg: '#050816',
          siderBg: '#050816',
          bodyBg: '#030712',
        },
        Menu: {
          darkItemBg: '#050816',
          darkItemSelectedBg: '#0c1929',
          darkItemSelectedColor: '#bae6fd',
          darkItemColor: '#94a3b8',
          darkItemHoverBg: '#0a1524',
        },
        Modal: {
          contentBg: '#0f172a',
          headerBg: '#0f172a',
          titleColor: '#e2e8f0',
          footerBg: '#0f172a',
        },
        Form: { labelColor: '#94a3b8' },
        Input: {
          colorBgContainer: '#0b1220',
          colorBorder: '#1e293b',
          activeBorderColor: '#38bdf8',
          hoverBorderColor: '#334155',
          colorText: '#e2e8f0',
          colorTextPlaceholder: '#64748b',
        },
        Select: {
          colorBgContainer: '#0b1220',
          colorBorder: '#1e293b',
          colorText: '#e2e8f0',
          optionSelectedBg: '#0c1929',
        },
      },
    }
  }

  return {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#0284c7',
      borderRadius: 6,
      colorBgBase: '#f8fafc',
      colorTextBase: '#0f172a',
      colorBorder: '#e2e8f0',
      colorBorderSecondary: '#cbd5e1',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorFillAlter: 'rgba(241, 245, 249, 0.9)',
      fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
    },
    components: {
      Layout: {
        headerBg: '#ffffff',
        siderBg: '#f1f5f9',
        bodyBg: '#f1f5f9',
      },
      Menu: {
        itemBg: '#f1f5f9',
        itemSelectedBg: '#e0f2fe',
        itemSelectedColor: '#0369a1',
        itemColor: '#334155',
        itemHoverBg: '#e2e8f0',
        subMenuItemBg: '#f1f5f9',
      },
      Modal: {
        contentBg: '#ffffff',
        headerBg: '#ffffff',
        titleColor: '#0f172a',
        footerBg: '#ffffff',
      },
      Form: { labelColor: '#475569' },
      Input: {
        colorBgContainer: '#ffffff',
        colorBorder: '#cbd5e1',
        colorText: '#0f172a',
        colorTextPlaceholder: '#94a3b8',
      },
      Select: {
        colorBgContainer: '#ffffff',
        colorBorder: '#cbd5e1',
        colorText: '#0f172a',
        optionSelectedBg: '#e0f2fe',
      },
    },
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(readStoredMode)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const setMode = useCallback((m: ColorMode) => setModeState(m), [])
  const toggleMode = useCallback(() => setModeState((prev) => (prev === 'dark' ? 'light' : 'dark')), [])

  const antdThemeConfig = useMemo(() => buildAntdTheme(mode), [mode])

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode,
      isDark: mode === 'dark',
    }),
    [mode, setMode, toggleMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdThemeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider')
  return ctx
}
