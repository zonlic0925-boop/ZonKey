// Pure Local WebAudio DSP for BPM Detection & Audio Waveform extraction

export async function decodeAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()
  return audioBuffer
}

export function extractPeaks(
  buffer: AudioBuffer,
  peaksCount: number = 200
): { min: number[]; max: number[] } {
  const channelData = buffer.getChannelData(0)
  const step = Math.floor(channelData.length / peaksCount)
  const min: number[] = []
  const max: number[] = []

  for (let i = 0; i < peaksCount; i++) {
    const start = i * step
    const end = start + step
    let minVal = channelData[start] || 0
    let maxVal = channelData[start] || 0

    for (let j = start; j < end; j++) {
      const val = channelData[j]
      if (val < minVal) minVal = val
      if (val > maxVal) maxVal = val
    }
    min.push(minVal)
    max.push(maxVal)
  }

  return { min, max }
}

export function detectBpm(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate

  // Lowpass filter ~150Hz to isolate bass drum / kick
  // Downsample to 22050Hz for performance
  const step = Math.max(1, Math.floor(sampleRate / 22050))
  const downsampled: number[] = []
  for (let i = 0; i < data.length; i += step) {
    downsampled.push(Math.abs(data[i]))
  }

  // Energy Envelope
  const winSize = Math.floor(22050 * 0.05) // 50ms
  const envelope: number[] = []
  let sum = 0
  for (let i = 0; i < downsampled.length; i++) {
    sum += downsampled[i]
    if (i >= winSize) sum -= downsampled[i - winSize]
    envelope.push(sum / winSize)
  }

  // Autocorrelation within 60-180 BPM range
  const minInterval = Math.floor((60 / 180) * (22050 / step))
  const maxInterval = Math.floor((60 / 60) * (22050 / step))

  let bestLag = 0
  let maxCorr = 0

  const testLimit = Math.min(envelope.length - maxInterval, 50000)

  for (let lag = minInterval; lag <= maxInterval; lag++) {
    let corr = 0
    for (let i = 0; i < testLimit; i += 4) {
      corr += envelope[i] * envelope[i + lag]
    }
    if (corr > maxCorr) {
      maxCorr = corr
      bestLag = lag
    }
  }

  if (bestLag === 0) return 120
  const bpm = Math.round((60 * (22050 / step)) / bestLag)
  return bpm >= 60 && bpm <= 200 ? bpm : 120
}
