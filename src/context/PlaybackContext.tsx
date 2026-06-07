import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { TIMELINE_SECONDS } from '../data/timeline'
import { clamp } from '../lib/format'

type PlaybackValue = {
  playheadSec: number
  setPlayheadSec: (s: number) => void
  playing: boolean
  toggle: () => void
  durationSec: number
}

const PlaybackContext = createContext<PlaybackValue | null>(null)

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [playheadSec, setPlayheadState] = useState(0)
  const [playing, setPlaying] = useState(false)

  const playheadRef = useRef(0)
  playheadRef.current = playheadSec

  const setPlayheadSec = useCallback((s: number) => {
    setPlayheadState(clamp(s, 0, TIMELINE_SECONDS))
  }, [])

  // Advance the playhead in real time while playing; stop at the end.
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const next = playheadRef.current + (now - last) / 1000
      last = now
      if (next >= TIMELINE_SECONDS) {
        setPlayheadState(TIMELINE_SECONDS)
        setPlaying(false)
        return
      }
      setPlayheadState(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toggle = useCallback(() => {
    setPlaying(p => {
      if (!p && playheadRef.current >= TIMELINE_SECONDS - 0.001) setPlayheadState(0) // restart from end
      return !p
    })
  }, [])

  return (
    <PlaybackContext.Provider value={{ playheadSec, setPlayheadSec, playing, toggle, durationSec: TIMELINE_SECONDS }}>
      {children}
    </PlaybackContext.Provider>
  )
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}
