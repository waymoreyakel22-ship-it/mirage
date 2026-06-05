import type { Asset, Folder, Kind } from '../types'

export const ASSET_ICONS: Record<Kind, string> = {
  video:  '▶',
  music:  '♪',
  images: '◰',
}

export const DEFAULT_FOLDERS: Folder[] = [
  { id: 'all',    name: 'All media', locked: true },
  { id: 'video',  name: 'Video',     locked: true },
  { id: 'music',  name: 'Music',     locked: true },
  { id: 'images', name: 'Images',    locked: true },
]

export const INITIAL_MEDIA: Asset[] = [
  { id: 'm1',  name: 'Interview_raw.mp4', kind: 'video',  sub: '12:04'  },
  { id: 'm2',  name: 'B-roll_park.mp4',   kind: 'video',  sub: '3:21'   },
  { id: 'm3',  name: 'Cutaway_01.mp4',    kind: 'video',  sub: '0:18'   },
  { id: 'm4',  name: 'Intro_shot.mp4',    kind: 'video',  sub: '0:42'   },
  { id: 'm5',  name: 'Main_theme.mp3',    kind: 'music',  sub: '2:30'   },
  { id: 'm6',  name: 'Ambient_loop.mp3',  kind: 'music',  sub: '1:00'   },
  { id: 'm7',  name: 'SFX_whoosh.wav',    kind: 'music',  sub: '0:02'   },
  { id: 'm8',  name: 'Outro_sting.mp3',   kind: 'music',  sub: '0:08'   },
  { id: 'm9',  name: 'Logo_white.png',    kind: 'images', sub: '48 KB'  },
  { id: 'm10', name: 'Lower_third.png',   kind: 'images', sub: '120 KB' },
  { id: 'm11', name: 'BG_gradient.jpg',   kind: 'images', sub: '1.2 MB' },
  { id: 'm12', name: 'Overlay_vhs.png',   kind: 'images', sub: '320 KB' },
]
