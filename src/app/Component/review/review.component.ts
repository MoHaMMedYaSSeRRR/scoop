import { Component, OnInit } from '@angular/core';
import { UploadService } from 'src/app/services/upload.service';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss'],
})
export class ReviewComponent implements OnInit {
  pdfImages: string[] = [];
  currentPage: number = 0;
  userPageCount: number = 0;
  ispay: boolean = false;
  pdfUrl: string = '';

  constructor(private _UploadService: UploadService) {}

  ngOnInit(): void {
    this.pdfUrl = this._UploadService.getPdfUrl();
    console.log('Retrieved PDF URL:', this.pdfUrl);
    this.loadPdfImages(this.pdfUrl);
  }

  /**
   * Converts a PDF into an array of image URLs (Base64).
   */
  async convertPdfToImages(pdfUrl: string): Promise<string[]> {
    const images: string[] = [];
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      images.push(canvas.toDataURL('image/png'));
    }

    return images;
  }

  /**
   * Loads PDF images and sets them to `pdfImages`.
   */
  async loadPdfImages(pdfUrl: string) {
    try {
      this.pdfImages = await this.convertPdfToImages(pdfUrl);
      this.userPageCount = this.pdfImages.length;
      console.log('PDF converted to images:', this.pdfImages);
    } catch (error) {
      console.error('Error converting PDF to images:', error);
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      console.log('Navigated to page:', this.currentPage);
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.userPageCount - 1) {
      this.currentPage++;
      console.log('Navigated to page:', this.currentPage);
    }
  }

  showpay() {
    this.ispay = true;
  }
}
