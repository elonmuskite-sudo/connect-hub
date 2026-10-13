import { useRef, useState } from 'react'
import { Sparkles, X, Square } from 'lucide-react'
import { supabase, getSupabaseConfig } from '../../../lib/supabase'

export default function BioWriter({ name, bio, setBio, interests, setInterests }) {
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  const addTag = () => {
    const t = tag.trim().replace(/,$/, '')
    if (t && !interests.includes(t) && interests.length < 20) setInterests([...interests, t])
    setTag('')
  }

  const write = async () => {
    setError(''); setBusy(true)
    const ctrl = new AbortController(); abortRef.current = ctrl
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in first.')
      const { url, anonKey } = getSupabaseConfig()
      const res = await fetch(`${url}/functions/v1/generate-bio`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name, interests, draft: bio }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not write a bio.')
      const reader = res.body.getReader(); const dec = new TextDecoder()
      let buf = '', out = ''
      for (;;) {
        const { value, done } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const ev = JSON.parse(line.slice(5).trim())
            if (ev.type === 'response.output_text.delta') { out += ev.delta; setBio(out) }
            if (ev.type === 'error' || ev.type === 'response.failed') throw new Error(ev.error?.message || ev.response?.error?.message || 'The AI stopped unexpectedly.')
          } catch (e) { if (e instanceof Error && !(e instanceof SyntaxError)) throw e }
        }
      }
      if (!out.trim()) throw new Error('The AI returned no text.')
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally { setBusy(false); abortRef.current = null }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interests</label>
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground">
              {i}
              <button type="button" aria-label={`Remove ${i}`} onClick={() => setInterests(interests.filter((x) => x !== i))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <input
          value={tag} onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
          onBlur={addTag} placeholder="Type an interest and press Enter"
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</label>
        <textarea
          value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1500}
          placeholder="Write a rough bio — a few words is fine"
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button" onClick={busy ? () => abortRef.current?.abort() : write}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
        >
          {busy ? <><Square className="w-3.5 h-3.5" /> Stop</> : <><Sparkles className="w-3.5 h-3.5" /> Polish with AI</>}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">You can edit the result before saving.</p>
      </div>
    </div>
  )
}
