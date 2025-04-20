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
  points: number[][][];
  roi_type: string;
  entities_count: number;
  choices?: string[];
  orientation: string; // Add this field
  direction: string; // Add this field
  worth?: number; // Add this field
  corrected_by_teacher: boolean; // Add this field
  id: boolean; // Add this field
  page_number?: number;
}

type SelectedQuestions = Record<string, Record<string, ROI>>;

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
  pdfUrl: any;
  isGlobal = true;
  isshow = false;
  formData = new FormData();
  isID: boolean = false;
  questionType = '';
  id: any = {};
  isSelecting: boolean = false;
  selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  startX: number = 0;
  startY: number = 0;
  isLoading: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef;
  currentScore: any = 0;
  finalScore: any = 0;
  selectedIdType!: string;
  selectionBoxesByPage: {
    [pageNumber: number]: {
      x: number;
      y: number;
      width: number;
      height: number;
      submitted?: boolean;
    }[];
  } = {};
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
    const file = event.target.files?.[0];

    if (file && file.type === 'application/pdf') {
      this.fileName = file.name;
      this.selectedFile = file;

      // Patch file into your form if needed
      this.pdfForm.patchValue({ pdfFile: file });
    } else {
      console.error('Please select a valid PDF file.');
      this.fileName = '';
      this.selectedFile = null;
      this.pdfForm.patchValue({ pdfFile: null });
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
                roi_type: new FormControl('', Validators.required),
                direction: new FormControl('', Validators.required),
                orientation: new FormControl('', Validators.required),
                marked: new FormControl(),
                gradedByTeacher: new FormControl(),
                entities_count: new FormControl(),
                roi_coordinates: new FormControl([]),
                page_number: new FormControl(i + 1),
                choices: new FormControl('', Validators.required),
                worth: new FormControl(1, Validators.required),
                id: new FormControl(false),
              })
            );
          }
        }

        // Transition to step two
        this.step1 = false;
        this.step2 = true;
      };

      fileReader.readAsArrayBuffer(pdfFile);
    }
  }

  // Get the current question FormGroup
  getCurrentQuestionFormGroup(): FormGroup {
    return this.questions.at(this.currentPage) as FormGroup;
  }

  resetSelectionBox() {
    this.selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  }

  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.resetSelectionBox(); // Reset selection on page change
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.userPageCount - 1) {
      this.currentPage++;
      this.resetSelectionBox(); // Reset selection on page change
    }
  }

  resetboxes() {
    this.selectionBoxes = [];
  }

  another: any = [];

  // onCurrentQuestionSubmit(): void {
  //   if (this.isGlobal) {
  //     this.isGlobal = false;
  //     this.isshow = true;
  //   }

  //   if (this.isshow) {
  //     const currentQuestionForm = this.getCurrentQuestionFormGroup();

  //     if (this.selectionBoxes.length > 0) {
  //       const userEntitiesCount = currentQuestionForm.value.entities_count || 0; // Take from input field
  //       const worth = currentQuestionForm.value.worth || 0; // Take from input field

  //       const points = this.selectionBoxes.map((box) => [
  //         [Math.floor(box.x), Math.floor(box.y)],
  //         [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
  //       ]);

  //       // Determine roi_type dynamically
  //       const roi_type = points.length === 1 ? 'question' : 'complementary';

  //       const roiData: ROI = {
  //         points: points,
  //         roi_type: roi_type,
  //         entities_count:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim()).length
  //             : 10, // **Keep this unchanged**
  //         choices:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim())
  //             : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  //         orientation: currentQuestionForm.value.orientation || 'vertical',
  //         direction: currentQuestionForm.value.direction || 'top-to-bottom',
  //         worth: worth,
  //         corrected_by_teacher:
  //           currentQuestionForm.value.gradedByTeacher === true,
  //         id: this.selectedIdType === 'student_id' ? false : true,
  //       };

  //       console.log(roiData);

  //       // **Update Final Score Calculation (Use Input `entities_count`)**
  //       this.finalScore += userEntitiesCount * worth;

  //       // Store question data
  //       const questionKey = `question_${
  //         Object.keys(this.selectedQuestions).length + 1
  //       }`;
  //       this.selectedQuestions[questionKey] = roiData;

  //       currentQuestionForm.reset({
  //         roi_coordinates: [],
  //         colNumber: '',
  //         direction: '',
  //         marked: '',
  //         gradedByTeacher: false,
  //         choices: '',
  //         worth: 0,
  //         id: false,
  //         entities_count: '',
  //       });

  //       this.resetboxes();
  //       this.questionType = '';
  //     } else {
  //       console.error('Please define a selection area before submitting.');
  //     }

  //     this.direction = '';
  //     this.isID = false;
  //   }
  // }

  checkifid(x: any) {
    if (x == true) {
      this.selectedIdType = 'student_id';
      this.isID = true;
    } else {
      this.selectedIdType = 'question_id';

      this.isID = false;
    }
  }
  checkQuestionType(x: any) {
    this.questionType = x;
  }
  // onFinalSubmit(): void {
  //   this.onCurrentQuestionSubmit(); // Ensure the last question is submitted

  //   const pagesObject: Record<string, any> = {};
  //   let totalExamScore = 0; // Initialize total score

  //   Object.keys(this.selectedQuestions).forEach((key, index) => {
  //     const questionData = this.selectedQuestions[key];
  //     const pageKey = `page-${questionData.page_number || 1}`;

  //     // Ensure the page object exists
  //     if (!pagesObject[pageKey]) {
  //       pagesObject[pageKey] = {};
  //     }

  //     // Get the next available question key for this page
  //     const questionNumber = Object.keys(pagesObject[pageKey]).length + 1;
  //     const questionKey = `question-${questionNumber}`;

  //     pagesObject[pageKey][questionKey] = {
  //       points: questionData.points,
  //       roi_type: questionData.roi_type || 'question',
  //       entities_count: questionData.entities_count || 10,
  //       choices: questionData.choices || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  //       orientation: questionData.orientation || 'horizontal',
  //       direction: questionData.direction || 'right-to-left',
  //       worth: questionData.worth || 1,
  //       corrected_by_teacher: questionData.corrected_by_teacher || false,
  //       id: questionData.id,
  //     };

  //     // Use user-entered entities_count for total score calculation
  //     totalExamScore += questionData.entities_count * questionData.worth;
  //   });

  //   this.finalScore = totalExamScore; // Update total score dynamically

  //   const finalPayload = { ...pagesObject };
  //   this._UploadService.setdata(finalPayload, this.selectedFile);

  //   if (this.selectedFile) {
  //     this.formData.append('file', this.selectedFile);
  //   }

  //   const pdfJson = JSON.stringify(finalPayload);
  //   this.formData.append('data', pdfJson);

  //   this.isshow = false;
  //   this._UploadService.upload(this.formData).subscribe({
  //     next: (res) => {
  //       console.log(res);
  //       this._UploadService.setdata(res.response, this.selectedFile);
  //       this.router.navigate(['/review']);
  //     },
  //     error: (err) => {
  //       console.log(err);
  //     },
  //   });
  // }

  onFinalSubmit(): void {
    this.onCurrentQuestionSubmit(); // Ensure the last question is submitted

    const pagesObject: Record<string, any> = {};
    let totalExamScore = 0; // Initialize total score

    Object.keys(this.selectedQuestions).forEach((pageKey) => {
      if (!pagesObject[pageKey]) {
        pagesObject[pageKey] = {};
      }

      Object.keys(this.selectedQuestions[pageKey]).forEach(
        (questionKey, index) => {
          const questionData = this.selectedQuestions[pageKey][questionKey];

          pagesObject[pageKey][`question-${index + 1}`] = {
            points: questionData.points,
            roi_type: questionData.roi_type || 'question',
            entities_count:
              questionData.entities_count ||
              (questionData.choices ? questionData.choices.length : 10),
            choices: questionData.choices || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            orientation: questionData.orientation || 'horizontal',
            direction: questionData.direction || 'right-to-left',
            corrected_by_teacher: questionData.corrected_by_teacher || false,
            id: questionData.id,
            worth: questionData.worth,
          };

          // Calculate total exam score
          if (questionData.worth) {
            totalExamScore += questionData.entities_count * questionData.worth;
          }
        }
      );
    });

    // this.finalScore = totalExamScore; // Update total score dynamically

    const finalPayload = { ...pagesObject };
    this._UploadService.setdata(finalPayload, this.selectedFile);

    if (this.selectedFile) {
      this.formData.append('file', this.selectedFile);
    }

    const pdfJson = JSON.stringify(finalPayload);
    this.formData.append('data', pdfJson);
    // this._UploadService.setdata(pdfJson, this.selectedFile);
    // this.router.navigate(['/review']);
    this.isshow = false;
    this._UploadService.upload(this.formData).subscribe({
      next: (res) => {
        console.log(res);
        this._UploadService.setdata(res.response, this.selectedFile);
        this.router.navigate(['/review']);
      },
      error: (err) => {
        console.log(err);
      },
    });
  }

  // onCurrentQuestionSubmit(): void {
  //   if (this.isGlobal) {
  //     this.isGlobal = false;
  //     this.isshow = true;
  //   }

  //   if (this.isshow) {
  //     const currentQuestionForm = this.getCurrentQuestionFormGroup();

  //     if (this.selectionBoxes.length > 0) {
  //       const userEntitiesCount = currentQuestionForm.value.entities_count || 0; // Take from input field
  //       const worth = currentQuestionForm.value.worth || 1; // Take from input field

  //       const points = this.selectionBoxes.map((box) => [
  //         [Math.floor(box.x), Math.floor(box.y)],
  //         [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
  //       ]);

  //       // Determine roi_type dynamically
  //       // const roi_type = points.length === 1 ? 'question' : 'complementary';
  //       const roi_type = 'question' ;
  //       const roiData: ROI = {
  //         points: points,
  //         roi_type: roi_type,
  //         entities_count:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim()).length
  //             : 10,
  //         choices:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim())
  //             : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  //         orientation: currentQuestionForm.value.orientation || 'vertical',
  //         direction: currentQuestionForm.value.direction || 'top-to-bottom',
  //         corrected_by_teacher: currentQuestionForm.value.gradedByTeacher === 'true',
  //         id: this.selectedIdType === 'student_id' ? false : true,
  //         worth: worth
  //             };

  //       console.log(roiData);

  //       // **Update Final Score Calculation (Use Input `entities_count`)**
  //       this.finalScore += userEntitiesCount * worth;

  //       // Store question under its respective page
  //       const pageKey = `page-${this.currentPage+1}`;
  //       if (!this.selectedQuestions[pageKey]) {
  //         this.selectedQuestions[pageKey] = {};
  //       }

  //       const questionNumber = Object.keys(this.selectedQuestions[pageKey]).length + 1;
  //       const questionKey = `question-${questionNumber}`;
  //       this.selectedQuestions[pageKey][questionKey] = roiData;

  //       currentQuestionForm.reset({
  //         roi_coordinates: [],
  //         colNumber: '',
  //         direction: '',
  //         marked: '',
  //         gradedByTeacher: false,
  //         choices: '',
  //         worth: 1,
  //         id: false,
  //         entities_count: '',
  //       });

  //       this.resetboxes();
  //       this.questionType = '';
  //     } else {
  //       console.error('Please define a selection area before submitting.');
  //     }

  //     this.direction = '';
  //     this.isID = false;
  //   }
  // }
  // onCurrentQuestionSubmit(): void {
  //   if (this.isGlobal) {
  //     this.isGlobal = false;
  //     this.isshow = true;
  //   }

  //   if (this.isshow) {
  //     const currentQuestionForm = this.getCurrentQuestionFormGroup();

  //     if (this.selectionBoxes.length > 0) {
  //       const userEntitiesCount = currentQuestionForm.value.entities_count || 0;
  //       const worth = currentQuestionForm.value.worth || 1;

  //       const points = this.selectionBoxes.map((box) => [
  //         [Math.floor(box.x), Math.floor(box.y)],
  //         [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
  //       ]);
  //       const orientation = currentQuestionForm.value.orientation || 'vertical';
  //       const direction = currentQuestionForm.value.direction?.trim()
  //         ? currentQuestionForm.value.direction.trim()
  //         : (orientation === 'vertical' ? 'top-to-bottom' : 'right-to-left');

  //       const roi_type = currentQuestionForm.value.roi_type || 'question';
  //       const roiData: ROI = {
  //         points: points,
  //         roi_type: roi_type,
  //         entities_count:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim()).length
  //             : 10,
  //         choices:
  //           currentQuestionForm.value.choices &&
  //           currentQuestionForm.value.choices.trim()
  //             ? currentQuestionForm.value.choices
  //                 .split(/[-,]/)
  //                 .map((choice: string) => choice.trim())
  //             : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  //             orientation: orientation,
  //             direction: direction,
  //         corrected_by_teacher: currentQuestionForm.value.gradedByTeacher === 'true',
  //         id: this.selectedIdType === 'student_id' ? false : true,
  //         worth: worth,
  //       };

  //       console.log(roiData);

  //       if (roiData.corrected_by_teacher) {
  //         const numericChoices = (roiData.choices ?? []).map(Number);
  //         const maxChoice = Math.max(...numericChoices, 0); // default to 0 if array is empty
  //         this.finalScore += maxChoice;
  //       } else {
  //         this.finalScore += userEntitiesCount * worth;
  //       }

  //       const pageKey = `page-${this.currentPage + 1}`;
  //       if (!this.selectedQuestions[pageKey]) {
  //         this.selectedQuestions[pageKey] = {};
  //       }

  //       const questionNumber = Object.keys(this.selectedQuestions[pageKey]).length + 1;
  //       const questionKey = `question-${questionNumber}`;
  //       this.selectedQuestions[pageKey][questionKey] = roiData;

  //       // 🔵 Mark boxes as submitted (change to blue)
  //       if (this.selectionBoxesByPage[this.currentPage]) {
  //         this.selectionBoxesByPage[this.currentPage] = this.selectionBoxesByPage[
  //           this.currentPage
  //         ].map((box) => ({ ...box, submitted: true }));
  //       }

  //       currentQuestionForm.reset({
  //         roi_coordinates: [],
  //         colNumber: '',
  //         direction: '',
  //         marked: '',
  //         gradedByTeacher: false,
  //         choices: '',
  //         worth: 1,
  //         id: false,
  //         entities_count: '',
  //       });

  //       this.resetboxes();
  //       this.questionType = '';
  //     } else {
  //       console.error('Please define a selection area before submitting.');
  //     }

  //     this.direction = '';
  //     this.isID = false;
  //   }
  // }
  onCurrentQuestionSubmit(): void {
    if (this.isGlobal) {
      this.isGlobal = false;
      this.isshow = true;
    }
  
    if (!this.isshow) return;
  
    const currentQuestionForm = this.getCurrentQuestionFormGroup();
  
    if (this.selectionBoxes.length === 0) {
      console.error('Please define a selection area before submitting.');
      return;
    }
  
    const worth = currentQuestionForm.value.worth || 1;
    const isCorrectedByTeacher = currentQuestionForm.value.gradedByTeacher === 'true' || currentQuestionForm.value.gradedByTeacher === true;
  
    // Get points from selection boxes
    const points = this.selectionBoxes.map((box) => [
      [Math.floor(box.x), Math.floor(box.y)],
      [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
    ]);
  
    // Orientation and direction defaults
    const orientation = ['horizontal', 'vertical'].includes(currentQuestionForm.value.orientation)
      ? currentQuestionForm.value.orientation
      : 'vertical';
  
    const direction = ['right-to-left', 'top-to-bottom'].includes(currentQuestionForm.value.direction)
      ? currentQuestionForm.value.direction
      : orientation === 'vertical' ? 'top-to-bottom' : 'right-to-left';
  
    // ROI type
    const roi_type = ['question', 'complementary'].includes(currentQuestionForm.value.roi_type)
      ? currentQuestionForm.value.roi_type
      : 'question';
  
    // Setup choices and entity count
    let choices: string[] = [];
    let entities_count: number;
  
    if (isCorrectedByTeacher) {
      const rawChoices = currentQuestionForm.value.choices || '';
      choices = rawChoices.split('-');
      entities_count = choices.length;
    } else {
      const arabicLetters = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const choiceCount = Number(currentQuestionForm.value.choices);
      entities_count = choiceCount > 0 ? choiceCount : 10;
      choices = arabicLetters.slice(0, entities_count);
    }
  
    // Construct the ROI data object
    const roiData: ROI = {
      points: points,
      roi_type: roi_type,
      entities_count: entities_count,
      choices: choices,
      orientation: orientation,
      direction: direction,
      corrected_by_teacher: isCorrectedByTeacher,
      id: this.selectedIdType === 'student_id' ? false : true,
      worth: worth,
    };
  
    // Store in selectedQuestions per page
    const pageKey = `page-${this.currentPage + 1}`;
    if (!this.selectedQuestions[pageKey]) {
      this.selectedQuestions[pageKey] = {};
    }
  
    const questionNumber = Object.keys(this.selectedQuestions[pageKey]).length + 1;
    const questionKey = `question-${questionNumber}`;
    this.selectedQuestions[pageKey][questionKey] = roiData;
  
    // Mark boxes as submitted
    if (this.selectionBoxesByPage[this.currentPage]) {
      this.selectionBoxesByPage[this.currentPage] = this.selectionBoxesByPage[this.currentPage].map((box) => ({
        ...box,
        submitted: true,
      }));
    }
  
    // Reset the form
    currentQuestionForm.reset({
      roi_coordinates: [],
      colNumber: '',
      direction: '',
      marked: '',
      gradedByTeacher: false,
      choices: '',
      worth: 1,
      id: false,
      entities_count: '',
      roi_type: 'question',
    });
  
    this.resetboxes();
    this.questionType = '';
    this.direction = '';
    this.isID = false;
  
    console.log('ROI data submitted:', roiData);
  }
  
  // onCurrentQuestionSubmit(): void {
  //   if (this.isGlobal) {
  //     this.isGlobal = false;
  //     this.isshow = true;
  //   }
  
  //   if (this.isshow) {
  //     const currentQuestionForm = this.getCurrentQuestionFormGroup();
  
  //     if (this.selectionBoxes.length > 0) {
  //       const userEntitiesCount = currentQuestionForm.value.entities_count || 0;
  //       const worth = currentQuestionForm.value.worth || 1;
  
  //       const points = this.selectionBoxes.map((box) => [
  //         [Math.floor(box.x), Math.floor(box.y)],
  //         [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
  //       ]);
  
  //       const orientation =
  //         currentQuestionForm.value.orientation === 'horizontal' ||
  //         currentQuestionForm.value.orientation === 'vertical'
  //           ? currentQuestionForm.value.orientation
  //           : 'vertical';
  
  //       const direction =
  //         currentQuestionForm.value.direction === 'right-to-left' ||
  //         currentQuestionForm.value.direction === 'top-to-bottom'
  //           ? currentQuestionForm.value.direction
  //           : orientation === 'vertical'
  //           ? 'top-to-bottom'
  //           : 'right-to-left';
  
  //       const roi_type =
  //         currentQuestionForm.value.roi_type === 'complementary' ||
  //         currentQuestionForm.value.roi_type === 'question'
  //           ? currentQuestionForm.value.roi_type
  //           : 'question';
  
  //       const isCorrectedByTeacher = currentQuestionForm.value.gradedByTeacher === 'true';
  
  //       let choices: string[] = [];
  //       let entities_count: number = 10;
  
  //       if (isCorrectedByTeacher) {
  //         // 👇 Parse the custom choices string (e.g. "0-0.5-1-2-3")
  //         const rawChoices = currentQuestionForm.value.choices || '';
  //         choices = rawChoices.split('-');
  //         entities_count = choices.length;
  //       } else {
  //         // 👇 Use Arabic letters logic
  //         const arabicLetters = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  //         const choiceCount = Number(currentQuestionForm.value.choices);
  //         entities_count = choiceCount && choiceCount > 0 ? choiceCount : 10;
  //         choices = arabicLetters.slice(0, entities_count);
  //       }
  
  //       const roiData: ROI = {
  //         points: points,
  //         roi_type: roi_type,
  //         entities_count: entities_count,
  //         choices: choices,
  //         orientation: orientation,
  //         direction: direction,
  //         corrected_by_teacher: isCorrectedByTeacher,
  //         id: this.selectedIdType === 'student_id' ? false : true,
  //         worth: worth,
  //       };
  
  //       console.log(roiData);
  
  //       if (roiData.corrected_by_teacher) {
  //         const numericChoices = (roiData.choices ?? []).map(Number).filter(n => !isNaN(n));
  //         const maxChoice = Math.max(...numericChoices, 0);
  //         this.finalScore += maxChoice;
  //       } else {
  //         this.finalScore += userEntitiesCount * worth;
  //       }
  
  //       const pageKey = `page-${this.currentPage + 1}`;
  //       if (!this.selectedQuestions[pageKey]) {
  //         this.selectedQuestions[pageKey] = {};
  //       }
  
  //       const questionNumber =
  //         Object.keys(this.selectedQuestions[pageKey]).length + 1;
  //       const questionKey = `question-${questionNumber}`;
  //       this.selectedQuestions[pageKey][questionKey] = roiData;
  
  //       // 🔵 Mark boxes as submitted (change to blue)
  //       if (this.selectionBoxesByPage[this.currentPage]) {
  //         this.selectionBoxesByPage[this.currentPage] =
  //           this.selectionBoxesByPage[this.currentPage].map((box) => ({
  //             ...box,
  //             submitted: true,
  //           }));
  //       }
  
  //       currentQuestionForm.reset({
  //         roi_coordinates: [],
  //         colNumber: '',
  //         direction: '',
  //         marked: '',
  //         gradedByTeacher: false,
  //         choices: '',
  //         worth: 1,
  //         id: false,
  //         entities_count: '',
  //         roi_type: 'question',
  //       });
  
  //       this.resetboxes();
  //       this.questionType = '';
  //     } else {
  //       console.error('Please define a selection area before submitting.');
  //     }
  
  //     this.direction = '';
  //     this.isID = false;
  //   }
  // }
  
  visibleSelectionBoxes: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  removeBox(index: number, event: any): void {
    event.stopPropagation();

    const removedBox = this.selectionBoxesByPage[this.currentPage][index];

    // 1. Remove from selectionBoxesByPage
    this.selectionBoxesByPage[this.currentPage].splice(index, 1);

    // 2. Remove from selectionBoxes (match by coordinates)
    this.selectionBoxes = this.selectionBoxes.filter(
      (box) =>
        !(
          box.x === removedBox.x &&
          box.y === removedBox.y &&
          box.width === removedBox.width &&
          box.height === removedBox.height
        )
    );

    // 3. Remove from visibleSelectionBoxes
    this.visibleSelectionBoxes = this.visibleSelectionBoxes.filter(
      (box) =>
        !(
          box.x === removedBox.x &&
          box.y === removedBox.y &&
          box.width === removedBox.width &&
          box.height === removedBox.height
        )
    );

    // 4. Remove from selectedQuestions structure
    const pageKey = `page-${this.currentPage + 1}`;
    const questionsOnPage = this.selectedQuestions[pageKey];

    if (questionsOnPage) {
      for (const questionKey of Object.keys(questionsOnPage)) {
        const question = questionsOnPage[questionKey];

        question.points = question.points.filter(([topLeft, bottomRight]) => {
          const isSame =
            topLeft[0] === Math.floor(removedBox.x) &&
            topLeft[1] === Math.floor(removedBox.y) &&
            bottomRight[0] === Math.floor(removedBox.x + removedBox.width) &&
            bottomRight[1] === Math.floor(removedBox.y + removedBox.height);

          return !isSame;
        });

        // Remove the question entirely if no points left
        if (question.points.length === 0) {
          delete questionsOnPage[questionKey];
        } else {
          // Update roi_type if only one box left
          question.roi_type =
            question.points.length === 1 ? 'question' : 'complementary';
        }
      }
    }
  }

  direction: any;
  checkdirection(direction: any) {
    this.direction = direction;
  }
  selectionBoxes: { x: number; y: number; width: number; height: number }[] =
    [];
  globalSelectionBox = { x: 0, y: 0, width: 0, height: 0 };
  globalSelectionBoxesByPage: {
    [pageNumber: number]: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } = {};

  onMouseDown(event: MouseEvent): void {
    const imgElement = event.target as HTMLImageElement;
    const rect = imgElement.getBoundingClientRect();

    const imgWidth = 600; // الصورة بعرض ثابت 600px
    const aspectRatio = imgElement.naturalHeight / imgElement.naturalWidth; // نسبة الأبعاد الحقيقية
    const imgHeight = imgWidth * aspectRatio; // حساب الارتفاع بناءً على العرض

    // ضبط الإحداثيات بحيث يكون (x=0) عند حافة اليسار و(y=0) عند الحافة العلوية
    this.startX = ((event.clientX - rect.left) / rect.width) * imgWidth;
    this.startY = ((event.clientY - rect.top) / rect.height) * imgHeight;

    this.isSelecting = true;
    this.selectionBox = { x: this.startX, y: this.startY, width: 0, height: 0 };
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isSelecting) {
      const imgElement = event.target as HTMLImageElement;
      const rect = imgElement.getBoundingClientRect();

      const imgWidth = 600; // عرض الصورة القياسي
      const aspectRatio = imgElement.naturalHeight / imgElement.naturalWidth; // نسبة أبعاد الصورة
      const imgHeight = imgWidth * aspectRatio; // حساب الارتفاع بناءً على العرض

      // تحويل إحداثيات الماوس إلى نظام الصورة (600x auto height)
      const currentX = ((event.clientX - rect.left) / rect.width) * imgWidth;
      const currentY = ((event.clientY - rect.top) / rect.height) * imgHeight;

      this.selectionBox.width = Math.abs(currentX - this.startX);
      this.selectionBox.height = Math.abs(currentY - this.startY);
      this.selectionBox.x = Math.min(this.startX, currentX);
      this.selectionBox.y = Math.min(this.startY, currentY);
    }
  }
  onMouseUp(): void {
    if (this.isSelecting) {
      this.isSelecting = false;

      if (this.isGlobal) {
        const fixedWidth = 100;
        const fixedHeight = 100;

        this.globalSelectionBoxesByPage[this.currentPage] = {
          x: this.selectionBox.x,
          y: this.selectionBox.y,
          width: fixedWidth,
          height: fixedHeight,
        };

        const selectionPoints: [[number, number], [number, number]] = [
          [this.selectionBox.x, this.selectionBox.y],
          [this.selectionBox.x + fixedWidth, this.selectionBox.y + fixedHeight],
        ];

        this._UploadService.setSelectedBox(selectionPoints);
        console.log(
          'Corrected Global Selection for page',
          this.currentPage,
          ':',
          this.globalSelectionBoxesByPage[this.currentPage]
        );
      } else {
        if (!this.selectionBoxesByPage[this.currentPage]) {
          this.selectionBoxesByPage[this.currentPage] = [];
        }

        const newBox = { ...this.selectionBox, submitted: false };

        this.selectionBoxesByPage[this.currentPage].push(newBox);
        this.selectionBoxes.push(newBox);
        this.visibleSelectionBoxes.push(newBox);

        console.log('Final Selection Box:', this.selectionBox);
      }

      this.resetSelectionBox();
    }
  }

  setOpacityForSameName(name: string, value: any): void {
    const radios = document.querySelectorAll(
      `input[name="${name}"]`
    ) as NodeListOf<HTMLInputElement>;

    radios.forEach((radio) => {
      const label = radio.nextElementSibling as HTMLElement;

      // Normalize both `radio.value` and `value` to strings for comparison
      if (radio.value === String(value)) {
        // Full opacity for the selected radio button and its label
        radio.style.opacity = '1';
        if (label) {
          label.style.opacity = '1';
        }
      } else {
        // Reduced opacity for unselected radio buttons and their labels
        radio.style.opacity = '0.5';
        if (label) {
          label.style.opacity = '0.5';
        }
      }
    });
  }
  setOpacityForBoolean(name: string, selectedValue: boolean): void {
    const radios = document.querySelectorAll(
      `input[name="${name}"]`
    ) as NodeListOf<HTMLInputElement>;
    radios.forEach((radio) => {
      const label = radio.nextElementSibling as HTMLElement;

      const isSelected =
        (radio.value === 'true' && selectedValue) ||
        (radio.value === 'false' && !selectedValue);

      if (isSelected) {
        radio.style.opacity = '1';
        if (label) label.style.opacity = '1';
      } else {
        radio.style.opacity = '0.5';
        if (label) label.style.opacity = '0.5';
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget &&
      (event.currentTarget as HTMLElement).classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget &&
      (event.currentTarget as HTMLElement).classList.remove('dragover');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).classList.remove('dragover');

    const file = event.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      this.fileInput.nativeElement.files = dataTransfer.files;

      // Manually trigger file select logic
      this.onFileSelected({ target: this.fileInput.nativeElement } as any);
    }
  }
}
// onCurrentQuestionSubmit(): void {
//   if (this.isGlobal) {
//     this.isGlobal = false;
//     this.isshow = true;
//   }

