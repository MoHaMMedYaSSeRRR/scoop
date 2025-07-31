import { AuthService } from 'src/app/services/auth.service';
import { PayService } from './../../services/pay.service';
import { Component, ElementRef, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { PDFDocument } from 'pdf-lib';
import { UploadService } from 'src/app/services/upload.service';
import { ToastrService } from 'ngx-toastr';
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
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})
export class TestComponent {
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
  ispay: boolean = true;
  selectedIdType!: string;
  hasSubscribed: boolean = false;
  selectionBoxesByPage: {
    [pageNumber: number]: {
      x: number;
      y: number;
      width: number;
      height: number;
      submitted?: boolean;
    }[];
  } = {};
  modifiedFile: any;
  constructor(
    private formBuilder: FormBuilder,
    private _UploadService: UploadService,
    private router: Router,
    private _PayService: PayService,
    private route: ActivatedRoute,
    private _AuthService: AuthService,
    private _ToastrService: ToastrService
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
 
  
  
  
  showPay() {
    this.ispay = !this.ispay;
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
      
      // Patch the selected file into the form
      this.pdfForm.patchValue({ pdfFile: file });
      
      // Cut the PDF to the first 10 pages
      this.cutPdfToFirst10Pages(file).then((modifiedPdf) => {
        // Store the new modified PDF for submission
        this.modifiedFile = modifiedPdf;
      });
    } else {
      console.error('Please select a valid PDF file.');
      this.fileName = '';
      this.selectedFile = null;
      this.pdfForm.patchValue({ pdfFile: null });
    }
  }
  
  // Function to cut the PDF to the first 10 pages
  async cutPdfToFirst10Pages(file: File): Promise<File> {
    const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Create a new PDF document to store the first 10 pages
    const newPdf = await PDFDocument.create();
  
    // Get the total number of pages in the original PDF
    const totalPages = pdfDoc.getPages().length;
    const pagesToCopy = Math.min(totalPages, 10); // Limit to 10 pages
  
    // Copy the first 10 pages (or fewer if the PDF has less than 10 pages)
    for (let i = 0; i < pagesToCopy; i++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
    }
  
    // Save the new PDF
    const modifiedPdfBytes = await newPdf.save();
    const modifiedFile = new File([modifiedPdfBytes], 'modified.pdf', { type: 'application/pdf' });
  
    return modifiedFile;
  }
  
  

  get languageDirection(): string {
    return this.pdfForm.get('language')?.value === 'ar'
      ? 'right-to-left'
      : 'left-to-right';
  }

