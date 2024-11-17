import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private pdfUrl: string = '';

  constructor(
    private _HttpClient:HttpClient
  ) { }
  upload(data:any):Observable<any>{
    return this._HttpClient.post('https://scoob.cc/upload-file' ,data);

  }
  setPdfUrl(url: string): void {
    this.pdfUrl = url;
  }

  getPdfUrl(): string {
    return this.pdfUrl;
  }
}
