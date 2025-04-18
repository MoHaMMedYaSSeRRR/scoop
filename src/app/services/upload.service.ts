import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, Observable, throwError, timeout } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private pdfUrl: string = '';
  private dataSubject = new BehaviorSubject<any>(null);
  data$ = this.dataSubject.asObservable();

  private fileSubject = new BehaviorSubject<File | null>(null);
  file$ = this.fileSubject.asObservable();
  private baseUrl = '/api'; // Use proxy path

  constructor(
    private _HttpClient:HttpClient
  ) { }
  upload(data: any): Observable<any> {
    return this._HttpClient.post('https://scoob.cc/step-1', data);
  }
  // upload(data: any): Observable<any> {
  //   return this._HttpClient.post('/scoob/step-1', data);
  // }
  pdfFile:any;
  setdata(data: any, file: File) {
    this.dataSubject.next(data);
    this.fileSubject.next(file);
  }

  // ✅ Retrieve Stored Data
  getdata(): any {
    return this.dataSubject.getValue();
  }

  getFile(): File | null {
    return this.fileSubject.getValue();
  }
  setPdfUrl(url: string): void {
    this.pdfUrl = url;
  }

  getPdfUrl(): string {
    return this.pdfUrl;
  }
  private scores: any = null;

  setScores(scores: any) {
    this.scores = scores;
  }

  getScores() {
    return this.scores;
  }
  private selectedBoxSubject = new BehaviorSubject<any>(null); 
  selectedBox$ = this.selectedBoxSubject.asObservable();

  setSelectedBox(box: any) {
    this.selectedBoxSubject.next(box); 
  }

  getSelectedBox() {
    return this.selectedBoxSubject.value;  
  }
   reviewOmr(data:any): Observable<any> {
    return this._HttpClient.post('https://scoob.cc/final', data);
  }
  // reviewOmr(data: any): Observable<any> {
  //   return this._HttpClient.post(`/scoob/final`, data);
  // }


  private omrIds: { [key: string]: number } = {};
  // private omrIds: { [key: string]: number } = {
  //   '027': 19,
  //   '690': 29,
  //   '691': 30,
  //   '692': 20,
  //   '693': 25,
  //   '694': 22,
  //   '695': 30,
  //   '696': 26,
  //   '697': 26,
  //   '698': 19,
  //   '699': 23,
  //   '700': 24,
  //   '701': 27,
  //   '702': 29,
  //   '703': 27,
  //   '704': 18,
  //   '705': 29,
  //   '706': 25,
  //   '707': 11,
  //   '708': 24,
  //   '709': 25,
  //   '710': 23,
  //   '711': 25,
  //   '712': 26,
  //   '713': 30,
  //   '714': 30,
  //   '715': 18,
  //   '716': 27,
  //   '717': 29,
  //   '718': 14,
  //   '719': 10,
  //   '721': 29,
  //   '722': 25,
  //   '723': 30,
  //   '724': 29,
  //   '725': 28,
  //   '726': 27,
  //   '727': 23,
  //   '728': 25,
  //   '729': 17,
  //   '730': 13,
  //   '731': 27,
  //   '732': 28,
  //   '733': 23,
  //   '735': 17,
  //   '736': 30,
  //   '737': 30,
  //   '738': 18,
  //   '739': 30,
  //   '740': 30,
  //   '741': 28,
  //   '743': 14,
  //   '744': 23,
  //   '745': 16,
  //   '746': 30,
  //   '747': 24,
  //   '748': 29,
  //   '749': 24,
  //   '750': 11,
  //   '751': 24,
  //   '752': 30,
  //   '753': 29,
  //   '754': 29,
  //   '755': 28,
  //   '756': 28,
  //   '757': 28,
  //   '758': 15,
  //   '759': 20,
  //   '760': 18,
  //   '761': 27
  // };
  // Store OMR IDs
  setOmrIds(ids: { [key: string]: number }) {
    this.omrIds = ids;
  }

  // Retrieve OMR IDs
  getOmrIds(): { [key: string]: number } {
    return this.omrIds;
  }
}
