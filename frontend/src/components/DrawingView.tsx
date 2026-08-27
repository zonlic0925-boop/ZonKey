import React, { useRef, useState, useCallback } from 'react'
import { FileListDrawer, FileItem } from './FileListDrawer'
import { CanvasViewport } from './CanvasViewport'
import { ExportSettingsPanel } from './ExportSettingsPanel'
import { formatCandidateLabel } from '../lib/imageLayout'
import { CandidateBox, PageInfo } from '../types'
import { uploadPdfTwoPhase, useExportSettings, removePdfCandidate, applyRemovedCandidateFilter, rescanPdfCandidates } from '../lib/api'
import { requestPdfRedaction, syncPdfAfterPreview } from '../lib/redactPreview'
import { CandidateListPanel } from './CandidateListPanel'
import { RedactActionBar } from './RedactActionBar'
import { useI18n } from '../i18n'

interface DrawingViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void
  backendOnline?: boolean | null
}

interface DrawingFileData {
  serverFileId: string
  pages: PageInfo[]
  afterPages: PageInfo[] | null
  candidates: CandidateBox[]
  pageCount: number
  scanning?: boolean
  removedCandidateIds: string[]
  downloadUrl?: string | null
}

function isDrawingCandidate(c: any): boolean {
  const text = String(c.text || '')
  if (c.type === 'pii') return false
  if (text.startsWith('[') && text.includes('身份证')) return false
  if (text.startsWith('[') && text.includes('护照')) return false
  if (text.startsWith('[') && text.includes('手机')) return false
  return c.type === 'drawing' || c.type === 'enterprise' || !text.startsWith('[')
}

function mapApiPage(p: any): PageInfo {
  const pageNum =
    typeof p.page_num === 'number' && Number.isFinite(p.page_num)
      ? p.page_num
      : typeof p.page_index === 'number'
        ? p.page_index + 1
        : 1
  return {
    page_num: pageNum,
    width: p.width,
    height: p.height,
    image_url: p.image_url,
  }
}

function mapApiToDrawing(
  data: any,
  labels: { defaultText: string; enterpriseRule: string; manualText: string },
  scanning = false,
  removedIds: string[] = []
): DrawingFileData {
  const pages: PageInfo[] = (data.pages || []).map(mapApiPage)

  const afterPages: PageInfo[] | null = data.redacted_pages
    ? data.redacted_pages.map(mapApiPage)
    : null

  const candidates: CandidateBox[] = applyRemovedCandidateFilter(
    (data.candidates || [])
      .filter(isDrawingCandidate)
      .map((c: any) => ({
        id: c.id,
        page_num: c.page_index + 1,
        bbox: [c.x, c.y, c.x + c.width, c.y + c.height] as [number, number, number, number],
        text: c.text || labels.defaultText,
        rule_name: formatCandidateLabel(c.matched_terms, c.text, labels.enterpriseRule),
        channel: c.manual_required || String(c.id).startsWith('manual_') ? 'manual' : 'vector',
        is_selected: c.selected !== false,
        confidence: c.confidence,
        is_manual: String(c.id).startsWith('manual_'),
      })),
    removedIds
  )

  return {
    serverFileId: data.file_id,
    pages,
    afterPages,
    candidates,
    pageCount: data.page_count || pages.length,
    scanning,
    removedCandidateIds: [...removedIds],
  }
}

