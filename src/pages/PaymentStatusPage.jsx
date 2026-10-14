import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Hourglass, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBytes } from '../lib/storageManager'
import { appwriteData, isAppwriteAuthEnabled } from '../lib/appwrite'

export default function PaymentStatusPage() {
  const { purchaseId } = useParams()
  const navigate = useNavigate()
  const [purchase, setPurchase] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if ((!supabase && !isAppwriteAuthEnabled()) || !purchaseId) return undefined
    let active = true
    const load = async () => {
      try {
        if (isAppwriteAuthEnabled()) {
          const { purchase: result } = await appwriteData('payments.purchase.get', { purchaseId })
          if (!result) throw new Error('Payment not found.')
          if (active) setPurchase(result)
        } else {
          const { data, error: queryError } = await supabase.from('storage_purchases').select('*').eq('id', purchaseId).maybeSingle()
          if (queryError) throw queryError
          if (data && active) setPurchase(data)
        }
        if (active) setError('')
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load payment status.')
      }
    }
    load()
    if (isAppwriteAuthEnabled()) {
      const poll = setInterval(load, 10000)
      return () => { active = false; clearInterval(poll) }
    }
    const channel = supabase.channel(`purchase-${purchaseId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'storage_purchases', filter: `id=eq.${purchaseId}` },
        (payload) => setPurchase(payload.new))
      .subscribe()
    const poll = setInterval(load, 10000) // fallback if realtime drops
    return () => { active = false; clearInterval(poll); supabase.removeChannel(channel) }
  }, [purchaseId])

  useEffect(() => {
    if (purchase?.status !== 'completed') return undefined
    const t = setTimeout(() => navigate('/app', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [purchase?.status, navigate])

  const status = purchase?.status
  return (
    <div className="flex h-full min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-8 text-center shadow-sm">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        {status === 'completed' ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Payment completed</h1>
            <button onClick={() => navigate(`/app/invoice/${purchase.id}`)} className="mt-3 text-sm text-primary hover:underline">View invoice</button>
            <p className="mt-2 text-sm text-muted-foreground">{formatBytes(purchase.added_bytes)} has been added to your storage. Taking you to your chats…</p>
          </>
        ) : status === 'rejected' ? (
          <>
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Payment not confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't find your payment. If you sent it, contact support with your transaction hash.</p>
            <button onClick={() => navigate('/app')} className="mt-6 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Back to chats</button>
          </>
        ) : (
          <>
            <Hourglass className="mx-auto h-14 w-14 animate-pulse text-primary" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Waiting for approval</h1>
            <p className="mt-2 text-sm text-muted-foreground">Thanks! We're checking your USDT payment. This page updates by itself as soon as it's approved — you can keep it open or come back later.</p>
            <button onClick={() => navigate('/app')} className="mt-6 rounded-full border border-border px-5 py-2 text-sm text-foreground">Go to chats meanwhile</button>
          </>
        )}
      </div>
    </div>
  )
}
