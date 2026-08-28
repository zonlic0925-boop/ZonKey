/**
 * 音视频中心核心。
 * - WAV 编码/音频解码/裁剪/格式转换/视频音轨提取：Web Audio 标准管线
 * - BPM 检测：移植 ToolKnit bpm-detect-core.js 的 analyzeBpmPcm 主算法
 *   （能量包络 → onset 包络 → 自相关峰值 + 峰值间隔直方图 → 调性融合评分）。
 *   Beatroot/实时引擎与调性检测依赖其外部库，属后续批次。
 * - 视频抽帧：<video> 精确 seek + Canvas 抓帧
 */

export const MEDIA_LIMITS = Object.freeze({
  maxAudioBytes: 50 * 1024 * 1024,
  maxVideoBytes: 200 * 1024 * 1024,
  maxDurationSeconds: 5 * 60,
});

// ===== 音频解码 =====

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  if (file.size > MEDIA_LIMITS.maxAudioBytes && !(file instanceof File && /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name))) {
    throw new Error(`Audio exceeds the ${MEDIA_LIMITS.maxAudioBytes / 1024 / 1024}MB limit`);
  }
  const arrayBuffer = await file.arrayBuffer();
  try {
    return await getAudioContext().decodeAudioData(arrayBuffer);
  } catch {
    throw new Error('Could not decode the file as audio');
  }
}

// ===== WAV 编码（16-bit PCM） =====

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export interface ClipRange {
  startSeconds: number;
  endSeconds: number;
}

export async function clipAudioToWav(file: File, range: ClipRange): Promise<{ blob: Blob; fileName: string; duration: number }> {
  const buffer = await decodeAudioFile(file);
  const sampleRate = buffer.sampleRate;
  const start = Math.max(0, Math.min(range.startSeconds, buffer.duration));
  const end = Math.max(start + 1 / sampleRate, Math.min(range.endSeconds, buffer.duration));
  const startFrame = Math.floor(start * sampleRate);
  const frameCount = Math.floor((end - start) * sampleRate);

  const clipped = getAudioContext().createBuffer(Math.min(2, buffer.numberOfChannels), frameCount, sampleRate);
  for (let channel = 0; channel < clipped.numberOfChannels; channel += 1) {
    clipped.copyToChannel(buffer.getChannelData(channel).subarray(startFrame, startFrame + frameCount), channel);
  }
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob: audioBufferToWav(clipped), fileName: `${baseName}_clip.wav`, duration: buffer.duration };
}

export async function convertAudioToWav(file: File): Promise<{ blob: Blob; fileName: string; duration: number }> {
  const buffer = await decodeAudioFile(file);
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob: audioBufferToWav(buffer), fileName: `${baseName}.wav`, duration: buffer.duration };
}

/** 从视频容器中抽取音轨（Chromium 可解码 mp4/webm 音频轨） */
export async function extractAudioFromVideo(file: File): Promise<{ blob: Blob; fileName: string; duration: number }> {
  if (file.size > MEDIA_LIMITS.maxVideoBytes) throw new Error(`Video exceeds the ${MEDIA_LIMITS.maxVideoBytes / 1024 / 1024}MB limit`);
  const buffer = await decodeAudioFile(file);
  const baseName = file.name.replace(/\.[^.\\/]+$/, '');
  return { blob: audioBufferToWav(buffer), fileName: `${baseName}_audio.wav`, duration: buffer.duration };
}

// ===== BPM 检测（移植自 ToolKnit analyzeBpmPcm） =====

const BPM_DISPLAY_MIN = 30;
const BPM_DISPLAY_MAX = 300;
const BPM_ANALYSIS_MIN = 55;
const BPM_ANALYSIS_MAX = 210;
const BPM_COMMON_MIN = 70;
const BPM_COMMON_MAX = 180;
const BPM_ENVELOPE_WINDOW = 1024;
const BPM_ENVELOPE_HOP = 512;

export interface BpmCandidate {
  bpm: number;
  confidence: number;
}

