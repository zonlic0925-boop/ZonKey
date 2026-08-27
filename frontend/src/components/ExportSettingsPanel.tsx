import React, { useState } from 'react'
import { FolderOpen, Archive, FolderSearch } from 'lucide-react'
import { pickExportFolder, type NotifyFn } from '../lib/api'
import { useI18n } from '../i18n'

export interface ExportSettingsState {
  outputDir: string
  exportAsZip: boolean
}

interface ExportSettingsPanelProps {
  settings: ExportSettingsState
  onChange: (next: ExportSettingsState) => void
  compact?: boolean
  onNotify?: NotifyFn
}

export const ExportSettingsPanel: React.FC<ExportSettingsPanelProps> = ({
  settings,
  onChange,
  compact = false,
  onNotify,
}) => {
  const { t } = useI18n()
  const [picking, setPicking] = useState(false)

  const handlePickFolder = async () => {
    setPicking(true)
    try {
      const selected = await pickExportFolder(settings.outputDir || undefined)
      if (selected) {
        onChange({ ...settings, outputDir: selected })
        onNotify?.(t('export.dirSetSuccess', { path: selected }), 'success')
      }
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : t('export.folderPickerError'), 'error')
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className={`memphis-card-flat p-3 flex flex-col gap-2 ${compact ? '' : 'w-full'}`}>
      <div className="text-[11px] font-bold flex items-center gap-1.5 text-mem-ink/70">
        <FolderOpen className="w-3.5 h-3.5" />
        {t('export.settingsTitle')}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={settings.outputDir}
          onChange={(e) => onChange({ ...settings, outputDir: e.target.value })}
          placeholder={t('export.dirPlaceholder')}
          className="memphis-input text-xs py-1.5 flex-1 min-w-0"
          readOnly
        />
        <button
          type="button"
          onClick={() => void handlePickFolder()}
          disabled={picking}
          className="memphis-btn-ghost shrink-0 px-2.5 py-1.5 text-xs flex items-center gap-1"
          title={t('export.dirPlaceholder')}
        >
          <FolderSearch className={`w-3.5 h-3.5 ${picking ? 'animate-pulse' : ''}`} />
          {picking ? t('export.browsing') : t('export.browse')}
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={settings.exportAsZip}
          onChange={(e) => onChange({ ...settings, exportAsZip: e.target.checked })}
          className="rounded accent-mem-coral"
        />
        <Archive className="w-3.5 h-3.5" />
        {t('export.exportAsZip')}
      </label>
    </div>
  )
}
