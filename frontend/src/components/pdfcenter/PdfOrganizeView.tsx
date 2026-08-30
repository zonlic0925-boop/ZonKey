import React, { useState } from 'react';
import { Upload, FileSignature, Layers } from 'lucide-react';
import { PdfEditorCanvas } from './PdfEditorCanvas';
import { SignaturePad } from './SignaturePad';
import { usePdfLocalRender } from '../../lib/hooks/usePdfLocalRender';
import { exportEditedPdf } from '../../lib/hooks/usePdfEditorExport';
import { PdfElement } from '../../types';
import { downloadBytes } from './pdfKit';
import { useI18n } from '../../i18n';

export const PdfOrganizeView: React.FC = () => {
  const { t } = useI18n();
  const { renderedPages, pagesLoading, error, loadFile, fileName, reset } = usePdfLocalRender();
  
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [elements, setElements] = useState<PdfElement[]>([]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [pendingSignPos, setPendingSignPos] = useState<{x: number, y: number} | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    
    setOriginalFile(file);
    setElements([]);
    setCurrentPage(1);
    setExportError(null);
    await loadFile(file);
    e.target.value = '';
  };

  const handleExport = async () => {
    if (!originalFile) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportEditedPdf(originalFile, elements);
      const outName = fileName.replace(/\.[^.]+$/, '') + '_edited.pdf';
      const fileData = new Uint8Array(await blob.arrayBuffer());
      downloadBytes(fileData, outName);
    } catch (err: unknown) {
      setExportError(String((err as Error).message));
    } finally {
      setIsExporting(false);
    }
  };

  const pageInfo = renderedPages.find(p => p.page_num === currentPage) || null;

  return (
    <div className="flex-1 w-full h-[70vh] flex flex-col md:flex-row min-h-0 bg-transparent rounded-xl border-4 border-mem-ink overflow-hidden shadow-memphis-xl mx-auto">
      
      {/* Sidebar Tool panel */}
      <div className="order-2 md:order-1 w-full md:w-64 shrink-0 flex flex-col border-t-[3px] md:border-t-0 md:border-r-[3px] border-mem-ink bg-white min-h-0">
         <div className="p-4 border-b-[3px] border-mem-ink">
            <div className="memphis-card p-4 relative overflow-hidden transition-all hover:-translate-y-0.5">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 mb-2 text-mem-ink" />
                    <h3 className="text-sm font-bold truncate px-2 w-full text-center">
                        {fileName ? t('docPdf.replaceFile', '更换文件' as any) : t('docPdf.uploadTitle', '选择 PDF' as any)}
                    </h3>
                </div>
            </div>
         </div>
         
         <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
             {!fileName ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-mem-ink/40 gap-2">
                     <Layers className="w-8 h-8" />
                     <p className="text-sm font-bold text-center">请先上传文件</p>
                 </div>
             ) : (
                 <>
                 <div className="bg-mem-blue/10 border-2 border-mem-ink rounded-xl p-3 shadow-memphis-sm">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-mem-ink mb-1">{t('editor.document', '文件信息' as any)}</h3>
                     <p className="text-xs font-medium truncate" title={fileName}>{fileName}</p>
                     <p className="text-[11px] font-mono text-mem-ink/60 mt-0.5">{renderedPages.length} 页</p>
                 </div>
                 
                 <div className="bg-mem-cream border-2 border-mem-ink rounded-xl p-3 shadow-memphis-sm flex-1 min-h-[150px] flex flex-col">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-mem-ink mb-2">
                         {t('editor.elements', '所有元素' as any)} <span className="opacity-50">({elements.length})</span>
                     </h3>
                     <div className="flex-1 overflow-auto space-y-1.5 min-h-0 pr-1 mask-v-fade">
                         {elements.map(el => (
                             <div key={el.id} className="text-[10px] flex items-center justify-between p-1.5 bg-white rounded-lg border-2 border-mem-ink">
                                 <span className="truncate flex-1 font-mono hover:text-clip">
                                     [{el.type.toUpperCase()}] p.{el.page}
                                 </span>
                                 <button onClick={() => setElements(els => els.filter(e => e.id !== el.id))} 
                                         className="text-mem-coral hover:bg-mem-coral/10 rounded px-1 ml-1 cursor-pointer">
                                     &times;
                                 </button>
                             </div>
                         ))}
                         {elements.length === 0 && (
                             <p className="text-xs text-mem-ink/40 text-center py-4">无编辑元素</p>
                         )}
                     </div>
                 </div>
                 </>
             )}
         </div>
         
         <div className="p-4 border-t-[3px] border-mem-ink bg-white">
             {exportError && (
                 <div className="mb-2 p-2 bg-mem-coral text-white text-xs font-bold rounded-lg border-2 border-mem-ink">
                     {exportError}
                 </div>
             )}
             <button 
                onClick={handleExport} 
                disabled={!fileName || isExporting}
                className="memphis-btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 text-sm"
             >
                 {isExporting ? <Upload className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
                 {t('docPdf.exportLabel', '保存并导出' as any)}
             </button>
         </div>
      </div>

      {/* Main Canvas Area */}
      <div className="order-1 md:order-2 flex-1 min-w-0 min-h-0 flex flex-col relative bg-mem-light">
          {error && (
              <div className="absolute top-4 left-4 z-50 bg-mem-coral text-white p-3 rounded-xl border-2 border-mem-ink shadow-memphis-sm max-w-sm">
                  {error}
              </div>
          )}
          
          <PdfEditorCanvas 
            currentPage={currentPage}
            totalPages={renderedPages.length}
            setCurrentPage={setCurrentPage}
            pageInfo={pageInfo}
            elements={elements}
            setElements={setElements}
            pagesLoading={pagesLoading}
            onAddSignatureRequest={() => setShowSignDialog(true)}
          />

          {showSignDialog && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-mem-ink/40 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl border-[3px] border-mem-ink shadow-memphis-lg max-w-[400px] w-full transform transition-all p-5">
                      <h2 className="text-base font-black mb-3 text-mem-ink">
                          {t('editor.createSignature', '手写签名' as any)}
                      </h2>
                      <SignaturePad 
                         onSave={(dataUrl) => {
                             const w = 150; const h = 50;
                             const fallbackPt = pageInfo ? { x: pageInfo.width/2 - w/2, y: pageInfo.height/2 - h/2 } : { x: 50, y: 50 };
                             
                             const newEl: PdfElement = {
                                 id: `img_${Date.now()}`,
                                 page: currentPage,
                                 type: 'image',
                                 imageUrl: dataUrl,
                                 x: pendingSignPos ? pendingSignPos.x : fallbackPt.x,
                                 y: pendingSignPos ? pendingSignPos.y : fallbackPt.y,
                                 width: w,
                                 height: h,
                             };
                             setElements(els => [...els, newEl]);
                             setShowSignDialog(false);
                             setPendingSignPos(null);
                         }}
                         onCancel={() => { setShowSignDialog(false); setPendingSignPos(null); }}
                      />
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
