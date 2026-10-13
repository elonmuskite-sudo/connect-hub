import { playNotificationTone } from './notification-tones'
import { readFromStorageQuick } from './settings-store'

function createNotification(detail) {
  if (typeof window === 'undefined') return

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(detail.title, {
        body: detail.preview,
        icon: detail.avatarUrl || '/logo.png',
      })
    } catch {
      // Ignore OS notification failures.
    }
  }
}

function playNotificationSound() {
  if (typeof window === 'undefined') return
  const enabled = readFromStorageQuick('notificationSound', true)
  if (!enabled) return
  const tone = readFromStorageQuick('notificationTone', 'chime')
  const volume = readFromStorageQuick('notificationVolume', 0.5)
  playNotificationTone(tone, volume)
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      return Notification.permission
    }
  }
  return Notification.permission
}

export function showIncomingNotification({ title, preview, avatarUrl, type = 'message' }) {
  const detail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    preview,
    avatarUrl: avatarUrl || '/logo.png',
    type,
  }

  window.dispatchEvent(new CustomEvent('nexus:incoming-notification', { detail }))
  createNotification(detail)
  playNotificationSound()
}

export function showSystemNotification({ title, preview, avatarUrl, type = 'system' }) {
  const detail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    preview,
    avatarUrl: avatarUrl || '/logo.png',
    type,
  }

  window.dispatchEvent(new CustomEvent('nexus:system-notification', { detail }))
  createNotification(detail)
  playNotificationSound()
}
