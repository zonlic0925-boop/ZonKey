import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** 触屏可用裁剪画布（图像工坊「图像裁剪」与工具箱「证件照换底色」共用）。
 *
 * round-25 重写要点：
 * 1. 画布宽度自适应容器（ResizeObserver 实测）而非桌面硬编码 600px，
 *    390px 手机视口下整图完整可见——旧实现固定 600 宽在手机上右侧被裁。
 * 2. Pointer Events + stage setPointerCapture 统一鼠标/触屏/笔，
 *    触屏拖框/拖框体/拉手柄不被浏览器手势抢走（round-24 打码同款修法）。
 * 3. 手柄渲染与热区分离：12px 视觉 + 触屏下 24px 命中热区，手机上
 *    「拖不动」主因是 12px 手柄低于指尖命中下限。
 */

export interface RectImage {
  x: number
  y: number
  width: number
  height: number
}

export type CropMode = 'free' | 'ratio' | 'cover'
export interface CropStageProps {
  /** objectURL 图片地址（组件内部自行 keep 尺寸/宽高比） */
  src: string
  /** 原图像素宽高（未传入时组件从 img 加载推断） */
  naturalWidth?: number
  naturalHeight?: number
  /** 目标像素裁剪框（受控），变更须为原图像素坐标 */
  value: RectImage
  onChange: (r: RectImage) => void
  /** 交互模式：free=自由裁剪；ratio=锁定比例裁剪（widthRatio/heightRatio）；
   *  cover=仅移动/缩放手柄锁定 ratio 的占满框（证件照换底色默认全图） */
  mode?: CropMode
  widthRatio?: number
  heightRatio?: number
  /** 最小裁剪边长（原图像素），默认 4 */
  minSize?: number
  /** 边框/手柄主题色（mem 变量名），默认 mem-pink */
  accent?: string
  /** 是否显示 X/Y/W/H 读数（预览下方，勿覆盖数值输入区） */
  showReadout?: boolean
}

type DragMode =
  | 'move'
  | 'new'
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const MIN_DRAW = 8 // 触屏拖画最小判定（原图像素）

