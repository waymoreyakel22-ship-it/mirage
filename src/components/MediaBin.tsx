import type { DragEvent } from 'react'
import { ASSET_ICONS } from '../data/media'
import { useMediaBin } from '../hooks/useMediaBin'
import type { Asset } from '../types'
import './MediaBin.css'

export function MediaBin() {
  const bin = useMediaBin()

  return (
    <div className="media-bin">
      <div className="bin-toolbar">
        <span className="bin-title">Media pool</span>
        <span className="flex-spacer" />
        <button className="bin-view-btn" title="Import files" onClick={bin.importFiles}>⤓</button>
        <button
          className={`bin-view-btn${bin.binView === 'grid' ? ' active' : ''}`}
          title="Grid view"
          onClick={() => bin.setBinView('grid')}
        >▦</button>
        <button
          className={`bin-view-btn${bin.binView === 'list' ? ' active' : ''}`}
          title="List view"
          onClick={() => bin.setBinView('list')}
        >≣</button>
      </div>

      <div className="bin-body">
        <div className="folder-tree">
          <div className="folder-list">
            {bin.folders.map(f => (
              bin.renamingId === f.id ? (
                <input
                  key={f.id}
                  className="folder-rename"
                  autoFocus
                  value={bin.renameValue}
                  onChange={e => bin.setRenameValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onBlur={bin.commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') bin.commitRename()
                    if (e.key === 'Escape') bin.setRenamingId(null)
                  }}
                />
              ) : (
                <button
                  key={f.id}
                  className={`folder-item${bin.activeFolderId === f.id ? ' active' : ''}`}
                  title={f.name}
                  onClick={() => bin.setActiveFolder(f.id)}
                  onDoubleClick={() => bin.startRename(f)}
                >
                  <span className="folder-icon">▸</span>
                  <span className="folder-name">{f.name}</span>
                </button>
              )
            ))}
          </div>
          <button className="new-folder-btn" onClick={bin.newFolder}>+ New folder</button>
        </div>

        <div className="bin-contents" onContextMenu={bin.openMenu}>
          {bin.visibleAssets.length === 0 ? (
            <div className="bin-empty">No media — right-click to import</div>
          ) : bin.binView === 'grid' ? (
            <div className="bin-grid">
              {bin.visibleAssets.map(a => (
                <BinItem
                  key={a.id}
                  asset={a}
                  dragging={bin.draggingId === a.id}
                  onDragStart={bin.onAssetDragStart}
                  onDragEnd={bin.onAssetDragEnd}
                />
              ))}
            </div>
          ) : (
            <div className="bin-listview">
              {bin.visibleAssets.map(a => (
                <BinItem
                  key={a.id}
                  asset={a}
                  list
                  dragging={bin.draggingId === a.id}
                  onDragStart={bin.onAssetDragStart}
                  onDragEnd={bin.onAssetDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <input ref={bin.fileInputRef} type="file" multiple hidden onChange={bin.onFilesPicked} />

      {bin.menu && (
        <div className="ctx-menu" style={{ left: bin.menu.x, top: bin.menu.y }}>
          <button className="ctx-item" onClick={bin.importFiles}>Import files</button>
          <button className="ctx-item" onClick={bin.newFolder}>New folder</button>
        </div>
      )}
    </div>
  )
}

type BinItemProps = {
  asset: Asset
  list?: boolean
  dragging: boolean
  onDragStart: (e: DragEvent, asset: Asset) => void
  onDragEnd: () => void
}

function BinItem({ asset, list, dragging, onDragStart, onDragEnd }: BinItemProps) {
  const thumb = (
    <div className="bin-thumb">
      <span className="bin-thumb-icon">{ASSET_ICONS[asset.kind]}</span>
    </div>
  )
  return (
    <div
      className={`bin-item${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, asset)}
      onDragEnd={onDragEnd}
    >
      {thumb}
      {list ? (
        <div className="bin-text">
          <div className="bin-name">{asset.name}</div>
          <div className="bin-sub">{asset.sub}</div>
        </div>
      ) : (
        <>
          <div className="bin-name">{asset.name}</div>
          <div className="bin-sub">{asset.sub}</div>
        </>
      )}
    </div>
  )
}
