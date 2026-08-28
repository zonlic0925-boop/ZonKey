// PdfStudioView
import React, { useState } from 'react';
import { MemphisCard } from '../common/MemphisCard';
import { MemphisButton } from '../common/MemphisButton';
import { Layers, Scissors, RotateCw, Stamp, Upload, AlertCircle } from 'lucide-react';
import { mergePdfDocuments, splitPdfDocumentToZip, rotatePdfPages, addPdfWatermark } from '../../lib/toolknit/officeCore';

export const PdfStudioView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'merge' | 'split' | 'rotate' | 'watermark'>('merge');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [rotateDeg, setRotateDeg] = useState<number>(90);
  const [watermarkText, setWatermarkText] = useState<string>('机密文件 请勿外传');

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setStatus('');
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setStatus('请至少选择 2 个 PDF 文件进行合并');
      return;
    }
    setProcessing(true);
    setStatus('正在合并 PDF 文档...');
    try {
      const mergedBlob = await mergePdfDocuments(files);
      downloadBlob(new Blob([mergedBlob as any], { type: 'application/pdf' }), 'merged_document.pdf');
      setStatus('合并成功！已触发下载。');
    } catch (e: any) {
      setStatus('合并失败: ' + e.message);
    }
    setProcessing(false);
  };

  const handleSplit = async () => {
    if (files.length === 0) {
      setStatus('请选择一个 PDF 文件进行拆分');
      return;
    }
    setProcessing(true);
    setStatus('正在按页拆分 PDF 并打包 ZIP...');
    try {
      const zipBlob = await splitPdfDocumentToZip(files[0]);
      downloadBlob(zipBlob, files[0].name.replace('.pdf', '') + '_pages.zip');
      setStatus('拆分完成！已打包下载全部单页。');
    } catch (e: any) {
      setStatus('拆分失败: ' + e.message);
    }
    setProcessing(false);
  };

  const handleRotate = async () => {
    if (files.length === 0) {
      setStatus('请选择需要旋转的 PDF 文件');
      return;
    }
    setProcessing(true);
    setStatus('正在旋转 PDF 页面...');
    try {
      const rotatedBlob = await rotatePdfPages(files[0], rotateDeg as 90 | 180 | 270);
      downloadBlob(new Blob([rotatedBlob as any], { type: 'application/pdf' }), 'rotated_' + files[0].name);
      setStatus('旋转完成！已生成新文档。');
    } catch (e: any) {
      setStatus('旋转失败: ' + e.message);
    }
    setProcessing(false);
  };

  const handleWatermark = async () => {
    if (files.length === 0) {
      setStatus('请选择需要加水印的 PDF 文件');
      return;
    }
    setProcessing(true);
    setStatus('正在为 PDF 添加安全水印...');
    try {
      const watermarkedBlob = await addPdfWatermark(files[0], watermarkText);
      downloadBlob(new Blob([watermarkedBlob as any], { type: 'application/pdf' }), 'watermarked_' + files[0].name);
      setStatus('水印添加成功！已触发下载。');
    } catch (e: any) {
      setStatus('添加水印失败: ' + e.message);
    }
    setProcessing(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full p-6 overflow-y-auto max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b-2 border-mem-ink/20">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-mem-ink">PDF 多功能工坊 (PDF Studio)</h2>
          <p className="text-sm text-mem-ink/70 mt-0.5">纯本地高保真 PDF 页面合并、单页拆分、方向旋转与水印加注</p>
        </div>
        <div className="flex gap-2 p-1 bg-white border-2 border-mem-ink rounded-xl shadow-mem-sm">
          {[
            { id: 'merge', label: '页面合并', icon: Layers },
            { id: 'split', label: '按页拆分', icon: Scissors },
            { id: 'rotate', label: '页面旋转', icon: RotateCw },
            { id: 'watermark', label: '添加水印', icon: Stamp },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveSubTab(tab.id as any); setStatus(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                  active ? 'bg-mem-canary text-mem-ink border-2 border-mem-ink shadow-mem-xs' : 'text-mem-ink/60 hover:text-mem-ink'
                }`}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
            </button>
            );
          })}
        </div>
      </div>

      <MemphisCard color="bg-mem-cream" title="选择输入文件">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-mem-ink/40 rounded-xl p-8 text-center bg-white/50 hover:bg-white/80 transition-colors">
            <input
              type="file"
              multiple={activeSubTab === 'merge'}
              accept="application/pdf"
              onChange={handleFiles}
              className="hidden"
              id="pdf-upload-input"
            />
            <label htmlFor="pdf-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-mem-sky/20 border-2 border-mem-ink flex items-center justify-center text-mem-ink">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-mem-ink">点击选择或拖拽 PDF 文件到此处</p>
                <p className="text-xs text-mem-ink/60 mt-1">
                  {activeSubTab === 'merge' ? '支持选择多个 PDF 文件按顺序合并' : '选择 1 个待处理的 PDF 文档'}
                </p>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-mem-ink p-3 space-y-1.5">
              <div className="text-xs font-bold text-mem-ink/70 px-1">已选文件列表 ({files.length}):</div>
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-mem-cream/50 px-2.5 py-1.5 rounded-lg border border-mem-ink/10">
                  <span className="font-medium truncate max-w-md">{i + 1}. {f.name}</span>
                  <span className="text-mem-ink/50">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </MemphisCard>

      {activeSubTab === 'rotate' && (
        <MemphisCard color="bg-mem-cream" title="旋转角度设置">
          <div className="flex items-center gap-4">
            {[90, 180, 270].map((deg) => (
              <label key={deg} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rotate_deg"
                  checked={rotateDeg === deg}
                  onChange={() => setRotateDeg(deg)}
                  className="accent-mem-ink w-4 h-4"
                />
                <span className="text-sm font-bold text-mem-ink">顺时针 {deg}°</span>
              </label>
            ))}
          </div>
        </MemphisCard>
      )}

      {activeSubTab === 'watermark' && (
        <MemphisCard color="bg-mem-cream" title="水印文本配置">
          <div>
            <label className="block text-xs font-bold text-mem-ink/80 mb-1.5">水印文字内容</label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-mem-ink rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-mem-canary"
              placeholder="例如：机密文件 严禁拍照"
            />
          </div>
        </MemphisCard>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-sm">
          {status && (
            <div className="flex items-center gap-1.5 font-bold text-mem-ink bg-mem-yellow/40 px-3 py-1.5 rounded-lg border border-mem-ink/30">
              <AlertCircle className="w-4 h-4 text-mem-ink" />
              <span>{status}</span>
            </div>
          )}
        </div>
        <div>
          {activeSubTab === 'merge' && (
            <MemphisButton
              variant="primary"
              size="md"
              disabled={processing || files.length < 2}
              onClick={handleMerge}
            >
              <Layers className="w-4 h-4 mr-1.5 inline" />
              {processing ? '正在合并...' : '开始合并 PDF'}
            </MemphisButton>
          )}
          {activeSubTab === 'split' && (
            <MemphisButton
              variant="primary"
              size="md"
              disabled={processing || files.length === 0}
              onClick={handleSplit}
            >
              <Scissors className="w-4 h-4 mr-1.5 inline" />
              {processing ? '正在拆分...' : '按页拆分导出 ZIP'}
            </MemphisButton>
          )}
          {activeSubTab === 'rotate' && (
            <MemphisButton
              variant="primary"
              size="md"
              disabled={processing || files.length === 0}
              onClick={handleRotate}
            >
              <RotateCw className="w-4 h-4 mr-1.5 inline" />
              {processing ? '正在旋转...' : '执行旋转并导出'}
            </MemphisButton>
          )}
          {activeSubTab === 'watermark' && (
            <MemphisButton
              variant="primary"
              size="md"
              disabled={processing || files.length === 0}
              onClick={handleWatermark}
            >
              <Stamp className="w-4 h-4 mr-1.5 inline" />
              {processing ? '正在注水...' : '注水并导出 PDF'}
            </MemphisButton>
          )}
        </div>
      </div>
    </div>
  );
};