export const CropStage: React.FC<CropStageProps> = ({
  src,
  naturalWidth,
  naturalHeight,
  value,
  onChange,
  mode = 'free',
  widthRatio = 1,
  heightRatio = 1,
  minSize = 4,
  accent = 'mem-pink',
  showReadout = false,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [img, setImg] = useState({ w: 0, h: 0 }) // 原图像素
  const [box, setBox] = useState({ w: 0, h: 0 }) // 画布显示尺寸
  const dragRef = useRef<{
    mode: DragMode
    pointerId: number
    startX: number
    startY: number
    start: RectImage
  } | null>(null)

  // 原图尺寸：优先 props，未给则读图
  useEffect(() => {
    if (naturalWidth && naturalHeight) {
      setImg({ w: naturalWidth, h: naturalHeight })
      return
    }
    const probe = new Image()
    probe.onload = () => setImg({ w: probe.naturalWidth, h: probe.naturalHeight })
    probe.src = src
  }, [src, naturalWidth, naturalHeight])

  // 容器宽度自适应：ResizeObserver（手机横竖屏/分栏实时跟随），限高 480
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const avail = Math.max(120, wrap.clientWidth - 8)
      const hMax = Math.min(560, window.innerHeight * 0.55)
      if (!img.w || !img.h) return
      let cw = avail
      let ch = Math.round((cw * img.h) / img.w)
      if (ch > hMax) {
        ch = hMax
        cw = Math.round((ch * img.w) / img.h)
      }
      setBox({ w: Math.max(1, cw), h: Math.max(1, ch) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [img.w, img.h])

  // 事件/渲染坐标换算（画布显示尺寸 == 原图等比例，纯比例换算）
  const toImgX = useCallback(
    (px: number) => (box.w && img.w ? clamp(Math.round((px / box.w) * img.w), 0, img.w) : 0),
    [box.w, img.w],
  )
  const toImgY = useCallback(
    (py: number) => (box.h && img.h ? clamp(Math.round((py / box.h) * img.h), 0, img.h) : 0),
    [box.h, img.h],
  )
  const fromImgX = (px: number) => (img.w && box.w ? (px / img.w) * box.w : 0)
  const fromImgY = (py: number) => (img.h && box.h ? (py / img.h) * box.h : 0)

  const localPoint = (e: React.PointerEvent) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const r = stage.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // 锁定比例的几何助手（mode !== 'free' 时宽高成比例约束）
  const ratioOf = (mode: CropMode) => (mode === 'free' ? 0 : heightRatio / widthRatio) // h = w * r
  const fitRatioRect = (
    x0: number, y0: number, x1: number, y1: number,
  ): RectImage => {
    const r = ratioOf(mode)
    if (!r) return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    let w = x1 - x0
    let h = w * r
    if (y0 + h > img.h) { h = img.h - y0; w = h / r }
    if (x0 + w > img.w) { w = img.w - x0; h = w * r }
    return { x: x0, y: y0, width: Math.max(0, w), height: Math.max(0, h) }
  }
  const clampRatioRect = (r: RectImage): RectImage => {
    const k = ratioOf(mode)
    const maxW = img.w, maxH = img.h
    if (!k) {
      const w = clamp(Math.round(r.width), minSize, maxW)
      const h = clamp(Math.round(r.height), minSize, maxH)
      const x = clamp(Math.round(r.x), 0, maxW - w)
      const y = clamp(Math.round(r.y), 0, maxH - h)
      return { x, y, width: w, height: h }
    }
    // 等比：以中心为锚缩放/平移后夹在界内
    let w = clamp(Math.round(r.width), minSize, maxW)
    let h = clamp(Math.round(r.height), minSize, maxH)
    if (Math.abs(h / w - k) > 0.02) { w = clamp(Math.round(h / k), minSize, maxW); h = Math.round(w * k) }
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const x = clamp(cx - w / 2, 0, Math.max(0, maxW - w))
    const y = clamp(cy - h / 2, 0, Math.max(0, maxH - h))
    return { x: Math.round(x), y: Math.round(y), width: w, height: Math.round(h) }
  }

  const down = (e: React.PointerEvent, m: DragMode) => {
    // 触屏 pointerdown 的 button=-1（规范：无按钮变化），只对鼠标检查主键，
    // 否则触屏拖画永远进不来（round-25 实测坑，同 ImageMaskView 修法）。
    // 注意：touch pointerdown 上不能调 preventDefault()——Chromium 合成触屏
    // 序列里这会抑制后续 pointermove 派发（实测 CDP 链路 move/up 全部消失），
    // 防手势交给 stage 的 touch-action:none；stopPropagation 保留防止冒泡触发
    // 外层拖拽/滚动（打码工具同款行为）。
    if (!img.w || !img.h || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.stopPropagation()
    const p = localPoint(e)
    const ix = toImgX(p.x)
    const iy = toImgY(p.y)
    const start = m === 'new' ? { x: ix, y: iy, width: 0, height: 0 } : { ...value }
    dragRef.current = { mode: m, pointerId: e.pointerId, startX: ix, startY: iy, start }
    try { stageRef.current?.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  const move = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId || !img.w) return
    const p = localPoint(e)
    const ix = toImgX(p.x)
    const iy = toImgY(p.y)
    const s = d.start
    let next: RectImage = { ...s }
    const dx = ix - d.startX
    const dy = iy - d.startY
    const r = ratioOf(mode)
    switch (d.mode) {
      case 'new': {
        const x0 = Math.min(s.x, ix), y0 = Math.min(s.y, iy)
        const x1 = Math.max(s.x, ix), y1 = Math.max(s.y, iy)
        if (!r) {
          next = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
        } else {
          // 按起点向对角方向生长，锁定宽高比
          let w = x1 - s.x, h = y1 - s.y
          const sx = ix >= s.x ? 1 : -1
          const sy = iy >= s.y ? 1 : -1
          const wAbs = Math.max(Math.abs(w), Math.abs(h) / r)
          next = { x: s.x, y: s.y, width: sx * wAbs, height: sy * wAbs * r }
          // 负向生长翻转到左上角
          if (sx < 0) next.x = s.x - Math.abs(next.width)
          if (sy < 0) next.y = s.y - Math.abs(next.height)
          if (next.width < 0) { next.width = Math.abs(next.width); next.x = s.x }
          if (next.height < 0) { next.height = Math.abs(next.height); next.y = s.y }
        }
        next = clampRatioRect(next)
        break
      }
      case 'move': {
        const nx = clamp(s.x + dx, 0, Math.max(0, img.w - s.width))
        const ny = clamp(s.y + dy, 0, Math.max(0, img.h - s.height))
        next = { ...s, x: nx, y: ny }
        break
      }
      default: {
        // 八向手柄：等比模式下任何角/边都围绕对边中心等比缩放
        let x = s.x, y = s.y, w = s.width, h = s.height
        const d0 = d.mode
        const right = d0.includes('e')
        const bottom = d0.includes('s')
        const left = d0.includes('w')
        const top = d0.includes('n')
        if (mode !== 'free') {
          const k = r!
          const cx = s.x + (right ? s.width : 0)
          const cy = s.y + (bottom ? s.height : 0)
          // 对角向的投影长度（沿拖动方向维持比例）
          let raw = 0
          if (left || right) raw = right ? s.width + dx : s.width - dx
          else raw = bottom ? s.height + dy : s.height - dy
          const nw = Math.max(minSize, Math.round(raw))
          const nh = Math.max(minSize, Math.round(nw * k))
          // 锚点在对侧（left 锚右缘/right 锚左缘）
          const ax = left ? s.x + s.width : s.x
          const ay = top ? s.y + s.height : s.y
          if (left) { x = ax - nw } else { x = ax }
          if (top) { y = ay - nh } else { y = ay }
          w = nw; h = nh
          // 边界收束
          if (x < 0) { w += x; x = 0; h = Math.max(1, Math.round(w * k)) }
          if (y < 0) { h += y; y = 0; w = Math.max(1, Math.round(h / k)) }
          if (x + w > img.w) { w = img.w - x; h = Math.max(1, Math.round(w * k)) }
          if (y + h > img.h) { h = img.h - y; w = Math.max(1, Math.round(h / k)) }
        } else {
          if (right) w = Math.max(minSize, s.width + dx)
          if (bottom) h = Math.max(minSize, s.height + dy)
          if (left) {
            const nx0 = clamp(s.x + dx, 0, s.x + s.width - minSize)
            w = s.width + (s.x - nx0)
            x = nx0
          }
          if (top) {
            const ny0 = clamp(s.y + dy, 0, s.y + s.height - minSize)
            h = s.height + (s.y - ny0)
            y = ny0
          }
          // 边界收束
          if (x + w > img.w) w = Math.max(minSize, img.w - x)
          if (y + h > img.h) h = Math.max(minSize, img.h - y)
        }
        next = clampRatioRect({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) })
      }
    }
    if (next.width >= 1 && next.height >= 1) onChange(next)
  }

  const up = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    try { stageRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }

  const ready = img.w > 0 && box.w > 0
  // 手柄命中热区整体放在框内：stage 是 overflow-hidden，框贴边时任何伸向
  // 框外的部分都会被裁掉且不可命中（全图框时四角手柄只剩框内半边可用）。
  // 28px 热区中心 = 框角向框内偏 14px，视觉方块 14px 再内嵌 7px。
  const inset = 14
  const handles: Array<{ key: DragMode; x: number; y: number }> = ready
    ? [
      { key: 'nw', x: fromImgX(value.x) + inset, y: fromImgY(value.y) + inset },
      { key: 'ne', x: fromImgX(value.x + value.width) - inset, y: fromImgY(value.y) + inset },
      { key: 'sw', x: fromImgX(value.x) + inset, y: fromImgY(value.y + value.height) - inset },
      { key: 'se', x: fromImgX(value.x + value.width) - inset, y: fromImgY(value.y + value.height) - inset },
      { key: 'n', x: fromImgX(value.x + value.width / 2), y: fromImgY(value.y) + inset },
      { key: 's', x: fromImgX(value.x + value.width / 2), y: fromImgY(value.y + value.height) - inset },
      { key: 'w', x: fromImgX(value.x) + inset, y: fromImgY(value.y + value.height / 2) },
      { key: 'e', x: fromImgX(value.x + value.width) - inset, y: fromImgY(value.y + value.height / 2) },
    ]
    : []
  const cursors: Record<string, string> = {
    n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
    ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
  }

  if (!ready) {
    // wrapper 必须恒渲染：ready 依赖 box.w（由 ResizeObserver 实测 wrapper 得出），
    // 若这里 return null 则 wrapRef 永不挂载、box 永远为 0（自锁死循环）
    return <div ref={wrapRef} className="w-full" />
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div
        ref={stageRef}
        className="relative overflow-hidden border-2 border-mem-ink rounded-xl select-none touch-none"
        style={{ width: box.w, height: box.h, cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={(e) => down(e, 'new')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <img src={src} alt="" draggable={false} className="block w-full h-full pointer-events-none object-fill" />
        {/* 遮罩：框外压暗，只在有真实框时显示 */}
        {value.width > 0 && value.height > 0 && (
          <>
            <div className="absolute inset-0 pointer-events-none bg-mem-ink/50" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${fromImgX(value.x)}px ${fromImgY(value.y)}px, ${fromImgX(value.x)}px ${fromImgY(value.y + value.height)}px, ${fromImgX(value.x + value.width)}px ${fromImgY(value.y + value.height)}px, ${fromImgX(value.x + value.width)}px ${fromImgY(value.y)}px, ${fromImgX(value.x)}px ${fromImgY(value.y)}px)` }} />
            {/* 框体：move（stage 冒泡优先，自身 pointerdown 拦截） */}
            <div
              className="absolute border-2 cursor-move"
              style={{
                left: fromImgX(value.x), top: fromImgY(value.y),
                width: fromImgX(value.width), height: fromImgY(value.height),
                borderColor: 'var(--mem-coral)',
                zIndex: 3,
              }}
              onPointerDown={(e) => down(e, 'move')}
            />
            {/* 八向手柄：视觉 14px + 热区 28px（触屏命中下限） */}
            {handles.map((hp) => (
              <div
                key={hp.key}
                className="absolute"
                style={{ left: hp.x - 14, top: hp.y - 14, width: 28, height: 28, zIndex: 4, cursor: cursors[hp.key] ?? 'default', touchAction: 'none' }}
                onPointerDown={(e) => down(e, hp.key)}
              >
                <div
                  className="absolute rounded-sm border-2"
                  style={{
                    left: 7, top: 7, width: 14, height: 14,
                    background: '#fff', borderColor: 'var(--mem-coral)',
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>
      {showReadout && value.width > 0 && (
        <div className="mt-1.5 flex justify-end font-mono text-[10px] font-bold text-mem-ink/50">
          {value.width}×{value.height}
        </div>
      )}
    </div>
  )
}
