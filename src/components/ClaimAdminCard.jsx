import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Shown only while the workspace has no admin. The database grants the role once, to one confirmed account.
export default function ClaimAdminCard() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase || !user?.id || user.role === 'admin') return
    supabase.rpc('admin_exists').then(({ data, error: e }) => { if (!e && data === false) setShow(true) })
  }, [user?.id, user?.role])

  if (!show) return null
  const claim = async () => {
    setError('')
    const { error: e } = await supabase.rpc('claim_first_admin')
    if (e) return setError(e.message)
    window.location.assign('/admin')
  }
  return (
    <div className="mb-6 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="w-4 h-4 text-primary" /> No admin yet</p>
      <p className="mt-1 text-sm text-muted-foreground">This workspace has no admin. The first person to claim it becomes the admin — this only works once.</p>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <button onClick={claim} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Make me the admin</button>
    </div>
  )
}
