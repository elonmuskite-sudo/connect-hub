import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useFilteredTabs, getActiveTabFromPath } from './AppBottomNav'

export default function AppTopNav({ className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const tabs = useFilteredTabs()
  const activeTab = getActiveTabFromPath(location.pathname)

  const visibleTabs = useMemo(() => tabs, [tabs])

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={`hidden md:flex items-center gap-1 ${className}`}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-current={isActive ? 'page' : undefined}
            title={tab.label}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
