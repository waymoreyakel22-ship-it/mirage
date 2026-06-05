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
