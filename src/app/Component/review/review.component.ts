import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { UploadService } from 'src/app/services/upload.service';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { jsPDF } from 'jspdf';

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
     // Store the global selection box

 
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

  showfinalize=false;
  showDownload=false;
  showScore=false;
  constructor(private _UploadService: UploadService) {}

  ngOnInit(): void {
   //     this.pdfUrl=`https://scoob.cc/corrected/8aa115aa-d98c-4421-b9f2-cfdcb6017b2b.pdf`;
  this.pdfUrl = this._UploadService.getPdfUrl();
    console.log('Retrieved PDF URL:', this.pdfUrl);
    this.loadPdfImages(this.pdfUrl);
    this.studentsScores = this._UploadService.getScores(); // Load student scores from the service
    console.log(this.studentsScores);
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

  async loadPdfImages(pdfUrl: string) {
    this.isLoading = true;
    try {
      this.pdfImages = await this.convertPdfToImages(pdfUrl);
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




onMouseDown(event: MouseEvent) {
  this.isSelecting = true;
  const imageRect = (event.target as HTMLElement).getBoundingClientRect();
  this.selectionBox = {
    x: event.clientX - imageRect.left,
    y: event.clientY - imageRect.top,
    width: 0,
    height: 0,
  };
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





}
