import React from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import { CandidateBox } from '../types'
import { useI18n } from '../i18n'

interface CandidateListPanelProps {
  candidates: CandidateBox[]
  selectedCandidateId: string | null
  onSelect: (id: string, pageNum: number) => void
  onDelete: (id: string) => void
  scanning?: boolean
  detecting?: boolean
  emptyHint?: string
}

export const CandidateListPanel: React.FC<CandidateListPanelProps> = ({
  candidates,
  selectedCandidateId,
  onSelect,
  onDelete,
  scanning = false,
  detecting = false,
  emptyHint,
}) => {
  const { t } = useI18n()
  const empty = emptyHint ?? t('candidateList.emptyDefault')

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 border-t-2 border-mem-ink/15">
      {(scanning || detecting) && candidates.length === 0 && (
        <div className="text-center text-xs text-mem-ink/60 py-6">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          {detecting ? t('candidateList.detecting') : t('candidateList.loadingPreview')}
        </div>
      )}
      {!scanning && !detecting && candidates.length === 0 && (
        <div className="text-xs text-center text-mem-teal py-4">{empty}</div>
      )}
      {candidates.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect(c.id, c.page_num)}
          className={`p-2 rounded-lg border-2 text-xs cursor-pointer flex items-start gap-2 transition-all ${
            selectedCandidateId === c.id
              ? 'border-mem-coral bg-mem-coral/10'
              : 'border-mem-ink/15 hover:border-mem-ink/40'
          } ${c.is_selected ? '' : 'opacity-50'}`}
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate" title={c.text}>
              {c.text}
            </div>
            <div className="text-xs text-mem-ink/60 mt-0.5">
              {t('candidateList.meta', {
                page: c.page_num,
                source: c.is_manual ? t('candidateList.sourceManual') : t('candidateList.sourceSystem'),
              })}
            </div>
          </div>
          <button
            type="button"
            title={t('candidateList.deleteTitle')}
            className="shrink-0 p-2.5 -m-1.5 rounded-md text-mem-ink/40 hover:text-mem-coral hover:bg-mem-coral/10"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(c.id)
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
