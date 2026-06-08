import { useRef } from 'react'
import './App.css'
import { Center } from './components/Center'
import { Inspector } from './components/Inspector'
import { ResizeHandle } from './components/ResizeHandle'
import { Sidebar } from './components/Sidebar'
import { AiProvider } from './context/AiContext'
import { PlaybackProvider } from './context/PlaybackContext'
import { SelectionProvider } from './context/SelectionContext'
import { useResizablePanels } from './hooks/useResizablePanels'

export default function App() {
  const centerRef = useRef<HTMLDivElement>(null)
  const tabbarRef = useRef<HTMLDivElement>(null)
  const { sidebarW, rightW, previewH, startDrag } = useResizablePanels(centerRef, tabbarRef)

  return (
    <PlaybackProvider>
    <AiProvider>
    <SelectionProvider>
      <div className="app" style={{ gridTemplateColumns: `${sidebarW}px 1fr ${rightW}px` }}>
        <Sidebar />
        <Center
          previewH={previewH}
          onPreviewResize={e => startDrag('preview', e)}
          centerRef={centerRef}
          tabbarRef={tabbarRef}
        />
        <Inspector />

        <ResizeHandle orientation="col" style={{ left: sidebarW }} onMouseDown={e => startDrag('sidebar', e)} />
        <ResizeHandle orientation="col" side="right" style={{ right: rightW }} onMouseDown={e => startDrag('right', e)} />
      </div>
    </SelectionProvider>
    </AiProvider>
    </PlaybackProvider>
  )
}
