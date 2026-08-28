import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { AnimatedCounter } from '../common/AnimatedCounter'
import { decodeAudioBuffer, detectBpm, extractPeaks } from '../../lib/core-audio/audio-dsp'
import { Music, Activity, Upload, Play, Square } from 'lucide-react'

export const BpmDetectView: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [duration, setDuration] = useState<string>('')
  const [peaks, setPeaks] = useState<{ min: number[]; max: number[] } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAudioFile(file)
    setIsAnalyzing(true)

    try {
      const buffer = await decodeAudioBuffer(file)
      const detected = detectBpm(buffer)
      const pk = extractPeaks(buffer, 120)

      const mins = Math.floor(buffer.duration / 60)
      const secs = Math.floor(buffer.duration % 60)
      setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`)

      setBpm(detected)
      setPeaks(pk)

      if (audioEl) audioEl.pause()
      const newAudio = new Audio(URL.createObjectURL(file))
      newAudio.onended = () => setIsPlaying(false)
      setAudioEl(newAudio)
    } catch (err) {
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const togglePlay = () => {
    if (!audioEl) return
    if (isPlaying) {
      audioEl.pause()
      setIsPlaying(false)
    } else {
      audioEl.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className="space-y-6">
      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <Music className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">
          {audioFile ? audioFile.name : '选择本地音频文件 (MP3, WAV, FLAC, M4A)'}
        </p>
        <p className="text-xs text-mem-ink/50 mt-1">
          基于 WebAudio PCM 离线自相关 DSP 算法，本地瞬时计算曲目速度
        </p>
      </MemphisCard>

      {isAnalyzing && (
        <div className="text-center py-6">
          <Activity className="w-8 h-8 mx-auto text-mem-coral animate-spin mb-2" />
          <p className="font-display font-black text-xs text-mem-ink">正在离线计算音频能量包络与 BPM...</p>
        </div>
      )}

      {bpm !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MemphisCard className="p-6 bg-mem-coral/15 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-display font-black text-mem-coral uppercase tracking-wider mb-1">
              测得音乐速度
            </span>
            <div className="text-5xl font-display font-black text-mem-ink flex items-baseline gap-1">
              <AnimatedCounter value={bpm} />
              <span className="text-sm font-bold text-mem-ink/60">BPM</span>
            </div>
            <p className="text-[11px] text-mem-ink/60 mt-2 font-bold">时长: {duration}</p>
          </MemphisCard>

          <MemphisCard className="p-6 bg-white md:col-span-2 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-display font-black text-mem-ink uppercase">
                  音频波形能量分布 (Waveform)
                </span>
                <MemphisButton
                  variant={isPlaying ? 'coral' : 'teal'}
                  onClick={togglePlay}
                  size="sm"
                  icon={isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                >
                  {isPlaying ? '暂停试听' : '试听音频'}
                </MemphisButton>
              </div>

              {/* Waveform Bars */}
              {peaks && (
                <div className="h-20 bg-mem-cream/60 border-2 border-mem-ink rounded-xl p-2 flex items-center justify-between gap-0.5">
                  {peaks.max.map((val, idx) => (
                    <motion.div
                      key={idx}
                      className="flex-1 bg-mem-coral rounded-full"
                      style={{ height: `${Math.max(10, Math.min(100, val * 100))}%` }}
                      animate={
                        isPlaying
                          ? { opacity: [0.6, 1, 0.6] }
                          : { opacity: 0.8 }
                      }
                      transition={{ duration: 0.5, repeat: Infinity, delay: (idx % 10) * 0.05 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-mem-ink/50 font-bold text-right">
              100% 本地数字信号处理，无需 AI 模型与网络
            </p>
          </MemphisCard>
        </div>
      )}
    </div>
  )
}
