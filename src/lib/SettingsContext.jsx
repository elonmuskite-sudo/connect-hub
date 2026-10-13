import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const SettingsContext = createContext()

function readFromStorage(key, defaultValue) {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = window.localStorage.getItem(key)
    return stored !== null ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    chatWallpaper: readFromStorage('chatWallpaper', 'nature'),
    notificationSound: readFromStorage('notificationSound', true),
    notificationTone: readFromStorage('notificationTone', 'chime'),
    notificationVolume: readFromStorage('notificationVolume', 0.5),
  }))

  useEffect(() => {
    const entries = Object.entries(settings)
    for (const [key, value] of entries) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage may be unavailable (private mode / quota); settings stay in memory.
      }
    }
  }, [settings])

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = typeof value === 'function' ? value(prev[key]) : value
      if (prev[key] === next) return prev
      return { ...prev, [key]: next }
    })
  }, [])

  const getSetting = useCallback((key, defaultValue) => {
    const current = settings[key]
    return current !== undefined ? current : defaultValue
  }, [settings])

  const value = useMemo(() => ({
    settings,
    setSetting,
    getSetting,
  }), [settings, setSetting, getSetting])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return ctx
}

export function useSetting(key, defaultValue) {
  const { settings, setSetting } = useSettings()
  const value = settings[key] !== undefined ? settings[key] : defaultValue

  const setValue = useCallback((v) => {
    setSetting(key, v)
  }, [key, setSetting])

  return [value, setValue]
}
