import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer,
  Square,
  CheckCheck,
  XSquare,
  Undo2,
  Redo2,
  ShieldCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { CandidateBox, PageInfo } from '../types'
import { parseDownloadUrl, type NotifyFn } from '../lib/api'
import {
  getContainedImageMetrics,
  overlayPointerToPdf,
  pdfBoxToOverlayPixels,
} from '../lib/imageLayout'
import { ExportDownloadButton } from './ExportDownloadButton'
import { useI18n } from '../i18n'

interface CanvasViewportProps {
  currentPage: number
  totalPages: number
  setCurrentPage: (page: number) => void
  pageInfo: PageInfo | null
  afterPageInfo?: PageInfo | null
  hasAfterPreview?: boolean
  previewMode?: 'before' | 'after'
  onPreviewModeChange?: (mode: 'before' | 'after') => void
  candidates: CandidateBox[]
  selectedCandidateId: string | null
  onSelectCandidate: (id: string | null) => void
  onToggleCandidate: (id: string) => void
  onDeleteCandidate: (id: string) => void
  onAddManualBox: (bbox: [number, number, number, number]) => void
  onSelectAll: () => void
  onClearAll: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onExecuteRedact: () => void
  isProcessing: boolean
  isScanning?: boolean
  previewSyncing?: boolean
  downloadUrl?: string | null
  downloadLabel?: string
  onNotify?: NotifyFn
  /** 脱敏按钮改由左侧边栏承载，避免被图纸标题栏/敏感区遮挡 */
  showFooterRedactButton?: boolean
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  currentPage,
  totalPages,
  setCurrentPage,
  pageInfo,
  afterPageInfo = null,
  previewMode = 'before',
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onToggleCandidate,
  onDeleteCandidate,
  onAddManualBox,
  onSelectAll,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExecuteRedact,
  isProcessing,
  isScanning = false,
  previewSyncing = false,
  downloadUrl,
  downloadLabel,
  onNotify,
  showFooterRedactButton = false,
}) => {
  const { t } = useI18n()
  const downloadInfo = parseDownloadUrl(downloadUrl ?? null)
  const [zoom, setZoom] = useState<number>(1)
  const [mode, setMode] = useState<'select' | 'rect'>('select')
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const [imageReady, setImageReady] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const displayPage =
    previewMode === 'after' && afterPageInfo ? afterPageInfo : pageInfo
  const showBoxes = previewMode === 'before' && !isScanning
  const pageCandidates = candidates.filter((c) => c.page_num === currentPage)

  const pointerToLayout = (clientX: number, clientY: number) => {
    const img = imageRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: ((clientX - rect.left) * img.clientWidth) / rect.width,
      y: ((clientY - rect.top) * img.clientHeight) / rect.height,
    }
  }

  const syncImageMetrics = useCallback(() => {
    const img = imageRef.current
    if (!img || !displayPage) return
    if (img.complete && img.naturalWidth > 0 && img.clientWidth > 0 && img.clientHeight > 0) {
      setImageReady(true)
    }
  }, [displayPage])

  useEffect(() => {
    setImageReady(false)
  }, [displayPage?.image_url, currentPage, previewMode])

  useLayoutEffect(() => {
    syncImageMetrics()
  }, [syncImageMetrics, displayPage?.image_url, candidates.length, isScanning, zoom])

  useEffect(() => {
    const img = imageRef.current
    if (!img || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => syncImageMetrics())
    ro.observe(img)
    return () => ro.disconnect()
  }, [syncImageMetrics, displayPage?.image_url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedCandidateId || previewMode === 'after') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteCandidate(selectedCandidateId)
        onSelectCandidate(null)
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        onToggleCandidate(selectedCandidateId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCandidateId, previewMode, onDeleteCandidate, onSelectCandidate, onToggleCandidate])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'rect' || !imageRef.current || previewMode === 'after') return
    const pt = pointerToLayout(e.clientX, e.clientY)
    if (!pt) return
    setDrawStart(pt)
    setDrawCurrent(pt)
    setIsDrawing(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return
    const pt = pointerToLayout(e.clientX, e.clientY)
    if (!pt) return
    setDrawCurrent(pt)
  }

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent || !imageRef.current || !displayPage) {
      setIsDrawing(false)
      return
    }

    const metrics = getContainedImageMetrics(
      imageRef.current,
      displayPage.width,
      displayPage.height
    )
    const x0 = Math.min(drawStart.x, drawCurrent.x)
    const y0 = Math.min(drawStart.y, drawCurrent.y)
    const x1 = Math.max(drawStart.x, drawCurrent.x)
    const y1 = Math.max(drawStart.y, drawCurrent.y)

    const p0 = overlayPointerToPdf(x0, y0, metrics)
    const p1 = overlayPointerToPdf(x1, y1, metrics)
    if (p0 && p1 && Math.abs(p1.x - p0.x) > 2 && Math.abs(p1.y - p0.y) > 2) {
      onAddManualBox([p0.x, p0.y, p1.x, p1.y])
    }

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }

  const imageMetrics =
    imageReady && imageRef.current && displayPage
      ? getContainedImageMetrics(imageRef.current, displayPage.width, displayPage.height)
      : null

  const toolBtn = (active: boolean, accent: string) =>
    active
      ? `${accent} border-2 border-mem-ink shadow-memphis-sm`
      : 'text-mem-ink/50 hover:text-mem-ink'

  const canvasTools = (horizontal: boolean) => (
    <>
      <div
        className={`flex p-0.5 rounded-lg bg-mem-cream border-2 border-mem-ink/20 ${
          horizontal ? 'flex-row' : 'flex-col'
        }`}
      >
        <button
          onClick={() => setMode('select')}
          title={t('canvas.modeSelect')}
          disabled={previewMode === 'after'}
          className={`p-2 md:p-1.5 rounded-md transition-all disabled:opacity-30 max-md:zs-touch-target-mobile ${toolBtn(
            mode === 'select',
            'bg-mem-yellow'
          )}`}
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMode('rect')}
          title={t('canvas.modeRect')}
          disabled={previewMode === 'after'}
          className={`p-2 md:p-1.5 rounded-md transition-all disabled:opacity-30 max-md:zs-touch-target-mobile ${toolBtn(
            mode === 'rect',
            'bg-mem-teal'
          )}`}
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (selectedCandidateId) {
            onDeleteCandidate(selectedCandidateId)
            onSelectCandidate(null)
          }
        }}
        disabled={!selectedCandidateId || previewMode === 'after'}
        title={t('canvas.deleteTitle')}
        className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
      >
        <Trash2 className="w-4 h-4 text-mem-coral" />
      </button>

      <button
        onClick={onUndo}
        disabled={!canUndo || previewMode === 'after'}
        className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
        title={t('canvas.undo')}
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo || previewMode === 'after'}
        className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
        title={t('canvas.redo')}
      >
        <Redo2 className="w-4 h-4" />
      </button>
    </>
  )

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none bg-mem-cream/50 min-h-0">
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* 桌面：左侧工具轨 */}
        <aside className="hidden md:flex shrink-0 w-11 sm:w-12 flex-col items-center gap-1 py-2 px-1 border-r-[3px] border-mem-ink bg-white/95 z-20">
          {canvasTools(false)}
        </aside>

        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 min-h-0 min-w-0 overflow-auto flex items-center justify-center p-2 sm:p-4 relative touch-pan-x touch-pan-y"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
        {displayPage ? (
          <div
            className="relative rounded-lg border-[3px] border-mem-ink shadow-memphis-lg overflow-hidden transition-transform duration-75 bg-white"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <img
              ref={imageRef}
              src={displayPage.image_url}
              alt={t('canvas.pageAlt', { page: currentPage })}
              className="block max-h-full max-w-full w-auto h-auto object-contain pointer-events-none select-none"
              draggable={false}
              onLoad={() => {
                setImageReady(true)
                syncImageMetrics()
              }}
            />

            {previewSyncing && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="px-4 py-2 rounded-xl bg-mem-yellow border-2 border-mem-ink text-xs font-semibold shadow-memphis-sm">
                  {t('canvas.previewSyncing')}
                </div>
              </div>
            )}

            {isScanning && previewMode === 'before' && !previewSyncing && (
              <div className="absolute top-3 right-3 z-40 flex items-center gap-2 px-2 py-1 rounded-lg bg-white/90 border border-mem-ink/30 shadow-sm text-[10px] font-medium text-mem-ink/70">
                <span className="w-1.5 h-1.5 rounded-full bg-mem-coral animate-pulse" />
                {t('canvas.scanningOverlay')}
              </div>
            )}

            {showBoxes && imageMetrics && (
              <div className="absolute inset-0 pointer-events-auto">
                {pageCandidates.map((box) => {
                  const { left, top, width, height } = pdfBoxToOverlayPixels(box.bbox, imageMetrics)
                  if (width < 1 || height < 1) return null
                  const isIncluded = box.is_selected
                  const isHighlighted = box.id === selectedCandidateId

                  return (
                    <div
                      key={box.id}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCandidate(box.id)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onToggleCandidate(box.id)
                      }}
                      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
                      className={`absolute cursor-pointer transition-all duration-150 rounded-sm border-2 ${
                        isIncluded
                          ? 'bg-mem-coral/35 border-mem-coral'
                          : 'bg-mem-teal/15 border-dashed border-mem-ink/40 hover:bg-mem-yellow/30'
                      } ${isHighlighted ? 'ring-2 ring-mem-sky ring-offset-1 z-10' : ''}`}
                    >
                      <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-md bg-mem-ink text-[9px] font-mono text-white whitespace-nowrap pointer-events-none">
                        {box.rule_name}
                        {isIncluded ? ' ✓' : ''}
                      </span>
                    </div>
                  )
                })}

                {isDrawing && drawStart && drawCurrent && (
                  <div
                    style={{
                      left: `${Math.min(drawStart.x, drawCurrent.x)}px`,
                      top: `${Math.min(drawStart.y, drawCurrent.y)}px`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x)}px`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y)}px`,
                    }}
                    className="absolute border-2 border-dashed border-mem-sky bg-mem-sky/25 pointer-events-none z-30"
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 text-mem-ink/50">
            <div className="w-16 h-16 rounded-2xl memphis-card flex items-center justify-center">
              <Layers className="w-8 h-8 text-mem-ink/40" />
            </div>
            <p className="text-sm font-medium">{t('canvas.emptyTitle')}</p>
            <p className="text-xs text-mem-ink/40">{t('canvas.emptyHint')}</p>
          </div>
        )}
        </div>
        </div>
      </div>

      {/* 手机：横向工具条（不遮挡图纸） */}
      <div className="md:hidden shrink-0 flex items-center justify-center gap-1.5 px-2 py-1.5 border-t-2 border-mem-ink/20 bg-white/95 z-20">
        {canvasTools(true)}
      </div>

      <div className="shrink-0 min-h-12 px-2 sm:px-3 py-2 bg-white border-t-[3px] border-mem-ink flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between z-20 gap-2">
        <div className="flex items-center justify-center gap-1.5 shrink-0">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono whitespace-nowrap px-1">
            {t('canvas.footerPage', { current: currentPage, total: totalPages || 1 })}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          <button
            onClick={onSelectAll}
            disabled={previewMode === 'after'}
            title={t('canvas.selectAll')}
            className="memphis-btn-ghost flex items-center gap-1 disabled:opacity-30 px-2 py-2 md:py-1 max-md:zs-touch-target-mobile"
          >
            <CheckCheck className="w-3.5 h-3.5 text-mem-teal" />
            <span className="text-xs hidden sm:inline">{t('canvas.selectAll')}</span>
          </button>
          <button
            onClick={onClearAll}
            disabled={previewMode === 'after'}
            title={t('canvas.clearAll')}
            className="memphis-btn-ghost flex items-center gap-1 disabled:opacity-30 px-2 py-2 md:py-1 max-md:zs-touch-target-mobile"
          >
            <XSquare className="w-3.5 h-3.5 text-mem-coral" />
            <span className="text-xs hidden sm:inline">{t('canvas.clearAll')}</span>
          </button>
          <span className="hidden md:inline text-xs text-mem-ink/60 px-1">
            {t('canvas.footerSelection', {
              selected: candidates.filter((c) => c.is_selected).length,
              total: candidates.length,
            })}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 justify-center">
          <button
            onClick={() => setZoom((p) => Math.max(0.4, p - 0.15))}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomOut')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-mem-ink/60 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((p) => Math.min(3, p + 0.15))}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomIn')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomReset')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {showFooterRedactButton && downloadInfo && (
            <ExportDownloadButton
              info={downloadInfo}
              label={downloadLabel ?? t('export.labelPdf')}
              onNotify={onNotify}
              className="memphis-btn-secondary flex items-center gap-1.5 text-xs ml-1"
            />
          )}
          {showFooterRedactButton && (
            <button
              onClick={onExecuteRedact}
              disabled={
                isProcessing ||
                isScanning ||
                previewMode === 'after' ||
                candidates.filter((c) => c.is_selected).length === 0
              }
              className="memphis-btn-primary flex items-center gap-2 text-xs ml-1"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isProcessing ? t('redact.executing') : isScanning ? t('redact.scanning') : t('redact.execute')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
