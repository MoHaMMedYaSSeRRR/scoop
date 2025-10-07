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
import { UploadService } from 'src/app/services/upload.service';
import { ToastrService } from 'ngx-toastr';
import { ProcessingService } from 'src/app/services/processing.service';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

interface ROI {
  points: number[][][];
  roi_type: string;
  entities_count: number;
  choices?: string[];
  orientation: string; // Add this field
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

  // UI state for tabs & orientation/direction
  openTab: string | null = null;
  selectedOrientation: string = ''; // 'horizontal' | 'vertical'
  selectedDirection: string = 'rtl'; // 'rtl' | 'ltr'

  constructor(
    private formBuilder: FormBuilder,
    private _UploadService: UploadService,
    private router: Router,
    private _PayService: PayService,
    private route: ActivatedRoute,
    private _AuthService: AuthService,
    private _ToastrService: ToastrService ,
    private processingService: ProcessingService ,
    private http:HttpClient
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

  userPackageId: any;
  isPending=true;

 ngOnInit(): void {
  this._AuthService.setLoginState(true);

  this._UploadService.isPay$.subscribe({
    next: (res) => {
      this.ispay = res;
      console.log('isPay:', res);
    }
  });

  this.route.queryParams.subscribe((params) => {
    const paymentId = params['paymentId'];

    if (paymentId) {
      // حفظ الـ paymentId في localStorage
      localStorage.setItem('userPaymentId', paymentId);

      this._PayService.getPaymentStatus(paymentId).subscribe({
        next: (res) => {
          console.log('Payment Status Response:', res);

          if (res.Data.InvoiceStatus === 'Paid') {
            // ✅ الدفع ناجح
            this.subscribePackage();
            this.getUserPackage();

            // ✅ تحقق من وجود عدد الصفحات في localStorage
            const storedPages = localStorage.getItem('pendingPagesToAdd');
            if (storedPages) {
              const data = { number_of_pages: Number(storedPages) };
              this._PayService.addNewPagesToUser(data).subscribe({
                next: (res) => {
                  console.log('✅ Pages Added:', res);
                  this._ToastrService.success('تمت إضافة الصفحات بنجاح ✅');
                  localStorage.removeItem('pendingPagesToAdd');
                },
                error: (err) => {
                  console.error('❌ Error Adding Pages:', err);
                  this._ToastrService.error('حدث خطأ أثناء إضافة الصفحات');
                }
              });
            }

            localStorage.removeItem('userPaymentId');
            this.ispay = false;
            this._UploadService.setIsPay(false);
          } 
          else if (res.Data.InvoiceStatus === 'Pending') {
            // ⏳ الدفع قيد الانتظار
            this._ToastrService.info('جاري تأكيد عملية الدفع، برجاء الانتظار');
            setTimeout(() => {
              this._PayService.getPaymentStatus(paymentId).subscribe({
                next: (res) => {
                  console.log('Recheck Payment Response:', res);
                  if (res.Data.InvoiceStatus === 'Paid') {
                    this._ToastrService.success('تم تأكيد عملية الدفع');
                    this.getUserPackage();
                    localStorage.removeItem('userPaymentId');
                    console.log('subscribeSecond');
                    this.ispay = false;
                    this._UploadService.setIsPay(false);
                    this.subscribePackage();

                    // ✅ تحقق مرة ثانية من الصفحات بعد التأكيد
                    const storedPages = localStorage.getItem('pendingPagesToAdd');
                    if (storedPages) {
                      const data = { number_of_pages: Number(storedPages) };
                      this._PayService.addNewPagesToUser(data).subscribe({
                        next: (res) => {
                          console.log('✅ Pages Added (After Pending):', res);
                          this._ToastrService.success('تمت إضافة الصفحات بنجاح ✅');
                          localStorage.removeItem('pendingPagesToAdd');
                        },
                        error: (err) => {
                          console.error('❌ Error Adding Pages:', err);
                          this._ToastrService.error('حدث خطأ أثناء إضافة الصفحات');
                        }
                      });
                    }
                  }
                },
                error: (err) => {
                  console.error('Error fetching payment status:', err);
                },
              });
            }, 10000);
          }
        },
        error: (err) => {
          console.error('Error fetching payment status:', err);
        },
      });
    } 
    else if (localStorage.getItem('userPaymentId')) {
      // ✅ لو المستخدم رجع بعد الدفع بدون paymentId في الرابط
      const secondPaymentId = localStorage.getItem('userPaymentId');
      this._PayService.getPaymentStatus(secondPaymentId).subscribe({
        next: (res) => {
          console.log('Stored Payment Check:', res);
          if (res.Data.InvoiceStatus === 'Paid') {
            this.subscribePackage();
            this.getUserPackage();

            // ✅ تحقق من الصفحات المحفوظة
            const storedPages = localStorage.getItem('pendingPagesToAdd');
            if (storedPages) {
              const data = { number_of_pages: Number(storedPages) };
              this._PayService.addNewPagesToUser(data).subscribe({
                next: (res) => {
                  console.log('✅ Pages Added (From Stored ID):', res);
                  this._ToastrService.success('تمت إضافة الصفحات بنجاح ✅');
                  localStorage.removeItem('pendingPagesToAdd');
                },
                error: (err) => {
                  console.error('❌ Error Adding Pages:', err);
                  this._ToastrService.error('حدث خطأ أثناء إضافة الصفحات');
                }
              });
            }

            localStorage.removeItem('userPaymentId');
            this.ispay = false;
            this._UploadService.setIsPay(false);
          }
        },
        error: (err) => {
          console.error('Error fetching stored payment status:', err);
        },
      });
    } 
    else {
      console.error('paymentId not found in URL');
    }
  });

  this.getUserPackage();
  // this.checkRemainingpages();
}


  getUserPackage() {
    this._AuthService.getUserPackage().subscribe({
      next: (res) => {
        console.log(res);
        if (res.data) {
          if (res.data[0].is_valid) {
            this.ispay = false;
            this._UploadService.setIsPay(false)
            this.userPackageId = res.data[0].id;
            this._AuthService.updateSubscriptionStatus(res.data[0]);
            console.log(this.userPackageId);
          }
        }
      },
    });
  }
  subscribePackage() {
    const selectedPackageId = localStorage.getItem('selectedPackageId');

    if (selectedPackageId) {
      const data = {
        package_id: selectedPackageId,
      };

      this._PayService.subscriveToPackage(data).subscribe({
        next: (res) => {
          console.log('Subscribed Package:', res);
          this._ToastrService.success('تم الاشتراك بنجاح');
          // Optionally navigate to another page after subscription
          // this._Router.navigate(['/uploadpdf']);
        },
        error: (err) => {
          console.error('Error subscribing package:', err);
        },
      });
    } else {
      console.error('No package selected in local storage');
    }
  }
  async checkRemainingpages() {
    // const pdfFile = this.pdfForm.get('pdfFile')?.value;
    // if (!pdfFile) return;
  
    // try {
    //   const pageCount = await this.getPdfPageCount(pdfFile);  // Get pages directly
    //   this.userPageCount = pageCount;  // store it if needed
  
    //   this._AuthService.checkRemainingpages(this.userPackageId, pageCount , false).subscribe({
    //     next: (res) => { 
    //       localStorage.setItem('userPackageId',this.userPackageId);
    //       localStorage.setItem('pageCount',pageCount.toString());

    //       console.log(this.userPackageId, pageCount);
    //       this.onSubmit();  // Now safely call onSubmit
    //     },
    //     error: (err) => {
    //       console.log(err);
    //       if (err.error.message == 'Not enough remaining pages.') {
    //         console.log(err.error.message);
    //         this.ispay = true;
    //         this._ToastrService.error("عدد صفحات الملف أكبر من عدد الصفحات المتبقية في باقتك");
    //       }
    //     },
    //   });
    // } catch (error) {
    //   console.error('Error reading PDF:', error);
    //   this._ToastrService.error("حدث خطأ أثناء قراءة الملف");
    // }
     this.onSubmit();
  }
  
  async getPdfPageCount(pdfFile: File): Promise<number> {
    const fileReader = new FileReader();
  
    return new Promise((resolve, reject) => {
      fileReader.onloadend = async () => {
        try {
          const pdfData = new Uint8Array(fileReader.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(pdfData).promise; // <-- fixed here
          resolve(pdf.numPages);
        } catch (error) {
          reject(error);
        }
      };
  
      fileReader.readAsArrayBuffer(pdfFile);
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
  const selectedPageCount = this.pdfForm.value.pageCount || 1;

  // الحد الأقصى للتحويل (أصغر من الصفحات الفعلية والمطلوبة)
  const pagesToConvert = Math.min(selectedPageCount, numPages);

  const startTime = Date.now();

  // تشغيل overlay
  this.processingService.setLoading(true);
  this.processingService.setProgress(0);

  for (let pageNum = 1; pageNum <= pagesToConvert; pageNum++) {
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

    // تحديث progress (على أساس عدد الصفحات اللي هيتحولوا مش الكل)
    const percent = Math.round((pageNum / pagesToConvert) * 100);
    this.processingService.setProgress(percent);

    // احسب الوقت المتبقي
    const elapsedTime = (Date.now() - startTime) / 1000; // بالثواني
    const avgTimePerPage = elapsedTime / pageNum;
    const remainingTime = Math.round(avgTimePerPage * (pagesToConvert - pageNum));
    this.processingService.setRemainingTime(remainingTime);

    // سرعة افتراضية (صفحات/ثانية)
    const pagesPerSecond = +(pageNum / elapsedTime).toFixed(2);
   
  }

  // خلص التحويل
  this.processingService.setLoading(false);
  this.processingService.setProgress(100);
  this.processingService.setRemainingTime(0);

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
                roi_type: new FormControl('', Validators.required),
                direction: new FormControl('rtl', Validators.required), // <<< CHANGED default rtl
                orientation: new FormControl('horizontal', Validators.required), // <<< CHANGED default horizontal
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
        this.step1=false;
        this.step2=true;
        this.isLoading = false;
      };

      fileReader.readAsArrayBuffer(pdfFile);
    }
  }
// uploadPdf(pdfFile: File) {
//   const formData = new FormData();
//   formData.append('file', pdfFile);

//   const startTime = Date.now();
//   let lastLoaded = 0;

//   this.processingService.setLoading(true);

//   this.http.post('http://your-api/upload', formData, {
//     reportProgress: true,
//     observe: 'events'
//   }).subscribe({
//     next: (event: HttpEvent<any>) => {
//       if (event.type === HttpEventType.UploadProgress && event.total) {
//         const loaded = event.loaded;
//         const total = event.total;

//         // حساب التقدم %
//         const progress = Math.round((loaded / total) * 100);
//         this.processingService.setProgress(progress);

//         // الوقت اللي فات بالثواني
//         const elapsedTime = (Date.now() - startTime) / 1000;

//         // السرعة (بايت / ثانية) => (MB/s)
//         const speed = (loaded / elapsedTime) / (1024 * 1024);
//         this.processingService.setUploadSpeed(Number(speed.toFixed(2)));

//         // الحجم المتبقي
//         const remainingBytes = total - loaded;

//         // الوقت المتبقي بالثواني
//         const remainingTime = speed > 0
//           ? Math.round((remainingBytes / (1024 * 1024)) / speed)
//           : 0;

//         this.processingService.setRemainingTime(remainingTime);

//         lastLoaded = loaded;
//       }

//       if (event.type === HttpEventType.Response) {
//         console.log('Upload complete:', event.body);

//         // إنهاء المعالجة
//         this.processingService.setLoading(false);
//         this.processingService.setProgress(100);
//         this.processingService.setRemainingTime(0);
//       }
//     },
//     error: (err) => {
//       console.error('Upload failed:', err);
//       this.processingService.setLoading(false);
//     }
//   });
// }

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
        this._UploadService.setIsPay(false);

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
  let totalExamScore = 0;

  Object.keys(this.selectedQuestions).forEach((pageKey) => {
    if (!pagesObject[pageKey]) {
      pagesObject[pageKey] = {};
    }

    Object.keys(this.selectedQuestions[pageKey]).forEach((questionKey) => {
      const questionData = this.selectedQuestions[pageKey][questionKey];

      pagesObject[pageKey][questionKey] = {
        points: questionData.points,
        roi_type: questionData.roi_type,
        entities_count:
          questionData.entities_count ||
          (questionData.choices ? questionData.choices.length : 10),
        choices: questionData.choices || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        orientation: questionData.orientation || 'horizontal',
        corrected_by_teacher: questionData.corrected_by_teacher || false,
        id: questionData.id,
        worth: questionData.worth,
      };

      if (questionData.worth) {
        totalExamScore += questionData.entities_count * questionData.worth;
      }
      questionData.roi_type = 'question';
    });
  });

  const finalPayload = { ...pagesObject };
  this._UploadService.setdata(finalPayload, this.selectedFile);

  if (this.selectedFile) {
    this.formData.append('file', this.selectedFile);
  }

  const pdfJson = JSON.stringify(finalPayload);
  this.formData.append('data', pdfJson);

  this.isshow = false;

  // ✅ حساب وقت متوقع بناءً على حجم الملف
  if (this.selectedFile) {
    const fileSizeMB = this.selectedFile.size / (1024 * 1024); // MB
    let estimatedTime = Math.ceil(fileSizeMB * 15); // تقريباً 15 ثانية لكل MB

    if (estimatedTime < 15) {
      estimatedTime = 15; // حد أدنى
    }

    // تشغيل شاشة المعالجة مع تايمر و progress bar
    this.processingService.startProcessing(estimatedTime);

    console.log(
      `📊 File size: ${fileSizeMB.toFixed(
        2
      )} MB, Estimated time: ${estimatedTime} sec`
    );
  }

  const startTime = Date.now();

  this._UploadService.upload(this.formData).subscribe({
    next: (res) => {
      const duration = (Date.now() - startTime) / 1000;
      console.log('✅ Request finished in:', duration, 'seconds');

      this.processingService.setLoading(false);
      this.processingService.setProgress(100);
      this.processingService.setRemainingTime(0);

      this._UploadService.setdata(res.response, this.selectedFile);
      this.router.navigate(['/review']);
    },
    error: (err) => {
      const duration = (Date.now() - startTime) / 1000;
      console.log('❌ Request failed after:', duration, 'seconds');

      this.processingService.setLoading(false);
      this.processingService.setRemainingTime(0);
      console.error(err);
    },
  });
}




onCurrentQuestionSubmit(): void {
  if (this.isGlobal) {
    this.isGlobal = false;
    this.isshow = true;
  }

  if (!this.isshow) return;

  const currentQuestionForm = this.getCurrentQuestionFormGroup();
  console.log(currentQuestionForm.value);

  if (this.selectionBoxes.length === 0) {
    console.error('Please define a selection area before submitting.');
    return;
  }

  const userEntitiesCount = currentQuestionForm.value.entities_count || 0;
  const worth = currentQuestionForm.value.worth || 1;
  const isCorrectedByTeacher =
    currentQuestionForm.value.gradedByTeacher === 'true' ||
    currentQuestionForm.value.gradedByTeacher === true;

  // points
  const points = this.selectionBoxes.map((box) => [
    [Math.floor(box.x), Math.floor(box.y)],
    [Math.floor(box.x + box.width), Math.floor(box.y + box.height)],
  ]);

  // roi_type
  const roiTypeValue = currentQuestionForm.value.roi_type;
  const roi_type =
    roiTypeValue === 'question' || roiTypeValue === 'complementary'
      ? roiTypeValue
      : 'question';

  // id check → رقم الجلوس فقط
  const isId = this.selectedIdType === 'student_id';

  // orientation → رقم الجلوس دايمًا vertical
  let orientation: string;
  if (isId) {
    orientation = 'vertical';
    console.log('Orientation forced to vertical for student ID');
  } else {
    orientation =
      ['horizontal', 'vertical'].includes(currentQuestionForm.value.orientation)
        ? currentQuestionForm.value.orientation
        : 'vertical';
  }

  // direction
  const direction =
    currentQuestionForm.value.direction || this.selectedDirection || 'rtl';

  // choices + entities
  let choices: string[] = [];
  let entities_count: number;

  if (isId) {
        orientation = 'vertical';

    // رقم الجلوس 0-9
    choices = Array.from({ length: 10 }, (_, i) => String(i));
    entities_count = choices.length;
  } else if (isCorrectedByTeacher) {
    const rawChoices = currentQuestionForm.value.choices || '';
    choices = rawChoices
      .split('-')
      .map((s: any) => s.trim())
      .filter((s: any) => s !== '');
    entities_count = choices.length;
  } else {
    const numbers = Array.from({ length: 21 }, (_, i) => String(i));
    const choiceCount = Number(currentQuestionForm.value.choices);
    entities_count = choiceCount && !isNaN(choiceCount) ? choiceCount : 10;
    choices = numbers.slice(0, entities_count);
  }

  // لو سؤال مقالي و اتجاهه RTL + corrected_by_teacher → نعكس
  if (!isId && isCorrectedByTeacher && orientation === 'horizontal' && direction === 'rtl') {
    choices = [...choices].reverse();
  }

  const roiData: ROI = {
    points: points,
    roi_type: roi_type,
    entities_count: entities_count,
    choices: choices,
    orientation: orientation,
    corrected_by_teacher: isCorrectedByTeacher,
    id: isId, // true بس لو رقم الجلوس
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

  const pageKey = `page-${this.currentPage + 1}`;
  if (!this.selectedQuestions[pageKey]) {
    this.selectedQuestions[pageKey] = {};
  }

  const questionNumber = Object.keys(this.selectedQuestions[pageKey]).length + 1;
  const questionKey = `question-${questionNumber}`;
  this.selectedQuestions[pageKey][questionKey] = roiData;

  if (this.selectionBoxesByPage[this.currentPage]) {
    this.selectionBoxesByPage[this.currentPage] = this.selectionBoxesByPage[
      this.currentPage
    ].map((box) => ({
      ...box,
      submitted: true,
    }));
  }

  currentQuestionForm.reset({
    roi_coordinates: [],
    colNumber: '',
    orientation: 'horizontal',
    direction: 'rtl',
    marked: '',
    gradedByTeacher: false,
    choices: '',
    worth: 1,
    id: false,
    entities_count: '',
    roi_type: 'question',
  });
  this.setOpacityForSameName('roi_type', 'question');

  this.resetboxes();
  this.questionType = '';
  this.direction = '';
  this.isID = false;
  this.selectedIdType = '';

  console.log('ROI data submitted:', roiData);
}



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

  toggleTab(tab: string) {
    this.openTab = this.openTab === tab ? null : tab;
    // keep selectedOrientation as-is; we will set orientation in selectOrientation
    // if current form has orientation, reflect it
    try {
      const current = this.getCurrentQuestionFormGroup();
      if (current) {
        const ori = current.value.orientation;
        const dir = current.value.direction;
        if (ori) this.selectedOrientation = ori;
        if (dir) this.selectedDirection = dir;
      }
    } catch (e) {
      // ignore
    }
  }

  confirm(tab: string) {
    this.openTab = null;
    this.selectedOrientation = '';
    // keep selectedDirection as-is
  }

  // when user clicks orientation buttons in UI, patch the current question form
  selectOrientation(value: string) {
    this.selectedOrientation = value;
    // If orientation changed, persist to form
    try {
      const current = this.getCurrentQuestionFormGroup();
      if (current) {
        current.patchValue({ orientation: value });
        if (value === 'horizontal') {
          // default horizontal direction to rtl unless already set
          this.selectedDirection = current.value.direction || 'rtl';
          current.patchValue({ direction: this.selectedDirection });
        } else {
          // vertical -> clear direction (not used)
          this.selectedDirection = current.value.direction || '';
          current.patchValue({ direction: '' });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // when user clicks direction buttons in UI, patch the current question form
  selectDirection(value: string) {
    this.selectedDirection = value;
    try {
      const current = this.getCurrentQuestionFormGroup();
      if (current) {
        current.patchValue({ direction: value });
      }
    } catch (e) {
      // ignore
    }
  }
startProcessing() {
    this.processingService.setLoading(true);
    // this.processingService.setSpeeds(5, 12, 50); // مثال سرعات مبدئية

    let progress = 0;
    let remaining = 60; // 60 ثانية

    const interval = setInterval(() => {
      progress += 5;
      remaining -= 3;

      this.processingService.setProgress(progress);
      this.processingService.setRemainingTime(remaining);

      if (progress >= 100) {
        clearInterval(interval);
        this.processingService.setLoading(false);
      }
    }, 1500);
  }
}
