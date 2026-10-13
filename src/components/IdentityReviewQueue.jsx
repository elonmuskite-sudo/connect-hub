import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

async function signed(path) {
  const { data } = await supabase.storage.from('identity-docs').createSignedUrl(path, 600)
  return data?.signedUrl
}

export default function IdentityReviewQueue() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [notes, setNotes] = useState({})
  const [error, setError] = useState('')

  const load = async () => {
    if (!supabase) return
    const { data, error: e } = await supabase.from('identity_verifications')
      .select('*').eq('status', 'pending').order('created_at').limit(50)
    if (e) return setError(e.message)
    setRows(await Promise.all((data || []).map(async (r) => ({
      ...r, selfieUrl: await signed(r.selfie_path), idUrl: await signed(r.id_document_path),
    }))))
  }
  useEffect(() => { load() }, [])

  const decide = async (id, status) => {
    const { error: e } = await supabase.from('identity_verifications').update({
      status, reviewer_note: notes[id] || null, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (e) return setError(e.message)
    setRows((r) => r.filter((x) => x.id !== id))
  }

  return (
    <section className="mt-8 rounded-[24px] border border-border bg-card p-6">
      <h2 className="text-xl font-semibold text-foreground">ID checks waiting for review</h2>
      <p className="mt-1 text-sm text-muted-foreground">Faces already matched on the person's device. Confirm the ID looks genuine before approving.</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!rows.length && !error && <p className="mt-4 text-sm text-muted-foreground">Nothing to review.</p>}
      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Match score {Number(r.match_score || 0).toFixed(2)} · {new Date(r.created_at).toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3">
              {r.selfieUrl && <img src={r.selfieUrl} alt="Selfie" className="w-full rounded-xl" />}
              {r.idUrl && <img src={r.idUrl} alt="Government ID" className="w-full rounded-xl" />}
            </div>
            <input placeholder="Note (shown to the person if rejected)" value={notes[r.id] || ''}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => decide(r.id, 'approved')} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Approve</button>
              <button onClick={() => decide(r.id, 'rejected')} className="rounded-full border border-border px-4 py-2 text-sm text-destructive">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
