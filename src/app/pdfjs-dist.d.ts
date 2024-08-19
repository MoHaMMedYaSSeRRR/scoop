declare module 'pdfjs-dist/build/pdf' {
    export const GlobalWorkerOptions: any;
    export function getDocument(url: string | Uint8Array): any;
    export class PDFPageProxy {
      getViewport(params: { scale: number }): any;
      render(params: { canvasContext: CanvasRenderingContext2D; viewport: any }): any;
    }
    export class PDFDocumentProxy {
      numPages: number;
      getPage(pageNumber: number): Promise<PDFPageProxy>;
    }
  }