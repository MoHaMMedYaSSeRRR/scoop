

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
  selector: 'app-review-test',
  templateUrl: './review-test.component.html',
  styleUrls: ['./review-test.component.scss']
})
export class ReviewTestComponent {
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
    // this._UploadService.data$.subscribe((response) => {
    //   if (response) {
    //     this.omrResponse = response;
    //         }
    // });
    this._UploadService.file$.subscribe((file) => {
      if (file) {
        this.pdfFile = file;
        console.log(this.pdfFile)
      }
    });
    
       this.omrResponse =examData;
        this.loadPdfImages(this.pdfFile);
        this.filterErrorPages();
        this.extractValidSelections();
        this.loadFilteredPdfImages();
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







  // showpay() {
  //   this.ispay = true;
  //   this.printFinalSummary();
  //   if(this.isGlobal ==false){
      
  //   }
  // }

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

  // onMouseDown(event: MouseEvent) {
  //   this.isSelecting = true;
  //   const imageRect = (event.target as HTMLElement).getBoundingClientRect();
  //   this.selectionStartX = event.clientX - imageRect.left;
  //   this.selectionStartY = event.clientY - imageRect.top;
  //   this.selectionBox = {
  //     x: this.selectionStartX,
  //     y: this.selectionStartY,
  //     width: 0,
  //     height: 0,
  //   };
  // }

  // onMouseMove(event: MouseEvent) {
  //   if (!this.isSelecting) return;
  //   const imageRect = (event.target as HTMLElement).getBoundingClientRect();
  //   const currentX = event.clientX - imageRect.left;
  //   const currentY = event.clientY - imageRect.top;

  //   this.selectionBox.width = currentX - this.selectionStartX;
  //   this.selectionBox.height = currentY - this.selectionStartY;
  // }


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

  // goToPreviousPage() {
  //   if (this.currentPage > 0) {
  //     this.saveCurrentPageSelections(); // Save current page's selections
  //     this.currentPage--; // Go back to the previous page
  //     this.loadPageSelections(this.currentPage); // Load selections for the previous page
  //     this.updateScores();
  //   }

  // }

  // goToNextPage() {
  //   if (this.currentPage < this.userPageCount - 1) {
  //     this.saveCurrentPageSelections(); // Save current page's selections
  //     this.currentPage++; // Move to the next page
  //     this.loadPageSelections(this.currentPage); // Load selections for the next page
  //     this.updateScores();
  //   }
  // }

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

  
  // onMouseUp() {
  //   console.log('Selection Ended');
  //   if (this.isSelecting) {
  //     this.isSelecting = false;
  //     // Push the selection to selectionBoxes
  //     this.selectionBoxes.push({ ...this.selectionBox });
  //     console.log('Selection Box Added:', this.selectionBox);
  
  //     // Step 1: Update scores for selected questions based on the current page
  //     this.updateScoreForSelectedQuestions();
  
  //     // Step 2: Reset selection box for the next selection
  //     this.selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  //   }
  // }
  
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

// onMouseDown(event: MouseEvent) {
//   this.isSelecting = true;
//   const imageRect = (event.target as HTMLElement).getBoundingClientRect();
//   this.selectionBox = {
//     x: event.clientX - imageRect.left,
//     y: event.clientY - imageRect.top,
//     width: 0,
//     height: 0,
//   };
// }

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
  // goToPreviousPage() {
  //   if (this.currentPage > 0) {
  //     this.currentPage--;
  //     this.selectionCircles[this.currentPage] = []; // Clear previous selections
  //   }
  // }

