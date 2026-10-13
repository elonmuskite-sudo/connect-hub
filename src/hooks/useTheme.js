import { useState, useEffect } from 'react'

const THEME_STORAGE_KEY = 'nexus-theme'

export function useTheme() {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    // Get stored theme on mount
    const stored = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
    const resolvedTheme = stored || 'light'
    setTheme(resolvedTheme)
    applyTheme(resolvedTheme)

    // Listen for storage changes from other tabs/components
    const handleStorageChange = (e) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        setTheme(e.newValue)
        applyTheme(e.newValue)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const applyTheme = (themeToApply) => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', themeToApply === 'dark')
      document.documentElement.style.colorScheme = themeToApply
    }
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      applyTheme(nextTheme)
      // Dispatch custom event for other components listening
      window.dispatchEvent(new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: nextTheme
      }))
    }
  }

  return { theme, toggleTheme }
}
