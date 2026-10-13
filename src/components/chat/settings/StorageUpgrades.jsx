import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, LoaderCircle, Receipt, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/AuthContext'
import { formatBytes } from '../../../lib/storageManager'
import { USDT_TIERS, getPaymentSettings } from '../../../lib/usdtPayments'

const STATUS_LABEL = { awaiting_approval: 'Waiting approval', completed: 'Completed', rejected: 'Rejected', pending: 'Pending', failed: 'Failed' }

export default function StorageUpgrades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState([])
  const [settings, setSettings] = useState(null)
  const [tier, setTier] = useState(null)
  const [txRef, setTxRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase || !user?.id) return
    supabase.from('storage_purchases').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setPurchases(data || []))
    getPaymentSettings().then(setSettings).catch(() => setSettings(null))
  }, [user?.id])

  const paid = async () => {
    setBusy(true); setError('')
    const { data, error: e } = await supabase.rpc('submit_usdt_payment', { _tier: tier.id, _tx_reference: txRef })
    setBusy(false)
    if (e) return setError(e.message)
    navigate(`/app/payment/${data}`)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(settings.wallet_address)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const ready = settings?.wallet_address

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="font-semibold text-foreground">Get more storage</p>
      </div>
      {!ready && <p className="text-sm text-muted-foreground">Upgrades open once the admin adds a payment wallet.</p>}
      <div className="grid grid-cols-3 gap-2">
        {USDT_TIERS.map((t) => (
          <button key={t.id} onClick={() => setTier(t)} disabled={!ready}
            className={`rounded-xl border p-3 text-center transition disabled:opacity-50 ${tier?.id === t.id ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:border-primary'}`}>
            <p className="font-bold text-foreground">{t.label}</p>
            <p className="text-sm text-muted-foreground">{t.amount} USDT</p>
          </button>
        ))}
      </div>

      {tier && ready && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-sm text-foreground">Send exactly <b>{tier.amount} USDT</b> on the <b>BNB Smart Chain (BEP20)</b> network to:</p>
          {settings.qrUrl && <img src={settings.qrUrl} alt="Wallet QR code" className="mx-auto h-44 w-44 rounded-xl bg-background object-contain p-2" />}
          <button onClick={copy} className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-xs font-mono text-foreground break-all">
            <span className="flex-1">{settings.wallet_address}</span>
            <Copy className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          </button>
          {copied && <p className="text-xs text-primary">Address copied</p>}
          <p className="text-xs text-destructive">Only send USDT on BEP20. Other networks or coins will be lost.</p>
          <input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="Transaction hash (optional, speeds up approval)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button onClick={paid} disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : 'Paid'}
          </button>
        </div>
      )}

      {purchases.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Receipts</p>
          <ul className="space-y-1">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-foreground">{formatBytes(p.added_bytes)} · {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()} · {new Date(p.created_at).toLocaleDateString()}</span>
                <span className="text-muted-foreground">{STATUS_LABEL[p.status] || p.status}</span>
                {p.status === 'awaiting_approval' && <button onClick={() => navigate(`/app/payment/${p.id}`)} className="text-primary hover:underline">View</button>}
                <button onClick={() => navigate(`/app/invoice/${p.id}`)} className="text-primary hover:underline">Invoice</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