  // goToNextPage() {
  //   if (this.currentPage < this.userPageCount - 1) {
  //     this.currentPage++;
  //     this.selectionCircles[this.currentPage] = []; // Clear previous selections
  //   }
  // }
      onMouseDown(event: MouseEvent) {

    const offsetX = event.offsetX;
    const offsetY = event.offsetY;
    const radius = 5;
    const tolerance = 5; // 🔥 Increase tolerance to avoid missing small spaces

    console.log(`📍 User clicked at (${offsetX}, ${offsetY})`);

    if (!this.omrResponse || !Array.isArray(this.omrResponse)) {
        console.error('⚠️ OMR Response data is missing or invalid.');
        return;
    }

    // Step 1️⃣: Find the page data for the current page
    const pageData = this.omrResponse.find((p: any) => p.page_number === this.currentPage + 1);
    if (!pageData) {
        console.error(`⚠️ No response data found for page ${this.currentPage + 1}`);
        return;
    }

    let foundQuestionKey: string | null = null;
    let foundQuestionData: any = null;

    // Step 2️⃣: Identify which question contains the clicked point (Increase Bounding Box)
    for (const questionKey in pageData.questions) {
        const question = pageData.questions[questionKey];

        if (!question.points || !Array.isArray(question.points) || question.points.length < 1) {
            continue;
        }

        // 🔥 Expand the bounding box by tolerance
        const [[minX, minY], [maxX, maxY]] = question.points[0];
        const expandedMinX = minX - tolerance;
        const expandedMaxX = maxX + tolerance;
        const expandedMinY = minY - tolerance;
        const expandedMaxY = maxY + tolerance;

        if (offsetX >= expandedMinX && offsetX <= expandedMaxX &&
            offsetY >= expandedMinY && offsetY <= expandedMaxY) {
            
            foundQuestionKey = questionKey;
            foundQuestionData = question;
            console.log(`✅ Found question: ${questionKey}`);
            break;
        }
    }

    if (!foundQuestionKey || !foundQuestionData) {
        console.warn('❌ No matching question found for this point.');
        return;
    }

    // Step 3️⃣: Identify the correct group based on bubble positions
    let foundGroupIndex: number | null = null;
    let previousMaxY = null;

    for (let groupIndex = 0; groupIndex < foundQuestionData.groups.length; groupIndex++) {
        const group = foundQuestionData.groups[groupIndex];

        // ✅ Only increase Y range for Group 0
        const extraPadding = groupIndex === 0 ? 5 : 0;

        // ✅ Dynamically calculate min/max values
        const minX = Math.min(...group.bubbles.map((b: { circle: number[] }) => b.circle[0])) - 3;
        const maxX = Math.max(...group.bubbles.map((b: { circle: number[] }) => b.circle[0])) + 3;

        let minY = previousMaxY !== null ? previousMaxY : Math.min(...group.bubbles.map((b: { circle: number[] }) => b.circle[1])) - extraPadding;
        let maxY = Math.max(...group.bubbles.map((b: { circle: number[] }) => b.circle[1])) + extraPadding;

        previousMaxY = maxY; // 🔥 Ensures the next group starts from the end of this one

        console.log(`📌 Group ${groupIndex} → Adjusted Range: [${minX}, ${minY}] to [${maxX}, ${maxY}]`);

        // ✅ Check if the click is inside this group
        if (offsetX >= minX && offsetX <= maxX && offsetY >= minY && offsetY <= maxY) {
            foundGroupIndex = groupIndex;
            console.log(`✅ Click is inside Group ${groupIndex}`);
            break;
        }
    }

    if (foundGroupIndex === null) {
        console.warn('❌ No valid group found for this point.');
        return;
    }

    console.log(`✅ Assigned to Group ${foundGroupIndex}`);

    // Step 4️⃣: Now find the closest bubble inside the correct group
    let bestMatch: any = null;
    let bestDistance = Infinity;
    let selectedGroup = foundQuestionData.groups[foundGroupIndex];

    for (const bubble of selectedGroup.bubbles) {
        const [bubbleX, bubbleY, bubbleRadius] = bubble.circle;
        const distance = Math.sqrt((offsetX - bubbleX) ** 2 + (offsetY - bubbleY) ** 2);

        // ✅ Select bubble if within its radius + tolerance
        if (distance <= bubbleRadius + tolerance) {
            console.log(`✅ User clicked inside bubble choice: ${bubble.choice}`);
            bestMatch = bubble;
            bestDistance = distance;
            break;  // Stop searching once we find a valid bubble
        }

        // Keep track of the closest bubble even if not inside any
        if (distance < bestDistance) {
            bestMatch = bubble;
            bestDistance = distance;
        }
    }

    if (!bestMatch) {
        console.warn(`⚠️ No valid bubble found in Group ${foundGroupIndex}, assigning to closest bubble.`);
        return;
    }

    // Step 5️⃣: Compare the selected answer to the correct answer
    const isCorrect = bestMatch.selected && bestMatch.correct;
    const bubbleStatus = isCorrect ? '✅ Correct' : '❌ Incorrect';

    console.log(`🎯 Found bubble → Group ${foundGroupIndex}`);
    console.log(`📌 Bubble Choice: ${bestMatch.choice} → Selected: ${bestMatch.selected}, Correct: ${bestMatch.correct}`);
    console.log(`🎉 Result: ${bubbleStatus}`);

    // Step 6️⃣: Store the selection circle
    if (!this.selectionCircles[this.currentPage]) {
        this.selectionCircles[this.currentPage] = [];
    }

    this.selectionCircles[this.currentPage].push({
        x: offsetX,
        y: offsetY,
        radius,
        isCorrect,
    });

    console.log(`🔵 Added circle at (${offsetX}, ${offsetY}) → ${bubbleStatus}`);
}


filteredPages: any[] = [];
detectedCircles: { [key: number]: { x: number; y: number; radius: number; isCorrect: boolean }[] } = {};
extractValidSelections(): void {
  this.detectedCircles = {}; // Reset detected circles
  let errorQuestions: Set<string> = new Set(); // Store question numbers with errors

  this.filteredPages.forEach((page: Page, index: number) => {
    this.detectedCircles[index] = []; // Use index instead of page_number

    Object.entries(page.questions).forEach(([questionNumber, question]: [string, any]) => {
      // Check if any group has errors
      const hasError = question.groups.some((group: any) => group.errors !== null);

      if (hasError) {
        errorQuestions.add(`Page ${page.page_number} - Question ${questionNumber}`);
      }

      // Filter out groups with errors
      const validGroups = question.groups.filter((group: any) => group.errors === null);

      validGroups.forEach((group: any) => {
        group.bubbles.forEach((bubble: any) => {
          if (bubble.selected) {
            this.detectedCircles[index].push({
              x: bubble.circle[0],
              y: bubble.circle[1],
              radius: bubble.circle[2],
              isCorrect: bubble.correct
            });
          }
        });
      });
    });
  });

  console.log("⚠️ Questions with Errors:", Array.from(errorQuestions));
  console.log("✅ Detected Circles:", this.detectedCircles);
}



filterErrorPages(): void {
  this.filteredPages = this.omrResponse.filter((page: Page) =>
    Object.values(page.questions).some((question: any) =>
      question.groups.some((group: Group) => group.errors !== null)
    )
  );

  console.log("Filtered Pages:", this.filteredPages.map(page => page.page_number)); // Debugging
}

currentPageIndex: number = 0; // Track current page in filteredPages

goToPreviousPage(): void {
  if (this.currentPageIndex > 0) {
    this.currentPageIndex--;
  }
}

goToNextPage(): void {
  if (this.currentPageIndex < this.filteredPages.length - 1) {
    this.currentPageIndex++;
  }
}

// Get actual page number from filteredPages
getCurrentPageNumber(): number {
  return this.filteredPages.length > 0 ? this.filteredPages[this.currentPageIndex].page_number : 0;
}
// ✅ Load images only for the filtered pages
loadFilteredPdfImages(): void {
  this.pdfImages = this.filteredPages.map(page => page.page_number);
  console.log(this.pdfImages)
}

getFilteredPageIndex(): number {
  if (this.filteredPages.length === 0) return 0;
  return this.filteredPages[this.currentPageIndex].page_number;
}getCurrentPageImage(): string {
  const filteredPageIndex = this.getFilteredPageIndex();
  return this.pdfImages[filteredPageIndex] || ''; // Get image for the correct page
}


}
interface Bubble {
  circle: [number, number, number];
  selected: boolean;
  correct: boolean;
}

interface Group {
  bubbles: Bubble[];
  errors: string | null;
}



interface Page {
  page_number: number;
  questions: { [key: string]: Question };
}
interface Bubble {
  circle: [number, number, number];
  selected: boolean;
  correct: boolean;
}

interface Group {
  bubbles: Bubble[];
  errors: string | null;
}



interface Page {
  page_number: number;
  questions: { [key: string]: Question };
}