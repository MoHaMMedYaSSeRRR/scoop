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

    private apiKey =`AWyacr4vOJXmODKMqgjzLIGhunN3lSJlzOwTb2X2LuwyKV9UMLHfsGaefHDabFXzWXGI4Df1fNWYZI-A-ZE0uAtOfiOQCutIZuvZLcm1Q9cDnMua4A8GHnhGrdEC8PV3BoE0kj34ZcNvI0LOnGxBpRSYRdQwkS5p-7f77wNAk2eMYoni_YQiclVcUTit_EbR6Z3afxbsTRRN2EnFKJ8jBSAZ4kniCp7rG0StNTH1Fgho097mQ8UwRCXtzD8J68YKl5jriZECCizMRvMaRWyfLjYNysT5-nehWleqA_RTS4t_OCTQwVIcxYxDA65gnqCUlybWpf1vXgAYgdH6QOh4IDuf-s2TQvMxX7Jjc2hWUgDUt1zBqptt6UpaGJPSzxSkvhts6VSwlfEwpyO2xS_kiqFRB2kGB86tvaIgr5hAV7hFw6DFGXi8XoeAXH0gvjSnvTsl8a-1hqQ0-NwV13PMGKMMor8l4jf3u4ju3gc2DuPlBuQ4G2MOdt5zZw7iB8uLXlF8bdgXsGyJhrmKX-yFoAvFCckm1EgUAmxMQDPCQ8p-reFxZML5pWNuFKytMZBofSrYH4EifBVKUbQ9IZ7Ml7pxJX4pQ2ddVuIU3D4Q6AIYd-7-gxA6_YLplxNkiONQj-VAoYfdtih_BRteq0WNjl3cPFymNlTjms2B6T31RtEPC1mEy5ARsikCOmKAH83Ksbxr1oPAkKgo_j4rIZ4ecpfNq1oDTKJdcXq28dJQkKbNdx9eRyvvdStSbbRuNr0yUGcEYA`
    createPayment(amount: number, currency: string, customerName: string, customerEmail: string, customerMobile: string, returnUrl: string, mobileCountryCode: string): Observable<any> {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'authorization': `Bearer AWyacr4vOJXmODKMqgjzLIGhunN3lSJlzOwTb2X2LuwyKV9UMLHfsGaefHDabFXzWXGI4Df1fNWYZI-A-ZE0uAtOfiOQCutIZuvZLcm1Q9cDnMua4A8GHnhGrdEC8PV3BoE0kj34ZcNvI0LOnGxBpRSYRdQwkS5p-7f77wNAk2eMYoni_YQiclVcUTit_EbR6Z3afxbsTRRN2EnFKJ8jBSAZ4kniCp7rG0StNTH1Fgho097mQ8UwRCXtzD8J68YKl5jriZECCizMRvMaRWyfLjYNysT5-nehWleqA_RTS4t_OCTQwVIcxYxDA65gnqCUlybWpf1vXgAYgdH6QOh4IDuf-s2TQvMxX7Jjc2hWUgDUt1zBqptt6UpaGJPSzxSkvhts6VSwlfEwpyO2xS_kiqFRB2kGB86tvaIgr5hAV7hFw6DFGXi8XoeAXH0gvjSnvTsl8a-1hqQ0-NwV13PMGKMMor8l4jf3u4ju3gc2DuPlBuQ4G2MOdt5zZw7iB8uLXlF8bdgXsGyJhrmKX-yFoAvFCckm1EgUAmxMQDPCQ8p-reFxZML5pWNuFKytMZBofSrYH4EifBVKUbQ9IZ7Ml7pxJX4pQ2ddVuIU3D4Q6AIYd-7-gxA6_YLplxNkiONQj-VAoYfdtih_BRteq0WNjl3cPFymNlTjms2B6T31RtEPC1mEy5ARsikCOmKAH83Ksbxr1oPAkKgo_j4rIZ4ecpfNq1oDTKJdcXq28dJQkKbNdx9eRyvvdStSbbRuNr0yUGcEYA`
      });
    console.log("Headers:", headers);
      const body = {
        "InvoiceValue": amount,
        "CustomerName": localStorage.getItem('scoobEmail'),
        "CustomerEmail": localStorage.getItem('scoobEmail'),
        "CallBackUrl": "https://scoob.cc/uploadpdf",
        "ErrorUrl": "https://scoob.cc/uploadpdf",
        "Language": "en",
        "DisplayCurrencyIso": "SAR",
        "NotificationOption": "LNK"
      };
    
      return this._HttpClient.post(`https://scoob.cc/myfatoorah.php`, body, { headers });
    }
    getPaymentStatus(paymentId: any): Observable<any> {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json'
      });
    
      const body = {
        Key: paymentId,
        KeyType: 'PaymentId'  // or 'InvoiceId' based on what you have
      };
    
      return this._HttpClient.post(`https://scoob.cc/paymentstatus.php`, body, { headers });
    }
    useFree(x:any): Observable<any> {
      return this._HttpClient.post(
        `https://dev.scoob.cc/api/use-free-trial`,
        {
          package_id: x,
        }
      );
    }
    getFreeTrial(): Observable<any> {
      return this._HttpClient.get(
        `https://dev.scoob.cc/api/check-free-trial`
      );
    }
    getPriceOfHandredPage():Observable<any>{
    return this._HttpClient.get(`https://dev.scoob.cc/api/user/page-price`);
  }
  addNewPagesToUser(data:any):Observable<any>{
    return this._HttpClient.post(`https://dev.scoob.cc/api/user-packages/add-pages` , data)
  }
}
