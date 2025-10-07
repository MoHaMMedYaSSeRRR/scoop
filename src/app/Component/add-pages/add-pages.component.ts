import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PayService } from 'src/app/services/pay.service';
import { UploadService } from 'src/app/services/upload.service';

@Component({
  selector: 'app-add-pages',
  templateUrl: './add-pages.component.html',
  styleUrls: ['./add-pages.component.scss']
})
export class AddPagesComponent {
  isLayerHidden = false;
  pagesCount = 100; 
  pricePer100 = 0;
  totalPrice = 0;
  
  constructor(
    private _PayService: PayService,
    private _Toastr: ToastrService,
    private _UploadService: UploadService
  ) {}

  ngOnInit(): void {
    this._PayService.getPriceOfHandredPage().subscribe({
      next: (res) => {
        this.pricePer100 = res.data.price_per_hundred_page;
        this.calculateTotal();
      },
      error: (err) => console.error(err)
    });

    this._UploadService.addPages$.subscribe((value) => {
      this.isLayerHidden = value;
    });
  }

  hideLayer() {
    this.isLayerHidden = false;
  }

  increase() {
    this.pagesCount += 100;
    this.calculateTotal();
  }

  decrease() {
    if (this.pagesCount > 100) {
      this.pagesCount -= 100;  
      this.calculateTotal(); 
    } 
  }

  calculateTotal() {
    this.totalPrice = (this.pagesCount / 100) * this.pricePer100;
  }

 payNow() {
  const amount = this.totalPrice;
  const currency = 'KWD';
  const customerName = 'Test User';
  const customerEmail = 'john@example.com';
  const customerMobile = '96650000000';
  const mobileCountryCode = '+966';
  const returnUrl = 'https://scoob.cc/test';

  this._PayService.createPayment(
    amount, currency, customerName, customerEmail, customerMobile, returnUrl, mobileCountryCode
  ).subscribe({
    next: (response: any) => {
      console.log('Payment Response:', response);

      if (response.IsSuccess) {
        // ✅ خزّن عدد الصفحات في localStorage بدلاً من النداء المباشر
        localStorage.setItem('pendingPagesToAdd', this.pagesCount.toString());

        // 🔗 الانتقال لصفحة الدفع
        window.location.href = response.Data.InvoiceURL;
      } else {
        this._Toastr.error('فشل الدفع');
      }
    },
    error: (err) => {
      console.error('Payment Error:', err);
      this._Toastr.error('حدث خطأ في الدفع');
    }
  });
}

}
