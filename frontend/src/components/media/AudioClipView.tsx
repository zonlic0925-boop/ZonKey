import React, { useState, useRef, useCallback } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Upload, Scissors, Download, Play, Pause } from 'lucide-react'
import { clipAudio } from '../../lib/toolknit/mediaCore'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export const AudioClipView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(10)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setStatus('')
    const url = URL.createObjectURL(f)
    setAudioUrl(url)
    const audio = new Audio(url)
    audio.onloadedmetadata = () => {
      setDuration(audio.duration)
      setEndTime(Math.min(10, audio.duration))
    }
  }

  const handleClip = async () => {
    if (!file) return
    setProcessing(true); setStatus('正在裁剪...')
    try {
      const blob = await clipAudio(file, startTime, endTime)
      downloadBlob(blob, 'clipped_' + file.name.replace(/\.[^.]+$/, '.wav'))
      setStatus('裁剪完成！')
    } catch (e: any) { setStatus('裁剪失败: ' + e.message) }
    setProcessing(false)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.currentTime = startTime; audioRef.current.play(); setPlaying(true) }
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
    return m.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0')
  }

  return (
    <div className="space-y-6">
      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input type="file" accept="audio/*" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <Upload className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">{file ? file.name : '选择音频文件 (MP3/WAV/OGG)'}</p>
      </MemphisCard>

      {file && audioUrl && (
        <MemphisCard className="p-4 space-y-4">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <div className="flex items-center gap-3">
            <MemphisButton variant="sky" size="sm" icon={playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} onClick={togglePlay}>
              {playing ? '暂停' : '试听'}
            </MemphisButton>
            <span className="text-xs font-mono font-bold">总时长: {fmt(duration)}</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">开始时间: {fmt(startTime)}</label>
              <input type="range" min={0} max={duration} step={0.1} value={startTime}
                onChange={e => { const v = +e.target.value; setStartTime(v); if (v >= endTime) setEndTime(Math.min(v + 1, duration)) }}
                className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">结束时间: {fmt(endTime)}</label>
              <input type="range" min={0} max={duration} step={0.1} value={endTime}
                onChange={e => { const v = +e.target.value; setEndTime(v); if (v <= startTime) setStartTime(Math.max(0, v - 1)) }}
                className="w-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MemphisButton variant="teal" icon={<Scissors className="w-4 h-4" />} onClick={handleClip} disabled={processing}>
              {processing ? '裁剪中...' : '裁剪并下载 WAV'}
            </MemphisButton>
            {status && <span className="text-xs font-bold text-green-700">{status}</span>}
          </div>
        </MemphisCard>
      )}
    </div>
  )
}
