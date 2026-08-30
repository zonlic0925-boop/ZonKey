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

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLE_SIZE = 6
const HANDLE_HIT = 14
const MIN_BOX_PDF = 4
const MIN_USER_ZOOM = 0.25
const MAX_USER_ZOOM = 5
const ZOOM_STEP = 1.15

function measureContainerInner(container: HTMLElement): { w: number; h: number } {
  const cs = getComputedStyle(container)
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  return {
    w: Math.max(0, container.clientWidth - padX),
    h: Math.max(0, container.clientHeight - padY),
  }
}

function clampBboxToPage(
  bbox: [number, number, number, number],
  pageWidth: number,
  pageHeight: number
): [number, number, number, number] {
  let [x0, y0, x1, y1] = bbox
  const w = x1 - x0
  const h = y1 - y0
  if (w < MIN_BOX_PDF) x1 = x0 + MIN_BOX_PDF
  if (h < MIN_BOX_PDF) y1 = y0 + MIN_BOX_PDF
  x0 = Math.max(0, Math.min(x0, pageWidth - MIN_BOX_PDF))
  y0 = Math.max(0, Math.min(y0, pageHeight - MIN_BOX_PDF))
  x1 = Math.max(x0 + MIN_BOX_PDF, Math.min(x1, pageWidth))
  y1 = Math.max(y0 + MIN_BOX_PDF, Math.min(y1, pageHeight))
  return [x0, y0, x1, y1]
}

function hitTestHandle(
  px: number,
  py: number,
  left: number,
  top: number,
  width: number,
  height: number
): ResizeHandle | null {
  const hs = HANDLE_HIT
  const cx = left + width / 2
  const cy = top + height / 2
  const corners: Array<[ResizeHandle, number, number]> = [
    ['nw', left, top],
    ['ne', left + width, top],
    ['se', left + width, top + height],
    ['sw', left, top + height],
  ]
  for (const [handle, hx, hy] of corners) {
    if (Math.abs(px - hx) <= hs && Math.abs(py - hy) <= hs) return handle
  }
  const edges: Array<[ResizeHandle, number, number]> = [
    ['n', cx, top],
    ['e', left + width, cy],
    ['s', cx, top + height],
    ['w', left, cy],
  ]
  for (const [handle, hx, hy] of edges) {
    if (handle === 'n' || handle === 's') {
      if (Math.abs(py - hy) <= hs && px >= left && px <= left + width) return handle
    } else if (Math.abs(px - hx) <= hs && py >= top && py <= top + height) {
      return handle
    }
  }
  return null
}

function applyBoxDrag(
  startBbox: [number, number, number, number],
  dxPdf: number,
  dyPdf: number,
  pageWidth: number,
  pageHeight: number
): [number, number, number, number] {
  const [x0, y0, x1, y1] = startBbox
  const w = x1 - x0
  const h = y1 - y0
  let nx0 = x0 + dxPdf
  let ny0 = y0 + dyPdf
  nx0 = Math.max(0, Math.min(nx0, pageWidth - w))
  ny0 = Math.max(0, Math.min(ny0, pageHeight - h))
  return [nx0, ny0, nx0 + w, ny0 + h]
}

