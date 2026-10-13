import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheckIcon } from '@heroicons/react/24/solid'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../hooks/useTheme'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true })
    }
  }, [user, navigate])

  const themeClasses = useMemo(() => theme === 'dark'
    ? {
        shell: 'border-white/10 bg-slate-950/80 text-slate-100',
        card: 'border-white/10 bg-slate-900/80 text-slate-100',
        muted: 'text-slate-300',
        input: 'border-slate-700 bg-slate-800 text-white focus:border-blue-500',
        button: 'bg-blue-600 text-white hover:bg-blue-500'
      }
    : {
        shell: 'border-slate-200 bg-white/80 text-slate-900',
        card: 'border-slate-200 bg-white/80 text-slate-900',
        muted: 'text-slate-600',
        input: 'border-slate-300 bg-white text-slate-900 focus:border-blue-500',
        button: 'bg-blue-600 text-white hover:bg-blue-500'
      }, [theme])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password)
      const destination = result?.user?.role === 'admin' ? '/admin' : '/app'
      navigate(destination)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back to Nexus"
      subtitle="Sign in using the email address associated with your Nexus account."
      compact
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className={`flex-1 rounded-[24px] border p-8 ${theme === 'dark' ? 'border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-slate-900' : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'}`}>
          <div className={`rounded-full border px-3 py-1 text-sm ${theme === 'dark' ? 'border-blue-400/30 bg-blue-500/10 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
            Secure access
          </div>
          <div className={`mt-6 rounded-2xl border p-4 text-sm ${theme === 'dark' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheckIcon className="h-4 w-4" /> Protected by end-to-end encryption
            </div>
          </div>
        </div>

        <div className={`w-full max-w-md rounded-[24px] border p-6 shadow-lg ${themeClasses.card}`}>
          <h2 className="text-2xl font-semibold">Nexus login</h2>
          <p className={`mt-2 text-sm ${themeClasses.muted}`}>Your Nexus number remains available in your profile.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className={`mb-2 block text-sm font-medium ${themeClasses.muted}`}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ring-0 transition ${themeClasses.input}`}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-medium ${themeClasses.muted}`}>Password</label>
              <div className="relative">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none transition ${themeClasses.input}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={passwordVisible}
                  title={passwordVisible ? 'Hide password' : 'Show password'}
                  className={`absolute inset-y-0 right-0 flex w-12 items-center justify-center ${themeClasses.muted}`}
                >
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${themeClasses.button} disabled:bg-slate-600`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link to="/forgot-password" className="text-sm text-blue-500 hover:underline">
              Forgot password?
            </Link>
            <p className="text-sm text-slate-400">
              New here?{' '}
              <Link to="/register" className="font-semibold text-blue-500 hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
