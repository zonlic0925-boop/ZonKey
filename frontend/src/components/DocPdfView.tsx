import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { CanvasViewport } from './CanvasViewport';
import { ExportSettingsPanel } from './ExportSettingsPanel';
import { CandidateListPanel } from './CandidateListPanel';
import { RedactActionBar } from './RedactActionBar';
import { CandidateBox, PageInfo } from '../types';
import { uploadPdfTwoPhase, useExportSettings, removePdfCandidate, applyRemovedCandidateFilter, rescanPdfCandidates, syncPdfCandidateBoxes } from '../lib/api';
import { requestPdfRedaction, syncPdfAfterPreview } from '../lib/redactPreview';
import { APP_NAME } from '../lib/brand';
import { useI18n } from '../i18n';

interface DocPdfViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  backendOnline?: boolean | null;
}

function mapPages(raw: any[]): PageInfo[] {
  return (raw || []).map((p: any) => ({
    page_num: p.page_index + 1,
    width: p.width,
    height: p.height,
    image_url: p.image_url,
  }));
}

function mapCandidates(raw: any[], labels: { defaultText: string; piiRule: string; sensitiveWord: string }): CandidateBox[] {
  return (raw || []).map((c: any) => ({
    id: c.id,
    page_num: c.page_index + 1,
    bbox: [c.x, c.y, c.x + c.width, c.y + c.height] as [number, number, number, number],
    text: c.text || labels.defaultText,
    rule_name: c.text || (c.type === 'pii' ? labels.piiRule : labels.sensitiveWord),
    matched_terms: Array.isArray(c.matched_terms) ? c.matched_terms.filter(Boolean) : [],
    channel: c.type === 'pii' ? 'ocr' : 'vector',
    is_selected: c.selected !== false,
    confidence: c.confidence,
    is_manual: String(c.id).startsWith('manual_'),
  }));
}

