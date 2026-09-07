/**
 * 任务完成事件总线 — 「任务档案弹窗」的发射源（round-26）。
 *
 * 工具任务产出产物后 emitTaskDone()，App 层挂载的 TaskDoneModal 订阅并自动弹出，
 * 弹窗内可直接「打开」（壳=os.startfile 系统程序 / 浏览器=新标签预览）或「下载」
 * （壳=原生另存为 / 浏览器=a[download]）。
 *
 * 设计约束：
 * - 模块级单例 + useSyncExternalStore，零 React 上下文依赖 —— 任何视图/纯 TS
 *   交付层（deliver.ts）都能直接 emit，不用穿 props。
 * - 产物二选一：blob（前端内存产物，弹窗内现做 objectURL）或 output 文件
 *   （服务端产物，走 /api/download 与 /api/export/*）。blob 由弹窗负责 revoke。
 * - 弹窗关闭后档案保留在 modal 内部最近记录（App 层持有），不持久化——
 *   任务档案是「本次会话的交付仪式」，历史产物仍走各中心 output 列表。
 */

export type TaskArtifactKind = 'image' | 'pdf' | 'zip' | 'audio' | 'video' | 'text' | 'file'

export interface TaskArtifact {
  /** 展示与下载用的文件名（含扩展名） */
  name: string
  /** 前端内存产物：弹窗内直接交付（优先于 output） */
  blob?: Blob
  /** 服务端产物：output/ 目录内的文件名 + 可选子目录（MediaJobOutput.dir） */
  outputName?: string
  outputDir?: string
  kind: TaskArtifactKind
  /** 字节数（未知可不传，弹窗尝试从 blob/output 推断，推断不了就不显示大小） */
  size?: number
}

export interface TaskDoneRecord {
  id: number
  /** 工具显示名（已本地化，调用方用 t('tools.xxx') 取好再传入） */
  toolLabel: string
  finishedAt: number
  artifacts: TaskArtifact[]
}

type Listener = (record: TaskDoneRecord | null) => void

let current: TaskDoneRecord | null = null
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(current)
}

export function subscribeTaskDone(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTaskDone(): TaskDoneRecord | null {
  return current
}

export function dismissTaskDone(): void {
  current = null
  emit()
}

function kindFromName(name: string): TaskArtifactKind {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'ico'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['zip', '7z', 'gz', 'tar'].includes(ext)) return 'zip'
  if (['wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'gifv'].includes(ext)) return 'video'
  if (['txt', 'md', 'json', 'csv', 'log'].includes(ext)) return 'text'
  return 'file'
}

/**
 * 任务完成：记录档案并通知弹窗弹出。
 * @param toolLabel 工具显示名（调用方本地化后传入）
 * @param artifacts 产物清单（至少一项；纯提示类任务不弹窗就不调用）
 */
export function emitTaskDone(toolLabel: string, artifacts: TaskArtifact[]): void {
  const clean = artifacts.filter((a) => a.blob || a.outputName)
  if (!clean.length) return
  current = {
    id: nextId++,
    toolLabel,
    finishedAt: Date.now(),
    artifacts: clean.map((a) => ({ ...a, kind: a.kind ?? kindFromName(a.name) })),
  }
  emit()
}

/** 便捷封装：单个 blob 产物（前端内存工具最常见形态） */
export function emitTaskDoneBlob(toolLabel: string, blob: Blob, name: string): void {
  emitTaskDone(toolLabel, [{ blob, name, kind: kindFromName(name), size: blob.size }])
}

/** 便捷封装：单个服务端产物（output/ 文件） */
export function emitTaskDoneOutput(
  toolLabel: string,
  output: { name: string; dir?: string },
): void {
  emitTaskDone(toolLabel, [{
    name: output.name,
    outputName: output.name,
    outputDir: output.dir,
    kind: kindFromName(output.name),
  }])
}

/** 便捷封装：一批服务端产物（job 轮询 / 批处理完成形态） */
export function emitTaskDoneOutputs(
  toolLabel: string,
  outputs: Array<{ name: string; dir?: string }>,
): void {
  const artifacts: TaskArtifact[] = outputs.map((output) => ({
    name: output.name,
    outputName: output.name,
    outputDir: output.dir,
    kind: kindFromName(output.name),
  }))
  if (!artifacts.length) return
  emitTaskDone(toolLabel, artifacts)
}
