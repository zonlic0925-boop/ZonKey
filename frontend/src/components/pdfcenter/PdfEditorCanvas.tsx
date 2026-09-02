import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { MousePointer, Square, Circle, Type, Type as PenTool, Trash2, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { PdfElement, PageInfo } from '../../types';
import { getContainedImageMetrics, pdfBoxToOverlayPixels, overlayPointerToPdf } from '../../lib/imageLayout';
import { useI18n } from '../../i18n';

interface PdfEditorCanvasProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  pageInfo: PageInfo | null;
  elements: PdfElement[];
  setElements: React.Dispatch<React.SetStateAction<PdfElement[]>>;
  pagesLoading: boolean;
  onAddSignatureRequest: () => void;
}

type EditMode = 'select' | 'text' | 'rect' | 'ellipse' | 'sign';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_SIZE = 8;
const MIN_USER_ZOOM = 0.25;
const MAX_USER_ZOOM = 5;
const ZOOM_STEP = 1.15;

function hitTestHandle(px: number, py: number, width: number, height: number): ResizeHandle | null {
  const hs = 14; 
  const cx = width / 2;
  const cy = height / 2;
  const corners: Array<[ResizeHandle, number, number]> = [
    ['nw', 0, 0],
    ['ne', width, 0],
    ['se', width, height],
    ['sw', 0, height],
  ];
  for (const [handle, hx, hy] of corners) {
    if (Math.abs(px - hx) <= hs && Math.abs(py - hy) <= hs) return handle;
  }
  return null;
}