//   if (this.isshow) {
//     const currentQuestionForm = this.getCurrentQuestionFormGroup();

//     if (this.selectionBoxes.length > 0) {
//       const roiData: ROI = {
//         points: this.selectionBoxes.map((box) => [
//           [Math.floor(box.x), Math.floor(box.y)],
//           [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
//         ]),
//         roi_type: 'question',
//         entities_count: currentQuestionForm.value.choices && currentQuestionForm.value.choices.trim()
//         ? currentQuestionForm.value.choices.split(/[-,]/).map((choice: string) => choice.trim()).length
//         : 10,
//       choices: currentQuestionForm.value.choices && currentQuestionForm.value.choices.trim()
//         ? currentQuestionForm.value.choices.split(/[-,]/).map((choice: string) => choice.trim())
//         : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],

//         orientation: currentQuestionForm.value.orientation || 'horizontal',
//         direction: currentQuestionForm.value.direction || "right-to-left",
//         worth: currentQuestionForm.value.worth || 1,
//         corrected_by_teacher: currentQuestionForm.value.gradedByTeacher === true,
//         id: this.selectedIdType === 'student_id' ? false : true,
//       };
//       console.log(roiData)
//       const questionKey = `question_${Object.keys(this.selectedQuestions).length + 1}`;
//       this.selectedQuestions[questionKey] = roiData;

