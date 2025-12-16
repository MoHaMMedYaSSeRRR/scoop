import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UploadService } from 'src/app/services/upload.service';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { jsPDF } from 'jspdf';
import examData from '../../../assets/EXAM-1-response.json';
import { Router } from '@angular/router';
import { FinalSheetComponent } from '../final-sheet/final-sheet.component';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { ProcessingService } from 'src/app/services/processing.service';
import { NgZone } from '@angular/core';

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
  showDownloadButton:boolean=false;
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
  @ViewChild(FinalSheetComponent) finalSheetComponent!: FinalSheetComponent; // Reference FinalSheetComponent

  constructor(private _UploadService: UploadService, private router: Router ,
    private _AuthService: AuthService,
    private _ToastrService:ToastrService ,
    private processingService:ProcessingService,
      private ngZone: NgZone , 
       private toastr:ToastrService

    ) {}

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

    // this.omrResponse =examData;
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
    const pageData = Object.values(this.omrResponse).find(
      (p: any) => p.page_number === this.currentPage
    );

    if (!pageData) {
      console.error(`⚠️ No data found for page ${this.currentPage + 1}`);
      return null;
    }

    return pageData as any; // 👈 simple cast to avoid TS error
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
async reviewOMR(): Promise<void> {
  try {
    const box = this._UploadService.getSelectedBox();

    if (!Array.isArray(box) || box.length !== 2) {
      this.toastr.error('❌ Invalid box selection');
      return;
    }

    const [x_min, y_min] = box[0];
    const [x_max, y_max] = box[1];
    const circleData = {
      x: Math.round((x_min + x_max) / 2),
      y: Math.round((y_min + y_max) / 2),
      radius: Math.round(Math.max(x_max - x_min, y_max - y_min) / 2),
    };

    const updatedOMR = {
      pages: { ...this.omrResponse },
      number_of_pages: Object.keys(this.omrResponse).length,
      drag: circleData,
    };

    const userPackageId = localStorage.getItem('userPackageId');
    const pagesStr: any = localStorage.getItem('pdf_page_count');

    if (!userPackageId || !pagesStr) {
      this.toastr.error('بيانات الحزمة أو عدد الصفحات غير متوفرة.');
      return;
    }

    this._AuthService.checkRemainingpages(userPackageId, pagesStr, true).subscribe({
      next: (res: any) => {
        console.log('✅ Remaining page check:', res);

        // ✅ Start fake progress simulation
        const processingSim = this.processingService.startProcessing(60);
        const startTime = Date.now();

        this._UploadService.reviewOmr(updatedOMR).subscribe({
          next: (res) => {
            const duration = (Date.now() - startTime) / 1000;
            console.log(`✅ Review finished in: ${duration}s`);

            // ✅ Stop progress simulation cleanly
            this.processingService.stopProcessing();

            if (res.success && res.response) {
              const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

              if (isMobile) {
                // 📱 لو موبايل → افتح الرابط في نفس الصفحة
                window.location.href = res.response;
              } else {
                // 💻 لو كمبيوتر → افتح في تاب جديدة
                const previewTab = window.open('', '_blank');
                if (previewTab) {
                  previewTab.location.href = res.response;
                } else {
                  console.error('❌ لم يتم فتح التبويب (قد يكون المتصفح منع النوافذ المنبثقة).');
                }
              }

              // ✅ باقي العمليات بعد الفتح
              this._UploadService.setOmrIds(res.ids);
              this.finalSheetComponent.omrIds = res.ids;
              this.finalSheetComponent.onSubmit();
              this.toastr.success('تمت مراجعة ورقة الإجابة بنجاح ✅');
            }
          },
          error: (err) => {
            console.error('❌ Review failed:', err);
            this.processingService.stopProcessing();
            this.toastr.error('فشل في مراجعة الورقة.');
          },
        });
      },
      error: (err: any) => {
        console.log(err);
        if (err.error?.message === 'Not enough remaining pages.') {
          this.toastr.error('عدد الصفحات المتبقية غير كافٍ في خطتك الحالية.');
        } else {
          this.toastr.error('حدث خطأ أثناء التحقق من الصفحات المتبقية.');
        }
      },
    });
  } catch (error) {
    console.error('❌ Error during reviewOMR:', error);
    this.processingService.stopProcessing();
    this.toastr.error('حدث خطأ أثناء معالجة الورقة.');
  }
}



  async checkRemainingpages() {  
    try {
      const userPackageId = localStorage.getItem('userPackageId');
      const pagesStr:any = localStorage.getItem('pdf_page_count');
      this._AuthService.checkRemainingpages(userPackageId, pagesStr , true).subscribe({
        next: (res) => { 
          console.log(res);
        },
        error: (err:any) => {
          console.log(err);
          if (err.error.message == 'Not enough remaining pages.') {
            console.log(err.error.message);
          }
        },
      });
    } catch (error) {
      console.error('Error reading PDF:', error);
    }
  }  
  downloadFile(){
    this.finalSheetComponent.downloadUpdatedExcel();
  }


  pageVisited: { [pageNumber: number]: boolean } = {}; // 👈 track which pages were counted

  onMouseDown(event: MouseEvent) {
    console.log('🖱️ Mouse Down Triggered');

    const imgElement = event.target as HTMLImageElement;
    if (!imgElement) {
      console.warn('❌ No image element detected from event target.');
      return;
    }

    const { offsetX, offsetY } = this.getNormalizedClick(event, imgElement);
    console.log(`📍 Normalized Click Coordinates: X=${offsetX}, Y=${offsetY}`);

    const currentErrorBorders = this.errorBorders[this.currentPage] || [];
    console.log(
      `📦 Loaded ${currentErrorBorders.length} error borders for page ${this.currentPage}`
    );

    const errorBorder = currentErrorBorders.find(
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

    console.log(`✅ Click inside error border:`, errorBorder);

    const pageData = this.getPageData();
    if (!pageData) {
      console.warn('❌ No page data found for current page.');
      return;
    }

    console.log(`📄 Loaded page data for page ${this.currentPage}`);
    console.log(`🔎 Searching for clicked question in coordinates...`);

    const foundQuestionKey = this.getClickedQuestion(
      offsetX,
      offsetY,
      pageData
    );

    if (!foundQuestionKey) {
      console.warn(`❌ No question found at (${offsetX}, ${offsetY})`);
      return;
    }

    console.log(`✅ Found question: ${foundQuestionKey}`);
    console.log(`📌 Question Details:`, pageData.questions[foundQuestionKey]);

    if (!this.selectionCircles[this.currentPage]) {
      this.selectionCircles[this.currentPage] = [];
      console.log(
        `🌀 Initialized selectionCircles for page ${this.currentPage}`
      );
    }

    const prevCount = this.selectionCircles[this.currentPage].length;

    // Remove any existing circle inside this error border
    this.selectionCircles[this.currentPage] = this.selectionCircles[
      this.currentPage
    ].filter(
      (circle) =>
        !(
          circle.x >= errorBorder.x &&
          circle.x <= errorBorder.x + errorBorder.width &&
          circle.y >= errorBorder.y &&
          circle.y <= errorBorder.y + errorBorder.height
        )
    );

    const newCount = this.selectionCircles[this.currentPage].length;
    console.log(
      `🔁 Removed ${prevCount - newCount} old circles inside this error area`
    );

    // Update bubble selection
    console.log(`🆕 Calling updateBubbleSelection()...`);
    this.updateBubbleSelection(
      offsetX,
      offsetY,
      pageData.questions[foundQuestionKey],
      foundQuestionKey
    );
  }

  getClickedQuestion(offsetX: number, offsetY: number, pageData: any) {
    const tolerance = 12;
    let closestQuestionKey: string | null = null;
    let closestDistance = Infinity;

    console.log(`🖱️ User clicked at: (${offsetX}, ${offsetY})`);

    for (const questionKey in pageData.questions) {
      const question = pageData.questions[questionKey];
      if (!question.points || question.points.length < 1) continue;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const rect of question.points) {
        const [topLeft, bottomRight] = rect;
        minX = Math.min(minX, topLeft[0]);
        minY = Math.min(minY, topLeft[1]);
        maxX = Math.max(maxX, bottomRight[0]);
        maxY = Math.max(maxY, bottomRight[1]);
      }

      console.log(
        `📦 Question ${questionKey} area: [${minX}, ${minY}] → [${maxX}, ${maxY}]`
      );

      const withinBounds =
        offsetX >= minX - tolerance &&
        offsetX <= maxX + tolerance &&
        offsetY >= minY - tolerance &&
        offsetY <= maxY + tolerance;

      console.log(
        `📍 Click is ${
          withinBounds ? '' : 'NOT '
        }inside question ${questionKey} area`
      );

      if (withinBounds) {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const distance = Math.sqrt(
          (offsetX - centerX) ** 2 + (offsetY - centerY) ** 2
        );

        console.log(`📏 Distance to center of ${questionKey}: ${distance}`);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestQuestionKey = questionKey;
          console.log(`🔄 New closest match: ${questionKey}`);
        }
      }
    }

    if (!closestQuestionKey) {
      console.warn(`❌ No matching question found.`);
      return null;
    }

    console.log(`✅ Found question: ${closestQuestionKey}`);
    return closestQuestionKey;
  }

  updateBubbleSelection(
    offsetX: number,
    offsetY: number,
    foundQuestionData: any,
    questionKey: string
  ) {
    console.log(
      `🔘 updateBubbleSelection triggered for question '${questionKey}'`
    );
    console.log(`📍 Click position: (${offsetX}, ${offsetY})`);
    const circleRadius = 8;
    const tolerance = 12;
    let bestMatch: any = null;
    let bestDistance = Infinity;
    let foundGroupIndex: number | null = null;

    // Group comparison logic
    const isSameGroup = (g1: any, g2: any): boolean => {
      const threshold = 10; // pixels
      return (
        g1.bubbles.length === g2.bubbles.length &&
        g1.bubbles.every((b: any, i: number) => {
          const b2 = g2.bubbles[i];
          return (
            Math.abs(b.circle[0] - b2.circle[0]) < threshold &&
            Math.abs(b.circle[1] - b2.circle[1]) < threshold
          );
        })
      );
    };

    for (
      let groupIndex = 0;
      groupIndex < foundQuestionData.groups.length;
      groupIndex++
    ) {
      const group = foundQuestionData.groups[groupIndex];
      console.log(
        `🔍 Checking group ${groupIndex} with ${group.bubbles.length} bubbles`
      );

      for (const bubble of group.bubbles) {
        const [bubbleX, bubbleY, bubbleRadius] = bubble.circle;
        const distance = Math.sqrt(
          (offsetX - bubbleX) ** 2 + (offsetY - bubbleY) ** 2
        );

        console.log(
          `➡️ Bubble at (${bubbleX}, ${bubbleY}), distance: ${distance.toFixed(
            2
          )}px`
        );

        if (distance <= bubbleRadius + tolerance) {
          console.log(
            `✅ Bubble within range (distance: ${distance.toFixed(2)} <= ${
              bubbleRadius + tolerance
            })`
          );

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = bubble;
            foundGroupIndex = groupIndex;
          }
        }
      }
    }

    if (bestMatch && foundGroupIndex !== null) {
      console.log(
        `🏹 Best bubble found in group ${foundGroupIndex} at:`,
        bestMatch.circle
      );

      const modelAnswerPage = Object.values(this.omrResponse).find((p: any) =>
        p.questions && p.questions.hasOwnProperty(questionKey)
      ) as { questions: any };

      if (!modelAnswerPage) {
        console.warn('⚠️ Model Answer Page (Page 1) not found!');
        return;
      }

      const modelQuestion = modelAnswerPage.questions?.[questionKey];
      if (!modelQuestion) {
        console.warn(`⚠️ Model Question '${questionKey}' not found in Page 1.`);
        console.log(
          '📋 Available model question keys:',
          Object.keys(modelAnswerPage.questions)
        );
        return;
      }

      const modelGroups = modelQuestion.groups || [];
      const clickedGroup = foundQuestionData.groups[foundGroupIndex];
      const matchingModelGroupIndex = modelGroups.findIndex((g: any) =>
        isSameGroup(g, clickedGroup)
      );
      const modelGroup =
        matchingModelGroupIndex !== -1
          ? modelGroups[matchingModelGroupIndex]
          : null;

      if (!modelGroup) {
        console.warn(
          `⚠️ Matching group not found in model answer for question '${questionKey}'.`
        );
      }

      let isCorrect = false;
      if (modelGroup) {
        for (const bubble of modelGroup.bubbles) {
          console.log(
            `🧪 Comparing with model bubble choice '${bubble.choice}'`
          );
          if (bubble.choice === bestMatch.choice) {
            isCorrect = bubble.selected === true;
            console.log(
              `🎯 Choice matched: '${bubble.choice}', Correct: ${isCorrect}`
            );
            break;
          }
        }
      }

      console.log(
        `🔄 Resetting previous bubble selections in group ${foundGroupIndex}`
      );
      foundQuestionData.groups[foundGroupIndex].bubbles.forEach(
        (bubble: any) => {
          bubble.selected = false;
          console.log(`🚫 Bubble '${bubble.choice}' unselected`);
        }
      );

      bestMatch.selected = true;
      console.log(`✅ Selected new bubble: '${bestMatch.choice}'`);

      if (foundQuestionData.groups[foundGroupIndex].errors) {
        console.log(
          `🧹 Removing error message:`,
          foundQuestionData.groups[foundGroupIndex].errors
        );
        foundQuestionData.groups[foundGroupIndex].errors = null;
      }

      if (!this.selectionCircles[this.currentPage]) {
        this.selectionCircles[this.currentPage] = [];
      }

      this.selectionCircles[this.currentPage].push({
        x: bestMatch.circle[0],
        y: bestMatch.circle[1],
        radius: circleRadius,
        isCorrect,
      });

      console.log(
        `💾 Stored selection in selectionCircles for page ${this.currentPage}`
      );
      console.log(`🧠 Final selected bubble data:`, {
        x: bestMatch.circle[0],
        y: bestMatch.circle[1],
        choice: bestMatch.choice,
        isCorrect,
      });
    } else {
      console.warn(`❌ No valid bubble found near (${offsetX}, ${offsetY})`);
    }
  }

  errorQuestionsByPage: { [pageNumber: number]: any[] } = {};
  totalErrors: number = 0;
  totalErrorsRemaining: number = 0;
  visitedPages: Set<number> = new Set();
  subtractedIndexes = new Set<number>(); // 👈 Track which pages we've subtracted from

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


  getAllPagesWithErrors() {
    this.errorQuestions = [];
    this.errorQuestionsByPage = {};
    this.errorBorders = {};
    this.errorPages = [];
    this.subtractedIndexes.clear();

    const errorPagesSet = new Set<number>();

    Object.values(this.omrResponse).forEach((pageData: any) => {
      const pageErrors: any = [];
      const questionErrors: any = [];

      Object.entries(pageData.questions).forEach(
        ([questionNumber, questionData]: [string, any]) => {
          questionData.groups.forEach((group: any, groupIndex: number) => {
            if (group.errors) {
              const error = {
                page: pageData.page_number,
                questionNumber,
                subQuestion: groupIndex + 1,
                errors: group.errors,
              };
              questionErrors.push(error);
              errorPagesSet.add(pageData.page_number);

              if (!group.bubbles?.length) return;

              const bubbles = group.bubbles.map((b: any) => b.circle);
              const minX = Math.min(...bubbles.map((b: any) => b[0]));
              const minY = Math.min(...bubbles.map((b: any) => b[1]));
              const maxX = Math.max(...bubbles.map((b: any) => b[0]));
              const maxY = Math.max(...bubbles.map((b: any) => b[1]));

              const padding = 10;
              const width = maxX - minX + padding;
              const height = maxY - minY + padding;

              const borderColor =
                group.errors === "There's more than one answer"
                  ? '#0000ff'
                  : '#ff0000';

              pageErrors.push({
                x: minX - padding / 2,
                y: minY - padding / 2,
                width,
                height,
                color: borderColor,
              });
            }
          });
        }
      );

      if (questionErrors.length > 0) {
        this.errorQuestionsByPage[pageData.page_number] = questionErrors;
      }

      if (pageErrors.length > 0) {
        this.errorBorders[pageData.page_number] = pageErrors;
      }
    });

    this.errorPages = Array.from(errorPagesSet).sort((a, b) => a - b);
    this.totalErrors = Object.values(this.errorQuestionsByPage).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    this.totalErrorsRemaining = this.totalErrors;

    if (this.errorPages.length > 0) {
      this.currentErrorIndex = 0;
      this.currentPage = this.errorPages[0];
      this.errorQuestions = this.errorQuestionsByPage[this.currentPage] || [];
    }
  }

  goToNextPage() {
    if (this.currentErrorIndex < this.errorPages.length - 1) {
      const currentIndex = this.currentErrorIndex;
      const currentPageNumber = this.errorPages[currentIndex];
      const errorsOnPage =
        this.errorQuestionsByPage[currentPageNumber]?.length || 0;

      // Only subtract once
      if (!this.subtractedIndexes.has(currentIndex)) {
        this.totalErrorsRemaining -= errorsOnPage;
        this.subtractedIndexes.add(currentIndex);
      }

      this.currentErrorIndex++;
      this.currentPage = this.errorPages[this.currentErrorIndex];
      this.errorQuestions = this.errorQuestionsByPage[this.currentPage] || [];
    }
    else{
      this._ToastrService.success(" تم انتهاء عملية المراجعة")
    }
  }

  goToPreviousPage() {
    if (this.currentErrorIndex > 0) {
      const previousIndex = this.currentErrorIndex - 1;
      const previousPageNumber = this.errorPages[previousIndex];
      const errorsOnPage =
        this.errorQuestionsByPage[previousPageNumber]?.length || 0;

      // Only add back once
      if (this.subtractedIndexes.has(previousIndex)) {
        this.totalErrorsRemaining += errorsOnPage;
        this.subtractedIndexes.delete(previousIndex);
      }

      this.currentErrorIndex--;
      this.currentPage = this.errorPages[this.currentErrorIndex];
      this.errorQuestions = this.errorQuestionsByPage[this.currentPage] || [];
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

    (
      Object.values(this.omrResponse) as {
        page_number: number;
        questions: any;
      }[]
    ).forEach((page) => {
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
    });
  }


zoomLevel: number = 1;
zoomStep: number = 0.2;
maxZoom: number = 2;
minZoom: number = 0.6;

zoomIn() {
  if (this.zoomLevel < this.maxZoom) {
    this.zoomLevel = parseFloat((this.zoomLevel + this.zoomStep).toFixed(1));
  }
}

zoomOut() {
  if (this.zoomLevel > this.minZoom) {
    this.zoomLevel = parseFloat((this.zoomLevel - this.zoomStep).toFixed(1));
  }
}


}
interface Page {
  page_number: number;
  questions: { [key: string]: Question };
}
