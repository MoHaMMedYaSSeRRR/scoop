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

    private apiKey =`rLtt6JWvbUHDDhsZnfpAhpYk4dxYDQkbcPTyGaKp2TYqQgG7FGZ5Th_WD53Oq8Ebz6A53njUoo1w3pjU1D4vs_ZMqFiz_j0urb_BH9Oq9VZoKFoJEDAbRZepGcQanImyYrry7Kt6MnMdgfG5jn4HngWoRdKduNNyP4kzcp3mRv7x00ahkm9LAK7ZRieg7k1PDAnBIOG3EyVSJ5kK4WLMvYr7sCwHbHcu4A5WwelxYK0GMJy37bNAarSJDFQsJ2ZvJjvMDmfWwDVFEVe_5tOomfVNt6bOg9mexbGjMrnHBnKnZR1vQbBtQieDlQepzTZMuQrSuKn-t5XZM7V6fCW7oP-uXGX-sMOajeX65JOf6XVpk29DP6ro8WTAflCDANC193yof8-f5_EYY-3hXhJj7RBXmizDpneEQDSaSz5sFk0sV5qPcARJ9zGG73vuGFyenjPPmtDtXtpx35A-BVcOSBYVIWe9kndG3nclfefjKEuZ3m4jL9Gg1h2JBvmXSMYiZtp9MR5I6pvbvylU_PP5xJFSjVTIz7IQSjcVGO41npnwIxRXNRxFOdIUHn0tjQ-7LwvEcTXyPsHXcMD8WtgBh-wxR8aKX7WPSsT1O8d8reb2aR7K3rkV3K82K_0OgawImEpwSvp9MNKynEAJQS6ZHe_J_l77652xwPNxMRTMASk1ZsJL`
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
}
