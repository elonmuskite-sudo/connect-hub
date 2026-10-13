import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const tone = (o) => o === 'storage_added' ? 'text-primary' : ['error', 'rejected'].includes(o) ? 'text-destructive' : 'text-muted-foreground'

export default function PaymentWebhookLog() {
  const [events, setEvents] = useState([])
  const [purchases, setPurchases] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true); setError('')
    const [ev, pu] = await Promise.all([
      supabase.from('payment_webhook_events').select('*').order('received_at', { ascending: false }).limit(50),
      supabase.from('storage_purchases').select('id, user_id, tier, amount_cents, status, created_at, updated_at').order('created_at', { ascending: false }).limit(30),
    ])
    if (ev.error || pu.error) setError((ev.error || pu.error).message)
    setEvents(ev.data || []); setPurchases(pu.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <section className="mt-8 rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Payments & storage upgrades</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recent NOWPayments notifications, what happened with each, and purchase statuses.</p>
        </div>
        <button onClick={load} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted">Refresh</button>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">Webhook events</h3>
            {!events.length && <p className="mt-2 text-sm text-muted-foreground">No events received yet.</p>}
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className={`font-semibold ${tone(e.outcome)}`}>{e.outcome}</span>
                    <span className="text-muted-foreground">{new Date(e.received_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">Status: {e.payment_status || '—'} · Order: <span className="font-mono">{e.order_id?.slice(0, 8) || '—'}</span> · Signature: {e.signature_valid ? 'valid' : 'invalid'}</p>
                  {e.error && <p className="mt-1 text-destructive">{e.error}</p>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Purchases</h3>
            {!purchases.length && <p className="mt-2 text-sm text-muted-foreground">No purchases yet.</p>}
            <ul className="mt-3 space-y-2">
              {purchases.map((p) => (
                <li key={p.id} className="flex justify-between rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <span>{p.tier} · ${(p.amount_cents / 100).toFixed(2)} <span className="font-mono text-muted-foreground">{p.id.slice(0, 8)}</span></span>
                  <span className={p.status === 'paid' ? 'text-primary font-semibold' : p.status === 'pending' ? 'text-muted-foreground' : 'text-destructive'}>{p.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
