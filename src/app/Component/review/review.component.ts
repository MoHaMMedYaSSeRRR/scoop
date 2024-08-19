import { Component } from '@angular/core';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss']
})
export class ReviewComponent {
  pdfImages: string[] = [];
  currentPage: number = 0;
  userPageCount!: number;


  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      // this.currentRoiIndex = 0; // Reset to first question of the current page
      console.log('Navigated to page:', this.currentPage);
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.userPageCount - 1) {
      this.currentPage++;
      // this.currentRoiIndex = 0; // Reset to first question of the new page
      console.log('Navigated to page:', this.currentPage);
    }
  }
}
