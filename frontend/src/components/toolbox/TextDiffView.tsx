import React, { useMemo, useState } from 'react'
import { FileDiff } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { AreaInput, ErrorLine, ResultTile } from '../calcdev/kit'
import { diffLines, diffStats } from '../../lib/zonkey/toolboxCore'

const OP_STYLE: Record<string, string> = {
  equal: 'bg-white text-mem-ink',
  insert: 'bg-mem-teal/25 text-mem-ink',
  delete: 'bg-mem-coral/20 text-mem-ink',
}

export const TextDiffView: React.FC = () => {
  const { t } = useI18n()
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ran, setRan] = useState(false)

  const rows = useMemo(() => (ran ? diffLines(left, right) : []), [ran, left, right])
  const stats = useMemo(() => diffStats(rows), [rows])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileDiff className="w-5 h-5 text-mem-pink" />
        <h3 className="font-display font-black text-mem-ink">{t('toolbox.diffTitle')}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-bold text-mem-ink/70">{t('toolbox.diffOriginal')}</p>
          <AreaInput value={left} onChange={setLeft} rows={8} placeholder={t('toolbox.diffLeftHint')} />
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-mem-ink/70">{t('toolbox.diffModified')}</p>
          <AreaInput value={right} onChange={setRight} rows={8} placeholder={t('toolbox.diffRightHint')} />
        </div>
      </div>

      <MemphisButton variant="pink" onClick={() => setRan(true)}>
        {t('toolbox.diffRun')}
      </MemphisButton>

      {ran && (
        <>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <ResultTile value={stats.added} label={t('toolbox.diffAdded')} tone="teal" />
            <ResultTile value={stats.removed} label={t('toolbox.diffRemoved')} tone="coral" />
            <ResultTile value={stats.unchanged} label={t('toolbox.diffUnchanged')} tone="sky" />
          </div>
          <div className="border-2 border-mem-ink rounded-xl overflow-hidden max-h-96 overflow-y-auto bg-white">
            {rows.length === 0 && (
              <p className="px-3 py-4 text-xs font-bold text-mem-ink/50 text-center">{t('toolbox.diffIdentical')}</p>
            )}
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-2 py-0.5 text-xs font-mono border-b border-mem-ink/10 last:border-b-0 ${OP_STYLE[row.op]}`}
              >
                <span className="w-10 shrink-0 text-right text-mem-ink/40 select-none">{row.leftNo ?? ''}</span>
                <span className="w-10 shrink-0 text-right text-mem-ink/40 select-none">{row.rightNo ?? ''}</span>
                <span className="w-4 shrink-0 select-none text-mem-ink/60">
                  {row.op === 'insert' ? '+' : row.op === 'delete' ? '−' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all min-w-0">{row.text || ' '}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <ErrorLine />
    </div>
  )
}
