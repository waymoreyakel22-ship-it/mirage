import { useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { DEFAULT_FOLDERS, INITIAL_MEDIA } from '../data/media'
import { formatSize, kindFromName } from '../lib/format'
import type { Asset, BinView, Folder } from '../types'

const isDefaultFolder = (id: string) => DEFAULT_FOLDERS.some(f => f.id === id)
const isTypeFolder = (id: string): id is 'video' | 'music' | 'images' =>
  id === 'video' || id === 'music' || id === 'images'

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
    const added: Asset[] = files.map((f, i) => ({
      id: `a${Date.now()}_${i}`,
      name: f.name,
      kind: kindFromName(f.name),
      sub: formatSize(f.size),
      folderId: isDefaultFolder(activeFolderId) ? undefined : activeFolderId,
    }))
    if (added.length) setMedia(prev => [...prev, ...added])
    e.target.value = ''
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

  // The asset payload rides in application/json; its kind also rides in a custom
  // MIME type so drop targets can read it during dragover (when getData is blocked).
  function onAssetDragStart(e: ReactDragEvent, asset: Asset) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/json', JSON.stringify(asset))
    e.dataTransfer.setData(`application/x-mirage-${asset.kind}`, '1')
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
