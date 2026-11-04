'use client'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { api, getSession, setSession, type Session } from '@/lib/api'
import { I18nProvider } from '@/lib/i18n'
import { translate } from '@/lib/messages'
import {
  accentTokens,
  materialThemes,
  defaults,
  normalizePreferences,
  type Preferences,
} from '@/lib/appearance'
export { palette, defaults, normalizePreferences, type Color, type Preferences } from '@/lib/appearance'

const PreferencesContext = createContext({
  preferences: defaults,
  resolvedTheme: 'dark' as 'dark' | 'light',
  setPreferences: (_p: Preferences) => {},
})
const AuthContext = createContext<{
  session: Session | null
  ready: boolean
  logout: () => void
}>({ session: null, ready: false, logout: () => {} })
export const usePreferences = () => useContext(PreferencesContext)
export const useAuth = () => useContext(AuthContext)
function resetTableModes() {
  for (const key of Object.keys(localStorage).filter((key) =>
    key.startsWith('table:'),
  )) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}')
      delete saved.mode
      localStorage.setItem(key, JSON.stringify(saved))
    } catch {
      localStorage.removeItem(key)
    }
  }
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
        },
      }),
  )
  const [session, updateSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [preferences, updatePreferences] = useState(defaults)
  const resolvedTheme = preferences.theme
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('campaigner.preferences') || '{}',
      )
      if (saved?.version !== 2) resetTableModes()
      const normalized = normalizePreferences(saved)
      updatePreferences(normalized)
      localStorage.setItem('campaigner.preferences', JSON.stringify(normalized))
    } catch {}
    const sync = () => {
      updateSession(getSession())
      client.clear()
    }
    sync()
    setReady(true)
    const storage = (event: StorageEvent) => {
      if (event.key === 'campaigner.workspace.session' || event.key === null)
        sync()
      if (event.key === 'campaigner.preferences' && event.newValue) {
        try {
          updatePreferences(normalizePreferences(JSON.parse(event.newValue)))
        } catch {}
      }
    }
    window.addEventListener('session-change', sync)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('session-change', sync)
      window.removeEventListener('storage', storage)
    }
  }, [client])
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.lang = preferences.language
    root.dataset.theme = resolvedTheme === 'dark' ? 'dark' : 'silver'
    const accent = accentTokens(preferences.accent, resolvedTheme)
    root.style.setProperty('--primary', accent.primary)
    root.style.setProperty('--primary-foreground', accent.foreground)
    root.style.setProperty('--accent-ink', accent.ink)
    root.style.setProperty('--selected', accent.selected)
    root.style.setProperty('--hover', accent.hover)
    // Semantic status colors are fixed; only the primary color is configurable.
    for (const key of ['info', 'success', 'warning', 'error'])
      root.style.removeProperty(`--${key}`)
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) =>
        meta.setAttribute(
          'content',
          materialThemes[resolvedTheme].colors.canvas,
        ),
      )
  }, [preferences.accent, preferences.language, resolvedTheme])
  useEffect(() => {
    if (!session) return
    let stopped = false
    const check = () =>
      api('/auth/test-token', { method: 'POST' })
        .then((data) => {
          if (stopped) return
          if (!data.user?.is_active) setSession(null)
          else if (
            JSON.stringify(data.user) !== JSON.stringify(getSession()?.user)
          )
            setSession({ ...session, user: data.user, ts: data.ts })
        })
        .catch(() => {})
    void check()
    const timer = setInterval(check, 60000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [session?.access_token])
  const setPreferences = (p: Preferences) => {
    if (p.tableMode !== preferences.tableMode) resetTableModes()
    const normalized = normalizePreferences(p)
    updatePreferences(normalized)
    localStorage.setItem('campaigner.preferences', JSON.stringify(normalized))
  }
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{ session, ready, logout: () => setSession(null) }}
      >
        <PreferencesContext.Provider
          value={{ preferences, resolvedTheme, setPreferences }}
        >
          <I18nProvider language={preferences.language}>
            {children}
            <Toaster
              theme={resolvedTheme}
              richColors
              closeButton
              position="top-center"
              containerAriaLabel={translate(
                preferences.language,
                'Уведомления',
              )}
              toastOptions={{
                closeButtonAriaLabel: translate(
                  preferences.language,
                  'Закрыть',
                ),
              }}
            />
          </I18nProvider>
        </PreferencesContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}