export const DocPdfView: React.FC<DocPdfViewProps> = ({ onNotify, backendOnline }) => {
  const { t } = useI18n();
  const { settings: exportSettings, setSettings: setExportSettings } = useExportSettings();
  const exportLabel = exportSettings.exportAsZip ? t('export.labelZip') : t('export.labelPdf');
  const docLabels = {
    defaultText: t('docPdf.defaultText'),
    piiRule: t('docPdf.piiRule'),
    sensitiveWord: t('docPdf.sensitiveWord'),
    manualText: t('docPdf.manualText'),
  };
  const [scanning, setScanning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [afterPages, setAfterPages] = useState<PageInfo[] | null>(null);
  const [candidates, setCandidates] = useState<CandidateBox[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('before');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSyncing, setPreviewSyncing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<CandidateBox[][]>([]);
  const [redoStack, setRedoStack] = useState<CandidateBox[][]>([]);
  const [removedCandidateIds, setRemovedCandidateIds] = useState<string[]>([]);
  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  const pageInfo = pages.find((p) => p.page_num === currentPage) ?? null;
  const afterPageInfo = afterPages?.find((p) => p.page_num === currentPage) ?? null;
  const totalPages = pages.length || 1;

  const pushHistory = useCallback(() => {
    setUndoStack((s) => [...s, candidates.map((c) => ({ ...c }))]);
    setRedoStack([]);
  }, [candidates]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (backendOnline === false) {
      onNotify(t('docPdf.backendOffline'), 'error');
      return;
    }
    const selected = files[0];
    setScanning(true);
    setDetecting(false);
    setPagesLoading(false);
    setPreviewMode('before');
    setDownloadUrl(null);
    setAfterPages(null);
    setCandidates([]);
    setPages([]);
    setFileId(null);
    setRemovedCandidateIds([]);

    try {
      const data = await uploadPdfTwoPhase(
        selected,
        'document',
        (preview) => {
          setFileId(preview.file_id);
          setFilename(preview.filename);
          setPages(mapPages(preview.pages));
          setCurrentPage(1);
          setPagesLoading(true);
          onNotify(t('docPdf.pagesLoading', { filename: selected.name }), 'info');
        },
        120000,
        () => {
          setPagesLoading(false);
          setDetecting(true);
          onNotify(t('docPdf.pagesReadyScan', { filename: selected.name }), 'info');
        }
      );
      setRemovedCandidateIds((removed) => {
        const mapped = applyRemovedCandidateFilter(mapCandidates(data.candidates, docLabels), removed);
        setCandidates(mapped);
        return removed;
      });
      onNotify(t('docPdf.detectComplete', { count: data.candidates.length, appName: APP_NAME }), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('docPdf.scanFailed'), 'error');
    } finally {
      setScanning(false);
      setDetecting(false);
      setPagesLoading(false);
    }
    e.target.value = '';
  };

  const syncPreview = useCallback(async (nextCandidates: CandidateBox[], hadAfterPreview: boolean) => {
    if (!fileId || !hadAfterPreview) return;

    setPreviewSyncing(true);
    try {
      const synced = await syncPdfAfterPreview({
        fileId,
        candidates: nextCandidates,
        hadAfterPreview: true,
        outputDir: exportSettings.outputDir || undefined,
        exportAsZip: exportSettings.exportAsZip,
      });
      setAfterPages(synced.afterPages);
      setPreviewMode(synced.previewMode);
      setDownloadUrl(synced.downloadUrl);
      setPdfDownloadUrl(synced.pdfDownloadUrl);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NO_SELECTION') {
        setAfterPages(null);
        setPreviewMode('before');
        setDownloadUrl(null);
        return;
      }
      onNotify(err instanceof Error ? err.message : t('docPdf.redactFailed'), 'error');
      setPreviewMode('before');
    } finally {
      setPreviewSyncing(false);
    }
  }, [exportSettings.exportAsZip, exportSettings.outputDir, fileId, onNotify, t]);

  const handleDeleteCandidate = useCallback(async (id: string) => {
    const hadAfterPreview = !!afterPages?.length;
    const nextCandidates = candidates.filter((c) => c.id !== id);
    const selectedRemaining = nextCandidates.filter((c) => c.is_selected);

    setUndoStack((s) => [...s, candidates.map((c) => ({ ...c }))]);
    setRedoStack([]);
    setRemovedCandidateIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCandidates(nextCandidates);
    setSelectedCandidateId((prev) => (prev === id ? null : prev));

    if (hadAfterPreview) {
      setPreviewSyncing(true);
      setAfterPages(null);
      if (!selectedRemaining.length) {
        setPreviewMode('before');
        setDownloadUrl(null);
      }
    }

    if (fileId) {
      await removePdfCandidate(fileId, id);
    }

    await syncPreview(nextCandidates, hadAfterPreview);
  }, [afterPages, candidates, fileId, syncPreview]);

  const handleAddManualBox = (bbox: [number, number, number, number]) => {
    pushHistory();
    const box: CandidateBox = {
      id: `manual_${Date.now()}`,
      page_num: currentPage,
      bbox,
      text: docLabels.manualText,
      rule_name: docLabels.manualText,
      channel: 'manual',
      is_selected: true,
      is_manual: true,
    };
    const nextCandidates = [...candidates, box];
    setCandidates(nextCandidates);
    setSelectedCandidateId(box.id);
    if (fileId) void syncPdfCandidateBoxes(fileId, nextCandidates);
    onNotify(t('docPdf.manualBoxAdded'), 'info');
  };

  const handleUpdateCandidateBbox = async (id: string, bbox: [number, number, number, number]) => {
    const nextCandidates = candidatesRef.current.map((c) => (c.id === id ? { ...c, bbox } : c));
    candidatesRef.current = nextCandidates;
    setCandidates(nextCandidates);
    if (fileId) await syncPdfCandidateBoxes(fileId, nextCandidates);
    void syncPreview(nextCandidates, !!afterPages?.length);
  };

  const handleExecuteRedact = async () => {
    if (!fileId) return;
    const latest = candidatesRef.current;
    const selected = latest.filter((c) => c.is_selected);
    if (!selected.length) {
      onNotify(t('docPdf.selectAtLeastOne'), 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await syncPdfCandidateBoxes(fileId, latest);
      const { result, downloadUrl: dl, pdfDownloadUrl: pdfDl, afterPages: nextAfter } = await requestPdfRedaction({
        fileId,
        candidates: candidatesRef.current,
        outputDir: exportSettings.outputDir || undefined,
        exportAsZip: exportSettings.exportAsZip,
      });

      setAfterPages(nextAfter);
      setPreviewMode('after');
      setDownloadUrl(dl);
      setPdfDownloadUrl(pdfDl);
      onNotify(t('docPdf.redactComplete', { count: result.redacted_boxes_count }), 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NO_SELECTION') {
        onNotify(t('docPdf.selectAtLeastOne'), 'error');
        return;
      }
      onNotify(err instanceof Error ? err.message : t('docPdf.redactFailed'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRescan = async () => {
    if (!fileId || detecting || isProcessing) return;

    setDetecting(true);
    setPreviewMode('before');
    setDownloadUrl(null);
    setAfterPages(null);
    setSelectedCandidateId(null);
    setUndoStack([]);
    setRedoStack([]);
    setRemovedCandidateIds([]);

    try {
      const scan = await rescanPdfCandidates(fileId);
      const mapped = mapCandidates(scan.candidates, docLabels);
      setCandidates(mapped);
      onNotify(t('docPdf.rescanComplete', { count: mapped.length, appName: APP_NAME }), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('docPdf.rescanFailed'), 'error');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">
      <div className="order-2 lg:order-1 w-full lg:w-[360px] shrink-0 flex flex-col border-t-[3px] lg:border-t-0 lg:border-r-[3px] border-mem-ink bg-white min-h-0 lg:overflow-hidden">
        <div className="p-4 border-b-2 border-mem-ink/15">
          <div className="memphis-card p-4 text-center relative overflow-hidden group">
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <Upload className="w-8 h-8 mx-auto mb-2 text-mem-teal" />
            <h3 className="text-sm font-bold">{t('docPdf.uploadTitle')}</h3>
            <p className="text-xs text-mem-ink/60 mt-1">{t('docPdf.uploadSubtitle', { appName: APP_NAME })}</p>
          </div>
        </div>

        <div className="shrink-0 px-3 pt-2 pb-1 border-b-2 border-mem-ink/15">
          <h3 className="text-xs font-bold text-mem-ink/70">{t('docPdf.hitsTitle', { count: candidates.length })}</h3>
          <p className="text-xs text-mem-ink/40">{t('docPdf.hitsHint')}</p>
        </div>

        <CandidateListPanel
          candidates={candidates}
          selectedCandidateId={selectedCandidateId}
          onSelect={(id, pageNum) => {
            setSelectedCandidateId(id);
            setCurrentPage(pageNum);
          }}
          onDelete={(id) => void handleDeleteCandidate(id)}
          scanning={scanning && !pages.length}
          detecting={detecting}
          emptyHint={t('docPdf.noHits')}
        />

        <div className="p-3 border-t-2 border-mem-ink/15 space-y-3">
          <RedactActionBar
            onExecuteRedact={handleExecuteRedact}
            isProcessing={isProcessing}
            isScanning={detecting}
            selectedCount={candidates.filter((c) => c.is_selected).length}
            previewMode={previewMode}
            hasAfterPreview={!!afterPages?.length}
            onPreviewModeChange={setPreviewMode}
            onRescan={handleRescan}
            canRescan={!!fileId && pages.length > 0}
            downloadUrl={downloadUrl}
            pdfDownloadUrl={pdfDownloadUrl}
            downloadLabel={exportLabel}
            onNotify={onNotify}
          />
          <ExportSettingsPanel settings={exportSettings} onChange={setExportSettings} compact onNotify={onNotify} className="flex" />
          {filename && (
            <p className="text-xs text-mem-ink/40 truncate">{filename}</p>
          )}
        </div>
      </div>

      <div className="order-1 lg:order-2 flex-none lg:flex-1 h-[50vh] lg:h-auto lg:min-h-0 shrink-0 lg:shrink min-w-0 overflow-hidden">
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
          pushHistory();
          const nextCandidates = candidates.map((c) =>
            c.id === id ? { ...c, is_selected: !c.is_selected } : c
          );
          setCandidates(nextCandidates);
          void syncPreview(nextCandidates, !!afterPages);
        }}
        onDeleteCandidate={handleDeleteCandidate}
        onAddManualBox={handleAddManualBox}
        onBeginCandidateEdit={pushHistory}
        onUpdateCandidateBbox={handleUpdateCandidateBbox}
        onSelectAll={() => {
          pushHistory();
          setCandidates((prev) => prev.map((c) => ({ ...c, is_selected: true })));
        }}
        onClearAll={() => {
          pushHistory();
          setCandidates((prev) => prev.map((c) => ({ ...c, is_selected: false })));
        }}
        onUndo={() => {
          if (!undoStack.length) return;
          setRedoStack((s) => [...s, candidates.map((c) => ({ ...c }))]);
          const snap = undoStack[undoStack.length - 1];
          setUndoStack((s) => s.slice(0, -1));
          setCandidates(snap);
        }}
        onRedo={() => {
          if (!redoStack.length) return;
          setUndoStack((s) => [...s, candidates.map((c) => ({ ...c }))]);
          const snap = redoStack[redoStack.length - 1];
          setRedoStack((s) => s.slice(0, -1));
          setCandidates(snap);
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onExecuteRedact={handleExecuteRedact}
        isProcessing={isProcessing}
        isScanning={detecting}
        pagesLoading={pagesLoading}
        previewSyncing={previewSyncing}
        downloadUrl={downloadUrl}
        pdfDownloadUrl={pdfDownloadUrl}
        downloadLabel={exportLabel}
        onNotify={onNotify}
      />
      </div>
    </div>
  );
};
