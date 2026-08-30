import { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Standard Vite worker configuration for pdfjs-dist
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RenderedPage {
  page_num: number;
  width: number;
  height: number;
  image_url: string; // Data URL for the canvas rendering of the page
}

export function usePdfLocalRender() {
  const [docProxy, setDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const loadFile = useCallback(async (file: File) => {
    setPagesLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      // Load document
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        // CMap is often required for Asian fonts
        cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });
      const proxy = await loadingTask.promise;
      
      setDocProxy(proxy);
      
      const numPages = proxy.numPages;
      const pages: RenderedPage[] = [];
      
      // Render pages to data URLs synchronously for immediate display 
      // (in a full prod app we might want to lazy load, but for editor < 100 pages chunk is okay)
      const maxPreRender = Math.min(numPages, 100); 
      for (let i = 1; i <= maxPreRender; i++) {
        const page = await proxy.getPage(i);
        // Default scale 1.5 ~ roughly 144 DPI for 96 DPI unscaled
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };
          await page.render(renderContext).promise;
          pages.push({
            page_num: i,
            width: viewport.width,
            height: viewport.height,
            image_url: canvas.toDataURL('image/jpeg', 0.9)
          });
        }
      }
      setRenderedPages(pages);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error rendering PDF local file');
      setDocProxy(null);
      setRenderedPages([]);
    } finally {
      setPagesLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setDocProxy(null);
    setRenderedPages([]);
    setFileName('');
    setError(null);
  }, []);

  return { docProxy, renderedPages, pagesLoading, error, fileName, loadFile, reset };
}
