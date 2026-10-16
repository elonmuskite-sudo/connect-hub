import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

const Body = z.object({
  name: z.string().max(120).optional().default(''),
  interests: z.array(z.string().min(1).max(60)).max(20).default([]),
  draft: z.string().max(1500).optional().default(''),
})

const json = (b: unknown, status: number) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = req.headers.get('Authorization') || ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await sb.auth.getUser(auth.replace('Bearer ', ''))
  if (!user) return json({ error: 'Please sign in first.' }, 401)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, 400)
  const { name, interests, draft } = parsed.data
  if (!interests.length && !draft.trim()) return json({ error: 'Add some interests or a rough bio first.' }, 400)

  const key = Deno.env.get('LOVABLE_API_KEY')
  if (!key) return json({ error: 'AI is not configured.' }, 500)

  const input = [
    { role: 'system', content: 'You write short, warm, first-person profile bios for a chat app called Nexus. 2-3 sentences, under 300 characters, no hashtags, no emojis unless the user used them, no invented facts. Reply with the bio text only.' },
    { role: 'user', content: `Name: ${name || '(not given)'}\nInterests: ${interests.join(', ') || '(none)'}\nRough bio: ${draft || '(none)'}` },
  ]

  try {
    const runId = req.headers.get('X-Lovable-AIG-Run-ID') || undefined
    const r = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json', 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch',
        ...(runId ? { 'X-Lovable-AIG-Run-ID': runId } : {}),
      },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', input, stream: true, store: false,
        reasoning: { effort: 'low', summary: 'auto' }, include: ['reasoning.encrypted_content'],
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      let msg = 'The AI could not write a bio right now.'
      try { msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || msg } catch { /* ignore */ }
      if (r.status === 429) msg = 'Too many requests — please wait a moment and try again.'
      if (r.status === 402) msg = 'AI credits are used up for this workspace.'
      return json({ error: msg }, r.status)
    }
    const headers = new Headers({ ...corsHeaders, 'Content-Type': 'text/event-stream' })
    r.headers.forEach((v, k) => { if (k.toLowerCase().startsWith('x-lovable-aig-')) headers.set(k, v) })
    return new Response(r.body, { status: 200, headers })
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders })
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