export interface BpmResult {
  bpm: number | null;
  confidence: number;
  candidates: BpmCandidate[];
  analyzedSeconds: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function normalizeTempo(tempo: number): number {
  let normalized = tempo;
  while (normalized < BPM_ANALYSIS_MIN) normalized *= 2;
  while (normalized > BPM_ANALYSIS_MAX) normalized /= 2;
  return normalized;
}

interface TempoCandidateInternal {
  bpm: number;
  score: number;
  sources: Set<string>;
}

function addTempoCandidate(merged: Map<number, TempoCandidateInternal>, tempo: number, score: number, source = 'local'): void {
  if (!Number.isFinite(tempo) || !Number.isFinite(score) || score <= 0) return;
  const normalized = normalizeTempo(tempo);
  if (!Number.isFinite(normalized) || normalized < BPM_DISPLAY_MIN || normalized > BPM_DISPLAY_MAX) return;
  const key = Math.round(normalized);
  const current = merged.get(key) ?? { bpm: key, score: 0, sources: new Set<string>() };
  current.score += score;
  current.sources.add(source);
  merged.set(key, current);
}

function tempoAffinity(left: number, right: number): number {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return 0;
  if (Math.abs(left - right) <= 1.5) return 1;
  if (Math.abs(left * 2 - right) <= 2 || Math.abs(left - right * 2) <= 2) return 0.42;
  if (Math.min(Math.abs(left * 1.5 - right), Math.abs(left - right * 1.5)) <= 2) return 0.18;
  return 0;
}

function commonTempoPreference(bpm: number): number {
  if (bpm >= 138 && bpm <= 172) return 1.11;
  if (bpm >= 84 && bpm <= 156) return 1.08;
  if (bpm >= BPM_COMMON_MIN && bpm <= BPM_COMMON_MAX) return 1;
  return 0.9;
}

function sourceQualityBonus(candidate: TempoCandidateInternal): number {
  let bonus = 0;
  if (candidate.sources.has('beatroot-top')) bonus += 0.38;
  if (candidate.sources.has('beatroot')) bonus += 0.26;
  if (candidate.sources.has('realtime')) bonus += 0.16;
  if (candidate.sources.has('local-top')) bonus += 0.1;
  return bonus;
}

function hasProfessionalSource(candidate: TempoCandidateInternal): boolean {
  return candidate.sources.has('beatroot-top') || candidate.sources.has('beatroot') || candidate.sources.has('realtime');
}

function buildTempoResult(merged: Map<number, TempoCandidateInternal>, analyzedSeconds: number): BpmResult {
  const base = [...merged.values()];
  if (base.length === 0) return { bpm: null, confidence: 0, candidates: [], analyzedSeconds };

  const reinforced = base
    .map((candidate) => {
      let harmonicScore = 0;
      for (const other of base) {
        if (other === candidate) continue;
        harmonicScore += other.score * tempoAffinity(candidate.bpm, other.bpm) * 0.28;
      }
      const score = (candidate.score + harmonicScore + sourceQualityBonus(candidate)) * commonTempoPreference(candidate.bpm);
      return { ...candidate, score, confidenceScore: candidate.score + harmonicScore };
    })
    .sort((left, right) => right.score - left.score || Math.abs(left.bpm - 120) - Math.abs(right.bpm - 120));

  let first = reinforced[0];
  if (first && first.bpm < BPM_COMMON_MIN) {
    const doubleCandidate = reinforced
      .filter((candidate) => candidate.bpm >= BPM_COMMON_MIN && candidate.bpm <= 156 && Math.abs(candidate.bpm - first!.bpm * 2) <= 4 && candidate.score >= first!.score * 0.34)
      .sort((left, right) => Math.abs(left.bpm - first!.bpm * 2) - Math.abs(right.bpm - first!.bpm * 2) || right.score - left.score)[0];
    if (doubleCandidate) first = doubleCandidate;
  } else if (first && first.bpm > 176) {
    const halfCandidate = reinforced
      .filter((candidate) => candidate.bpm >= 88 && candidate.bpm <= BPM_COMMON_MAX && Math.abs(candidate.bpm * 2 - first!.bpm) <= 4 && candidate.score >= first!.score * 0.42)
      .sort((left, right) => Math.abs(left.bpm * 2 - first!.bpm) - Math.abs(right.bpm * 2 - first!.bpm) || right.score - left.score)[0];
    if (halfCandidate) first = halfCandidate;
  }
  if (first && first.bpm >= 86 && first.bpm <= 118) {
    const oneAndHalfCandidate = reinforced
      .filter((candidate) => candidate.bpm >= 130 && candidate.bpm <= 176 && Math.abs(candidate.bpm - first!.bpm * 1.5) <= 6 && candidate.score >= first!.score * 0.28 && hasProfessionalSource(candidate))
      .sort((left, right) => Math.abs(left.bpm - first!.bpm * 1.5) - Math.abs(right.bpm - first!.bpm * 1.5) || right.score - left.score)[0];
    if (oneAndHalfCandidate) first = oneAndHalfCandidate;
  }

  const orderedCandidates = first ? [first, ...reinforced.filter((candidate) => candidate !== first)] : reinforced;
  const secondScore = orderedCandidates.find((candidate) => candidate !== first)?.score ?? 0;
  if (!first || first.score < 0.08) return { bpm: null, confidence: 0, candidates: [], analyzedSeconds };

  const separation = 1 - Math.min(0.55, (secondScore / Math.max(first.score, 1e-6)) * 0.32);
  const sourceBonus = first.sources.size > 1 ? 1.12 : 1;
  const confidence = Math.round(Math.max(0, Math.min(1, first.confidenceScore * sourceBonus * separation)) * 100) / 100;
  return {
    bpm: first.bpm,
    confidence,
    candidates: orderedCandidates.slice(0, 7).map((candidate) => ({
      bpm: candidate.bpm,
      confidence: Math.round(Math.max(0, Math.min(1, candidate.confidenceScore)) * 100) / 100,
    })),
    analyzedSeconds,
  };
}

function extractPeakIntervalCandidates(envelope: Float64Array, envelopeRate: number): { bpm: number; score: number }[] {
  const minLag = Math.max(1, Math.floor((60 * envelopeRate) / BPM_ANALYSIS_MAX));
  const maxLag = Math.max(minLag + 1, Math.ceil((60 * envelopeRate) / BPM_ANALYSIS_MIN));
  const activeValues = Array.from(envelope).filter((value) => value > 0);
  if (activeValues.length < 4) return [];
  const threshold = Math.max(0.08, percentile(activeValues, 0.7) * 0.78);
  const rawPeaks: { index: number; value: number }[] = [];
  for (let index = 1; index < envelope.length - 1; index++) {
    const value = envelope[index];
    if (value < threshold || value < envelope[index - 1] || value <= envelope[index + 1]) continue;
    rawPeaks.push({ index, value });
  }
  if (rawPeaks.length < 3) return [];

  const minDistance = Math.max(1, Math.floor(minLag * 0.62));
  const selected: { index: number; value: number }[] = [];
  for (const peak of rawPeaks.sort((left, right) => right.value - left.value)) {
    if (selected.some((current) => Math.abs(current.index - peak.index) < minDistance)) continue;
    selected.push(peak);
    if (selected.length >= 260) break;
  }
  selected.sort((left, right) => left.index - right.index);
  if (selected.length < 3) return [];

  const histogram = new Map<number, number>();
  for (let left = 0; left < selected.length - 1; left++) {
    for (let right = left + 1; right < selected.length; right++) {
      const distance = selected[right].index - selected[left].index;
      if (distance > maxLag * 4) break;
      const pairWeight = Math.sqrt(selected[left].value * selected[right].value);
      for (let divisor = 1; divisor <= 4; divisor++) {
        const lag = distance / divisor;
        if (lag < minLag || lag > maxLag) continue;
        const tempo = normalizeTempo((60 * envelopeRate) / lag);
        const key = Math.round(tempo);
        const score = pairWeight / Math.pow(divisor, 0.82);
        histogram.set(key, (histogram.get(key) ?? 0) + score);
      }
    }
  }
  const maxScore = Math.max(0, ...histogram.values());
  if (maxScore <= 0) return [];
  return [...histogram.entries()]
    .map(([bpm, score]) => ({ bpm, score: score / maxScore }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

export function analyzeBpmPcm(samples: Float32Array, sampleRate: number): BpmResult {
  if (!(samples instanceof Float32Array) || samples.length < BPM_ENVELOPE_WINDOW * 8) {
    throw new Error('The decoded audio is too short for BPM analysis.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate < 1000 || sampleRate > 192000) {
    throw new Error('The decoded audio has an invalid sample rate.');
  }

  // 能量包络：RMS×0.78 + 峰值×0.22，窗 1024 / 跳 512
  const energies: number[] = [];
  for (let start = 0; start + BPM_ENVELOPE_WINDOW <= samples.length; start += BPM_ENVELOPE_HOP) {
    let sum = 0;
    let peakAbs = 0;
    for (let index = start; index < start + BPM_ENVELOPE_WINDOW; index++) sum += samples[index] * samples[index];
    for (let index = start; index < start + BPM_ENVELOPE_WINDOW; index++) {
      const abs = Math.abs(samples[index]);
      if (abs > peakAbs) peakAbs = abs;
    }
    energies.push(Math.sqrt(sum / BPM_ENVELOPE_WINDOW) * 0.78 + peakAbs * 0.22);
  }
  const floor = median(energies);
  const deviations = energies.map((value) => Math.max(0, value - floor));
  const envelope = new Float64Array(deviations.length);
  let peak = 0;
  let onsetTotal = 0;
  for (let index = 0; index < deviations.length; index++) {
    const start = Math.max(0, index - 8);
    let localAverage = 0;
    for (let cursor = start; cursor < index; cursor++) localAverage += deviations[cursor];
    localAverage /= Math.max(1, index - start);
    const risingEdge = Math.max(0, deviations[index] - (deviations[index - 1] ?? 0));
    const onset = Math.max(0, deviations[index] - localAverage * 0.62) + risingEdge * 0.42;
    envelope[index] = onset;
    peak = Math.max(peak, onset);
    onsetTotal += onset;
  }
  if (peak < 1e-5 || onsetTotal < 1e-4) {
    return { bpm: null, confidence: 0, candidates: [], analyzedSeconds: samples.length / sampleRate };
  }
  for (let index = 0; index < envelope.length; index++) envelope[index] /= peak;

  // 自相关周期估计
  const envelopeRate = sampleRate / BPM_ENVELOPE_HOP;
  const minLag = Math.max(1, Math.floor((60 * envelopeRate) / BPM_ANALYSIS_MAX));
  const maxLag = Math.min(envelope.length - 2, Math.ceil((60 * envelopeRate) / BPM_ANALYSIS_MIN));
  const rawCandidates: { lag: number; tempo: number; score: number }[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = lag; index < envelope.length; index++) {
      sum += envelope[index] * envelope[index - lag];
      leftEnergy += envelope[index] * envelope[index];
      rightEnergy += envelope[index - lag] * envelope[index - lag];
    }
    const score = sum / Math.sqrt(leftEnergy * rightEnergy || 1);
    if (Number.isFinite(score)) rawCandidates.push({ lag, tempo: (60 * envelopeRate) / lag, score });
  }

  interface LagPeak { lag: number; tempo: number; score: number }
  const peaks = rawCandidates
    .map((candidate, index, values): LagPeak | null => {
      const before = values[index - 1]?.score ?? Number.NEGATIVE_INFINITY;
      const after = values[index + 1]?.score ?? Number.NEGATIVE_INFINITY;
      if (candidate.score < before || candidate.score <= after) return null;
      const curvature = before - 2 * candidate.score + after;
      const offset = Number.isFinite(curvature) && curvature < -1e-9
        ? Math.max(-0.5, Math.min(0.5, (0.5 * (before - after)) / curvature))
        : 0;
      return { ...candidate, tempo: (60 * envelopeRate) / (candidate.lag + offset) };
    })
    .filter((candidate): candidate is LagPeak => candidate !== null);

  const merged = new Map<number, TempoCandidateInternal>();
  for (const candidate of peaks) {
    const tempo = normalizeTempo(candidate.tempo);
    const proximity = 1 - Math.min(0.08, Math.abs(tempo - 120) / 1500);
    addTempoCandidate(merged, tempo, candidate.score * proximity * 0.82, 'autocorrelation');
  }
  for (const candidate of extractPeakIntervalCandidates(envelope, envelopeRate)) {
    addTempoCandidate(merged, candidate.bpm, candidate.score * 0.95, 'beat-peaks');
  }

  return buildTempoResult(merged, samples.length / sampleRate);
}

/** 混合为单声道 Float32 后检测 */
export async function detectBpm(file: File): Promise<BpmResult> {
  const buffer = await decodeAudioFile(file);
  const duration = Math.min(buffer.duration, 126);
  const frames = Math.min(buffer.length, Math.ceil(duration * buffer.sampleRate));
  const mono = new Float32Array(frames);
  const channels = Math.min(2, buffer.numberOfChannels);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let frame = 0; frame < frames; frame += 1) mono[frame] += data[frame];
  }
  for (let frame = 0; frame < frames; frame += 1) mono[frame] /= channels;
  return analyzeBpmPcm(mono, buffer.sampleRate);
}

// ===== 视频抽帧 =====

export async function captureVideoFrame(
  file: File,
  timestampSeconds: number,
): Promise<{ blob: Blob; fileName: string; duration: number; width: number; height: number }> {
  if (file.size > MEDIA_LIMITS.maxVideoBytes) throw new Error(`Video exceeds the ${MEDIA_LIMITS.maxVideoBytes / 1024 / 1024}MB limit`);
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not load the video'));
    });
    const target = Math.max(0, Math.min(timestampSeconds, Math.max(0, video.duration - 0.05)));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Could not seek in the video'));
      video.currentTime = target;
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('capture-failed'))), 'image/png');
    });
    const baseName = file.name.replace(/\.[^.\\/]+$/, '');
    return {
      blob,
      fileName: `${baseName}_frame_${target.toFixed(2).replace('.', '_')}s.png`,
      duration: video.duration,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