function applyBoxResize(
  startBbox: [number, number, number, number],
  handle: ResizeHandle,
  dxPdf: number,
  dyPdf: number,
  pageWidth: number,
  pageHeight: number
): [number, number, number, number] {
  let [x0, y0, x1, y1] = startBbox
  if (handle.includes('w')) x0 += dxPdf
  if (handle.includes('e')) x1 += dxPdf
  if (handle.includes('n')) y0 += dyPdf
  if (handle.includes('s')) y1 += dyPdf
  if (x1 < x0) [x0, x1] = [x1, x0]
  if (y1 < y0) [y0, y1] = [y1, y0]
  return clampBboxToPage([x0, y0, x1, y1], pageWidth, pageHeight)
}

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
  onBeginCandidateEdit?: () => void
  onUpdateCandidateBbox?: (id: string, bbox: [number, number, number, number]) => void
  onSelectAll: () => void
  onClearAll: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onExecuteRedact: () => void
  isProcessing: boolean
  isScanning?: boolean
  pagesLoading?: boolean
  previewSyncing?: boolean
  downloadUrl?: string | null
  pdfDownloadUrl?: string | null
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
  hasAfterPreview = false,
  previewMode = 'before',
  onPreviewModeChange,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onToggleCandidate,
  onDeleteCandidate,
  onAddManualBox,
  onBeginCandidateEdit,
  onUpdateCandidateBbox,
  onSelectAll,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExecuteRedact,
  isProcessing,
  isScanning = false,
  pagesLoading = false,
  previewSyncing = false,
  downloadUrl,
  pdfDownloadUrl,
  downloadLabel,
  onNotify,
  showFooterRedactButton = false,
}) => {
  const { t } = useI18n()
  const downloadInfo = parseDownloadUrl(downloadUrl ?? null)
  const pdfOpenInfo = parseDownloadUrl(pdfDownloadUrl ?? null)
  const [userScale, setUserScale] = useState(1)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const [mode, setMode] = useState<'select' | 'rect'>('select')
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [liveBbox, setLiveBbox] = useState<[number, number, number, number] | null>(null)
  const editSessionRef = useRef<{
    id: string
    kind: 'drag' | 'resize'
    handle?: ResizeHandle
    startBbox: [number, number, number, number]
    startPointer: { x: number; y: number }
  } | null>(null)
  const liveBboxRef = useRef<[number, number, number, number] | null>(null)
  const pendingRectStartRef = useRef<{ x: number; y: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const displayPage =
    previewMode === 'after'
      ? afterPageInfo ?? null
      : pageInfo
  const afterPreviewPending = previewMode === 'after' && hasAfterPreview && !afterPageInfo
  const displayKey = `${previewMode}:${displayPage?.image_url ?? ''}:${currentPage}`
  const showBoxes = previewMode === 'before' && !isScanning && !pagesLoading
  const pageCandidates = candidates.filter((c) => c.page_num === currentPage)

  const clampUserScale = useCallback(
    (value: number) => Math.min(MAX_USER_ZOOM, Math.max(MIN_USER_ZOOM, value)),
    []
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const next = measureContainerInner(container)
    if (next.w > 0 && next.h > 0) {
      setViewportSize(next)
    }
  }, [displayKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const updateViewport = () => {
      const next = measureContainerInner(container)
      if (next.w > 0 && next.h > 0) {
        setViewportSize(next)
      }
    }

    updateViewport()
    const ro = new ResizeObserver(updateViewport)
    ro.observe(container)
    return () => ro.disconnect()
  }, [displayKey])

  useEffect(() => {
    setUserScale(1)
    setImageReady(false)
  }, [displayKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setUserScale((s) => clampUserScale(s * factor))
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [clampUserScale, displayKey])

  const switchToBeforeForEdit = () => {
    if (previewMode === 'after' && hasAfterPreview && onPreviewModeChange) {
      onNotify?.(t('canvas.switchToBeforeForManual'), 'info')
      onPreviewModeChange('before')
      return true
    }
    return false
  }

  useEffect(() => {
    if (previewMode !== 'before' || !pendingRectStartRef.current || mode !== 'rect') return
    const pt = pendingRectStartRef.current
    pendingRectStartRef.current = null
    setDrawStart(pt)
    setDrawCurrent(pt)
    setIsDrawing(true)
  }, [mode, previewMode])

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

  const pointerToPdfPoint = (clientX: number, clientY: number) => {
    const pt = pointerToLayout(clientX, clientY)
    if (!pt || !imageMetrics) return null
    return overlayPointerToPdf(pt.x, pt.y, imageMetrics)
  }

  const imageMetrics =
    imageReady && imageRef.current && displayPage
      ? getContainedImageMetrics(imageRef.current, displayPage.width, displayPage.height)
      : null

  const finishBoxEdit = useCallback(() => {
    const session = editSessionRef.current
    const bbox = liveBboxRef.current
    if (session && bbox && onUpdateCandidateBbox) {
      const [sx0, sy0, sx1, sy1] = session.startBbox
      const changed =
        Math.abs(bbox[0] - sx0) > 0.5 ||
        Math.abs(bbox[1] - sy0) > 0.5 ||
        Math.abs(bbox[2] - sx1) > 0.5 ||
        Math.abs(bbox[3] - sy1) > 0.5
      if (changed) {
        onUpdateCandidateBbox(session.id, bbox)
      }
    }
    editSessionRef.current = null
    liveBboxRef.current = null
    setEditingId(null)
    setLiveBbox(null)
  }, [onUpdateCandidateBbox])

  useEffect(() => {
    if (!editingId) return
    const onMove = (e: MouseEvent | PointerEvent) => {
      const session = editSessionRef.current
      if (!session || !imageMetrics || !displayPage) return
      const startPt = overlayPointerToPdf(session.startPointer.x, session.startPointer.y, imageMetrics)
      const curPt = pointerToPdfPoint(e.clientX, e.clientY)
      if (!startPt || !curPt) return
      const dx = curPt.x - startPt.x
      const dy = curPt.y - startPt.y
      const next =
        session.kind === 'drag'
          ? applyBoxDrag(session.startBbox, dx, dy, displayPage.width, displayPage.height)
          : applyBoxResize(
              session.startBbox,
              session.handle!,
              dx,
              dy,
              displayPage.width,
              displayPage.height
            )
      setLiveBbox(next)
      liveBboxRef.current = next
    }
    const onUp = () => finishBoxEdit()
    // pointer + mouse 双通道：触屏只发 pointer，鼠标两者都发（onMove 幂等，重复无害）
    window.addEventListener('pointermove', onMove as (e: Event) => void)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove as (e: Event) => void)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [displayPage, editingId, finishBoxEdit, imageMetrics])

  const beginBoxEdit = (
    box: CandidateBox,
    kind: 'drag' | 'resize',
    handle: ResizeHandle | undefined,
    pointer: { x: number; y: number }
  ) => {
    onBeginCandidateEdit?.()
    onSelectCandidate(box.id)
    const session = {
      id: box.id,
      kind,
      handle,
      startBbox: [...box.bbox] as [number, number, number, number],
      startPointer: pointer,
    }
    editSessionRef.current = session
    liveBboxRef.current = [...box.bbox] as [number, number, number, number]
    setEditingId(box.id)
    setLiveBbox([...box.bbox] as [number, number, number, number])
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
  }, [syncImageMetrics, displayPage?.image_url, candidates.length, isScanning, userScale])

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'rect' || !imageRef.current) return
    // 触屏框选：捕获指针并禁掉浏览器滚动手势，否则 touch-pan 会抢走拖动
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 指针已释放 */ }
    e.preventDefault()
    const pt = pointerToLayout(e.clientX, e.clientY)
    if (!pt) return
    if (previewMode === 'after' && hasAfterPreview) {
      pendingRectStartRef.current = pt
      switchToBeforeForEdit()
      return
    }
    setDrawStart(pt)
    setDrawCurrent(pt)
    setIsDrawing(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !imageRef.current) return
    const pt = pointerToLayout(e.clientX, e.clientY)
    if (!pt) return
    setDrawCurrent(pt)
  }

  const handlePointerUp = () => {
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
          onClick={() => {
            switchToBeforeForEdit()
            setMode('select')
          }}
          title={t('canvas.modeSelect')}
          className={`p-2 md:p-1.5 rounded-md transition-all max-md:zs-touch-target-mobile ${toolBtn(
            mode === 'select',
            'bg-mem-yellow'
          )}`}
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            switchToBeforeForEdit()
            setMode('rect')
          }}
          title={t('canvas.modeRect')}
          className={`p-2 md:p-1.5 rounded-md transition-all max-md:zs-touch-target-mobile ${toolBtn(
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
        disabled={!selectedCandidateId || (previewMode === 'after' && !hasAfterPreview)}
        title={t('canvas.deleteTitle')}
        className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
      >
        <Trash2 className="w-4 h-4 text-mem-coral" />
      </button>

      <button
        onClick={() => {
          switchToBeforeForEdit()
          onUndo()
        }}
        disabled={!canUndo || (previewMode === 'after' && !hasAfterPreview)}
        className="memphis-btn-ghost p-2 md:p-1.5 disabled:opacity-30 max-md:zs-touch-target-mobile"
        title={t('canvas.undo')}
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          switchToBeforeForEdit()
          onRedo()
        }}
        disabled={!canRedo || (previewMode === 'after' && !hasAfterPreview)}
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
          className={`flex-1 min-h-0 min-w-0 overflow-auto flex items-center justify-center p-2 sm:p-4 relative ${
            mode === 'rect' ? 'touch-none' : 'touch-pan-x touch-pan-y'
          }`}
          title={t('canvas.zoomWheelHint')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
        {afterPreviewPending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <div className="px-4 py-2 rounded-xl bg-mem-yellow border-2 border-mem-ink text-xs font-semibold shadow-memphis-sm">
              {t('canvas.previewSyncing')}
            </div>
          </div>
        )}

        {displayPage && viewportSize.w > 0 && viewportSize.h > 0 ? (
          <div
            className="relative rounded-lg border-[3px] border-mem-ink shadow-memphis-lg overflow-hidden bg-white shrink-0"
            style={{
              width: viewportSize.w * userScale,
              height: viewportSize.h * userScale,
            }}
          >
            <img
              key={displayKey}
              ref={imageRef}
              src={displayPage.image_url}
              alt={t('canvas.pageAlt', { page: currentPage })}
              className="block w-full h-full object-contain pointer-events-none select-none"
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

            {pagesLoading && previewMode === 'before' && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
                <div className="px-4 py-2 rounded-xl bg-mem-teal/30 border-2 border-mem-ink text-xs font-semibold shadow-memphis-sm">
                  {t('canvas.pagesLoading')}
                </div>
              </div>
            )}

            {isScanning && previewMode === 'before' && !previewSyncing && !pagesLoading && (
              <div className="absolute top-3 right-3 z-40 flex items-center gap-2 px-2 py-1 rounded-lg bg-white/90 border border-mem-ink/30 shadow-sm text-[10px] font-medium text-mem-ink/70">
                <span className="w-1.5 h-1.5 rounded-full bg-mem-coral animate-pulse" />
                {t('canvas.scanningOverlay')}
              </div>
            )}

            {showBoxes && imageMetrics && (
              <div className="absolute inset-0 pointer-events-auto">
                {pageCandidates.map((box) => {
                  const activeBbox =
                    editingId === box.id && liveBbox ? liveBbox : box.bbox
                  const { left, top, width, height } = pdfBoxToOverlayPixels(activeBbox, imageMetrics)
                  if (width < 1 || height < 1) return null
                  const isIncluded = box.is_selected
                  const isHighlighted = box.id === selectedCandidateId
                  const canEdit = mode === 'select' && !!onUpdateCandidateBbox && previewMode === 'before'
                  const showHandles = canEdit

                  const handlePos = (h: ResizeHandle) => {
                    switch (h) {
                      case 'nw':
                        return { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 }
                      case 'n':
                        return { left: width / 2 - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 }
                      case 'ne':
                        return { left: width - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 }
                      case 'e':
                        return { left: width - HANDLE_SIZE / 2, top: height / 2 - HANDLE_SIZE / 2 }
                      case 'se':
                        return { left: width - HANDLE_SIZE / 2, top: height - HANDLE_SIZE / 2 }
                      case 's':
                        return { left: width / 2 - HANDLE_SIZE / 2, top: height - HANDLE_SIZE / 2 }
                      case 'sw':
                        return { left: -HANDLE_SIZE / 2, top: height - HANDLE_SIZE / 2 }
                      case 'w':
                        return { left: -HANDLE_SIZE / 2, top: height / 2 - HANDLE_SIZE / 2 }
                    }
                  }

                  return (
                    <div
                      key={box.id}
                      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
                      className={`absolute transition-all duration-75 rounded-sm border-2 touch-none ${
                        isIncluded
                          ? 'bg-mem-coral/35 border-mem-coral'
                          : 'bg-mem-teal/15 border-dashed border-mem-ink/40 hover:bg-mem-yellow/30'
                      } ${isHighlighted ? 'ring-2 ring-mem-sky ring-offset-1 z-10' : ''} ${
                        canEdit ? 'cursor-move' : 'cursor-pointer'
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        if (!canEdit || !imageMetrics) {
                          onSelectCandidate(box.id)
                          return
                        }
                        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 指针已释放 */ }
                        const pt = pointerToLayout(e.clientX, e.clientY)
                        if (!pt) return
                        onSelectCandidate(box.id)
                        const handle = hitTestHandle(
                          pt.x - left,
                          pt.y - top,
                          0,
                          0,
                          width,
                          height
                        )
                        if (handle) {
                          beginBoxEdit(box, 'resize', handle, pt)
                        } else {
                          beginBoxEdit(box, 'drag', undefined, pt)
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (editingId) return
                        onSelectCandidate(box.id)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onToggleCandidate(box.id)
                      }}
                    >
                      <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-md bg-mem-ink text-[9px] font-mono text-white whitespace-nowrap pointer-events-none">
                        {box.rule_name}
                        {isIncluded ? ' ✓' : ''}
                      </span>
                      {showHandles &&
                        (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((h) => {
                          const pos = handlePos(h)
                          return (
                            <span
                              key={h}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                if (!canEdit || !imageMetrics) return
                                try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 指针已释放 */ }
                                const pt = pointerToLayout(e.clientX, e.clientY)
                                if (!pt) return
                                beginBoxEdit(box, 'resize', h, pt)
                              }}
                              style={{
                                left: `${pos.left}px`,
                                top: `${pos.top}px`,
                                width: `${HANDLE_SIZE}px`,
                                height: `${HANDLE_SIZE}px`,
                              }}
                              className={`absolute bg-white border border-mem-sky rounded-sm z-30 pointer-events-auto touch-none ${
                                h === 'nw' || h === 'se' ? 'cursor-nwse-resize' :
                                h === 'ne' || h === 'sw' ? 'cursor-nesw-resize' :
                                h === 'n' || h === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'
                              }`}
                            />
                          )
                        })}
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
            onClick={() => setUserScale((s) => clampUserScale(s / ZOOM_STEP))}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomOut')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span
            className="text-xs font-mono text-mem-ink/60 w-12 text-center"
            title={t('canvas.zoomWheelHint')}
          >
            {Math.round(userScale * 100)}%
          </span>
          <button
            onClick={() => setUserScale((s) => clampUserScale(s * ZOOM_STEP))}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomIn')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUserScale(1)}
            className="memphis-btn-ghost p-2 md:p-1.5 max-md:zs-touch-target-mobile"
            title={t('canvas.zoomReset')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {showFooterRedactButton && downloadInfo && (
            <ExportDownloadButton
              info={downloadInfo}
              openInfo={pdfOpenInfo}
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
