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
  private readonly ORIGINAL_IMAGE_WIDTH = 600; // Update this to the original width of your image
private readonly ORIGINAL_IMAGE_HEIGHT = 800; // Update this to the original height of your image
  step1: boolean = true;
  step2: boolean = false;
  selectedFile: any;
  pdfForm: FormGroup;
  fileName: string | null = null;
  pdfImages: any[] = [];
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
                fractioned_Grades: [null, [this.fractionedGradesValidator]],
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
   fractionedGradesValidator(control: FormControl): { [key: string]: boolean } | null {
    const value = control.value;
    // Allow empty input to be considered valid (return null if empty)
    if (!value) {
      return null;
    }
  
    // Validate if non-empty
    const values = value.split(',').map((val: string) => parseFloat(val));
    const isValid = values.every((num:any) => !isNaN(num) && num >= 0);
    return isValid ? null : { invalidFractionedGrade: true };
  }
  
  // Navigate to previous page
  goToPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.resetSelectionBox(); // Reset selection on page change
    }
  }

  url:string='';
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
          marked: '' ,
          gradedByTeacher: '' ,
          fractioned_Grades: null
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

  onFinalSubmit(): void {
    // Get the current question form
    const currentQuestionForm = this.getCurrentQuestionFormGroup();
    
    // Store the last question data, whether or not the form is valid
    this.addCurrentQuestionData();

    // Prepare FormData for the final upload
    const formData = new FormData();
    if (this.selectedFile) {
        formData.append('pdf_file', this.selectedFile, this.selectedFile.name);
    }

    // Prepare the JSON data for the final submission
    const pdfJson = JSON.stringify(this.selectedQuestions);
    formData.append('json_data', pdfJson);

    // Perform the upload
    this._UploadService.upload(formData).subscribe({
        next: (res) => {
            console.log(res);
            if (res.result && res.result.output_path) {
                const url = res.result.output_path.slice(1);
                console.log(url);
                setTimeout(() => {
                    const anchor = document.createElement('a');
                    anchor.href = 'http://157.173.124.62:5000' + url;
                    anchor.target = '_blank';
                    anchor.click();
                }, 100); // 100ms delay
            } else {
                console.error('Output path is missing in the response:', res);
            }
        },
        error: (err) => console.log(err)
    });
}


  
  addCurrentQuestionData(): void {
    const currentQuestion = this.getCurrentQuestionFormGroup().value;

    let fractionedGradesArray: number[] | null = null;

    if (currentQuestion.fractioned_Grades) {
        const parsedGrades = currentQuestion.fractioned_Grades
            .split(',')
            .map((grade: string) => parseFloat(grade.trim()))
            .filter((grade: number) => !isNaN(grade));

        if (parsedGrades.length > 0) {
            fractionedGradesArray = parsedGrades;
        }
    }
    if (this.pdfImages.length === 0) {
        console.error('No PDF images loaded');
        return;
    }
    const currentImage = this.pdfImages[this.currentPage];
    const roiData = {
        roi_coordinates: [
            Math.floor(this.selectionBox.x) , // min x
            Math.floor(this.selectionBox.y) , // min y
           Math.floor( this.selectionBox.width), // max x
            Math.floor(this.selectionBox.height)   // max y
        ],
        row_col_numbers: [currentQuestion.rowNumber, currentQuestion.colNumber],
        marked: currentQuestion.marked,
        graded_by_teacher: currentQuestion.gradedByTeacher,
        fractioned_grades: fractionedGradesArray,
        direction_of_question: currentQuestion.direction,
    };

    console.log('ROI Data:', roiData); 

    let pageData = this.selectedQuestions.find(
        page => page.page_number === this.currentPage + 1
    );

    if (!pageData) {
        pageData = { page_number: this.currentPage + 1, rois: [] };
        this.selectedQuestions.push(pageData);
    }

    pageData.rois.push(roiData);
    console.log("hello")

}


onMouseDown(event: MouseEvent): void {
  const imgElement = event.target as HTMLImageElement;
  const rect = imgElement.getBoundingClientRect();

  this.isSelecting = true;

  // Get the start coordinates relative to the original image size
  this.startX = (event.clientX - rect.left) * (this.ORIGINAL_IMAGE_WIDTH / rect.width);
  this.startY = (event.clientY - rect.top) * (this.ORIGINAL_IMAGE_HEIGHT / rect.height);

}
onMouseMove(event: MouseEvent): void {
  if (this.isSelecting) {
    const imgElement = event.target as HTMLImageElement;
    const rect = imgElement.getBoundingClientRect();

    // Get the current coordinates relative to the original image size
    const currentX = (event.clientX - rect.left) * (this.ORIGINAL_IMAGE_WIDTH / rect.width);
    const currentY = (event.clientY - rect.top) * (this.ORIGINAL_IMAGE_HEIGHT / rect.height);

    this.selectionBox = {
      x: Math.min(this.startX, currentX), 
      y: Math.min(this.startY, currentY),
      width: Math.abs(currentX - this.startX),
      height: Math.abs(currentY - this.startY)
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