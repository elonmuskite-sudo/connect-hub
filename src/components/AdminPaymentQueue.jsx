import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatBytes } from '../lib/storageManager'
import { appwriteData, isAppwriteAuthEnabled } from '../lib/appwrite'

export default function AdminPaymentQueue() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      if (isAppwriteAuthEnabled()) {
        const { purchases } = await appwriteData('payments.admin.queue')
        setRows(purchases || [])
      } else {
        const { data, error: queryError } = await supabase.from('storage_purchases').select('*').eq('status', 'awaiting_approval')
          .order('created_at').limit(100)
        if (queryError) throw queryError
        setRows(data || [])
      }
      setError('')
    } catch (error) {
      setError(error.message || 'Could not load pending payments.')
    }
  }, [])

  useEffect(() => {
    if (!isAppwriteAuthEnabled() && !supabase) return undefined
    load()
    if (isAppwriteAuthEnabled()) {
      const timer = setInterval(load, 10000)
      return () => clearInterval(timer)
    }
    const channel = supabase.channel('admin-usdt-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storage_purchases' }, load).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const decide = async (id, approve) => {
    setError('')
    try {
      if (isAppwriteAuthEnabled()) {
        await appwriteData('payments.review', { purchaseId: id, approve })
      } else {
        const { error: e } = await supabase.rpc('review_usdt_payment', { _purchase_id: id, _approve: approve })
        if (e) throw e
      }
      setRows((r) => r.filter((x) => x.id !== id))
    } catch (e) {
      setError(e.message || 'The payment could not be reviewed.')
    }
  }

  return (
    <section className="mt-8 rounded-[24px] border border-border bg-card p-6">
      <h2 className="text-xl font-semibold text-foreground">USDT payments waiting for approval</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check your wallet for the amount (and transaction hash if given) before approving. Approval adds the storage instantly.</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!rows.length && !error && <p className="mt-4 text-sm text-muted-foreground">Nothing waiting.</p>}
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm text-foreground"><b>{(r.amount_cents / 100).toFixed(2)} USDT</b> · {formatBytes(r.added_bytes)} · {new Date(r.created_at).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground break-all">User {r.user_id}{r.tx_reference ? ` · Tx ${r.tx_reference}` : ' · no transaction hash given'}</p>
            {r.tx_reference && <a href={`https://bscscan.com/tx/${encodeURIComponent(r.tx_reference)}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Look up on BscScan</a>}
            <div className="flex gap-2">
              <button onClick={() => decide(r.id, true)} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Approve</button>
              <button onClick={() => decide(r.id, false)} className="rounded-full border border-border px-4 py-2 text-sm text-destructive">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
