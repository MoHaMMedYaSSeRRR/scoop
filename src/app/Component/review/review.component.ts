import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { UploadService } from 'src/app/services/upload.service';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { jsPDF } from 'jspdf';
import examData from '../../../assets/EXAM-12-response.json'

  
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
  studentsScores: StudentScores[] = [];

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
  globalSelectionBox = { x: 0, y: 0, width: 0, height: 0 };  selectionBoxes: { x: number; y: number; width: number; height: number }[] =
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
data:any;
  showfinalize=false;
  showDownload=false;
  showScore=false;
  omrResponse: any;
  pdfFile!:File;
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
        console.log(this.pdfFile)
      }
    });
    
        // this.omrResponse =examData;
        this.loadPdfImages(this.pdfFile);
        this.getPagesWithErrors();
        this.getAllPagesWithErrors();

        // this.filterErrorPages();
        // this.extractValidSelections();
        // this.loadFilteredPdfImages();
        // this.pdfUrl = this._UploadService.getPdfUrl();
    // console.log('Retrieved PDF URL:', this.pdfUrl);
    // this.loadPdfImages(this.pdfUrl);
    // this.studentsScores = this._UploadService.getScores(); // Load student scores from the service
    // console.log(this.studentsScores);
    const rawData = this._UploadService.getdata();
    this.updateScores();
    if(this.currentPage==0){
      this.currentScore = this.finalScore = this.studentsScores[2].maxGrades;
    }
    if (rawData && rawData.questions) {
      this.question_data = this.convertQuestionsToArray(rawData.questions);
      console.log('Question Data:', this.question_data);
    } else {
      console.error('Failed to load question data:', rawData);
      this.question_data = []; // Initialize with an empty array
      alert('Error loading question data. Please try again later.');
    }
    this._UploadService.selectedBox$.subscribe({
      next:(res)=>{
        this.globalSelectionBox=res;
      }
    })
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
  

  downloadMarkedPdf() {
    if (!this.pdfImages || this.pdfImages.length === 0) {
        console.error('No images available to convert to PDF');
        return;
    }

    const pdf = new jsPDF();
    const promises: Promise<void>[] = [];

    this.pdfImages.forEach((image, pageIndex) => {
        promises.push(
            new Promise<void>((resolve) => {
                const img = new Image();
                img.src = image;

                img.onload = () => {
                    // Set canvas size to match the image size (600x800)
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (!context) return;

                    canvas.width = 600;  // Image width
                    canvas.height = 800; // Image height

                    // Draw the image without margins (exact position)
                    context.drawImage(img, 0, 0, 600, 800);

                    // Draw selection boxes (ensure they are after the image)
                    const selections = this.pageSelections[pageIndex] || [];
                    selections.forEach(({ x, y, width, height }) => {
                        // Make sure selection boxes have no margin and are drawn in the correct position
                        context.strokeStyle = '#01ff0a'; // Green for selection boxes
                        context.lineWidth = 2;
                        context.strokeRect(x, y, width, height);
                    });

                    // For the first page, use the max grade of page 2
                    let currentScore = 0;
                    let finalScore = 0;

                    // Display max grade at top and bottom of page 1
                    if (pageIndex === 0) {
                        const studentPage2 = this.studentsScores.find(s => s.page === 2);
                        if (studentPage2) {
                            currentScore = studentPage2.maxGrades || 0;
                            finalScore = studentPage2.maxGrades || 0;
                        }
                    } else {
                        // For other pages, use the regular logic
                        const student = this.studentsScores.find(s => s.page === pageIndex + 1);
                        if (student) {
                            currentScore = student.totalGrades || 0;
                            finalScore = student.maxGrades || 0;
                        }
                    }

                    // Draw global circle and scores
                    if (this.isGlobal && this.globalSelectionBox.width > 0) {
                        const { x, y, width, height } = this.globalSelectionBox;

                        // Draw the circle
                        context.beginPath();
                        context.arc(
                            x + width / 2,
                            y + height / 2,
                            width / 2,
                            0,
                            2 * Math.PI
                        );
                        context.strokeStyle = '#01ff0a'; // Green for the circle
                        context.lineWidth = 2;
                        context.stroke();

                        // Draw horizontal line inside the circle
                        context.beginPath();
                        context.moveTo(x, y + height / 2); // Start at the left
                        context.lineTo(x + width, y + height / 2); // End at the right
                        context.stroke();

                        // Draw scores at the top and bottom of the circle
                        context.font = 'bold 14px Arial';
                        context.fillStyle = '#01ff0a';
                        context.textAlign = 'center';
                        // Draw top score
                        context.fillText(
                            `${currentScore}`,
                            x + width / 2,
                            y + height / 2 - 10 // Slightly above the center line
                        );
                        // Draw bottom score
                        context.fillText(
                            `${finalScore}`,
                            x + width / 2,
                            y + height / 2 + 20 // Slightly below the center line
                        );
                    }

                    // Convert canvas to image
                    const imgData = canvas.toDataURL('image/png');

                    // Add the image to the PDF
                    if (pageIndex > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
                    resolve();
                };
            })
        );
    });

    // Save the PDF after processing all images
    Promise.all(promises).then(() => {
        pdf.save('marked_pdf_with_positions.pdf');
    });
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

  updateColor(color: string): void {
    this.selectedColor = color;
    this.canvasContext.strokeStyle = this.selectedColor;
  }

 
  // Calculate total score dynamically based on all questions
  calculateTotalScore(student: StudentScores) {
    let total = 0;
    for (const score of Object.values(student.score)) {
      total += parseInt(score, 10); // Ensure string is converted to a number
    }
    student.total = total; // Update total score
    console.log(`Student ${student.studentId} total updated: ${student.total}`);
  }


  clearSelection(): void {
    this.selectionBoxes = [];
    this.pageSelections[this.currentPage] = [];
  }

  saveCurrentPageSelections() {
    if (this.selectionBoxes.length > 0) {
      this.pageSelections[this.currentPage] = [...this.selectionBoxes];
    }
  }

  loadPageSelections(page: number) {
    this.selectionBoxes = this.pageSelections[page] || []; // Load saved selections if available
  }

  goToPreviousPage() {
    if (this.currentPage > 0) {
      this.saveCurrentPageSelections(); // Save current page's selections
      this.currentPage--; // Go back to the previous page
      this.loadPageSelections(this.currentPage); // Load selections for the previous page
      this.updateScores();
    }

  }

  goToNextPage() {
    if (this.currentPage < this.userPageCount - 1) {
      this.saveCurrentPageSelections(); // Save current page's selections
      this.currentPage++; // Move to the next page
      this.loadPageSelections(this.currentPage); // Load selections for the next page
      this.updateScores();
    }
  }

  remarkQuestion(questionNumber: number, updatedScore: number) {
    const student = this.studentsScores.find(
      (s) => s.studentId === this.currentStudentId
    );
    if (student) {
      student.score[questionNumber] = updatedScore.toString();
      this.calculateTotalScore(student);
      console.log(
        `Remarked Question ${questionNumber}: Updated score to ${updatedScore}`
      );
    } else {
      console.warn(`Student with ID ${this.currentStudentId} not found.`);
    }
  }
  // Method to handle remarking by user
  handleRemarking() {
    const remarkedQuestions = [
      { questionNumber: 1, updatedScore: 5 },
      { questionNumber: 2, updatedScore: 10 },
    ];

    remarkedQuestions.forEach((remark) => {
      this.remarkQuestion(remark.questionNumber, remark.updatedScore);
    });

    this.printFinalSummary();
  }
  // Print final summary after remarking
  printFinalSummary() {
    console.log('Final Student Scores Summary:');
    this.studentsScores.forEach((student) => {
      const total = student.totalGrades || 0;
      const maxGrades = student.maxGrades || 0;
      console.log(
        `Student ID: ${student.studentId}, Total: ${total}, Max Possible Grades: ${maxGrades}`
      );

      // Include detailed question scores if necessary
      // Object.entries(student.score).forEach(([question, score]) => {
      //   console.log(`Question ${question}: Score ${score}`);
      // });

      if (!student.score || Object.keys(student.score).length === 0) {
        console.warn(
          `No questions found for Student ID ${student.studentId} on Page ${student.page}`
        );
      }
    });
  }


  
  markedSelectionArray: { x: number; y: number; width: number; height: number }[] = [];

  

  
  updateScoreForSelectedQuestions() {
    const currentPagePlusOne = this.currentPage + 1; // Adjust for 1-based page index
    console.log(`Updating scores for current page: ${currentPagePlusOne}`);
  
    this.studentsScores.forEach((student) => {
      if (student.page === currentPagePlusOne) {
        console.log(`Processing scores for Student ID: ${student.studentId}`);
  
        let totalMarks = student.totalGrades || 0;
  
        if (typeof student.score === 'string') {
          student.score = {};
        }
  
        this.question_data.forEach((question) => {
          if (Array.isArray(question.position)) {
            question.position.forEach((posSet:any) => {
              if (Array.isArray(posSet) && posSet.length === 2) {
                const [point1, point2] = posSet;
  
                // Process each selection box (no need to remove, just check for marking)
                this.selectionBoxes.forEach((selection) => {
                  // Skip if the point has already been marked
                  const isAlreadyMarked = this.markedSelectionArray.some(
                    (marked) =>
                      marked.x === selection.x &&
                      marked.y === selection.y &&
                      marked.width === selection.width &&
                      marked.height === selection.height
                  );
                  
                  if (!isAlreadyMarked) {
                    // Mark the selection
                    const isOverlapping = this.isOverlap(
                      { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
                      point1,
                      point2
                    );
  
                    if (isOverlapping) {
                      // Add the marked selection to the markedSelectionArray
                      this.markedSelectionArray.push(selection);
  
                      const points = question.points || 0;
                      const currentScore = parseInt(student.score[question.question_number!] || '0', 10);
                      student.score[question.question_number!] = (currentScore + points).toString();
                      totalMarks += points;
  
                      console.log(
                        `Marked point for Question ${question.question_number}: ${JSON.stringify(
                          selection
                        )}, Updated Total Marks: ${totalMarks}`
                      );
                    }
                  }
                });
              }
            });
          }
        });
  
        student.totalGrades = totalMarks; // Update total grades
        console.log(
          `Final Total Grades for Student ID ${student.studentId}: ${student.totalGrades}`
        );
      }
    });
  }
  
  currentScore: number = 0; // Store current score
  finalScore: number = 0; // Store final score
  
  
   
  isOverlap(selection: { x: number; y: number; width: number; height: number; }, point1: number[], point2: number[]): boolean {
    // Calculate the selection's bottom-right corner
    const selectionMinX = selection.x;
    const selectionMinY = selection.y;
    const selectionMaxX = selection.x + selection.width;
    const selectionMaxY = selection.y + selection.height;

    // Get the position boundaries from point1 (top-left) and point2 (bottom-right)
    const rectMinX = Math.min(point1[0], point2[0]);
    const rectMinY = Math.min(point1[1], point2[1]);
    const rectMaxX = Math.max(point1[0], point2[0]);
    const rectMaxY = Math.max(point1[1], point2[1]);

    // Check if there's an overlap between the two rectangles
    const isXOverlap = (selectionMaxX > rectMinX && selectionMinX < rectMaxX); // Check if the selection box is horizontally overlapping
    const isYOverlap = (selectionMaxY > rectMinY && selectionMinY < rectMaxY); // Check if the selection box is vertically overlapping

    // Return true if both x and y ranges overlap
    return isXOverlap && isYOverlap;
}


onMouseMove(event: MouseEvent) {
  if (!this.isSelecting) return;
  const imageRect = (event.target as HTMLElement).getBoundingClientRect();
  const currentX = event.clientX - imageRect.left;
  const currentY = event.clientY - imageRect.top;

  this.selectionBox.width = currentX - this.selectionBox.x;
  this.selectionBox.height = currentY - this.selectionBox.y;
}

onMouseUp() {
  if (this.isSelecting) {
 
      this.selectionBoxes.push({ ...this.selectionBox });
      this.updateScoreForSelectedQuestions();
      this.updateScores();
      this.isSelecting=false
  }
}

// Switch between global and page-specific selection
showpay() {
  this.isGlobal = !this.isGlobal; // Toggle between global and page selection
  if (this.isGlobal) {
    console.log('Global Box:', this.globalSelectionBox);
  } else {
    console.log('Page-Specific Selections:', this.selectionBoxes);
  }
}

calculateLinePosition(): number {
  const currentImage = this.pdfImages[this.currentPage] as { height: number };

  const imageHeight = currentImage ? currentImage.height : 0;

  return imageHeight / 2; // Middle height
}


// Update current score and final score based on current student and page
updateScores() {
  const student = this.studentsScores.find(s => s.page === this.currentPage + 1);
  
  if (student) {
    if (this.currentPage === 0) {
      // On the first page, set currentScore equal to finalScore
      this.currentScore = student.maxGrades || 0;
    } else {
      // For other pages, use the regular logic
      this.currentScore = student.totalGrades || 0;
    }
    this.finalScore = student.maxGrades || 0; // Set the final score regardless of the page
  } else {
    // Default values if no student data is found
    this.currentScore = 0;
    this.finalScore = 0;
  }

  console.log(student);
}



selectionCircles: { [page: number]: { x: number; y: number; radius: number; isCorrect: boolean }[] } = {};

  circleRadius: number = 6;  
  validateSelection(selection: { x: number; y: number; isCorrect: boolean }, page: number) {
    const pageData = this.omrResponse.find((p: any) => p.page_number === page + 1);
    if (!pageData || !pageData.questions) return;
  
    let isCorrect = false;
  
    // Loop through all questions on the page
    Object.values(pageData.questions).forEach((question: any) => {
      question.groups.forEach((group: any) => {
        if (group.circle && Array.isArray(group.circle) && group.circle.length === 2) {
          const [[minX, minY], [maxX, maxY]] = group.circle;
  
          // ✅ Check if the selected point is inside the correct range
          if (selection.x >= minX && selection.x <= maxX && selection.y >= minY && selection.y <= maxY) {
            if (group.correct) {
              isCorrect = true; // ✅ Mark selection as correct
            }
          }
        }
      });
    });
  
    // ✅ Update `isCorrect` status
    selection.isCorrect = isCorrect;
  
    // ✅ Console log for debugging
    console.log(`Page ${page + 1} - Selection (${selection.x}, ${selection.y}): ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
  }

getNormalizedClick(event: MouseEvent, imgElement: HTMLImageElement) {
  const fixedWidth = 600; // Fixed width
  const rect = imgElement.getBoundingClientRect();
  const scaleX = fixedWidth / rect.width;
  const scaleY = scaleX; // Maintain aspect ratio

  return {
    offsetX: (event.clientX - rect.left) * scaleX,
    offsetY: (event.clientY - rect.top) * scaleY
  };
}


/** ✅ Get the current page data */
getPageData() {
  const pageData = this.omrResponse.find((p: any) => p.page_number === this.currentPage + 1);
  if (!pageData) {
      console.error(`⚠️ No data found for page ${this.currentPage + 1}`);
      return null;
  }
  return pageData;
}



errorQuestions: any[] = []; // ✅ Store errors for UI display

/** ✅ Log errors and store them for display */
logErrorQuestions(pageData: any) {
    this.errorQuestions = Object.entries(pageData.questions)
        .filter(([_, questionData]: [string, any]) => questionData.errors)
        .map(([questionNumber, questionData]: [string, any]) => ({
            page: pageData.page_number,
            questionNumber,
            subQuestion: 2, // 🔥 Adjust if dynamic
            errors: questionData.errors
        }));

    if (this.errorQuestions.length > 0) {
        console.log(`🚨 الأخطاء في الصفحة ${this.getArabicNumber(pageData.page_number)}:`);

        this.errorQuestions.forEach((error) => {
            console.log(`❌ الصفحة ${this.getArabicNumber(error.page)}, السؤال ${this.getArabicNumber(error.questionNumber)}, الفرعي ${this.getArabicNumber(error.subQuestion)}`);
            console.log(`🔹 ${error.errors}`);
        });
    }
}
/** ✅ Convert numbers to Arabic */
getArabicNumber(num: any) {
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num)
      .split("")
      .map((digit) => arabicNumbers[parseInt(digit, 10)])
      .join("");
}

reviewOMR() {
  const dragValue = this._UploadService.getSelectedBox(); 
  console.log("📦 Drag Value:", dragValue);

  const updatedOMR = {
      ...this.omrResponse, // ✅ Keep existing OMR data
      drag: dragValue // ✅ Add `drag` after all pages
  };
  this._UploadService.reviewOmr(updatedOMR).subscribe({
    next:(res)=>{
      console.log(res);
    }, 
    error:(err)=>{
      console.log(err);
    }
  })

  console.log("📄 Updated OMR JSON with Drag:", updatedOMR);
  return updatedOMR;
}

getAllPagesWithErrors() {
  this.errorQuestions = []; // Clear previous errors

  this.omrResponse.forEach((pageData: any) => {
      Object.entries(pageData.questions).forEach(([questionNumber, questionData]: [string, any]) => {
          questionData.groups.forEach((group: any, groupIndex: number) => {
              if (group.errors) {
                  this.errorQuestions.push({
                      page: pageData.page_number,
                      questionNumber,
                      subQuestion: groupIndex + 1, // ✅ Fix: Add +1 to group index
                      errors: group.errors
                  });
              }
          });
      });
  });

  console.log("🚨 جميع الأسئلة التي تحتوي على أخطاء:", this.errorQuestions);
}


getPagesWithErrors() {
  const pagesWithErrors = this.omrResponse
      .filter((page: any) => page.page_number !== 1) // Exclude Page 1 (Model Answer)
      .filter((page: any) => Object.values(page.questions).some((q: any) => q.errors))
      .map((page: any) => page.page_number);

  console.log(`🚨 Pages with errors (excluding Page 1): ${pagesWithErrors.join(', ')}`);
  return pagesWithErrors;
}

onMouseDown(event: MouseEvent) {
  const imgElement = event.target as HTMLImageElement;
  if (!imgElement) {
      console.error("❌ Image element not found!");
      return;
  }

  // Normalize click coordinates
  const { offsetX, offsetY } = this.getNormalizedClick(event, imgElement);
  console.log(`📍 Clicked at (${offsetX}, ${offsetY}) - Circle Center`);

  // Find the current page data
  const pageData = this.getPageData();
  if (!pageData) return;

  // Find the clicked question
  const foundQuestionKey = this.getClickedQuestion(offsetX, offsetY, pageData);
  if (!foundQuestionKey) return;

  // Find the closest bubble and mark selection
  this.updateBubbleSelection(offsetX, offsetY, pageData.questions[foundQuestionKey], foundQuestionKey);
}

getClickedQuestion(offsetX: number, offsetY: number, pageData: any) {
  const tolerance = 12;
  let foundQuestionKey = null;

  for (const questionKey in pageData.questions) {
      const question = pageData.questions[questionKey];

      if (!question.points || question.points.length < 1) continue;

      const [[minX, minY], [maxX, maxY]] = question.points[0];
      if (offsetX >= minX - tolerance && offsetX <= maxX + tolerance &&
          offsetY >= minY - tolerance && offsetY <= maxY + tolerance) {
          
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

updateBubbleSelection(offsetX: number, offsetY: number, foundQuestionData: any, questionKey: string) {
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
      console.log(`✅ Closest Bubble Found in Group ${foundGroupIndex} at (${bestMatch.circle[0]}, ${bestMatch.circle[1]})`);
      console.log(`🔍 Distance from click: ${bestDistance}px`);

      // Find Model Answer Page (Page 1)
      const modelAnswerPage = this.omrResponse.find((p: any) => p.page_number === 1);
      if (!modelAnswerPage) {
          console.warn("⚠️ Model Answer Page (Page 1) Not Found!");
          return;
      }

      console.log("📄 Model Answer Page Structure:", modelAnswerPage);
      console.log("🔍 Searching for Question Key:", questionKey);
      
      if (!modelAnswerPage.questions || !modelAnswerPage.questions[questionKey]) {
          console.warn(`⚠️ No matching question '${questionKey}' found in Model Answer Page!`);
          console.log("🧐 Available Questions:", Object.keys(modelAnswerPage.questions));
          return;
      }

      const modelQuestion = modelAnswerPage.questions[questionKey];
      
      // Find the corresponding group in Model Answer Page
      const modelGroup = modelQuestion.groups[foundGroupIndex];
      if (!modelGroup) {
          console.warn("⚠️ No matching group found in Model Answer Page!");
          return;
      }

      // Check if the selected bubble is correct
      let isCorrect = false;
      for (const bubble of modelGroup.bubbles) {
          if (bubble.choice === bestMatch.choice) {
              isCorrect = bubble.selected === true; // Bubble is correct only if selected in Page 1
              break;
          }
      }

      // Unselect previously selected bubble in the same group
      foundQuestionData.groups[foundGroupIndex].bubbles.forEach((bubble: any) => {
          bubble.selected = false;
      });
      
      // Select new bubble
      bestMatch.selected = true;

      // Store Selection for Dynamic Update
      if (!this.selectionCircles[this.currentPage]) {
          this.selectionCircles[this.currentPage] = [];
      }

      this.selectionCircles[this.currentPage].push({
          x: offsetX,
          y: offsetY,
          radius: circleRadius,
          isCorrect,
      });

      console.log(`🎯 Selected choice: ${bestMatch.choice} → ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
  } else {
      console.warn(`❌ No valid bubble found near (${offsetX}, ${offsetY}).`);
  }
}



}
