import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatBytes } from '../lib/storageManager'

const STATUS = { completed: 'Paid', awaiting_approval: 'Awaiting approval', rejected: 'Rejected', pending: 'Pending', failed: 'Failed' }

function invoiceText(p, user) {
  return [
    'NEXUS — INVOICE',
    `Invoice #${p.invoice_number}`,
    `Date: ${new Date(p.created_at).toLocaleDateString()}`,
    `Billed to: ${user?.fullName || ''} (Member #${user?.nexusId || ''})`,
    '',
    `Item: Storage upgrade ${formatBytes(p.added_bytes)}`,
    `Amount: ${(p.amount_cents / 100).toFixed(2)} ${p.currency.toUpperCase()}`,
    'Network: BNB Smart Chain (BEP20)',
    p.tx_reference ? `Transaction: ${p.tx_reference}` : null,
    `Status: ${STATUS[p.status] || p.status}`,
  ].filter((l) => l !== null).join('\n')
}

export default function InvoicePage() {
  const { purchaseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [p, setP] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.from('storage_purchases').select('*').eq('id', purchaseId).maybeSingle()
      .then(({ data, error }) => (error ? setMsg(error.message) : data ? setP(data) : setMsg('Invoice not found.')))
  }, [purchaseId])

  if (!p) return <div className="p-8 text-center text-muted-foreground">{msg || 'Loading invoice…'}</div>

  const download = () => {
    const blob = new Blob([invoiceText(p, user)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `invoice-${p.invoice_number}.txt`; a.click()
    URL.revokeObjectURL(a.href)
  }
  const share = async () => {
    const text = invoiceText(p, user)
    try {
      if (navigator.share) {
        const file = new File([text], `invoice-${p.invoice_number}.txt`, { type: 'text/plain' })
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: `Invoice #${p.invoice_number}`, files: [file] })
        else await navigator.share({ title: `Invoice #${p.invoice_number}`, text })
      } else { await navigator.clipboard.writeText(text); setMsg('Invoice copied — paste it anywhere to share.') }
    } catch { /* share cancelled */ }
  }

  const Row = ({ k, v }) => <div className="flex justify-between gap-4 py-2 border-b border-border text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right text-foreground break-all">{v}</span></div>

  return (
    <div className="mx-auto w-full max-w-lg p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1" />
        <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm"><Printer className="h-4 w-4" />PDF</button>
        <button onClick={download} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm"><Download className="h-4 w-4" />Download</button>
        <button onClick={share} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"><Share2 className="h-4 w-4" />Share</button>
      </div>
      {msg && <p className="mb-3 text-sm text-muted-foreground print:hidden">{msg}</p>}
      <div className="rounded-[24px] border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-primary">Invoice</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">#{p.invoice_number}</h1>
        <p className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
        <div className="mt-5">
          <Row k="Billed to" v={`${user?.fullName || ''} · #${user?.nexusId || ''}`} />
          <Row k="Item" v={`Storage upgrade ${formatBytes(p.added_bytes)}`} />
          <Row k="Network" v="BNB Smart Chain (BEP20)" />
          {p.tx_reference && <Row k="Transaction" v={p.tx_reference} />}
          <Row k="Status" v={STATUS[p.status] || p.status} />
          <div className="flex justify-between pt-3 text-lg font-bold text-foreground"><span>Total</span><span>{(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}</span></div>
        </div>
      </div>
    </div>
  )
}
