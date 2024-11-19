import { Component, ElementRef, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { UploadService } from 'src/app/services/upload.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

interface ROI {
  position: number[][][];
  bubbles: number;
  direction: string;
  method: string;
  marked_by_teacher: boolean;
  choices?: number[]; // Optional
  page?: number; // Add this line to include page tracking
  points?: number;
}

type SelectedQuestions = Record<string, ROI>; // Keep this as an object

interface QuestionData {
  position: number[][][];
  bubbles: number;
  direction: 'horizontal' | 'vertical'; // Explicit type matching ROI
  method: 'top-to-bottom' | 'bottom-to-top' | 'right-to-left' | 'left-to-right';
  marked_by_teacher: boolean;
}

@Component({
  selector: 'app-uploadpdf',
  templateUrl: './uploadpdf.component.html',
  styleUrls: ['./uploadpdf.component.scss'],
})
export class UploadpdfComponent {
  private readonly ORIGINAL_IMAGE_WIDTH = 600;
  private readonly ORIGINAL_IMAGE_HEIGHT = 800;
  step1: boolean = true;
  step2: boolean = false;
  selectedFile: any;
  pdfForm: FormGroup;
  fileName: string | null = null;
  pdfImages: any[] = [];
  currentPage: number = 0;
  userPageCount: number = 0;
  selectedQuestions: SelectedQuestions = {}; // Initialize as an object

  id: any = {};
  isSelecting: boolean = false;
  selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  startX: number = 0;
  startY: number = 0;
  isLoading: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(
    private formBuilder: FormBuilder,
    private _UploadService: UploadService,
    private router: Router
  ) {
    this.pdfForm = this.formBuilder.group({
      pdfFile: new FormControl(null, Validators.required),
      pageCount: new FormControl(null, [
        Validators.required,
        Validators.min(1),
      ]),
      questions: this.formBuilder.array([]),
      language: new FormControl('ar', Validators.required),
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
      console.error('Please select a valid PDF file.');
    }
  }

  get languageDirection(): string {
    return this.pdfForm.get('language')?.value === 'ar'
      ? 'right-to-left'
      : 'left-to-right';
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

  async onSubmit(): Promise<void> {
    this.isLoading = true;
    if (this.pdfForm.valid) {
      const pdfFile = this.pdfForm.get('pdfFile')?.value;
      const fileReader = new FileReader();

      fileReader.onloadend = async () => {
        const pdfUrl = URL.createObjectURL(pdfFile);
        this.pdfImages = await this.convertPdfToImages(pdfUrl);
        this.userPageCount = this.pdfForm.get('pageCount')?.value || 0;

        if (this.questions.length === 0) {
          const pageCount = this.pdfForm.get('pageCount')?.value || 0;
          for (let i = 0; i < pageCount; i++) {
            this.questions.push(
              this.formBuilder.group({
                rowNumber: new FormControl('', Validators.required),
                colNumber: new FormControl('', Validators.required),
                direction: new FormControl('', Validators.required),
                marked: new FormControl(),
                gradedByTeacher: new FormControl(),
                roi_coordinates: new FormControl([]), // ROI will be captured here
                page_number: new FormControl(i + 1),
                choices: new FormControl('', Validators.required), // Choices field
                method: new FormControl('', Validators.required), // Default method
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

  // Get the current question FormGroup
  getCurrentQuestionFormGroup(): FormGroup {
    return this.questions.at(this.currentPage) as FormGroup; // Adjusted to get current page's form
  }

  resetSelectionBox() {
    this.selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  }
  resetboxes() {
    this.selectionBoxes = [];
  }

  determineIdValue(currentQuestion: any): string {
    if (!currentQuestion.marked && !currentQuestion.gradedByTeacher) {
      return 'valid_id'; // Assign a valid ID when both are false
    } else if (currentQuestion.marked && currentQuestion.gradedByTeacher) {
      return 'teacher_id'; // Return a different value if either is true
    } else {
      return 'not_Teacher';
    }
  }
  addCurrentQuestionData(): void {
    const currentQuestion = this.getCurrentQuestionFormGroup().value;

    const roiData: ROI = {
      position: [
        [
          [Math.floor(this.selectionBox.x), Math.floor(this.selectionBox.y)],
          [
            Math.floor(this.selectionBox.x + this.selectionBox.width),
            Math.floor(this.selectionBox.y + this.selectionBox.height),
          ],
        ],
      ],
      bubbles: currentQuestion.colNumber,
      direction: currentQuestion.direction || 'horizontal',
      method: currentQuestion.method || 'top-to-bottom',
      marked_by_teacher: currentQuestion.gradedByTeacher || false,
    };

    const questionKey = `question_${
      Object.keys(this.selectedQuestions).length + 1
    }`; // Use Object.keys to get count
    this.selectedQuestions[questionKey] = roiData; // Store the ROI data for each question

    console.log('Question Data:', roiData); // Log for debugging
  }

  fractionedGradesValidator(
    control: FormControl
  ): { [key: string]: boolean } | null {
    const value = control.value;
    if (!value) {
      return null;
    }

    // Validate if non-empty
    const values = value.split(',').map((val: string) => parseFloat(val));
    const isValid = values.every((num: any) => !isNaN(num) && num >= 0);
    return isValid ? null : { invalidFractionedGrade: true };
  }
  another: any = [];
  onCurrentQuestionSubmit(): void {
    const currentQuestionForm = this.getCurrentQuestionFormGroup();

    // Validate if the selection box has been defined
    if (this.selectionBoxes.length > 0) {
      // Prepare ROI data based on the selection box and form values
      const roiData: ROI = {
        position: this.selectionBoxes.map((box) => [
          [Math.floor(box.x), Math.floor(box.y)],
          [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
        ]),
        bubbles: currentQuestionForm.value.colNumber,
        direction: currentQuestionForm.value.direction || 'horizontal',
        method: currentQuestionForm.value.method || 'top-to-bottom',
        marked_by_teacher: currentQuestionForm.value.gradedByTeacher || false,
        // choices: currentQuestionForm.value.choices
        //   .split(',')
        //   .map((choice: string) => parseInt(choice.trim(), 10)),
        page: this.currentPage + 1, // Add current page number
      };

      const idValue = this.determineIdValue(currentQuestionForm.value);

      if (idValue === 'valid_id') {
        // Handle ID data for the first question
        this.id = {
          ...roiData,
        };
      } else if (idValue === 'teacher_id') {
        // Add choices to ROI for teacher ID
        roiData.choices = currentQuestionForm.value.choices
          .split(',')
          .map((choice: string) => parseInt(choice.trim(), 10));
          const questionKey = `question_${
            Object.keys(this.selectedQuestions).length + 1
          }`;
  
          this.selectedQuestions[questionKey] = roiData;
      } else {
        // Add points to ROI for non-teacher ID
        roiData.points = currentQuestionForm.value.choices;
        const questionKey = `question_${
          Object.keys(this.selectedQuestions).length + 1
        }`;

        this.selectedQuestions[questionKey] = roiData;
      }

      // Reset the form after submission
      currentQuestionForm.reset({
        roi_coordinates: [],
        colNumber: '',
        direction: '',
        marked: '',
        gradedByTeacher: '',
        choices: '', // Reset choices field as well
      });

      this.resetboxes(); // Reset selection box for the next question
    } else {
      console.error('Please define a selection area before submitting.');
    }
    this.direction = '';
  }

  pdfUrl: any;

  onFinalSubmit(): void {
    this.onCurrentQuestionSubmit(); // Ensure current question data is stored before final submission

    const questionsObject: Record<string, any> = {};
    questionsObject['id'] = this.id; // Add the static id object

    // Loop through selected questions and add them to the questionsObject
    Object.keys(this.selectedQuestions).forEach((key, index) => {
      const questionData = this.selectedQuestions[key];
      questionsObject[key] = {
        ...questionData, // Spread existing properties of the question
        question_number: index + 1, // Add the dynamic `question_number` property
      };
    });

    // Prepare the final payload, including dynamic question data
    const finalPayload = {
      answer_pages: this.userPageCount, // Use userPageCount for dynamic page count
      questions: questionsObject, // Include questions object
    };

    console.log(finalPayload); // Check the structure of your final payload

    const formData = new FormData();
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    const pdfJson = JSON.stringify(finalPayload);
    formData.append('data', pdfJson);

    this._UploadService.upload(formData).subscribe({
      next: (res) => {
        console.log(res);
        this.pdfUrl = res.pdf_file_path;
        this._UploadService.setPdfUrl(this.pdfUrl);
        this.router.navigate(['/review']);
        setTimeout(() => {
          const anchor = document.createElement('a');
          anchor.href = this.pdfUrl;
          anchor.target = '_blank';
          anchor.click();
        }, 100);
      },
      error: (err) => {
        console.log(err);
      },
    });
  }
  direction: any;
  checkdirection(direction: any) {
    if (direction === 'horizontal') {
      this.direction = 'horizontal';
    } else {
      this.direction = 'vertical';
    }
  }
  selectionBoxes: { x: number; y: number; width: number; height: number }[] =
    [];

  // Other existing methods...

  onMouseDown(event: MouseEvent): void {
    const imgElement = event.target as HTMLImageElement;
    const rect = imgElement.getBoundingClientRect();
    this.isSelecting = true;
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;

    // Start a new selection box
    this.selectionBox = { x: this.startX, y: this.startY, width: 0, height: 0 };
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isSelecting) {
      const imgElement = event.target as HTMLImageElement;
      const rect = imgElement.getBoundingClientRect();
      const currentX = event.clientX - rect.left;
      const currentY = event.clientY - rect.top;

      // Update selection box dimensions
      this.selectionBox.width = Math.abs(currentX - this.startX);
      this.selectionBox.height = Math.abs(currentY - this.startY);
      this.selectionBox.x = Math.min(this.startX, currentX);
      this.selectionBox.y = Math.min(this.startY, currentY);
    }
  }

  onMouseUp(): void {
    if (this.isSelecting) {
      // Stop selecting and save the box
      this.isSelecting = false;
      // Add finalized selection box to array
      this.selectionBoxes.push({ ...this.selectionBox });
      console.log('Final Selection Box:', this.selectionBox);
      this.resetSelectionBox(); // Reset for next selection
    }
  }
}
