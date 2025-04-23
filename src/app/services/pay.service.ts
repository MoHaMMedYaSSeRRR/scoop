import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PayService {
  constructor(private _HttpClient: HttpClient) {}

  getAllPackages(): Observable<any> {
    return this._HttpClient.get(`https://dev.scoob.cc/api/packages`);
  }

  getPackageDetails(id: number): Observable<any> {
    return this._HttpClient.get(`https://dev.scoob.cc/api/package/${id}`);
  }
  getUserPackages(): Observable<any> {
    return this._HttpClient.get(
      `https://dev.scoob.cc/api/user-active-packages`
    );
  }
  subscriveToPackage(data: any): Observable<any> {
    return this._HttpClient.post(
      `https://dev.scoob.cc/api/subscribe-to-package`,
      data
    );
  }

  private apiUrl = './myfatoorah-api/v2/ExecutePayment';

    private apiKey =`lLbI5tXxTjo8qxAd_iVRimclBQIuvIY684PgE16Midgyv28wzR8CKfzfThdnZLQ-WyCwDUFRk_uW7M-rl79hoegb0ORYCnvXY0LUPQHeBWbsYHBACda2ryGnzxVU5HxKJ9nXpYr8Yc7vhUiXTj3VpwgNnSe0VYgoeH1YDTQ9q4AmVgTI4acG1zfwt7GBsRjG_tfIdmDVEqKfiMfKlZbzipEecguT--vyBBRqyr5u6itbj_WNlEMHyBN3yv0DHL8Qa8J8vx5lXsgjDI5JnyqLzu95-_5qV6UV8szA0ZV-haYNjKafUsBLynN7Yxe5RUdfA7xG40TlLejYW182UdX4EayDVfKP3-KjVHKaLVt2t84o0GmBWuq82PVkNZzMYKrszMQSOULf5HySnIgIzwxChvq5NcHwM1uQ1M83wW7mxqLifcLI0HT_GqdfaKrfjH0368TFpRjVlaV97AA6arapYJAuX7KoanyErKLpg_id1EfSCa5Ccx7wuOuCCGCVBt6tT-TZ3qOoHEVOjDRcKWPn0C4CS-OCyCY57PpDa-3y2X51W2XWiE7zLlAFpneIPTAucaISWp6xMHpNj1kssiWC1VoBqPtgOMgOXsyduDhxc9blcpPT2sVpOeHyF8JOtssUzIkaMXqJiR5V-pzjkoSzuTAojvBd2RbQyKDiofT1ofuv2FSlpRC3Sztk64vRo3XUd1bvsc8jbLN-VKvZTxvNDQExB4gsXP_XUq6wgoGw1kQIchzpbcB_qtOY8m4XCLByZEU7pQ`
    createPayment(amount: number, currency: string, customerName: string, returnUrl: string): Observable<any> {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      });
  
      const body = {

        "PaymentMethodId": 2,  // Use 2 for Mada, 3 for Visa/Mastercard, 11 for Apple Pay
        "InvoiceValue": amount,
        "Currency": "SAR",
        "CustomerName": customerName,
        "CallBackUrl": returnUrl,
        "ErrorUrl": returnUrl,
        "Language": "en",
        "DisplayCurrencyIso": "SAR"
      };
  
      return this._HttpClient.post(this.apiUrl, body, { headers });
    }
    checkTokenEnvironment() {
      const headers = new HttpHeaders({
        'Authorization': 'Bearer ' + this.apiKey
      });
    
      // Try Test Environment First
      this._HttpClient.get('https://api.myfatoorah.com/v2/GetProfile', { headers }).subscribe({
        next: res => {
          console.log('✅ Token is valid for TEST environment', res);
        },
        error: err => {
          if (err.status === 401) {
            console.warn('❌ Not valid for TEST. Checking LIVE...');
    
            // Now try LIVE
            this._HttpClient.get('https://apitest.myfatoorah.com/v2/GetProfile', { headers }).subscribe({
              next: res => {
                console.log('✅ Token is valid for LIVE environment', res);
              },
              error: err => {
                if (err.status === 401) {
                  console.error('❌ Token is invalid for both TEST and LIVE.');
                } else {
                  console.error('⚠️ Error checking LIVE token:', err);
                }
              }
            });
    
          } else {
            console.error('⚠️ Error checking TEST token:', err);
          }
        }
      });
    }
    
}
