import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UploadService } from 'src/app/services/upload.service';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { jsPDF } from 'jspdf';
import examData from '../../../assets/EXAM-2-response.json';

interface Question {
  position: number[][][];
  bubbles: number;
  direction: string;
  method: string;
  marked_by_teacher: boolean;
  page: number;
  points?: number;
  question_number?: number;
}
interface StudentScores {
  studentId: number;
  page: number;
  totalGrades: number;
  maxGrades: number;
  score: Record<number, string>;
  errorPages: number[];
  total?: number; // Optional if dynamically calculated
  maxScore?: number; // Optional if dynamically calculated
}

interface StudentMarks {
  id: number;
  marks: Record<string, number>;
}
@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss'],
})
export class ReviewComponent implements OnInit {
  question_data: any[] = [];

  pdfImages: any[] = [];
  currentPage: number = 0;
  userPageCount: number = 0;
  ispay: boolean = false;
  pdfUrl: string = '';
  isLoading: boolean = true;
  score: any;
  selectedColor: string = 'black';
  isDrawing: boolean = false;
  colors: string[] = ['red', 'green'];
  isSelecting: boolean = false; // For selection box visibility
  selectionBox: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  isGlobal: boolean = false;
  isSelectionBox: boolean = true;

  // The global selection box
  globalSelectionBox = { x: 0, y: 0, width: 0, height: 0 };
  selectionBoxes: { x: number; y: number; width: number; height: number }[] =
    [];
  selectionStartX: number = 0;
  selectionStartY: number = 0;
  @ViewChild('canvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  private canvasContext!: CanvasRenderingContext2D;

  marks: { page: number; type: string; x: number; y: number }[] = [];
  pageSelections: {
    [page: number]: { x: number; y: number; width: number; height: number }[];
  } = {};
  currentStudentId!: number;
  newmarks!: StudentMarks[];
  data: any;
  showfinalize = false;
  showDownload = false;
  showScore = false;
  omrResponse: any;
  pdfFile!: File;

  studentsScores: StudentScores[] = [];
  currentErrorIndex: number = 0;
  errorPages: number[] = []; // Stores only pages with errors
  errorBorders: {
    [key: number]: {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }[];
  } = {};

  constructor(private _UploadService: UploadService) {}

  ngOnInit(): void {
    this._UploadService.data$.subscribe((response) => {
      if (response) {
        this.omrResponse = response;
      }
    });
    this._UploadService.file$.subscribe((file) => {
      if (file) {
        this.pdfFile = file;
        console.log(this.pdfFile);
      }
    });

    //  this.omrResponse =examData;
    this.getAllPagesWithErrors();
    this.processOmrResponse();
    this.loadPdfImages(this.pdfFile);
  }

  async convertPdfToImages(file: File): Promise<string[]> {
    const images: string[] = [];

    // Read file as ArrayBuffer
    const fileReader = new FileReader();
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
      fileReader.onerror = (error) => reject(error);
      fileReader.readAsArrayBuffer(file);
    });

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(arrayBuffer);

    // Load PDF from Uint8Array
    const pdf = await pdfjsLib.getDocument(uint8Array).promise;
    const numPages = pdf.numPages;

    const imagePromises = Array.from({ length: numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      return canvas.toDataURL('image/png');
    });

