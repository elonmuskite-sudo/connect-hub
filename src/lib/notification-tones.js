const TONES = {
  chime: {
    id: 'chime',
    name: 'Chime',
    description: 'Bright 2-note chime',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      playOsc(actx, master, 'sine', 880, now, 0.18, 0.35)
      playOsc(actx, master, 'sine', 1318.5, now + 0.12, 0.22, 0.35)
    },
  },
  ding: {
    id: 'ding',
    name: 'Ding',
    description: 'Short classic ding',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      playOsc(actx, master, 'triangle', 1174.66, now, 0.18, 0.45)
      playOsc(actx, master, 'sine', 1760, now + 0.04, 0.2, 0.2)
    },
  },
  ping: {
    id: 'ping',
    name: 'Ping',
    description: 'Gentle digital ping',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      playOsc(actx, master, 'sine', 1046.5, now, 0.12, 0.28)
    },
  },
  bubble: {
    id: 'bubble',
    name: 'Bubble',
    description: 'Playful rising bubble',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      const osc = actx.createOscillator()
      const g = actx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.28)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.55, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
      osc.connect(g)
      g.connect(master)
      osc.start(now)
      osc.stop(now + 0.34)
    },
  },
  bell: {
    id: 'bell',
    name: 'Bell',
    description: 'Warm 3-note bell',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      playOsc(actx, master, 'sine', 783.99, now, 0.55, 0.22)
      playOsc(actx, master, 'sine', 987.77, now + 0.08, 0.45, 0.18)
      playOsc(actx, master, 'sine', 1318.5, now + 0.16, 0.4, 0.18)
    },
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Discreet soft pulse',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      playOsc(actx, master, 'sine', 523.25, now, 0.1, 0.22)
      playOsc(actx, master, 'sine', 659.25, now + 0.15, 0.1, 0.22)
    },
  },
  pop: {
    id: 'pop',
    name: 'Pop',
    description: 'Snappy wooden pop',
    play(actx, { volume = 0.5, dest = null } = {}) {
      const master = actx.createGain()
      master.gain.value = volume
      master.connect(dest || actx.destination)

      const now = actx.currentTime
      const osc = actx.createOscillator()
      const g = actx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(1800, now)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.7, now + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.connect(g)
      g.connect(master)
      osc.start(now)
      osc.stop(now + 0.14)
    },
  },
  silent: {
    id: 'silent',
    name: 'Silent',
    description: 'No sound',
    play() {},
  },
}

function playOsc(actx, dest, type, freq, when, duration, peak) {
  const osc = actx.createOscillator()
  const gain = actx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(when)
  osc.stop(when + duration + 0.03)
}

export const NOTIFICATION_TONES = Object.values(TONES)

let sharedCtx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx || sharedCtx.state === 'closed') {
    try {
      sharedCtx = new Ctx()
    } catch {
      return null
    }
  }
  return sharedCtx
}

export async function playNotificationTone(toneId = 'chime', volume = 0.5) {
  if (typeof navigator !== 'undefined'
    && navigator.userActivation
    && !navigator.userActivation.hasBeenActive) {
    return false
  }

  const ctx = getCtx()
  if (!ctx) return false

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
  } catch {
    // Resume can be rejected without a user gesture; still attempt playback.
  }

  const tone = TONES[toneId] || TONES.chime
  try {
    tone.play(ctx, { volume: Math.max(0, Math.min(1, volume)) })
    return true
  } catch {
    return false
  }
}

export function listNotificationTones() {
  return NOTIFICATION_TONES.map((t) => ({ id: t.id, name: t.name, description: t.description }))
}
