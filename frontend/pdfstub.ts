/** pdfjs 浏览器渲染层的 Node 冒烟替身：仅让 pdfCore 可在 Node 中加载 */
export const GlobalWorkerOptions = { workerSrc: '' };
export async function getDocument(): Promise<never> {
  throw new Error('pdfjs stub is not usable in smoke tests');
}