export const DrawingView: React.FC<DrawingViewProps> = ({ onNotify, backendOnline }) => {
  const { t } = useI18n()
  const labels = {
    defaultText: t('drawing.defaultText'),
    enterpriseRule: t('drawing.enterpriseRule'),
    manualText: t('drawing.manualText'),
  }
  const { settings: exportSettings, setSettings: setExportSettings } = useExportSettings()
  const exportLabel = exportSettings.exportAsZip ? t('export.labelZip') : t('export.labelPdf')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [fileDataMap, setFileDataMap] = useState<Record<string, DrawingFileData>>({})
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('before')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewSyncing, setPreviewSyncing] = useState(false)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [undoStack, setUndoStack] = useState<CandidateBox[][]>([])
  const [redoStack, setRedoStack] = useState<CandidateBox[][]>([])

  const activeData = activeFileId ? fileDataMap[activeFileId] : null
  const candidates = activeData?.candidates ?? []
  const pages = activeData?.pages ?? []
  const afterPages = activeData?.afterPages ?? null
  const pageInfo = pages.find((p) => p.page_num === currentPage) ?? null
  const afterPageInfo = afterPages?.find((p) => p.page_num === currentPage) ?? null
  const totalPages = activeData?.pageCount ?? 1
  const isScanning = activeData?.scanning ?? false

  const updateCandidates = useCallback(
    (fileId: string, updater: (prev: CandidateBox[]) => CandidateBox[]) => {
      setFileDataMap((prev) => {
        const data = prev[fileId]
        if (!data) return prev
        return { ...prev, [fileId]: { ...data, candidates: updater(data.candidates) } }
      })
    },
    []
  )

  const pushHistory = useCallback(
    (fileId: string) => {
      const data = fileDataMap[fileId]
      if (!data) return
      setUndoStack((s) => [...s, data.candidates.map((c) => ({ ...c }))])
      setRedoStack([])
    },
    [fileDataMap]
  )

  const scanFile = async (file: File, localId: string) => {
    if (backendOnline === false) {
      onNotify(t('drawing.backendOffline'), 'error')
      setFiles((prev) => prev.filter((f) => f.id !== localId))
      return
    }

    setPreviewMode('before')
    setDownloadUrl(null)
    setFiles((prev) =>
      prev.map((f) => (f.id === localId ? { ...f, status: 'scanning' as const } : f))
    )

    let previewLoaded = false

    try {
      const result = await uploadPdfTwoPhase(
        file,
        'drawing',
        (preview) => {
          previewLoaded = true
          const mapped = mapApiToDrawing(preview, labels, true, [])
          setFileDataMap((prev) => ({ ...prev, [localId]: mapped }))
          setActiveFileId(localId)
          setCurrentPage(1)
          onNotify(t('drawing.previewLoading', { filename: file.name }), 'info')
        },
        600000
      )

      let matchCount = 0
      setFileDataMap((prevMap) => {
        const prev = prevMap[localId]
        const removedIds = prev?.removedCandidateIds ?? []
        const mapped = mapApiToDrawing(result, labels, false, removedIds)
        mapped.afterPages = prev?.afterPages ?? null
        matchCount = mapped.candidates.length
        return { ...prevMap, [localId]: mapped }
      })
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localId
            ? { ...f, status: 'ready' as const, matchCount }
            : f
        )
      )
      onNotify(t('drawing.scanComplete', { filename: file.name, count: matchCount }), 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('drawing.scanFailed')
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localId
            ? { ...f, status: previewLoaded ? ('ready' as const) : ('error' as const), matchCount: 0 }
            : f
        )
      )
      if (previewLoaded) {
        setFileDataMap((prev) =>
          prev[localId] ? { ...prev, [localId]: { ...prev[localId], scanning: false } } : prev
        )
      }
      onNotify(previewLoaded ? t('drawing.previewScanFailed', { message: msg }) : msg, 'error')
    }
  }

  const processFiles = async (fileList: FileList | File[]) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    )
    if (pdfs.length === 0) {
      onNotify(t('drawing.pdfOnly'), 'error')
      return
    }
    for (const file of pdfs) {
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setFiles((prev) => [
        ...prev,
        { id: localId, name: file.name, path: file.name, size: file.size, status: 'idle' },
      ])
      await scanFile(file, localId)
    }
  }

  const syncPreviewForFile = useCallback(
    async (localId: string, nextCandidates: CandidateBox[], hadAfterPreview: boolean) => {
      const data = fileDataMap[localId]
      if (!data?.serverFileId || !hadAfterPreview) return

      setPreviewSyncing(true)
      try {
        const synced = await syncPdfAfterPreview({
          fileId: data.serverFileId,
          candidates: nextCandidates,
          hadAfterPreview: true,
          outputDir: exportSettings.outputDir || undefined,
          exportAsZip: exportSettings.exportAsZip,
        })
        setFileDataMap((prev) => ({
          ...prev,
          [localId]: {
            ...(prev[localId] ?? data),
            afterPages: synced.afterPages,
            downloadUrl: synced.downloadUrl,
          },
        }))
        setPreviewMode(synced.previewMode)
        setDownloadUrl(synced.downloadUrl)
        if (synced.result) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === localId
                ? { ...f, status: synced.previewMode === 'after' ? ('done' as const) : ('ready' as const), outputPath: synced.result!.output_path }
                : f
            )
          )
        } else if (synced.previewMode === 'before') {
          setFiles((prev) =>
            prev.map((f) => (f.id === localId ? { ...f, status: 'ready' as const } : f))
          )
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'NO_SELECTION') {
          setPreviewMode('before')
          setDownloadUrl(null)
          setFileDataMap((prev) => ({
            ...prev,
            [localId]: { ...(prev[localId] ?? data), afterPages: null },
          }))
          return
        }
        onNotify(err instanceof Error ? err.message : t('drawing.redactFailed'), 'error')
        setPreviewMode('before')
      } finally {
        setPreviewSyncing(false)
      }
    },
    [exportSettings.exportAsZip, exportSettings.outputDir, fileDataMap, onNotify, t]
  )

  const handleDeleteCandidate = async (id: string) => {
    if (!activeFileId) return
    const data = fileDataMap[activeFileId]
    if (!data) return

    pushHistory(activeFileId)
    const hadAfterPreview = !!data.afterPages?.length
    const nextCandidates = data.candidates.filter((c) => c.id !== id)
    const nextRemoved = data.removedCandidateIds.includes(id)
      ? data.removedCandidateIds
      : [...data.removedCandidateIds, id]
    const selectedRemaining = nextCandidates.filter((c) => c.is_selected)

    if (hadAfterPreview) setPreviewSyncing(true)

    setFileDataMap((prev) => ({
      ...prev,
      [activeFileId]: {
        ...data,
        removedCandidateIds: nextRemoved,
        candidates: nextCandidates,
        afterPages: hadAfterPreview ? null : data.afterPages,
        downloadUrl: hadAfterPreview && !selectedRemaining.length ? null : data.downloadUrl,
      },
    }))
    setFiles((prev) =>
      prev.map((f) =>
        f.id === activeFileId ? { ...f, matchCount: selectedRemaining.length } : f
      )
    )
    if (selectedCandidateId === id) setSelectedCandidateId(null)
    if (hadAfterPreview && !selectedRemaining.length) {
      setPreviewMode('before')
      setDownloadUrl(null)
    }

    if (data.serverFileId) {
      await removePdfCandidate(data.serverFileId, id)
    }

    await syncPreviewForFile(activeFileId, nextCandidates, hadAfterPreview)
  }

  const handleAddManualBox = (bbox: [number, number, number, number]) => {
    if (!activeFileId) return
    pushHistory(activeFileId)
    const newBox: CandidateBox = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      page_num: currentPage,
      bbox,
      text: labels.manualText,
      rule_name: labels.manualText,
      channel: 'manual',
      is_selected: true,
      is_manual: true,
    }
    updateCandidates(activeFileId, (prev) => [...prev, newBox])
    setSelectedCandidateId(newBox.id)
    onNotify(t('drawing.manualBoxAdded'), 'info')
  }

  const executeRedact = async (localId: string) => {
    const data = fileDataMap[localId]
    if (!data) return

    const { result, downloadUrl: dl, afterPages } = await requestPdfRedaction({
      fileId: data.serverFileId,
      candidates: data.candidates,
      outputDir: exportSettings.outputDir || undefined,
      exportAsZip: exportSettings.exportAsZip,
    })

    setFileDataMap((prev) => ({
      ...prev,
      [localId]: { ...data, afterPages, downloadUrl: dl },
    }))

    setDownloadUrl(dl)
    setPreviewMode('after')
    setFiles((prev) =>
      prev.map((f) =>
        f.id === localId ? { ...f, status: 'done' as const, outputPath: result.output_path } : f
      )
    )
    return result
  }

  const handleExecuteRedact = async () => {
    if (!activeFileId) return
    if (isScanning) {
      onNotify(t('drawing.waitScanComplete'), 'info')
      return
    }
    setIsProcessing(true)
    try {
      const result = await executeRedact(activeFileId)
      onNotify(
        exportSettings.exportAsZip
          ? t('drawing.redactCompleteZip', { count: result?.redacted_boxes_count ?? 0 })
          : t('drawing.redactCompletePdf', { count: result?.redacted_boxes_count ?? 0 }),
        'success'
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NO_SELECTION') {
        onNotify(t('drawing.selectAtLeastOne'), 'error')
        return
      }
      onNotify(err instanceof Error ? err.message : t('drawing.redactFailed'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRescan = async () => {
    if (!activeFileId || !activeData?.serverFileId) return
    if (isScanning || isProcessing) return

    const serverFileId = activeData.serverFileId
    const filename = files.find((f) => f.id === activeFileId)?.name ?? ''

    setPreviewMode('before')
    setDownloadUrl(null)
    setSelectedCandidateId(null)
    setUndoStack([])
    setRedoStack([])

    setFileDataMap((prev) => ({
      ...prev,
      [activeFileId]: {
        ...(prev[activeFileId] ?? activeData),
        scanning: true,
        afterPages: null,
        downloadUrl: null,
        removedCandidateIds: [],
      },
    }))
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, status: 'scanning' as const } : f))
    )

    try {
      const scan = await rescanPdfCandidates(serverFileId)
      setFileDataMap((prev) => {
        const current = prev[activeFileId] ?? activeData
        const mapped = mapApiToDrawing(
          {
            file_id: serverFileId,
            pages: current.pages,
            page_count: current.pageCount,
            candidates: scan.candidates,
          },
          labels,
          false,
          []
        )
        return {
          ...prev,
          [activeFileId]: {
            ...current,
            candidates: mapped.candidates,
            scanning: false,
            afterPages: null,
            downloadUrl: null,
            removedCandidateIds: [],
          },
        }
      })
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId
            ? {
                ...f,
                status: 'ready' as const,
                matchCount: (scan.candidates || []).filter(isDrawingCandidate).length,
              }
            : f
        )
      )
      const hitCount = (scan.candidates || []).filter(isDrawingCandidate).length
      onNotify(t('drawing.rescanComplete', { filename, count: hitCount }), 'success')
    } catch (err: unknown) {
      setFileDataMap((prev) => ({
        ...prev,
        [activeFileId]: { ...(prev[activeFileId] ?? activeData), scanning: false },
      }))
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, status: 'ready' as const } : f))
      )
      onNotify(err instanceof Error ? err.message : t('drawing.rescanFailed'), 'error')
    }
  }

  const handleSelectFile = (id: string) => {
    const data = fileDataMap[id]
    setActiveFileId(id)
    setCurrentPage(1)
    setSelectedCandidateId(null)
    setPreviewMode(data?.afterPages?.length ? 'after' : 'before')
    setDownloadUrl(data?.downloadUrl ?? null)
    setUndoStack([])
    setRedoStack([])
  }

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setFileDataMap((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (activeFileId === id) {
      const remaining = files.filter((f) => f.id !== id)
      setActiveFileId(remaining[0]?.id ?? null)
      setCurrentPage(1)
      setDownloadUrl(null)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files?.length) await processFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div
        className={`flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden relative min-h-0 ${isDragging ? 'ring-4 ring-mem-teal ring-inset' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files?.length) await processFiles(e.dataTransfer.files)
        }}
      >
        <div className="order-2 lg:order-1 flex flex-col w-full lg:w-80 shrink-0 border-t-[3px] lg:border-t-0 lg:border-r-[3px] border-mem-ink min-h-0 max-h-[40vh] lg:max-h-none overflow-hidden">
          <div className="max-h-[120px] lg:max-h-[40%] min-h-[88px] shrink-0 flex flex-col overflow-hidden border-b-2 border-mem-ink/15">
            <FileListDrawer
            files={files}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onAddFiles={() => fileInputRef.current?.click()}
            onRemoveFile={handleRemoveFile}
            onBatchProcess={async () => {
              const ready = files.filter((f) => f.status === 'ready' && (fileDataMap[f.id]?.candidates.filter(c => c.is_selected).length ?? 0) > 0)
              if (!ready.length) { onNotify(t('drawing.noBatchFiles'), 'info'); return }
              setIsBatchProcessing(true)
              for (const f of ready) {
                try { await executeRedact(f.id) } catch { onNotify(t('drawing.batchFileFailed', { filename: f.name }), 'error') }
              }
              setIsBatchProcessing(false)
              onNotify(t('drawing.batchComplete'), 'success')
            }}
            isBatchProcessing={isBatchProcessing}
          />
          </div>
          <div className="shrink-0 px-3 pt-2 pb-1 border-t-2 border-mem-ink/15">
            <h3 className="text-xs font-bold text-mem-ink/70">{t('drawing.hitsTitle', { count: candidates.length })}</h3>
            <p className="text-[10px] text-mem-ink/40">{t('drawing.hitsHint')}</p>
          </div>
          <CandidateListPanel
            candidates={candidates}
            selectedCandidateId={selectedCandidateId}
            onSelect={(id, pageNum) => {
              setSelectedCandidateId(id)
              setCurrentPage(pageNum)
            }}
            onDelete={(id) => void handleDeleteCandidate(id)}
            scanning={isScanning && candidates.length === 0}
            detecting={isScanning}
            emptyHint={pages.length > 0 && !isScanning ? t('drawing.noDrawingHits') : t('drawing.waitingScan')}
          />
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible">
          <div className="p-3 bg-white border-t-2 border-mem-ink/15 space-y-3">
            <RedactActionBar
              onExecuteRedact={handleExecuteRedact}
              isProcessing={isProcessing}
              isScanning={isScanning}
              selectedCount={candidates.filter((c) => c.is_selected).length}
              previewMode={previewMode}
              hasAfterPreview={!!afterPages?.length}
              onPreviewModeChange={setPreviewMode}
              onRescan={handleRescan}
              canRescan={!!activeData?.serverFileId && pages.length > 0}
              downloadUrl={downloadUrl}
              downloadLabel={exportLabel}
              onNotify={onNotify}
            />
            <ExportSettingsPanel settings={exportSettings} onChange={setExportSettings} compact onNotify={onNotify} className="hidden lg:flex" />
          </div>
          </div>
        </div>
        <div className="order-1 lg:order-2 flex-1 min-h-[52vh] lg:min-h-0 min-w-0 overflow-hidden">
        <CanvasViewport
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          pageInfo={pageInfo}
          afterPageInfo={afterPageInfo}
          hasAfterPreview={!!afterPages?.length}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          candidates={candidates}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={setSelectedCandidateId}
          onToggleCandidate={(id) => {
            if (!activeFileId) return
            const data = fileDataMap[activeFileId]
            if (!data) return
            pushHistory(activeFileId)
            const nextCandidates = data.candidates.map((c) =>
              c.id === id ? { ...c, is_selected: !c.is_selected } : c
            )
            updateCandidates(activeFileId, () => nextCandidates)
            void syncPreviewForFile(activeFileId, nextCandidates, !!data.afterPages)
          }}
          onDeleteCandidate={handleDeleteCandidate}
          onAddManualBox={handleAddManualBox}
          onSelectAll={() => {
            if (!activeFileId) return
            const data = fileDataMap[activeFileId]
            if (!data) return
            pushHistory(activeFileId)
            const nextCandidates = data.candidates.map((c) => ({ ...c, is_selected: true }))
            updateCandidates(activeFileId, () => nextCandidates)
            void syncPreviewForFile(activeFileId, nextCandidates, !!data.afterPages?.length)
          }}
          onClearAll={() => {
            if (!activeFileId) return
            const data = fileDataMap[activeFileId]
            if (!data) return
            pushHistory(activeFileId)
            const nextCandidates = data.candidates.map((c) => ({ ...c, is_selected: false }))
            updateCandidates(activeFileId, () => nextCandidates)
            if (data.afterPages?.length) {
              setPreviewMode('before')
              setDownloadUrl(null)
              setFileDataMap((prev) => ({
                ...prev,
                [activeFileId]: { ...data, candidates: nextCandidates, afterPages: null, downloadUrl: null },
              }))
            }
          }}
          onUndo={() => {
            if (!activeFileId || !undoStack.length) return
            const snap = undoStack[undoStack.length - 1]
            setRedoStack((s) => [...s, candidates.map((c) => ({ ...c }))])
            setUndoStack((s) => s.slice(0, -1))
            updateCandidates(activeFileId, () => snap)
          }}
          onRedo={() => {
            if (!activeFileId || !redoStack.length) return
            const snap = redoStack[redoStack.length - 1]
            setUndoStack((s) => [...s, candidates.map((c) => ({ ...c }))])
            setRedoStack((s) => s.slice(0, -1))
            updateCandidates(activeFileId, () => snap)
          }}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onExecuteRedact={handleExecuteRedact}
          isProcessing={isProcessing}
          isScanning={isScanning}
          previewSyncing={previewSyncing}
          downloadUrl={downloadUrl}
          downloadLabel={exportLabel}
          onNotify={onNotify}
        />
        </div>
      </div>
    </>
  )
}