    return Promise.all(imagePromises);
  }

  async loadPdfImages(file: File) {
    this.isLoading = true;
    try {
      this.pdfImages = await this.convertPdfToImages(file);
      this.userPageCount = this.pdfImages.length;
      console.log('PDF converted to images:', this.pdfImages);
    } catch (error) {
      console.error('Error converting PDF to images:', error);
    } finally {
      this.isLoading = false;
    }
  }

  clearCanvas(): void {
    if (this.canvasContext) {
      const canvas = this.canvasRef.nativeElement;
      this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  convertQuestionsToArray(questions: { [key: string]: Question }): Question[] {
    return Object.values(questions).map(
      ({
        position,
        bubbles,
        direction,
        method,
        marked_by_teacher,
        page,
        points,
        question_number,
      }) => ({
        position,
        bubbles,
        direction,
        method,
        marked_by_teacher,
        page,
        points,
        question_number,
      })
    );
  }
  clearSelection(): void {
    this.selectionBoxes = [];
    this.pageSelections[this.currentPage] = [];
  }

  markedSelectionArray: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];



  showpay() {
    this.isGlobal = !this.isGlobal; // Toggle between global and page selection
    if (this.isGlobal) {
      console.log('Global Box:', this.globalSelectionBox);
    } else {
      console.log('Page-Specific Selections:', this.selectionBoxes);
    }
  }

  selectionCircles: {
    [page: number]: {
      x: number;
      y: number;
      radius: number;
      isCorrect: boolean;
    }[];
  } = {};

  circleRadius: number = 6;

  getNormalizedClick(event: MouseEvent, imgElement: HTMLImageElement) {
    const fixedWidth = 600; // Fixed width
    const rect = imgElement.getBoundingClientRect();
    const scaleX = fixedWidth / rect.width;
    const scaleY = scaleX; // Maintain aspect ratio

    return {
      offsetX: (event.clientX - rect.left) * scaleX,
      offsetY: (event.clientY - rect.top) * scaleY,
    };
  }

  /** ✅ Get the current page data */
  getPageData() {
    const pageData = this.omrResponse.find(
      (p: any) => p.page_number === this.currentPage
    );
    if (!pageData) {
      console.error(`⚠️ No data found for page ${this.currentPage + 1}`);
      return null;
    }
    return pageData;
  }

  errorQuestions: any[] = []; // ✅ Store errors for UI display

  /** ✅ Convert numbers to Arabic */
  getArabicNumber(num: any) {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num)
      .split('')
      .map((digit) => arabicNumbers[parseInt(digit, 10)])
      .join('');
  }
  reviewOMR() {
    const box = this._UploadService.getSelectedBox();
  
    if (
      !Array.isArray(box) ||
      box.length !== 2 ||
      !Array.isArray(box[0]) ||
      !Array.isArray(box[1])
    ) {
      console.error('❌ Invalid box data format:', box);
      return;
    }
  
    // Extract coordinates from the array
    const [x_min, y_min] = box[0];
    const [x_max, y_max] = box[1];
  
    // Calculate the center and radius of the circle
    const x_center = Math.round((x_min + x_max) / 2);
    const y_center = Math.round((y_min + y_max) / 2);
    const radius = Math.round(Math.max(x_max - x_min, y_max - y_min) / 2);
  
    const circleData = { x: x_center, y: y_center, radius: radius };
    console.log('⭕ Circle Data:', circleData);
  
    // Update OMR data with circular selection
    const updatedOMR = {
      pages: { ...this.omrResponse }, // Wrap existing data inside 'pages'
      number_of_pages: this.omrResponse.length, // Count total pages
      drag: circleData, // Store circle data
    };
  
    this._UploadService.reviewOmr(updatedOMR).subscribe({
      next: (res) => {
        console.log('✅ API Response:', res);
  
        // Open link in a new tab if the response contains a valid URL
        if (res.success && res.response) {
          window.open(res.response, '_blank');
        }
      },
      error: (err) => {
        console.error('❌ API Error:', err);
      },
    });
  
    console.log('📄 Updated OMR JSON with Circle:', updatedOMR);
    return updatedOMR;
  }
  

  getAllPagesWithErrors() {
    this.errorQuestions = [];
    this.errorBorders = {}; // Ensure it's an object, not an array
    const errorPagesSet = new Set<number>();

    this.omrResponse.forEach((pageData: any) => {
      const pageErrors: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
      }[] = []; // Explicit type

      Object.entries(pageData.questions).forEach(
        ([questionNumber, questionData]: [string, any]) => {
          questionData.groups.forEach((group: any, groupIndex: number) => {
            if (group.errors) {
              this.errorQuestions.push({
                page: pageData.page_number,
                questionNumber,
                subQuestion: groupIndex + 1,
                errors: group.errors,
              });

              errorPagesSet.add(pageData.page_number);

              // Ensure we have valid bubbles
              if (!group.bubbles || group.bubbles.length === 0) return;

              const bubbles = group.bubbles.map((b: any) => b.circle);
              const minX = Math.min(...bubbles.map((b: any) => b[0]));
              const minY = Math.min(...bubbles.map((b: any) => b[1]));
              const maxX = Math.max(...bubbles.map((b: any) => b[0]));
              const maxY = Math.max(...bubbles.map((b: any) => b[1]));

              // Add dynamic padding for small areas
              const padding = 10;
              const width = maxX - minX + padding;
              const height = maxY - minY + padding;

              // Determine border color
              let borderColor = '#ff0000'; // Default: No answer
              if (group.errors === "There's more than one answer") {
                borderColor = '#0000ff'; // Multiple answers
              }

              // Store errors per page
              pageErrors.push({
                x: minX - padding / 2,
                y: minY - padding / 2,
                width: width,
                height: height,
                color: borderColor,
              });
            }
          });
        }
      );

      // Assign page-specific errors
      if (pageErrors.length > 0) {
        this.errorBorders[pageData.page_number] = pageErrors;
      }
    });

    this.errorPages = Array.from(errorPagesSet).sort((a, b) => a - b);

    if (this.errorPages.length > 0) {
      this.currentErrorIndex = 0;
      this.currentPage = this.errorPages[this.currentErrorIndex];
    }

    console.log('🚨 Pages with errors:', this.errorPages);
    console.log('🖼️ Error Borders:', this.errorBorders);
  }

  onMouseDown(event: MouseEvent) {
    const imgElement = event.target as HTMLImageElement;
    if (!imgElement) return;
  
    const { offsetX, offsetY } = this.getNormalizedClick(event, imgElement);
  
    // Find the error border where the click occurred
    const errorBorder = (this.errorBorders[this.currentPage] || []).find(
      (border) =>
        offsetX >= border.x &&
        offsetX <= border.x + border.width &&
        offsetY >= border.y &&
        offsetY <= border.y + border.height
    );
  
    if (!errorBorder) {
      console.warn('❌ Click ignored! Not inside an error-marked area.');
      return;
    }
  
    // Proceed with question selection logic
    const pageData = this.getPageData();
    if (!pageData) return;
  
    const foundQuestionKey = this.getClickedQuestion(offsetX, offsetY, pageData);
    if (!foundQuestionKey) return;
  
    // Ensure selectionCircles is initialized for the current page
    if (!this.selectionCircles[this.currentPage]) {
      this.selectionCircles[this.currentPage] = [];
    }
  
    // Remove any existing circle inside this error border
    this.selectionCircles[this.currentPage] = this.selectionCircles[this.currentPage].filter(circle =>
      !(
        circle.x >= errorBorder.x &&
        circle.x <= errorBorder.x + errorBorder.width &&
        circle.y >= errorBorder.y &&
        circle.y <= errorBorder.y + errorBorder.height
      )
    );
  
    // Update bubble selection
    this.updateBubbleSelection(offsetX, offsetY, pageData.questions[foundQuestionKey], foundQuestionKey);
  }
  

  getClickedQuestion(offsetX: number, offsetY: number, pageData: any) {
    const tolerance = 12;
    let foundQuestionKey = null;

    for (const questionKey in pageData.questions) {
      const question = pageData.questions[questionKey];

      if (!question.points || question.points.length < 1) continue;

      const [[minX, minY], [maxX, maxY]] = question.points[0];
      if (
        offsetX >= minX - tolerance &&
        offsetX <= maxX + tolerance &&
        offsetY >= minY - tolerance &&
        offsetY <= maxY + tolerance
      ) {
        console.log(`✅ Found question: ${questionKey}`);
        foundQuestionKey = questionKey;
        break;
      }
    }

    if (!foundQuestionKey) {
      console.warn(`❌ No matching question found.`);
      return null;
    }
    return foundQuestionKey;
  }

    updateBubbleSelection(
      offsetX: number,
      offsetY: number,
      foundQuestionData: any,
      questionKey: string
    ) {
      const circleRadius = 8;
      const tolerance = 12;
      let bestMatch: any = null;
      let bestDistance = Infinity;
      let foundGroupIndex: number | null = null;
    
      for (let groupIndex = 0; groupIndex < foundQuestionData.groups.length; groupIndex++) {
        const group = foundQuestionData.groups[groupIndex];
        for (const bubble of group.bubbles) {
          const [bubbleX, bubbleY, bubbleRadius] = bubble.circle;
          const distance = Math.sqrt((offsetX - bubbleX) ** 2 + (offsetY - bubbleY) ** 2);
          if (distance <= bubbleRadius + tolerance) {
            if (distance < bestDistance) {
              bestDistance = distance;
              bestMatch = bubble;
              foundGroupIndex = groupIndex;
            }
          }
        }
      }
    
      if (bestMatch && foundGroupIndex !== null) {
        // console.log(`✅ Closest Bubble Found in Group ${foundGroupIndex} at (${bestMatch.circle[0]}, ${bestMatch.circle[1]})`);
        // console.log(`🔍 Distance from click: ${bestDistance}px`);
    
        // Find Model Answer Page (Page 1)
        const modelAnswerPage = this.omrResponse.find((p: any) => p.page_number === 1);
        if (!modelAnswerPage) {
          // console.warn('⚠️ Model Answer Page (Page 1) Not Found!');
          return;
        }
    
        // console.log('📄 Model Answer Page Structure:', modelAnswerPage);
        // console.log('🔍 Searching for Question Key:', questionKey);
    
        if (!modelAnswerPage.questions || !modelAnswerPage.questions[questionKey]) {
          console.warn(`⚠️ No matching question '${questionKey}' found in Model Answer Page!`);
          console.log('🧐 Available Questions:', Object.keys(modelAnswerPage.questions));
          return;
        }
    
        const modelQuestion = modelAnswerPage.questions[questionKey];
    
        // Find the corresponding group in Model Answer Page
        const modelGroup = modelQuestion.groups[foundGroupIndex];
        if (!modelGroup) {
          // console.warn('⚠️ No matching group found in Model Answer Page!');
          return;
        }
    
        // Check if the selected bubble is correct
        let isCorrect = false;
        for (const bubble of modelGroup.bubbles) {
          console.log(bestMatch)
          if (bubble.choice === bestMatch.choice) {
            isCorrect = bubble.selected === true; // Bubble is correct only if selected in Page 1
            break;
          }
        }
    
        // Unselect previously selected bubble in the same group
        foundQuestionData.groups[foundGroupIndex].bubbles.forEach((bubble: any) => {
          bubble.selected = false;
          console.log(bubble)
        });
        // console.log(foundQuestionData.groups[foundGroupIndex].errors)

        // Select new bubble
        bestMatch.selected = true;
    
        // ✅ Clear error message when a bubble is selected
        if (foundQuestionData.groups[foundGroupIndex].errors) {
          // console.log('🔄 Removing error message:',foundQuestionData.groups[foundGroupIndex].errors);
          foundQuestionData.groups[foundGroupIndex].errors = null;
        }
        // console.log(foundQuestionData.groups[foundGroupIndex].errors);

        // Store Selection for Dynamic Update
        if (!this.selectionCircles[this.currentPage]) {
          this.selectionCircles[this.currentPage] = [];
        }
    
        // 🔥 Use bestMatch.circle coordinates instead of offsetX and offsetY
        this.selectionCircles[this.currentPage].push({
          x: bestMatch.circle[0], // Use found bubble X
          y: bestMatch.circle[1], // Use found bubble Y
          radius: circleRadius,
          isCorrect,
        });
    
        // console.log(`🎯 Selected choice: ${bestMatch.choice} → ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
        // console.log('🚀 Updated foundQuestionData:', foundQuestionData);
      } else {
        console.warn(`❌ No valid bubble found near (${offsetX}, ${offsetY}).`);
      }
    }
  
  

  getPagesWithErrors() {
    if (!Array.isArray(this.omrResponse)) {
      console.error(
        '❌ Error: this.omrResponse is not an array',
        this.omrResponse
      );
      return;
    }

    this.errorPages = this.omrResponse
      .filter((page: any) => page.page_number !== 1) // Exclude Model Answer Page 1
      .filter(
        (page: any) =>
          page.questions &&
          Object.values(page.questions).some((q: any) => q.errors)
      )
      .map((page: any) => page.page_number);

    if (this.errorPages.length > 0) {
      this.currentErrorIndex = 0; // Start from the first error page
    }

    console.log(`🚨 Pages with errors: ${this.errorPages.join(', ')}`);
  }

  goToPreviousPage() {
    if (this.currentErrorIndex > 0) {
      this.currentErrorIndex--;
      this.currentPage = this.errorPages[this.currentErrorIndex]; // Move to previous error page
    }
  }

  goToNextPage() {
    if (this.currentErrorIndex < this.errorPages.length - 1) {
      this.currentErrorIndex++;
      this.currentPage = this.errorPages[this.currentErrorIndex]; // Move to next error page
    }
  }

  filteredPages: any[] = [];
  detectedCircles: {
    [key: number]: {
      x: number;
      y: number;
      radius: number;
      isCorrect: boolean;
    }[];
  } = {};

  processOmrResponse(): void {
    if (!this.omrResponse) return;

    this.detectedCircles = {}; // Reset detected circles for each page

    this.omrResponse.forEach(
      (page: { page_number: number; questions: any }) => {
        let pageCircles: {
          x: number;
          y: number;
          radius: number;
          isCorrect: boolean;
        }[] = [];

        Object.keys(page.questions).forEach((questionKey: string) => {
          let question = page.questions[questionKey];

          if (question.groups && Array.isArray(question.groups)) {
            question.groups.forEach(
              (group: { bubbles: any[]; errors?: string }) => {
                if (!group.errors) {
                  // Only process groups without errors
                  group.bubbles.forEach(
                    (bubble: {
                      circle: number[];
                      selected: boolean;
                      correct: boolean;
                    }) => {
                      if (bubble.selected) {
                        pageCircles.push({
                          x: bubble.circle[0],
                          y: bubble.circle[1],
                          radius: bubble.circle[2],
                          isCorrect: bubble.correct,
                        });
                      }
                    }
                  );
                }
              }
            );
          }
        });

        this.detectedCircles[page.page_number] = pageCircles;
      }
    );
  }
}
interface Page {
  page_number: number;
  questions: { [key: string]: Question };
}
