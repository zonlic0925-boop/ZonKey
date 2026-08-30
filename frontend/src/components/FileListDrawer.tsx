import React from 'react'
import {
  FileUp,
  Trash2,
  FileText,
  FileCheck,
  CheckCircle,
  FolderOpen,
} from 'lucide-react'
import { useI18n } from '../i18n'

export interface FileItem {
  id: string
  name: string
  path: string
  size: number
  status: 'idle' | 'loading' | 'scanning' | 'ready' | 'done' | 'error'
  matchCount?: number
  outputPath?: string
}

interface FileListDrawerProps {
  files: FileItem[]
  activeFileId: string | null
  onSelectFile: (id: string) => void
  onAddFiles: () => void
  onRemoveFile: (id: string) => void
  onBatchProcess: () => void
  isBatchProcessing: boolean
}

export const FileListDrawer: React.FC<FileListDrawerProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onAddFiles,
  onRemoveFile,
  onBatchProcess,
  isBatchProcessing,
}) => {
  const { t } = useI18n()

  return (
    <aside className="flex-1 min-h-0 w-full flex flex-col z-20 select-none bg-white">
      <div className="p-4 border-b-2 border-mem-ink/15 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-mem-coral" />
            <h2 className="text-sm font-display font-bold">{t('fileList.title')}</h2>
          </div>
          <span className="text-xs font-mono bg-mem-yellow/50 px-2 py-0.5 rounded-lg border border-mem-ink/30">
            {t('fileList.count', { count: files.length })}
          </span>
        </div>

        <button onClick={onAddFiles} className="memphis-btn-secondary w-full flex items-center justify-center gap-2">
          <FileUp className="w-4 h-4" />
          <span>{t('fileList.addPdf')}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-mem-ink/40">
            <FileText className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-xs">{t('fileList.emptyTitle')}</p>
            <p className="text-[11px] mt-1">{t('fileList.emptyHint')}</p>
          </div>
        ) : (
          files.map((file) => {
            const isActive = file.id === activeFileId
            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer relative group flex flex-col gap-2 transition-all ${
                  isActive
                    ? 'bg-mem-yellow/40 border-mem-ink shadow-memphis-sm'
                    : 'bg-white border-mem-ink/20 hover:border-mem-ink hover:shadow-memphis-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-mem-coral' : 'text-mem-ink/40'}`} />
                    <span className="text-xs font-medium truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFile(file.id)
                    }}
                    className="opacity-40 md:opacity-0 md:group-hover:opacity-100 p-1 text-mem-ink/60 md:text-mem-ink/40 hover:text-mem-coral rounded-lg transition-opacity max-md:zs-touch-target"
                    title={t('fileList.removeTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-mem-ink/50">
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  {file.status === 'loading' && (
                    <span className="text-mem-teal animate-pulse">{t('fileList.statusLoading')}</span>
                  )}
                  {file.status === 'scanning' && (
                    <span className="text-mem-coral animate-pulse">{t('fileList.statusScanning')}</span>
                  )}
                  {file.status === 'ready' && (
                    <span className="text-mem-teal font-mono font-semibold">
                      {t('fileList.statusReady', { count: file.matchCount ?? 0 })}
                    </span>
                  )}
                  {file.status === 'done' && (
                    <span className="text-mem-teal flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {t('fileList.statusDone')}
                    </span>
                  )}
                  {file.status === 'error' && <span className="text-mem-coral">{t('fileList.statusError')}</span>}
                </div>
              </div>
            )
          })
        )}
      </div>

      {files.length > 0 && (
        <div className="p-3 border-t-2 border-mem-ink/15">
          <button
            onClick={onBatchProcess}
            disabled={isBatchProcessing}
            className="memphis-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <FileCheck className="w-4 h-4" />
            <span>{isBatchProcessing ? t('fileList.batchExecuting') : t('fileList.batchExecute')}</span>
          </button>
        </div>
      )}
    </aside>
  )
}
