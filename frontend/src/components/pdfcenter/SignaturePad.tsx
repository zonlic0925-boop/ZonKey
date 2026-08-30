import React, { useRef, useState, useLayoutEffect } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Resize handling for high-DPI displays
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      // Increase internal resolution for smoothness on retina displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d' as any);
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000'; // Pure black signature stream
        ctx.lineWidth = 4;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pos = getPos(e);
    if (!pos) return;
    lastPosRef.current = pos;
    setHasStroke(true);
    
    // Draw a single dot in case of tap
    const ctx = canvasRef.current?.getContext('2d' as any);
    if (ctx) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const lastPos = lastPosRef.current;
    const ctx = canvasRef.current?.getContext('2d' as any);
    if (!pos || !lastPos || !ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    // Simple line formulation, could upgrade to bezier for handwriting effect
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d' as any);
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Wipe entirely
    setHasStroke(false);
  };

  const handleSave = () => {
    if (!hasStroke || !canvasRef.current) return;
    // We export a transparent PNG representation of the signature
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div 
        ref={containerRef}
        className="w-full h-48 bg-mem-cream rounded-xl border-2 border-mem-ink/30 relative touch-none shadow-inner"
        style={{ cursor: 'crosshair' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasStroke && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-mem-ink/20 font-bold select-none text-xl">
            {t('docPdf.signHint', 'Sign here' as any)}
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <button 
          onClick={handleClear} 
          className="memphis-btn-ghost text-mem-coral py-2 px-3 disabled:opacity-30"
          disabled={!hasStroke}
        >
          <Trash2 className="w-4 h-4 mr-1.5 inline" />
          {t('common.clear', 'Clear' as any)}
        </button>
        <div className="flex gap-2">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-lg font-bold border-2 border-mem-ink/30 hover:bg-mem-light text-sm text-mem-ink transition-colors"
          >
            {t('common.cancel', 'Cancel' as any)}
          </button>
          <button 
            onClick={handleSave} 
            disabled={!hasStroke}
            className="memphis-btn-primary flex items-center gap-1.5 py-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('common.save', 'Save' as any)}
          </button>
        </div>
      </div>
    </div>
  );
};
