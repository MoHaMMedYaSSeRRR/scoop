import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private _HttpClient:HttpClient) { }

  login(data:any):Observable<any>{
    return this._HttpClient.post(`https://dev.scoob.cc/api/user/auth/send-otp`, data)
  }

  resendOtp(data:any):Observable<any>{
    return this._HttpClient.post(`https://dev.scoob.cc/api/user/auth/resend-otp`, data)
  }

  verifyOtp(data:any):Observable<any>{
    return this._HttpClient.post(`https://dev.scoob.cc/api/user/auth/verify-otp`, data)
  }
}
