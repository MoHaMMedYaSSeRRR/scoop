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

        // Transition to step two
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
    return this.questions.at(this.currentPage) as FormGroup;
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
    if (this.isGlobal == true) {
      this.globalSelectionBox = this.selectionBox;
      console.log(this.globalSelectionBox);
      this.isGlobal = false;
      this.isshow = true;
    }
    if (this.isshow == true) {
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
    if (this.isGlobal == true) {
      this.isGlobal = false;
      this.isshow = true;
    }
    if (this.isshow == true) {
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
            .split('-')
            .map((choice: string) => parseFloat(choice.trim()));

          // Safely calculate the max value
          roiData.points =
            Array.isArray(roiData.choices) && roiData.choices.length > 0
              ? Math.max(...roiData.choices)
              : 0; // Default to 0 if choices is undefined or empty

          const questionKey = `question_${
            Object.keys(this.selectedQuestions).length + 1
          }`;

          this.selectedQuestions[questionKey] = roiData;
        } else {
          // Add points to ROI for non-teacher ID
          roiData.points = Number(currentQuestionForm.value.choices) || 1;
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
      this.isID = false;
    }
  }

  checkifid(x: any) {
    if (x == true) {
      this.isID = true;
    } else {
      this.isID = false;
    }
  }
  checkQuestionType(x: any) {
    this.questionType = x;
  }
  onFinalSubmit(): void {
    this.onCurrentQuestionSubmit();

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

    const finalPayload = {
      answer_pages: this.userPageCount, // Use userPageCount for dynamic page count
      questions: questionsObject, // Include questions object
    };
    this._UploadService.setdata(finalPayload);
    console.log(finalPayload); // Check the structure of your final payload

    if (this.selectedFile) {
      this.formData.append('file', this.selectedFile);
    }

    const pdfJson = JSON.stringify(finalPayload);
    this.formData.append('data', pdfJson);

    this.isshow = false;
  }
  onCallApi() {
    this._UploadService.setSelectedBox(this.globalSelectionBox);
    console.log(this.globalSelectionBox);
    this._UploadService.upload(this.formData).subscribe({
      next: (res) => {
        console.log(res);
        this.pdfUrl = res.pdf_file_path;
        this._UploadService.setPdfUrl(this.pdfUrl);

        // Process the response to calculate grades and errors
        this.processApiResponse(
          res.response.answers,
          res.response.model_answer
        );

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
    this.direction = direction;
  }
  selectionBoxes: { x: number; y: number; width: number; height: number }[] =
    [];
  globalSelectionBox = { x: 0, y: 0, width: 0, height: 0 };

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
      if (this.isGlobal == true) {
        this.globalSelectionBox = this.selectionBox;
        console.log(this.globalSelectionBox)
      }
      // Add finalized selection box to array
      this.selectionBoxes.push({ ...this.selectionBox });
      console.log('Final Selection Box:', this.selectionBox);

      this.resetSelectionBox(); // Reset for next selection
    }
  }

  // Function to process the response
  processApiResponse(response: any, model: any): void {
    const results: any[] = []; // Array to store final results

    for (const studentId in response) {
      const studentData = response[studentId];
      let totalGrades = 0;
      let maxGrades = 0;
      const errorPages = new Set<number>(); // Use a Set to avoid duplicate pages
      let page: any = 0;

      for (const questionKey in studentData) {
        const question = studentData[questionKey];
        // Validate grades and calculate total and max grades
        page = question.page;
        if (Array.isArray(question.grades)) {
          totalGrades += question.grades.reduce(
            (sum: number, grade: number) => sum + grade,
            0
          );
        }

        // Check for errors and collect pages
        if (Array.isArray(question.errors)) {
          question.errors.forEach((error: string | null) => {
            if (error === "There's more than one answer") {
              errorPages.add(question.page);
            }
          });
        }
      }

      if (model) {
        for (const questionKey in model) {
          const question = model[questionKey];
          console.log(question);
          if (question.grades) {
            maxGrades += question.grades;
          }
        }
      }

      console.log('Model Answer Max Grade:', maxGrades);

      // Add result for the current student
      results.push({
        studentId: parseInt(studentId, 10),
        totalGrades,
        maxGrades,
        page: page,
        score: `${totalGrades} out of ${maxGrades}`,
        errorPages: Array.from(errorPages), // Convert Set to Array
      });
    }
    this._UploadService.setScores(results);
    console.log(results); // Output the final result
  }
  removeBox(index: number, event: any): void {
    event.stopPropagation();
    this.selectionBoxes.splice(index, 1);
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
    console.log(radios);
    radios.forEach((radio) => {
      const label = radio.nextElementSibling as HTMLElement;

      // Determine if the current radio is selected
      const isSelected =
        (radio.value === 'true' && selectedValue) ||
        (radio.value === 'false' && !selectedValue);

      // Apply opacity based on selection
      if (isSelected) {
        radio.style.opacity = '1'; // Fully opaque for selected
        if (label) label.style.opacity = '1'; // Fully opaque for label
      } else {
        radio.style.opacity = '0.5'; // Semi-transparent for unselected
        if (label) label.style.opacity = '0.5'; // Semi-transparent for label
      }
    });
  }
}
