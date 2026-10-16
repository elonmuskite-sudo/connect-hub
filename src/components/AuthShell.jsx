import { useMemo } from 'react'
import { useTheme } from '../hooks/useTheme'
import Header from './Header'
import AuthBottomNav from './AuthBottomNav'

export default function AuthShell({ children, title, subtitle, compact = false }) {
  const { theme } = useTheme()

  const themeClasses = useMemo(() => ({
    muted: theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
  }), [theme])

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-0`}>
      <Header />
      <div className={`mx-auto flex max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 ${compact ? 'max-w-5xl py-8' : 'py-10'}`}>
        {(title || subtitle) && (
          <div className="mb-6 max-w-2xl">
            {title && <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>}
            {subtitle && <p className={`mt-3 text-base leading-7 ${themeClasses.muted}`}>{subtitle}</p>}
          </div>
        )}
        <div className="rounded-[32px] border p-6 shadow-2xl backdrop-blur-xl lg:p-10 bg-white/80 dark:bg-slate-900/80 border-slate-200/70 dark:border-white/10">
          {children}
        </div>
      </div>
      <AuthBottomNav />
    </div>
  )
}
