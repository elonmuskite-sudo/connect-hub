import { supabase } from './supabase'

export const USDT_TIERS = [
  { id: 'plus_50', label: '+50 GB', amount: '1.99' },
  { id: 'plus_200', label: '+200 GB', amount: '4.99' },
  { id: 'plus_1000', label: '+1 TB', amount: '14.99' },
]

export async function getPaymentSettings() {
  const { data, error } = await supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  if (!data) return null
  let qrUrl = null
  if (data.qr_image_url) {
    const { data: s } = await supabase.storage.from('payment-qr').createSignedUrl(data.qr_image_url, 3600)
    qrUrl = s?.signedUrl || null
  }
  return { ...data, qrUrl }
}
