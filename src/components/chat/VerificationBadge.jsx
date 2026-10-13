import { useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const cache = new Map()

export function useVerificationBadge(userId) {
  const [level, setLevel] = useState(cache.get(userId) || 'none')
  useEffect(() => {
    if (!supabase || !userId) return
    if (cache.has(userId)) { setLevel(cache.get(userId)); return }
    supabase.rpc('get_verification_badge', { _user_id: userId }).then(({ data }) => {
      const value = data || 'none'
      cache.set(userId, value)
      setLevel(value)
    })
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