//       currentQuestionForm.reset({
//         roi_coordinates: [],
//         colNumber: '',
//         direction: '',
//         marked: '',
//         gradedByTeacher: false, // Ensure reset as boolean
//         choices: '',
//         worth: 1,
//         id: false,
//       });

//        this.resetboxes();
//     } else {
//       console.error('Please define a selection area before submitting.');
//     }

//     this.direction = '';
//     this.isID = false;
//   }
// }  // onFinalSubmit(): void {
//   this.onCurrentQuestionSubmit();

//   const pagesObject: Record<string, any> = {};

//   Object.keys(this.selectedQuestions).forEach((key) => {
//     const questionData = this.selectedQuestions[key];
//     const pageKey = `page-${questionData.page_number || 1}`;
//     const questionKey = `question-${Object.keys(pagesObject[pageKey] || {}).length + 1}`;

//     if (!pagesObject[pageKey]) {
//       pagesObject[pageKey] = {};
//     }

//     pagesObject[pageKey][questionKey] = {
//       points: questionData.points,
//       roi_type: questionData.roi_type || 'question',
//       entities_count: questionData.entities_count || 10,
//       choices: questionData.choices || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
//       orientation: questionData.orientation || 'horizontal',
//       direction: questionData.direction || 'right-to-left',
//       worth: questionData.worth || 1,
//       corrected_by_teacher: questionData.corrected_by_teacher || false,
//       id: questionData.id, // Now correctly stored based on the selected radio button
//     };
//   });

//   const finalPayload = { ...pagesObject };
//   this._UploadService.setdata(finalPayload , this.selectedFile);

//   if (this.selectedFile) {
//     this.formData.append('file', this.selectedFile);
//   }

//   const pdfJson = JSON.stringify(finalPayload);
//   this.formData.append('data', pdfJson);
//     // this._UploadService.setdata('res.response', this.selectedFile);
//     // this.router.navigate(['/review'])

//   this.isshow = false;
//   this._UploadService.upload(this.formData).subscribe({
//     next: (res) => {
//       console.log(res)
//       this._UploadService.setdata(res.response, this.selectedFile);
//       this.router.navigate(['/review'])
//     },
//     error: (err) => {
//       console.log(err);
//     },
//   });
//  }
