import { useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { appwriteData, isAppwriteAuthEnabled } from '../../lib/appwrite'

const cache = new Map()

export function useVerificationBadge(userId) {
  const [level, setLevel] = useState(cache.get(userId) || 'none')
  useEffect(() => {
    if ((!supabase && !isAppwriteAuthEnabled()) || !userId) return
    if (cache.has(userId)) { setLevel(cache.get(userId)); return }
    const load = isAppwriteAuthEnabled()
      ? appwriteData('verification.badge', { userId }).then(({ badge }) => badge)
      : supabase.rpc('get_verification_badge', { _user_id: userId }).then(({ data, error }) => {
        if (error) throw error
        return data
      })
    load.then((badge) => {
      const value = badge || 'none'
      cache.set(userId, value)
      setLevel(value)
    }).catch((error) => console.error('Could not load verification badge', error))
  }, [userId])
  return level
}

// eslint-disable-next-line react/prop-types
export default function VerificationBadge({ userId, className = 'w-4 h-4' }) {
  const level = useVerificationBadge(userId)
  if (level === 'authenticated') {
    return <BadgeCheck aria-label="Authenticated" className={`${className} fill-badge-gold text-background`} />
  }
  if (level === 'verified') {
    return <BadgeCheck aria-label="Verified" className={`${className} fill-badge-blue text-background`} />
  }
  return null
}
