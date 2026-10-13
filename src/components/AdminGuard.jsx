import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

// Admin access is re-confirmed with the database on every visit; the cached role is only a first filter.
export default function AdminGuard({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [verified, setVerified] = useState(null)

  useEffect(() => {
    let active = true
    if (!user?.id || user.role !== 'admin' || !supabase) { setVerified(false); return undefined }
    setVerified(null)
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data, error }) => { if (active) setVerified(!error && data === true) })
    return () => { active = false }
  }, [user?.id, user?.role])

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!loading && user && user.role !== 'admin') return <Navigate to="/app" replace />
  if (verified === false && !loading) return <Navigate to="/app" replace />

  if (loading || verified !== true) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return children
}
