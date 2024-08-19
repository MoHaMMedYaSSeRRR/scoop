import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

@Component({
  selector: 'app-uploadpdf',
  templateUrl: './uploadpdf.component.html',
  styleUrls: ['./uploadpdf.component.scss'],
})
export class UploadpdfComponent {
  step1: boolean = true;
  step2: boolean = false;

  pdfForm: FormGroup;
  fileName: string | null = null;
  pdfImages: string[] = [];
  currentPage: number = 0;
  userPageCount: number = 0;
  selectedQuestions: Array<{ page_number: number; rois: Array<any> }> = [];

  isSelecting: boolean = false;
  selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  startX: number = 0;
  startY: number = 0;
  currentRoiIndex: number = 0;

  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(private formBuilder: FormBuilder) {
    this.pdfForm = this.formBuilder.group({
      pdfFile: new FormControl(null, Validators.required),
      pageCount: new FormControl(null, [Validators.required, Validators.min(1)]),
      questionCount: new FormControl(null, [Validators.required, Validators.min(1)]),
      questions: this.formBuilder.array([])
    });
  }

  get questions(): FormArray {
    return this.pdfForm.get('questions') as FormArray;
  }

  getCurrentQuestionFormGroup(): FormGroup {
    return this.questions.at(this.currentRoiIndex) as FormGroup;
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.fileName = input.files[0].name;
      this.pdfForm.patchValue({
        pdfFile: input.files[0],
      });
    }
  }

  async convertPdfToImages(pdfUrl: string): Promise<string[]> {
    const images: string[] = [];
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
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

  async onSubmit(): Promise<void> {
    if (this.pdfForm.valid) {
      const pdfFile = this.pdfForm.get('pdfFile')?.value;
      const fileReader = new FileReader();
  
      fileReader.onloadend = async () => {
        const pdfUrl = URL.createObjectURL(pdfFile);
        this.pdfImages = await this.convertPdfToImages(pdfUrl);
        this.userPageCount = this.pdfForm.get('pageCount')?.value || 0;
  
        // Initialize questions only once
        if (this.questions.length === 0) {
          const questionCount = this.pdfForm.get('questionCount')?.value || 0;
          for (let i = 0; i < questionCount; i++) {
            this.questions.push(
              this.formBuilder.group({
                rowNumber: new FormControl('', Validators.required),
                colNumber: new FormControl('', Validators.required),
                score: new FormControl('', Validators.required),
                direction: new FormControl('', Validators.required),
                marked: new FormControl(false),
                gradedByTeacher: new FormControl(false),
                fractionedGrades: new FormControl(''),
                roi_coordinates: new FormControl([]),
                page_number: new FormControl(this.currentPage + 1)
              })
            );
          }
        }
  
        this.step1 = false;
        this.step2 = true;
      };
  
      fileReader.readAsArrayBuffer(pdfFile);
    }
  }
  

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

  onCurrentQuestionSubmit(): void {
    const currentQuestionForm = this.getCurrentQuestionFormGroup();
  
    if (currentQuestionForm.valid) {
      if (this.selectionBox.width > 0 && this.selectionBox.height > 0) {
        this.addCurrentQuestionData(); // Add data for the current question
        console.log("Data stored for question:", this.getCurrentQuestionFormGroup().value);
      }
  
      if (!this.isLastQuestion()) {
        // Move to the next question
        this.currentRoiIndex++;
        this.resetSelectionBox(); // Reset selection box for the next question
  
        // Ensure form controls are reset without affecting others
        this.getCurrentQuestionFormGroup().reset({
          roi_coordinates: [],
          rowNumber: '',
          colNumber: '',
          score: '',
          direction: '',
          marked: false,
          gradedByTeacher: false,
          fractionedGrades: ''
        });
      } else {
        this.onFinalSubmit(); // Handle final submission if it's the last question
      }
    } else {
      alert('Please fill out the form for the current question before proceeding.');
    }
  }
  

  onFinalSubmit(): void {
    // Ensure the last question data is added
    if (this.getCurrentQuestionFormGroup().valid) {
      this.addCurrentQuestionData();
    }

    console.log('Final data to send:', this.selectedQuestions);

    // Reset form and state
    this.pdfForm.reset();
    this.step1 = true;
    this.step2 = false;
    this.selectedQuestions = [];
    this.pdfImages = [];
    this.currentPage = 0;
    this.currentRoiIndex = 0;
  }

  isLastQuestion(): boolean {
    return this.currentRoiIndex >= this.questions.length - 1;
  }

  addCurrentQuestionData(): void {
    const currentQuestion = this.getCurrentQuestionFormGroup().value;

    const roiData = {
      roi_coordinates: [
        Math.min(this.selectionBox.x, this.selectionBox.x + this.selectionBox.width),
        Math.min(this.selectionBox.y, this.selectionBox.y + this.selectionBox.height),
        Math.max(this.selectionBox.x, this.selectionBox.x + this.selectionBox.width),
        Math.max(this.selectionBox.y, this.selectionBox.y + this.selectionBox.height)
      ],
      row_col_numbers: [currentQuestion.rowNumber, currentQuestion.colNumber],
      marked: currentQuestion.marked,
      graded_by_teacher: currentQuestion.gradedByTeacher,
      fractioned_grades: currentQuestion.fractionedGrades,
      direction_of_question: currentQuestion.direction,
    };

    // Find or create page data
    let pageData = this.selectedQuestions.find(
      page => page.page_number === this.currentPage + 1
    );

    if (!pageData) {
      // Create new page data if it doesn't exist
      pageData = { page_number: this.currentPage + 1, rois: [] };
      this.selectedQuestions.push(pageData);
      console.log("hello: Created new page data");
    }

    // Add or update ROI data
    const existingRoiIndex = pageData.rois.findIndex(
      roi => roi.row_col_numbers[0] === currentQuestion.rowNumber && roi.row_col_numbers[1] === currentQuestion.colNumber
    );

    if (existingRoiIndex !== -1) {
      // Update existing ROI data
      pageData.rois[existingRoiIndex] = roiData;
      console.log("hello: Updated existing ROI data");
    } else {
      // Add new ROI data
      pageData.rois.push(roiData);
      console.log("hello: Added new ROI data");
    }

    // Debug statements to ensure correct data handling
    console.log('Current Page:', this.currentPage + 1);
    console.log('ROI Data:', roiData);
    console.log('Selected Questions:', this.selectedQuestions);
  }

  // Event handler for selection box (e.g., mouse event handling)
  onMouseDown(event: MouseEvent): void {
    this.isSelecting = true;
    this.startX = event.offsetX;
    this.startY = event.offsetY;
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isSelecting) {
      const currentX = event.offsetX;
      const currentY = event.offsetY;

      this.selectionBox = {
        x: Math.min(this.startX, currentX),
        y: Math.min(this.startY, currentY),
        width: Math.abs(currentX - this.startX),
        height: Math.abs(currentY - this.startY),
      };
    }
  }

  onMouseUp(): void {
    this.isSelecting = false;
    // Save or process selection box data if necessary
    console.log('Selection box finalized:', this.selectionBox);
  }

  // Helper function to check if a specific question has a valid selection box
  isSelectionValid(): boolean {
    return this.selectionBox.width > 0 && this.selectionBox.height > 0;
  }

  // Reset selection box when moving to the next question
  resetSelectionBox(): void {
    this.selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  }
}

