import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { UploadService } from 'src/app/services/upload.service';

@Component({
  selector: 'app-final-sheet',
  templateUrl: './final-sheet.component.html',
  styleUrls: ['./final-sheet.component.scss']
})
export class FinalSheetComponent {
  pdfForm: FormGroup;
  fileName: string = '';
  isLoading: boolean = false;
  updatedData: any[] = [];
  showDownloadButton = false;

  public omrIds: { [key: string]: number } = {};

  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(private fb: FormBuilder , private _UploadService:UploadService) {
    this.pdfForm = this.fb.group({
      pdf: [null, Validators.required]
    });
  }
 ngOnInit(): void {
  this.setOmrIds(this._UploadService.getOmrIds())
 }
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    if (target) target.classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    if (target) target.classList.remove('dragover');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    if (target) target.classList.remove('dragover');

    const file = event.dataTransfer?.files?.[0];

    const isExcel =
      file &&
      (file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    if (isExcel && this.fileInput?.nativeElement) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      this.fileInput.nativeElement.files = dataTransfer.files;
      this.onFileSelected({ target: this.fileInput.nativeElement } as any);
    } else {
      console.warn('⚠️ Only Excel files are allowed.');
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
  }

  setFile(file: File) {
    console.log('📄 File selected:', file.name);
    this.fileName = file.name;
    this.pdfForm.patchValue({ pdf: file });
    this.pdfForm.get('pdf')?.updateValueAndValidity();
  }

  setOmrIds(ids: { [key: string]: number }) {
    this.omrIds = ids;
    console.log('🧠 OMR IDs Set:', this.omrIds);
  }

  getOmrIds(): { [key: string]: number } {
    return this.omrIds;
  }

onSubmit() {
  if (this.pdfForm.invalid) return;

  this.isLoading = true;
  const file = this.pdfForm.value.pdf;
  const reader = new FileReader();

  reader.onload = (e: any) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
const excelData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" });

    console.log('📊 Original Excel Data:', excelData);

    if (excelData.length === 0) {
      console.warn('⚠️ Excel file is empty or not properly formatted.');
      this.updatedData = [];
      this.isLoading = false;
      return;
    }

    const omrMap = this.getOmrIds();

    this.updatedData = excelData.map(row => {
      const seatNumber = row['رقم الجلوس']?.toString()?.trim();
      const score = omrMap[seatNumber];

      console.log(`🎯 Seat Number: ${seatNumber} - New Score: ${score}`);

      return {
        ...row,
        'النتيجة': score ?? ''  // Add 'النتيجة' column even if score is undefined
      };
    });

    console.log('✅ Updated Excel Data with النتيجة:', this.updatedData);
    this.showDownloadButton = true;
    this.isLoading = false;
    this.downloadUpdatedExcel();
  };

  reader.readAsArrayBuffer(file);
}

  

 downloadUpdatedExcel() {
  if (!this.updatedData || this.updatedData.length === 0) {
    console.warn('⚠️ No data to export. Make sure to upload and process a valid Excel file first.');
    return;
  }

  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.updatedData);
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Final Scores');

  const excelBuffer: any = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array'
  });

  const data: Blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  FileSaver.saveAs(data, 'final_result.xlsx');
  console.log('📥 File Download Triggered');
}

}
