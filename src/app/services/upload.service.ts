import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {

  constructor(
    private _HttpClient:HttpClient
  ) { }
  upload(data:any):Observable<any>{
    return this._HttpClient.post('http://157.173.124.62:8080/upload' ,data);

  }
  gettest():Observable<any>{
    return this._HttpClient.get('http://157.173.124.62:8080/test')
  }
}
