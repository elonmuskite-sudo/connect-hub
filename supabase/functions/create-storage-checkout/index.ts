import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { STORAGE_TIERS } from '../_shared/storage-tiers.ts'

const Body = z.object({ tier: z.string(), returnUrl: z.string().url() })
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY')
    if (!apiKey) return json({ error: 'Payments are not set up yet.' }, 503)

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Sign in required.' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Sign in required.' }, 401)

    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const tier = STORAGE_TIERS[parsed.data.tier]
    if (!tier) return json({ error: 'Unknown storage plan.' }, 400)

    const { data: purchase, error: insErr } = await admin.from('storage_purchases').insert({
      user_id: user.id, tier: parsed.data.tier, added_bytes: tier.addedBytes,
      amount_cents: tier.amountCents, currency: 'usd', status: 'pending',
    }).select('id').single()
    if (insErr) return json({ error: insErr.message }, 500)

    const res = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: tier.amountCents / 100,
        price_currency: 'usd',
        order_id: purchase.id,
        order_description: tier.label,
        ipn_callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/nowpayments-webhook`,
        success_url: `${parsed.data.returnUrl}?purchase=success`,
        cancel_url: `${parsed.data.returnUrl}?purchase=cancelled`,
      }),
    })
    const invoice = await res.json()
    if (!res.ok || !invoice?.invoice_url) {
      await admin.from('storage_purchases').update({ status: 'failed' }).eq('id', purchase.id)
      return json({ error: invoice?.message || 'Checkout failed.' }, 502)
    }
    await admin.from('storage_purchases').update({ checkout_session_id: String(invoice.id), receipt_url: invoice.invoice_url }).eq('id', purchase.id)
    return json({ url: invoice.invoice_url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
