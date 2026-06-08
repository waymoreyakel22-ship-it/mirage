import { useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { DEFAULT_FOLDERS, INITIAL_MEDIA } from '../data/media'
import { formatSize, formatTimecode, kindFromName, parseClockToSeconds } from '../lib/format'
import type { Asset, BinView, Folder, Kind } from '../types'

const isDefaultFolder = (id: string) => DEFAULT_FOLDERS.some(f => f.id === id)
const isTypeFolder = (id: string): id is 'video' | 'music' | 'images' =>
  id === 'video' || id === 'music' || id === 'images'

// Read a local file's real duration via a throwaway media element. Resolves null
// for images or unreadable files. The object URL is revoked once metadata loads.
function readMediaDuration(file: File, kind: Kind): Promise<number | null> {
  return new Promise(resolve => {
    if (kind !== 'video' && kind !== 'music') return resolve(null)
    const el = document.createElement(kind === 'video' ? 'video' : 'audio')
    el.preload = 'metadata'
    const done = (v: number | null) => {
      URL.revokeObjectURL(el.src)
      resolve(v)
    }
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null)
    el.onerror = () => done(null)
    el.src = URL.createObjectURL(file)
  })
}

export function useMediaBin() {
  const [folders, setFolders]           = useState<Folder[]>(DEFAULT_FOLDERS)
  const [media, setMedia]               = useState<Asset[]>(INITIAL_MEDIA)
  const [activeFolderId, setActiveFolder] = useState('all')
  const [binView, setBinView]           = useState<BinView>('grid')
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  const [menu, setMenu]                 = useState<{ x: number; y: number } | null>(null)
  const [draggingId, setDraggingId]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const close = () => setMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const visibleAssets = media.filter(a => {
    if (activeFolderId === 'all') return true
    if (isTypeFolder(activeFolderId)) return a.kind === activeFolderId
    return a.folderId === activeFolderId
  })

  function newFolder() {
    const id = `f${Date.now()}`
    setFolders(prev => [...prev, { id, name: 'New folder', locked: false }])
    setActiveFolder(id)
    setRenamingId(id)
    setRenameValue('New folder')
  }

  function commitRename() {
    if (!renamingId) return
    setFolders(prev => prev.map(f =>
      f.id === renamingId ? { ...f, name: renameValue.trim() || f.name } : f,
    ))
    setRenamingId(null)
  }

  function onFilesPicked(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return

    const entries = files.map((f, i) => {
      const kind = kindFromName(f.name)
      const asset: Asset = {
        id: `a${Date.now()}_${i}`,
        name: f.name,
        kind,
        sub: formatSize(f.size), // placeholder until real duration loads (A/V)
        folderId: isDefaultFolder(activeFolderId) ? undefined : activeFolderId,
      }
      return { asset, file: f, kind }
    })
    setMedia(prev => [...prev, ...entries.map(en => en.asset)])

    // Swap file size → real duration for audio/video once metadata is read.
    for (const { asset, file, kind } of entries) {
      readMediaDuration(file, kind).then(dur => {
        if (dur == null) return
        setMedia(prev => prev.map(m => (m.id === asset.id ? { ...m, sub: formatTimecode(dur) } : m)))
      })
    }
  }

  function openMenu(e: ReactMouseEvent) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  function importFiles() {
    setMenu(null)
    fileInputRef.current?.click()
  }

  function startRename(folder: Folder) {
    setRenamingId(folder.id)
    setRenameValue(folder.name)
  }

  // The asset payload rides in application/json; its kind and duration also ride
  // in custom MIME type names so drop targets can read them during dragover (when
  // getData is blocked) — the kind gates the track, the duration sizes the ghost.
  function onAssetDragStart(e: ReactDragEvent, asset: Asset) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/json', JSON.stringify(asset))
    e.dataTransfer.setData(`application/x-mirage-kind-${asset.kind}`, '1')
    const durSec = parseClockToSeconds(asset.sub)
    if (!Number.isNaN(durSec)) e.dataTransfer.setData(`application/x-mirage-dur-${durSec}`, '1')
    setDraggingId(asset.id)
  }

  function onAssetDragEnd() {
    setDraggingId(null)
  }

  return {
    folders, visibleAssets, binView, setBinView,
    activeFolderId, setActiveFolder,
    renamingId, renameValue, setRenameValue, commitRename, startRename, setRenamingId,
    menu, openMenu, newFolder, importFiles,
    fileInputRef, onFilesPicked,
    draggingId, onAssetDragStart, onAssetDragEnd,
  }
}
