import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlusIcon, LockClosedIcon, KeyIcon, SparklesIcon } from '@heroicons/react/24/solid'

const AUTH_TABS = [
  { id: 'landing', label: 'Home', icon: SparklesIcon, path: '/' },
  { id: 'register', label: 'Register', icon: UserPlusIcon, path: '/register' },
  { id: 'login', label: 'Login', icon: LockClosedIcon, path: '/login' },
  { id: 'forgot', label: 'Help', icon: KeyIcon, path: '/forgot-password' },
]

export default function AuthBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const getActiveTab = () => {
    const path = location.pathname
    const tab = AUTH_TABS.find(t => t.path === path)
    return tab?.id || null
  }

  const activeTab = getActiveTab()

  const handleTabClick = (tab) => {
    navigate(tab.path)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around">
        {AUTH_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={tab.label}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          )
        })}
      </div>
      <div className="h-[max(env(safe-area-inset-bottom),0.75rem)] bg-card" />
    </div>
  )
}