export const PdfEditorCanvas: React.FC<PdfEditorCanvasProps> = ({
  currentPage,
  totalPages,
  setCurrentPage,
  pageInfo,
  elements,
  setElements,
  pagesLoading,
  onAddSignatureRequest
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<EditMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [userScale, setUserScale] = useState(1);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [imageMetrics, setImageMetrics] = useState<any>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);
  
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const editSessionRef = useRef<{ id: string; mode: 'drag'|'resize'; handle?: ResizeHandle, startBbox: any, startPt: any } | null>(null);
  const [liveBox, setLiveBox] = useState<any | null>(null);

  // 文字元素 DOM 引用表：onBlur 回写不能读 e.currentTarget——React 18 批处理
  // 在事件处理器返回后才执行 setElements 的 updater，那时事件对象已被回收
  // （currentTarget=null），读它必抛 TypeError，且发生在渲染器 reducer 阶段，
  // 直接把整棵 React 树卸掉 = 白屏卡死（round-10 用户实测根因）。
  const textRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 元素拖动/缩放手势期间标记 <html data-canvas-gesture>，Header 拖拽行
  // 整体转 no-drag（与 CanvasViewport 同款纵深防御：拖到标题栏区域不劫持成移窗口）。
  useEffect(() => {
    if (editingElementId) {
      document.documentElement.setAttribute('data-canvas-gesture', '1');
      return () => document.documentElement.removeAttribute('data-canvas-gesture');
    }
  }, [editingElementId]);

  const clampUserScale = useCallback((value: number) => Math.min(MAX_USER_ZOOM, Math.max(MIN_USER_ZOOM, value)), []);

  const updateViewport = useCallback(() => {
    if (containerRef.current) {
      const cs = getComputedStyle(containerRef.current);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setViewportSize({
        w: Math.max(0, containerRef.current.clientWidth - padX),
        h: Math.max(0, containerRef.current.clientHeight - padY)
      });
    }
  }, []);

  useLayoutEffect(() => { updateViewport(); }, [pageInfo?.image_url]);
  
  useEffect(() => {
    const ob = new ResizeObserver(updateViewport);
    if (containerRef.current) ob.observe(containerRef.current);
    return () => ob.disconnect();
  }, [updateViewport]);

  const syncMetrics = useCallback(() => {
    if (imageRef.current && pageInfo) {
      setImageMetrics(getContainedImageMetrics(imageRef.current, pageInfo.width, pageInfo.height));
    }
  }, [pageInfo, userScale]);

  useLayoutEffect(() => { syncMetrics(); }, [syncMetrics]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setUserScale((s) => clampUserScale(s * factor));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [clampUserScale]);

  const pointerToLayout = (clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return {
      x: ((clientX - rect.left) * img.clientWidth) / rect.width,
      y: ((clientY - rect.top) * img.clientHeight) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    
    // Selecting empty space clears selection
    if (mode === 'select' && (e.target as HTMLElement).tagName === 'IMG') {
        setSelectedId(null);
        return;
    }

    if (mode === 'rect' || mode === 'ellipse') {
        e.preventDefault();
        const pt = pointerToLayout(e.clientX, e.clientY);
        if (pt) {
            setDrawStart(pt);
            setDrawCurrent(pt);
            setIsDrawing(true);
        }
    } else if (mode === 'text' || mode === 'sign') {
        e.preventDefault();
        const pt = pointerToLayout(e.clientX, e.clientY);
        if (pt && imageMetrics && pageInfo) {
            const pdfPt = overlayPointerToPdf(pt.x, pt.y, imageMetrics);
            if (pdfPt) {
                if (mode === 'text') {
                    const newEl: PdfElement = {
                        id: `text_${Date.now()}`,
                        page: currentPage,
                        type: 'text',
                        text: t('editor.defaultText', 'Double click to edit' as any),
                        fontSize: 24,
                        color: '#000000',
                        x: pdfPt.x,
                        y: pdfPt.y,
                        width: 150, // default placeholder
                        height: 30
                    };
                    setElements([...elements, newEl]);
                    setSelectedId(newEl.id);
                    setMode('select');
                } else if (mode === 'sign') {
                    onAddSignatureRequest();
                    setMode('select');
                }
            }
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const pt = pointerToLayout(e.clientX, e.clientY);
    if (isDrawing && pt) setDrawCurrent(pt);
    
    if (editingElementId && editSessionRef.current && imageMetrics && pageInfo && pt) {
        const session = editSessionRef.current;
        const pdfPt = overlayPointerToPdf(pt.x, pt.y, imageMetrics);
        const startPdfPt = overlayPointerToPdf(session.startPt.x, session.startPt.y, imageMetrics);
        if (!pdfPt || !startPdfPt) return;

        const dx = pdfPt.x - startPdfPt.x;
        const dy = pdfPt.y - startPdfPt.y;
        
        let { x, y, width, height } = session.startBbox;
        if (session.mode === 'drag') {
            x += dx; y += dy;
        } else if (session.handle) {
            if (session.handle.includes('e')) width += dx;
            if (session.handle.includes('w')) { x += dx; width -= dx; }
            if (session.handle.includes('s')) height += dy;
            if (session.handle.includes('n')) { y += dy; height -= dy; }
        }
        
        setLiveBox({ x, y, width: Math.max(10, width), height: Math.max(10, height) });
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && drawStart && drawCurrent && imageMetrics && pageInfo) {
        const x0 = Math.min(drawStart.x, drawCurrent.x);
        const y0 = Math.min(drawStart.y, drawCurrent.y);
        const x1 = Math.max(drawStart.x, drawCurrent.x);
        const y1 = Math.max(drawStart.y, drawCurrent.y);
        
        const p0 = overlayPointerToPdf(x0, y0, imageMetrics);
        const p1 = overlayPointerToPdf(x1, y1, imageMetrics);
        
        if (p0 && p1 && Math.abs(p1.x - p0.x) > 5) {
            const newEl: PdfElement = {
                id: `${mode}_${Date.now()}`,
                page: currentPage,
                type: mode as 'rect' | 'ellipse',
                x: p0.x,
                y: p0.y,
                width: p1.x - p0.x,
                height: p1.y - p0.y,
                color: '#ED5E5E', // Memphis coral
                strokeWidth: 3
            };
            setElements([...elements, newEl]);
            setSelectedId(newEl.id);
        }
        setIsDrawing(false);
        setMode('select');
    }
    
    if (editingElementId && liveBox) {
        setElements(elements.map(e => e.id === editingElementId ? { ...e, ...liveBox } : e));
        setEditingElementId(null);
        editSessionRef.current = null;
        setLiveBox(null);
    }
  };

  const startEdit = (el: PdfElement, mode: 'drag'|'resize', pt: any, handle?: ResizeHandle) => {
      setSelectedId(el.id);
      setEditingElementId(el.id);
      editSessionRef.current = { id: el.id, mode, handle, startBbox: { ...el }, startPt: pt };
      setLiveBox({ x: el.x, y: el.y, width: el.width, height: el.height });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
        if (!selectedId) return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            setElements(els => els.filter(el => el.id !== selectedId));
            setSelectedId(null);
        }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const pageEls = elements.filter(e => e.page === currentPage);
  const activeEl = elements.find(e => e.id === selectedId);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-mem-cream/50 min-h-0">
        
      {/* Editor Main Top Toolbar */}
      <div className="shrink-0 flex items-center p-2 gap-2 border-b-2 border-mem-ink/20 bg-white shadow-sm z-20 overflow-x-auto">
         <button onClick={() => setMode('select')} className={`p-1.5 rounded-lg border-2 ${mode==='select'?'bg-mem-yellow border-mem-ink':'border-transparent hover:bg-black/5'}`}>
             <MousePointer className="w-5 h-5"/>
         </button>
         <button onClick={() => setMode('text')} className={`p-1.5 rounded-lg border-2 ${mode==='text'?'bg-mem-teal border-mem-ink':'border-transparent hover:bg-black/5'}`}>
             <Type className="w-5 h-5"/>
         </button>
         <div className="w-[2px] h-6 bg-mem-ink/10 mx-1" />
         <button onClick={() => setMode('rect')} className={`p-1.5 rounded-lg border-2 ${mode==='rect'?'bg-mem-coral border-mem-ink':'border-transparent hover:bg-black/5'}`}>
             <Square className="w-5 h-5"/>
         </button>
         <button onClick={() => setMode('ellipse')} className={`p-1.5 rounded-lg border-2 ${mode==='ellipse'?'bg-mem-purple border-mem-ink':'border-transparent hover:bg-black/5'}`}>
             <Circle className="w-5 h-5"/>
         </button>
         <div className="w-[2px] h-6 bg-mem-ink/10 mx-1" />
         <button onClick={() => setMode('sign')} className={`p-1.5 rounded-lg border-2 ${mode==='sign'?'bg-mem-sky border-mem-ink':'border-transparent hover:bg-black/5'}`} title={t('editor.addSign', 'Add Signature' as any)}>
             <PenTool className="w-5 h-5"/>
         </button>
         
         {/* Contextual Properties */}
         {activeEl && (
             <div className="ml-auto flex items-center gap-3 bg-mem-light px-3 py-1.5 rounded-xl border border-mem-ink/15">
                 {activeEl.type === 'text' && (
                     <>
                     <input type="color" value={activeEl.color} onChange={e => setElements(els => els.map(el => el.id === activeEl.id ? {...el, color: e.target.value} : el))} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                     <input type="number" value={activeEl.fontSize} onChange={e => setElements(els => els.map(el => el.id === activeEl.id ? {...el, fontSize: parseInt(e.target.value)||12} : el))} className="w-16 h-8 text-sm px-1 border border-mem-ink/30 rounded" />
                     </>
                 )}
                 {(activeEl.type === 'rect' || activeEl.type === 'ellipse') && (
                     <>
                     <input type="color" value={activeEl.color} onChange={e => setElements(els => els.map(el => el.id === activeEl.id ? {...el, color: e.target.value} : el))} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                     <input type="range" min="1" max="15" value={activeEl.strokeWidth||2} onChange={e => setElements(els => els.map(el => el.id === activeEl.id ? {...el, strokeWidth: parseInt(e.target.value)} : el))} className="w-20" title="Stroke width"/>
                     </>
                 )}
                 <button onClick={() => { setElements(els => els.filter(el => el.id !== activeEl.id)); setSelectedId(null); }} className="p-1 hover:text-mem-coral text-mem-ink/60">
                     <Trash2 className="w-4 h-4" />
                 </button>
             </div>
         )}
      </div>

      <div 
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 relative touch-pan-x touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
          {pagesLoading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
               <div className="px-4 py-2 rounded-xl bg-mem-teal/30 border-2 border-mem-ink text-xs font-semibold shadow-memphis-sm animate-pulse">
                  {t('canvas.pagesLoading' as any)}
               </div>
            </div>
          )}

          {pageInfo && viewportSize.w > 0 ? (
              <div 
                className="relative bg-white border-[3px] border-mem-ink shadow-memphis-xl overflow-hidden shrink-0 select-none"
                style={{ width: viewportSize.w * userScale, height: viewportSize.h * userScale }}
              >
                  <img
                    ref={imageRef}
                    src={pageInfo.image_url}
                    className="block w-full h-full object-contain pointer-events-none"
                    draggable={false}
                    onLoad={syncMetrics}
                    alt="Page Preview"
                  />
                  
                  {/* Layering PDF elements on top */}
                  {imageMetrics && pageEls.map(el => {
                      const activeBbox = editingElementId === el.id && liveBox ? liveBox : el;
                      const { left, top, width, height } = pdfBoxToOverlayPixels(
                          [activeBbox.x, activeBbox.y, activeBbox.x + activeBbox.width, activeBbox.y + activeBbox.height], 
                          imageMetrics
                      );
                      const isSelected = selectedId === el.id;

                      return (
                          <div 
                            key={el.id}
                            className={`absolute touch-none font-sans ${isSelected ? 'ring-2 ring-mem-sky ring-offset-1 z-20 cursor-move' : 'cursor-pointer hover:ring-1 hover:ring-mem-ink/30 z-10'}`}
                            style={{ left, top, width, height }}
                            onPointerDown={e => {
                                e.stopPropagation();
                                if (mode !== 'select') { setSelectedId(el.id); return; }
                                const pt = pointerToLayout(e.clientX, e.clientY);
                                if (!pt) return;
                                
                                const handle = isSelected ? hitTestHandle(pt.x - left, pt.y - top, width, height) : null;
                                startEdit(el, handle ? 'resize' : 'drag', pt, handle ?? undefined);
                            }}
                          >
                              {/* RENDER ELEMENT CONTENT */}
                              {el.type === 'rect' && (
                                  <div className="w-full h-full border" style={{ borderColor: el.color, borderWidth: Math.max(1, (el.strokeWidth||2)*userScale) }} />
                              )}
                              {el.type === 'ellipse' && (
                                  <div className="w-full h-full border rounded-full" style={{ borderColor: el.color, borderWidth: Math.max(1, (el.strokeWidth||2)*userScale) }} />
                              )}
                              {el.type === 'image' && el.imageUrl && (
                                  <img src={el.imageUrl} className="w-full h-full object-contain pointer-events-none" alt=""/>
                              )}
                              {el.type === 'text' && (
                                  <div className="w-full h-full leading-none whitespace-pre-wrap outline-none" 
                                       style={{ color: el.color, fontSize: Math.max(1, (el.fontSize || 12) * userScale * (imageMetrics.scaleY || 1)) }}
                                       contentEditable={isSelected}
                                       suppressContentEditableWarning
                                       ref={(node) => { textRefs.current[el.id] = node; }}
                                       onBlur={() => {
                                           // 从 ref 表读当前节点文本（安全：读不到则保留原文本，绝不抛异常）
                                           const node = textRefs.current[el.id];
                                           const text = node ? node.innerText : el.text;
                                           setElements(els => els.map(e_ => e_.id === el.id ? {...e_, text} : e_));
                                       }}
                                       onPointerDown={e => e.stopPropagation()} // Let contenteditable handle clicks
                                  >
                                      {el.text}
                                  </div>
                              )}

                              {/* RESIZE HANDLES */}
                              {isSelected && mode === 'select' && ['nw','ne','se','sw'].map(h => {
                                  const off = -HANDLE_SIZE/2;
                                  return <span key={h} className="absolute bg-white border border-mem-sky pointer-events-auto"
                                    style={{
                                        width: HANDLE_SIZE, height: HANDLE_SIZE,
                                        left: h.includes('w') ? off : undefined, right: h.includes('e') ? off : undefined,
                                        top: h.includes('n') ? off : undefined, bottom: h.includes('s') ? off : undefined,
                                        cursor: (h==='nw'||h==='se') ? 'nwse-resize' : 'nesw-resize'
                                    }}
                                  />
                              })}
                          </div>
                      );
                  })}
                  
                  {/* Drawing Indicator */}
                  {isDrawing && drawStart && drawCurrent && (
                    <div
                      style={{
                        left: `${Math.min(drawStart.x, drawCurrent.x)}px`,
                        top: `${Math.min(drawStart.y, drawCurrent.y)}px`,
                        width: `${Math.abs(drawCurrent.x - drawStart.x)}px`,
                        height: `${Math.abs(drawCurrent.y - drawStart.y)}px`,
                      }}
                      className="absolute border-2 border-dashed border-mem-ink bg-mem-ink/5 pointer-events-none z-30 opacity-70"
                    />
                  )}
              </div>
          ) : (
              <div className="text-mem-ink/40 text-sm">PDF Editor Viewer</div>
          )}
      </div>

      <div className="shrink-0 min-h-12 px-3 py-2 bg-white border-t-[3px] border-mem-ink flex items-center justify-between z-20 gap-2">
          <div className="flex items-center gap-1">
             <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1 || pagesLoading} className="p-1 disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
             <span className="text-xs font-mono w-16 text-center">{currentPage} / {totalPages||1}</span>
             <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages || pagesLoading} className="p-1 disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
          </div>
          <div className="flex items-center gap-1">
              <button onClick={() => setUserScale(s => clampUserScale(s/ZOOM_STEP))} className="p-1"><ZoomOut className="w-4 h-4"/></button>
              <span className="text-xs font-mono w-12 text-center">{Math.round(userScale*100)}%</span>
              <button onClick={() => setUserScale(s => clampUserScale(s*ZOOM_STEP))} className="p-1"><ZoomIn className="w-4 h-4"/></button>
              <button onClick={() => setUserScale(1)} className="p-1 ml-1"><RotateCcw className="w-3.5 h-3.5"/></button>
          </div>
      </div>
    </div>
  );
};
