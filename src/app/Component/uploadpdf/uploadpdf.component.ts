import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { UploadService } from 'src/app/services/upload.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

@Component({
  selector: 'app-uploadpdf',
  templateUrl: './uploadpdf.component.html',
  styleUrls: ['./uploadpdf.component.scss'],
})
export class UploadpdfComponent {
  step1: boolean = true;
  step2: boolean = false;
  selectedFile: any;
  pdfForm: FormGroup;
  fileName: string | null = null;
  pdfImages: string[] = [];
  currentPage: number = 0;
  userPageCount: number = 0;
  selectedQuestions: Array<any> = []; 

  isSelecting: boolean = false;
  selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  startX: number = 0;
  startY: number = 0;

  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(private formBuilder: FormBuilder, private _UploadService: UploadService) {
    this.pdfForm = this.formBuilder.group({
      pdfFile: new FormControl(null, Validators.required),
      pageCount: new FormControl(null, [Validators.required, Validators.min(1)]),
      questions: this.formBuilder.array([]),
    });
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  get questions(): FormArray {
    return this.pdfForm.get('questions') as FormArray;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    this.fileName = file.name;

    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.pdfForm.patchValue({ pdfFile: file });
    } else {
      console.error("Please select a valid PDF file.");
    }
  }

  // Handle PDF to Image conversion
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

  // Step 1 to Step 2 transition after file selection and validation
  async onSubmit(): Promise<void> {
    if (this.pdfForm.valid) {
      const pdfFile = this.pdfForm.get('pdfFile')?.value;
      const fileReader = new FileReader();

      fileReader.onloadend = async () => {
        const pdfUrl = URL.createObjectURL(pdfFile);
        this.pdfImages = await this.convertPdfToImages(pdfUrl);
        this.userPageCount = this.pdfForm.get('pageCount')?.value || 0;

        // Create question forms based on page count
        if (this.questions.length === 0) {
          const pageCount = this.pdfForm.get('pageCount')?.value || 0;
          for (let i = 0; i < pageCount; i++) {
            this.questions.push(
              this.formBuilder.group({
                rowNumber: new FormControl('', Validators.required),
                colNumber: new FormControl('', Validators.required),
                fractioned_Grades: new FormControl('', ),
                direction: new FormControl('', Validators.required),
                marked: new FormControl(),
                gradedByTeacher: new FormControl(),
                roi_coordinates: new FormControl([]),
                page_number: new FormControl(i + 1) // Track page number if needed
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

  // Navigate to previous page
  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.resetSelectionBox(); // Reset selection on page change
    }
  }

  // Navigate to next page
  goToNextPage(): void {
    if (this.currentPage < this.userPageCount - 1) {
      this.currentPage++;
      this.resetSelectionBox(); // Reset selection on page change
    }
  }

  // Handle the 'التالي' button click event
  onCurrentQuestionSubmit(): void {
    const currentQuestionForm = this.getCurrentQuestionFormGroup();

   
      if (this.selectionBox.width > 0 && this.selectionBox.height > 0) {
        this.addCurrentQuestionData();
        console.log("Data stored for question:", currentQuestionForm.value);

        // Reset fields for the next question while keeping the previous data intact
        currentQuestionForm.reset({
          roi_coordinates: [],
          rowNumber: '',
          colNumber: '',
          direction: '',
          marked: false,
          gradedByTeacher: false,
          fractioned_Grades: ''
        });

        this.resetSelectionBox(); // Reset selection box for the next question
      } else {
        alert('Please select a region on the image.');
      }
    // } else {
    //   alert('Please fill out the form for the current question before proceeding.');
    // }
  }

  // Get the current question FormGroup
  getCurrentQuestionFormGroup(): FormGroup {
    return this.questions.at(this.currentPage) as FormGroup; // Adjusted to get current page's form
  }

  // Final submission after all questions are done
  onFinalSubmit(): void {
    if (this.getCurrentQuestionFormGroup().valid) {
      this.addCurrentQuestionData();
    }

    console.log('Final data to send:', this.selectedQuestions ,this.selectedFile );

    const formData = new FormData();
    if (this.selectedFile) {
      formData.append('pdf_file', this.selectedFile, this.selectedFile.name);
    }

    // Send collected question data as JSON
    const pdfJson = JSON.stringify(this.selectedQuestions);
    formData.append('json_data', pdfJson);

    // API call for final submission
    // console.log(formData)
    this._UploadService.upload(formData).subscribe({
      next: (res) => console.log(res),
      error: (err) => console.log(err)
    });
  }

  
addCurrentQuestionData(): void {
  const currentQuestion = this.getCurrentQuestionFormGroup().value;

  // Calculate min and max points based on the selection box
  const minX = Math.min(this.selectionBox.x, this.selectionBox.x + this.selectionBox.width);
  const minY = Math.min(this.selectionBox.y, this.selectionBox.y + this.selectionBox.height);
  const maxX = Math.max(this.selectionBox.x, this.selectionBox.x + this.selectionBox.width);
  const maxY = Math.max(this.selectionBox.y, this.selectionBox.y + this.selectionBox.height);

  const roiData = {
    roi_coordinates: [minX, minY, maxX, maxY], // Store coordinates in an array: [minX, minY, maxX, maxY]
    row_col_numbers: [currentQuestion.rowNumber, currentQuestion.colNumber],
    marked: currentQuestion.marked,
    graded_by_teacher: currentQuestion.gradedByTeacher,
   fractioned_grades: currentQuestion.fractioned_Grades,
    direction_of_question: currentQuestion.direction,
  };

  let pageData = this.selectedQuestions.find(
    page => page.page_number === this.currentPage + 1
  );

  if (!pageData) {
    pageData = { page_number: this.currentPage + 1, rois: [] };
    this.selectedQuestions.push(pageData);
  }

  pageData.rois.push(roiData);

  console.log('All ROIs for page:', pageData.page_number, pageData.rois);
}


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
  }

  // Reset the selection box
  resetSelectionBox(): void {
    this.selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  }
}