  // Handle PDF to Image conversion
  async convertPdfToImages(pdfUrl: string, maxPages: number = 10): Promise<string[]> {
    const images: string[] = [];
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    const numPages = Math.min(pdf.numPages, maxPages); // Limit to the maxPages (e.g., 10 pages)
  
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
  
        // Convert PDF only to the first 10 pages
        this.pdfImages = await this.convertPdfToImages(pdfUrl, 10); // Passing 10 as a parameter
  
        // Ensure we only keep the first 10 pages
        this.pdfImages = this.pdfImages.slice(0, 10);
  
        this.userPageCount = this.pdfForm.get('pageCount')?.value || 0;
  
        if (this.questions.length === 0) {
          const pageCount = Math.min(this.pdfImages.length, this.userPageCount); // Limit questions to the number of images
          for (let i = 0; i < pageCount; i++) {
            this.questions.push(
              this.formBuilder.group({
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
        this.step1 = false;
        this.step2 = true;
        this.isLoading = false;
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
  handleContinueFromPayment() {
    if (!this.hasSubscribed) {
      // Keep only the first 10 pdf pages
      this.pdfImages = this.pdfImages.slice(0, 10);
      this.userPageCount = 10;

      // Trim FormArray to first 10 questions
      while (this.questions.length > 10) {
        this.questions.removeAt(this.questions.length - 1);
      }
    }

    this.ispay = false;
    this.step1 = false;
    this.step2 = true;
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
 

  onFinalSubmit(): void {
    this.onCurrentQuestionSubmit(); // Ensure the last question is submitted
  
    const pagesObject: Record<string, any> = {};
    let totalExamScore = 0; // Initialize total score
  
    // Process the questions and limit them to 10 pages
    Object.keys(this.selectedQuestions).forEach((pageKey) => {
      if (!pagesObject[pageKey]) {
        pagesObject[pageKey] = {};
      }
  
      Object.keys(this.selectedQuestions[pageKey]).forEach(
        (questionKey, index) => {
          const questionData = this.selectedQuestions[pageKey][questionKey];
  
          pagesObject[pageKey][`question-${index + 1}`] = {
            points: questionData.points,
            roi_type:
              questionData.roi_type === 'complementary'
                ? 'complementary'
                : 'question',
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
  
    // finalPayload is generated based on the questions (limited to 10 pages)
    const finalPayload = { ...pagesObject };
    this._UploadService.setdata(finalPayload, this.selectedFile);
  
    if (this.modifiedFile) {
      // Send the modified file (first 10 pages only)
      this.formData.append('file', this.modifiedFile);
    }
  
    const pdfJson = JSON.stringify(finalPayload);
    this.formData.append('data', pdfJson);
  
    // Send the data (full PDF file + processed data for the first 10 pages)
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
    const userEntitiesCount = currentQuestionForm.value.entities_count || 0;

    const worth = currentQuestionForm.value.worth || 1;
    const isCorrectedByTeacher =
      currentQuestionForm.value.gradedByTeacher === 'true' ||
      currentQuestionForm.value.gradedByTeacher === true;

    // Get points from selection boxes
    const points = this.selectionBoxes.map((box) => [
      [Math.floor(box.x), Math.floor(box.y)],
      [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
    ]);

    // Orientation and direction defaults
    const orientation = ['horizontal', 'vertical'].includes(
      currentQuestionForm.value.orientation
    )
      ? currentQuestionForm.value.orientation
      : 'vertical';

    const direction = ['right-to-left', 'top-to-bottom'].includes(
      currentQuestionForm.value.direction
    )
      ? currentQuestionForm.value.direction
      : orientation === 'vertical'
      ? 'top-to-bottom'
      : 'right-to-left';

    // ROI type
    const roi_type = ['question', 'complementary'].includes(
      currentQuestionForm.value.roi_type
    )
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
    if (roiData.corrected_by_teacher) {
      const numericChoices = (roiData.choices ?? [])
        .map(Number)
        .filter((n) => !isNaN(n));
      const maxChoice = Math.max(...numericChoices, 0);
      this.finalScore += maxChoice;
    } else {
      this.finalScore += userEntitiesCount * worth;
    }
    // Store in selectedQuestions per page
    const pageKey = `page-${this.currentPage + 1}`;
    if (!this.selectedQuestions[pageKey]) {
      this.selectedQuestions[pageKey] = {};
    }

    const questionNumber =
      Object.keys(this.selectedQuestions[pageKey]).length + 1;
    const questionKey = `question-${questionNumber}`;
    this.selectedQuestions[pageKey][questionKey] = roiData;

    // Mark boxes as submitted
    if (this.selectionBoxesByPage[this.currentPage]) {
      this.selectionBoxesByPage[this.currentPage] = this.selectionBoxesByPage[
        this.currentPage
      ].map((box) => ({
        ...box,
        submitted: true,
      }));
    }

    // Reset the form
    currentQuestionForm.reset({
      roi_coordinates: [],
      colNumber: '',
      direction: '',
      orientation: '',
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
  isshowcomp: boolean = true;
  checkShow(x: any) {
    if ((x = 'comp')) {
      this.isshowcomp = false;
    } else {
      this.isshowcomp = true;
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


