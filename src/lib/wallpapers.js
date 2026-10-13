export const WALLPAPERS = [
  {
    id: 'default',
    name: 'Default',
    url: null,
    preview: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    license: 'Built-in',
  },
  {
    id: 'dots',
    name: 'Soft Dots',
    url: '/wallpapers/pattern-dots.svg',
    preview: '/wallpapers/pattern-dots.svg',
    license: 'CC0 — Nexus Chat',
  },
  {
    id: 'waves',
    name: 'Ocean Waves',
    url: '/wallpapers/pattern-waves.svg',
    preview: '/wallpapers/pattern-waves.svg',
    license: 'CC0 — Nexus Chat',
  },
  {
    id: 'geometric',
    name: 'Geometric',
    url: '/wallpapers/pattern-geometric.svg',
    preview: '/wallpapers/pattern-geometric.svg',
    license: 'CC0 — Nexus Chat',
  },
  {
    id: 'nature',
    name: 'Nature Sky',
    url: '/wallpapers/pattern-nature.svg',
    preview: '/wallpapers/pattern-nature.svg',
    license: 'CC0 — Nexus Chat',
  },
  {
    id: 'abstract',
    name: 'Abstract',
    url: '/wallpapers/pattern-abstract.svg',
    preview: '/wallpapers/pattern-abstract.svg',
    license: 'CC0 — Nexus Chat',
  },
]

export function getWallpaperById(id) {
  return WALLPAPERS.find(w => w.id === id) || WALLPAPERS[0]
}
