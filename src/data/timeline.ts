import type { Tool } from '../types'

export const TRACKS = [
  { id: 'v2', label: 'V2', color: '#5E8B7E', accepts: 'video' },
  { id: 'v1', label: 'V1', color: '#7079A8', accepts: 'video' },
  { id: 'a1', label: 'A1', color: '#9A8662', accepts: 'music' },
  { id: 'a2', label: 'A2', color: '#9B6B7D', accepts: 'music' },
] as const

export const CLIPS: Record<string, { left: number; width: number; label: string }[]> = {
  v2: [{ left: 15, width: 18, label: 'Title card' }],
  v1: [
    { left: 0,  width: 45, label: 'Interview_raw.mp4' },
    { left: 50, width: 30, label: 'B-roll_park.mp4'  },
  ],
  a1: [{ left: 0, width: 60, label: 'Main_theme.mp3' }],
  a2: [
    { left: 20, width: 12, label: 'SFX_whoosh.wav' },
    { left: 50, width:  9, label: 'SFX_whoosh.wav' },
  ],
}

export const RULER_MARKS = ['0:00', '0:05', '0:10', '0:15', '0:20', '0:25', '0:30']

export const TOOLS: { id: Tool; label: string; glyph: string }[] = [
  { id: 'select',   label: 'Select',        glyph: '↖' },
  { id: 'cut',      label: 'Cut',           glyph: '✂' },
  { id: 'razor',    label: 'Razor',         glyph: '⌿' },
  { id: 'magnet',   label: 'Snap',          glyph: '⊕' },
  { id: 'ripple',   label: 'Ripple delete', glyph: '⊘' },
  { id: 'zoom-in',  label: 'Zoom in',       glyph: '+' },
  { id: 'zoom-out', label: 'Zoom out',      glyph: '−' },
]
