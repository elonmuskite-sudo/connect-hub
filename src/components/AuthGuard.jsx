import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // If user is authenticated, redirect to appropriate dashboard
  if (user) {
    return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/app" replace />
  }

  // Allow unauthenticated users to access auth pages
  return children
}
