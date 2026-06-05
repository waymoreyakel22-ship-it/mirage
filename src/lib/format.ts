import type { Kind } from '../types'

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v']
const AUDIO_EXT = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a']

export function kindFromName(name: string): Kind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (AUDIO_EXT.includes(ext)) return 'music'
  return 'images'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

/** "m:ss" or "h:mm" → seconds; NaN if not a clock value (e.g. "48 KB"). */
export function parseClockToSeconds(value: string): number {
  const m = /^(\d+):(\d{1,2})$/.exec(value.trim())
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN
}

/** seconds → "m:ss" */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
