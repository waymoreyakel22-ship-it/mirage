import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const STEP_COUNT = 3 // matches the log lines in AiThoughts
const STEP_MS = 800

type AiValue = {
  analyzing: boolean
  step: number // active log line index; STEP_COUNT once finished
  done: boolean
  analyze: () => void
  dismiss: () => void
}

const AiContext = createContext<AiValue | null>(null)

export function AiProvider({ children }: { children: ReactNode }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [step, setStep] = useState(-1)
  const [done, setDone] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Fake a multi-step analysis: advance a step every STEP_MS, mark done, then
  // slide the panel away shortly after.
  const analyze = useCallback(() => {
    clearTimers()
    setAnalyzing(true)
    setDone(false)
    setStep(0)
    for (let i = 1; i < STEP_COUNT; i++) {
      timers.current.push(window.setTimeout(() => setStep(i), STEP_MS * i))
    }
    timers.current.push(window.setTimeout(() => {
      setStep(STEP_COUNT)
      setDone(true)
    }, STEP_MS * STEP_COUNT))
    timers.current.push(window.setTimeout(() => setAnalyzing(false), STEP_MS * STEP_COUNT + 1100))
  }, [])

  const dismiss = useCallback(() => {
    clearTimers()
    setAnalyzing(false)
    setDone(false)
    setStep(-1)
  }, [])

  return (
    <AiContext.Provider value={{ analyzing, step, done, analyze, dismiss }}>
      {children}
    </AiContext.Provider>
  )
}

export function useAi() {
  const ctx = useContext(AiContext)
  if (!ctx) throw new Error('useAi must be used within AiProvider')
  return ctx
}
