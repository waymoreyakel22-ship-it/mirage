import { createContext, useContext, useState, type ReactNode } from 'react'

export type SelectedClip = {
  id: string
  name: string
  trackLabel: string
  kind: string
  startSec: number
  durationSec: number
}

type SelectionValue = {
  selectedClip: SelectedClip | null
  setSelectedClip: (clip: SelectedClip | null) => void
}

const SelectionContext = createContext<SelectionValue | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedClip, setSelectedClip] = useState<SelectedClip | null>(null)
  return (
    <SelectionContext.Provider value={{ selectedClip, setSelectedClip }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider')
  return ctx
}
