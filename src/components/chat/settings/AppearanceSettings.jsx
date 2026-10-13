import { useSetting } from '../../../hooks/useSetting'
import { WALLPAPERS } from '../../../lib/wallpapers'
import SettingsRow from './SettingsRow'
import { Check, Image } from 'lucide-react'

export default function AppearanceSettings() {
  const [chatWallpaper, setChatWallpaper] = useSetting('chatWallpaper', 'nature')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Change Chat Wallpaper
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose from open-source wallpapers. All patterns are CC0 licensed.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {WALLPAPERS.map(wallpaper => {
            const isSelected = chatWallpaper === wallpaper.id
            return (
              <button
                key={wallpaper.id}
                onClick={() => setChatWallpaper(wallpaper.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div
                  className="w-full h-full"
                  style={
                    wallpaper.url
                      ? {
                          backgroundImage: `url(${wallpaper.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : { background: wallpaper.preview }
                  }
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-blue-600 rounded-full p-1">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-xs text-white truncate">{wallpaper.name}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <SettingsRow label="Selected Wallpaper">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {WALLPAPERS.find(w => w.id === chatWallpaper)?.name || 'Default'}
        </span>
      </SettingsRow>
    </div>
  )
}
