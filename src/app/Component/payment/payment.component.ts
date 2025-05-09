import { ToastrService } from 'ngx-toastr';
import { PayService } from './../../services/pay.service';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent {
  isLayerHidden: boolean = false;
  constructor(private _PayService:PayService,
    private _ToastrService:ToastrService,
    private  _Router:Router
  ){}

  packages:any[] = [];
  hideLayer(): void {
    this.isLayerHidden = true;
  }
  ngOnInit(): void {
   this._PayService.getAllPackages().subscribe({
    next:(res)=>{
     
      this.packages=res.data;
      console.log(this.packages);
    }
   })
   this.getPacageDetails();    
  }
  selectedPackageId: number | null = null; 
  selectedPackage: any ;
selectPackage(item: any) {
  this.selectedPackageId = item.id; 
  this.selectedPackage = item;
  console.log("Selected Package:", item); 
}

getPacageDetails(){
    this._PayService.getPackageDetails(2).subscribe({
      next: (res) => {
        console.log("Package Details:", res);
      }
    })
  }
  subscribePackage(){
   if(this.selectedPackageId){
    const data ={
      package_id: this.selectedPackageId
    }
    this._PayService.subscriveToPackage(data).subscribe({
      next: (res) => {
        console.log("Subscribed Package:", res);
        this._ToastrService.success('تم الاشتراك بنجاح');
        // this._Router.navigate(['/uploadpdf']);
      
      
      },
      error: (err) => {
        console.error("Error subscribing package:", err);
      }
    })
   }
  }


  testMyFatoorah() {
    const amount = this.selectedPackage.final_price;
    const currency = 'KWD';
    const customerName = 'Test User';
    const returnUrl = 'http://localhost:4200/uploadpdf'; // Change in production
  
    this._PayService.createPayment(amount, currency, customerName, returnUrl).subscribe(response => {
      if (response.IsSuccess) {
        window.location.href = response.Data.PaymentURL;
      } else {
        console.error('Payment Failed:', response);
      }
    });
  }
  
  }

