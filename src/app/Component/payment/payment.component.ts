import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { PayService } from './../../services/pay.service';
import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { UploadService } from 'src/app/services/upload.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent {
  isLayerHidden: boolean = false;
  constructor(private _PayService:PayService,
    private _ToastrService:ToastrService,
    private  _Router:Router , 
    private _UploadService:UploadService,
    private _AuthService:AuthService
  ){}
  @Output() continueClicked = new EventEmitter<void>();
  @Output() subscribed = new EventEmitter<void>();
  subscriptionStatusText: string = '';
userEmail: string | null = localStorage.getItem('scoobEmail');
  packages:any[] = [];
  hideLayer(): void {
    this.isLayerHidden = true;
    this._UploadService.setIsPay(false);
  }
  isFree: boolean = false;
  ngOnInit(): void {
   this._PayService.getAllPackages().subscribe({
    next:(res)=>{
     
      this.packages=res.data;
      console.log(this.packages);
    }
   })
       this._AuthService.formattedDate$.subscribe(status => {
         this.subscriptionStatusText = status;
         console.log("Subscription Status:", status);
       });
   this.getPacageDetails();
   
   this.checkFree()
  }
  selectedPackageId: number | null = null; 
  selectedPackage: any ;
selectPackage(item: any) {
  this.selectedPackageId = item.id; 
  this.selectedPackage = item;
  localStorage.setItem('selectedPackageId', item.id.toString());
  console.log("Selected Package:", item); 
}
openInNewTab() {
  const url = '/test';  // Your desired route
  window.open(url, '_blank');
}
getPacageDetails(){
    this._PayService.getPackageDetails(2).subscribe({
      next: (res) => {
        console.log("Package Details:", res);
      }
    })
    
  }
  // subscribePackage(){
  //  if(this.selectedPackageId){
  //   const data ={
  //     package_id: this.selectedPackageId
  //   }
  //   this._PayService.subscriveToPackage(data).subscribe({
  //     next: (res) => {
  //       console.log("Subscribed Package:", res);
  //       this._ToastrService.success('تم الاشتراك بنجاح');
  //       // this._Router.navigate(['/uploadpdf']);
  //       this.subscribed.emit(); // ✅ Emit when subscription is confirmed

      
  //     },
  //     error: (err) => {
  //       console.error("Error subscribing package:", err);
  //     }
  //   })
  //  }
  // }

  usefree(){
    this._PayService.useFree(3).subscribe({
      next: (res) => {
        console.log("Free Package Response:", res);
        this.checkFree()
      },
      error: (err) => {
        console.error("Error using free package:", err);
      }
    })
  }
  checkFree(){
    this._PayService.getFreeTrial().subscribe({
      next: (res) => {
        console.log("Free Package Response:", res);
        this.isFree = res.data.free_trial;
      },
      error: (err) => {
        console.error("Error using free package:", err);
      }
    })
  }
 
  testMyFatoorah() {
    const amount = this.selectedPackage?.final_price;
    const currency = 'KWD'; // Currency code (currently KWD, but modify as needed)
    const customerName = 'Test User';
    const customerEmail = 'john@example.com'; // Customer's email
    const customerMobile = '96650000000'; // Customer's mobile number
    const mobileCountryCode = '+966'; // Country code for mobile number
    const returnUrl = 'https://scoob.cc/review'; // Must be a public URL
  
    this._PayService.createPayment(amount, currency, customerName, customerEmail, customerMobile, returnUrl, mobileCountryCode).subscribe(
      (response: any) => {
        console.log('Payment Response:', response);
        if (response.IsSuccess) {
           window.location.href = response.Data.InvoiceURL; // Redirect to payment URL
        } else {
          console.error('Payment Failed:', response);
        }
      },
      error => {
        console.error('Payment Error:', error);
      }
    );
  }
  
  

  
  isMark=false;
   mark(){
    this.isMark=true;
   }
  
  }

