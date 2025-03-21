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
  private baseUrl = '/scoob-api'; // Use proxy path

  constructor(
    private _HttpClient:HttpClient
  ) { }
  // upload(data: any): Observable<any> {
  //   const apiUrl = 'https://scoob.cc/step-1'; // Use full URL
  //   return this._HttpClient.post(apiUrl, data);
  // }
  
  upload(data: any): Observable<any> {
    return this._HttpClient.post(`http://127.0.0.1:8000/step-1`, data);
  }
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
  //  reviewOmr(data:any): Observable<any> {
  //   const apiUrl = 'https://scoob.cc/final'; // Use full URL
  //   return this._HttpClient.post(apiUrl, data);
  // }
  reviewOmr(data: any): Observable<any> {
    return this._HttpClient.post(`http://127.0.0.1:8000/final`, data);
  }
}
