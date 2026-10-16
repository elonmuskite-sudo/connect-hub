import { useEffect, useState } from 'react'
import { ExternalLink, LoaderCircle, Receipt } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/AuthContext'
import { formatBytes } from '../../../lib/storageManager'
import { appwriteData, isAppwriteAuthEnabled } from '../../../lib/appwrite'

const STATUS = {
  pending: { label: 'Awaiting payment', cls: 'bg-muted text-muted-foreground' },
  waiting: { label: 'Awaiting payment', cls: 'bg-muted text-muted-foreground' },
  confirming: { label: 'Confirming', cls: 'bg-accent text-accent-foreground' },
  partially_paid: { label: 'Partially paid', cls: 'bg-accent text-accent-foreground' },
  paid: { label: 'Paid — storage added', cls: 'bg-primary/10 text-primary' },
  finished: { label: 'Paid — storage added', cls: 'bg-primary/10 text-primary' },
  failed: { label: 'Failed', cls: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expired', cls: 'bg-destructive/10 text-destructive' },
  refunded: { label: 'Refunded', cls: 'bg-muted text-muted-foreground' },
}

export default function BillingHistory() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if ((!supabase && !isAppwriteAuthEnabled()) || !user?.id) { setLoading(false); return }
    let active = true
    const load = async () => {
      try {
        const rows = isAppwriteAuthEnabled()
          ? (await appwriteData('payments.purchase.list')).purchases
          : await supabase.from('storage_purchases')
            .select('id, tier, added_bytes, amount_cents, currency, status, checkout_session_id, receipt_url, created_at, updated_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
            .then(({ data, error: queryError }) => {
              if (queryError) throw queryError
              return data
            })
        if (active) {
          setRows(rows || [])
          setError('')
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load billing history.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    if (isAppwriteAuthEnabled()) {
      const timer = setInterval(load, 15000)
      return () => { active = false; clearInterval(timer) }
    }
    const channel = supabase.channel(`billing-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storage_purchases', filter: `user_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [user?.id])

  if (loading) return <div className="flex justify-center py-10"><LoaderCircle className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  if (error) return <p className="text-sm text-destructive">Could not load your billing history: {error}</p>
  if (!rows.length) return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <Receipt className="mx-auto w-6 h-6 text-muted-foreground mb-2" />
      <p className="text-foreground font-medium">No purchases yet</p>
      <p className="text-sm text-muted-foreground">Storage upgrades you buy in Settings → Storage will appear here.</p>
    </div>
  )

  const paidTotal = rows.filter((r) => ['paid', 'finished'].includes(r.status)).reduce((s, r) => s + r.amount_cents, 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Total paid: <span className="font-semibold text-foreground">${(paidTotal / 100).toFixed(2)}</span> · Payments processed by NOWPayments</p>
      <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
        {rows.map((r) => {
          const s = STATUS[r.status] || { label: r.status, cls: 'bg-muted text-muted-foreground' }
          return (
            <li key={r.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[10rem]">
                <p className="font-medium text-foreground">+{formatBytes(r.added_bytes)} storage</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · ${(r.amount_cents / 100).toFixed(2)} {String(r.currency || 'usd').toUpperCase()}
                  {r.checkout_session_id ? ` · Invoice ${r.checkout_session_id}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
              {r.receipt_url && (
                <a href={r.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  {['pending', 'waiting'].includes(r.status) ? 'Pay now' : 'Invoice'} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
