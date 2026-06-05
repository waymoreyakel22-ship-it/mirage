export type CenterMode = 'timeline' | 'ai-editor' | 'color' | 'audio'
export type RightTab   = 'suggestions' | 'style' | 'clip'
export type Tool       = 'select' | 'cut' | 'razor' | 'magnet' | 'ripple' | 'zoom-in' | 'zoom-out'
export type Kind       = 'video' | 'music' | 'images'
export type BinView    = 'grid' | 'list'

export type Folder = { id: string; name: string; locked: boolean }
export type Asset  = { id: string; name: string; kind: Kind; sub: string; folderId?: string }
