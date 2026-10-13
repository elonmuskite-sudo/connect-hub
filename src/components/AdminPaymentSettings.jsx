import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getPaymentSettings } from '../lib/usdtPayments'

export default function AdminPaymentSettings() {
  const [wallet, setWallet] = useState('')
  const [qrPath, setQrPath] = useState(null)
  const [qrUrl, setQrUrl] = useState(null)
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    getPaymentSettings().then((s) => {
      if (!s) return
      setWallet(s.wallet_address || ''); setQrPath(s.qr_image_url); setQrUrl(s.qrUrl)
    }).catch((e) => setMsg(e.message))
  }, [])

  const save = async () => {
    setMsg('')
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())) return setMsg('Enter a valid BEP20 address (starts with 0x, 42 characters).')
    setBusy(true)
    try {
      let path = qrPath
      if (file) {
        path = `qr-${Date.now()}.${(file.name.split('.').pop() || 'png').toLowerCase()}`
        const { error } = await supabase.storage.from('payment-qr').upload(path, file, { contentType: file.type })
        if (error) throw error
      }
      const { error } = await supabase.from('payment_settings').upsert({ id: 1, wallet_address: wallet.trim(), qr_image_url: path, network: 'BEP20' })
      if (error) throw error
      setQrPath(path); setFile(null)
      if (path) {
        const { data } = await supabase.storage.from('payment-qr').createSignedUrl(path, 3600)
        setQrUrl(data?.signedUrl || null)
      }
      setMsg('Saved.')
    } catch (e) {
      setMsg(e.message || 'Could not save.')
    } finally { setBusy(false) }
  }

  return (
    <section className="mt-8 rounded-[24px] border border-border bg-card p-6">
      <h2 className="text-xl font-semibold text-foreground">USDT (BEP20) payment wallet</h2>
      <p className="mt-1 text-sm text-muted-foreground">People pay storage upgrades to this wallet. Double-check the address — payments can't be reversed.</p>
      <div className="mt-4 space-y-3">
        <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm" />
        <div className="flex items-center gap-4">
          {qrUrl && <img src={qrUrl} alt="Current QR code" className="h-24 w-24 rounded-xl bg-background object-contain p-1" />}
          <label className="text-sm text-foreground">QR code image
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
          </label>
        </div>
        <button onClick={save} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save wallet'}</button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </section>
  )
}
