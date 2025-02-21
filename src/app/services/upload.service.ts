import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private pdfUrl: string = '';
  data:any;
  constructor(
    private _HttpClient:HttpClient
  ) { }
  upload(data:any):Observable<any>{
    return this._HttpClient.post('https://scoob.cc/upload-file' ,data);

  }
  setdata(data:any){
    this.data=data;
  }
  getdata():any{
    return this.data;
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
  private selectedBoxSubject = new BehaviorSubject<any>(null); // Initialize as null
  selectedBox$ = this.selectedBoxSubject.asObservable();

  setSelectedBox(box: any) {
    this.selectedBoxSubject.next(box); // Update the selected box
  }

  getSelectedBox() {
    return this.selectedBoxSubject.value; // Get the latest selected box
  }
}
