import { useState, useCallback } from 'react'
import { useSetting } from '../../../hooks/useSetting'
import { listNotificationTones, playNotificationTone } from '../../../lib/notification-tones'
import { Volume2, VolumeX, Bell, Play, Check } from 'lucide-react'
import SettingsRow from './SettingsRow'
import * as Switch from '@radix-ui/react-switch'

export default function NotificationsSettings() {
  const [notificationSound, setNotificationSound] = useSetting('notificationSound', true)
  const [notificationTone, setNotificationTone] = useSetting('notificationTone', 'chime')
  const [notificationVolume, setNotificationVolume] = useSetting('notificationVolume', 0.5)
  const [playingId, setPlayingId] = useState(null)

  const tones = listNotificationTones()

  const handlePreviewTone = useCallback(async (toneId) => {
    setPlayingId(toneId)
    await playNotificationTone(toneId, notificationVolume)
    setTimeout(() => setPlayingId((curr) => (curr === toneId ? null : curr)), 650)
  }, [notificationVolume])

  const handleToggleSound = useCallback((checked) => {
    setNotificationSound(checked)
    if (checked) {
      playNotificationTone(notificationTone, notificationVolume)
    }
  }, [setNotificationSound, notificationTone, notificationVolume])

  const handleSelectTone = useCallback((toneId) => {
    setNotificationTone(toneId)
    handlePreviewTone(toneId)
  }, [setNotificationTone, handlePreviewTone])

  return (
    <div className="space-y-8">
      <SettingsRow
        label="Notification sounds"
        description="Play a tone when a new notification appears"
        icon={<Bell className="w-5 h-5" />}
      >
        <div className="flex items-center justify-between gap-4 py-1 w-full">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {notificationSound ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            <span>{notificationSound ? 'Enabled' : 'Muted'}</span>
          </div>
          <Switch.Root
            checked={notificationSound}
            onCheckedChange={handleToggleSound}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
          >
            <Switch.Thumb
              className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0`}
            />
          </Switch.Root>
        </div>
      </SettingsRow>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Notification tone</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose the sound that plays for incoming popups and system notifications.</p>
          </div>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-2"
          aria-label="Notification tone selection"
        >
          {tones.map((tone) => {
            const selected = notificationTone === tone.id
            const isPlaying = playingId === tone.id
            const disabled = !notificationSound && !selected
            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => handleSelectTone(tone.id)}
                disabled={disabled}
                className={`group relative flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm'
                    : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium truncate ${selected ? 'text-primary' : 'text-foreground'}`}>{tone.name}</p>
                    {selected && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{tone.description}</p>
                </div>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    isPlaying
                      ? 'border-primary bg-primary text-primary-foreground animate-pulse'
                      : 'border-border bg-muted text-muted-foreground group-hover:border-primary group-hover:text-primary'
                  }`}
                  aria-label={`Preview ${tone.name}`}
                >
                  <Play className="w-4 h-4" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <SettingsRow
        label="Notification volume"
        description="How loud to play notification tones"
        icon={<Volume2 className="w-5 h-5" />}
      >
        <div className="w-full py-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={notificationVolume}
                onChange={(e) => setNotificationVolume(parseFloat(e.target.value))}
                onMouseUp={() => playNotificationTone(notificationTone, notificationVolume)}
                onKeyUp={() => playNotificationTone(notificationTone, notificationVolume)}
                className="w-48 sm:w-64 accent-primary"
                aria-label="Notification volume"
              />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium tabular-nums text-muted-foreground w-12 text-right">
              {Math.round(notificationVolume * 100)}%
            </span>
          </div>
        </div>
      </SettingsRow>
    </div>
  )
}
