import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('scoobToken'));
  public isLoggedIn$ = this._isLoggedInSubject.asObservable();

  setLoginState(isLoggedIn: boolean) {
    this._isLoggedInSubject.next(isLoggedIn);
  }

  get isLoggedIn(): boolean {
    return this._isLoggedInSubject.value;
  }
  
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
  getUserPackage(): Observable<any> {
    return this._HttpClient.get('https://dev.scoob.cc/api/user-active-packages');

  }
  checkRemainingpages(userPackageId: any, pages: number, should_deduct: boolean): Observable<any> {
    const body = {
      user_package_id: userPackageId,
      should_deduct: should_deduct, // actual boolean
      pages: pages
    };
    return this._HttpClient.post('https://dev.scoob.cc/api/consume-pages', body);
  }
  
  
  private subscriptionStatus = new BehaviorSubject<string>('');
  subscriptionStatus$ = this.subscriptionStatus.asObservable();
  private formattedDate = new BehaviorSubject<string>('');
  formattedDate$ = this.formattedDate.asObservable();
  updateSubscriptionStatus(packageData: any): void {
    const expiresAt = new Date(packageData.expires_at);
    const remainingPages = packageData.remaining_pages;
    const durationType = packageData.package?.duration?.type;
    const packageName = packageData.package?.name;

    // Format Arabic date (e.g., 20 مايو 2025)
    const formattedDate = expiresAt.toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // const status = `اشتراك ${packageName} <br> عدد الصفحات المتبقية ${remainingPages}  <br> ينتهي في ${formattedDate}`;
        const status = ` عدد الورق:  ${remainingPages}`;
        const dateStatus = `   اشتراكك الحالي ينتهي في ${formattedDate}`;

    this.subscriptionStatus.next(status);
    this.formattedDate.next(dateStatus);
  }
}
