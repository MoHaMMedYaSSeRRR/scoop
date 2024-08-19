import { PaymentComponent } from './Component/payment/payment.component';
import { ReviewComponent } from './Component/review/review.component';
import { UploadpdfComponent } from './Component/uploadpdf/uploadpdf.component';
import { LoginComponent } from './Component/login/login.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {path:'',component: LoginComponent , pathMatch:'full'},
  {path:'login',component: LoginComponent},
  {path:'uploadpdf',component: UploadpdfComponent},
  {path:'review',component: ReviewComponent},
  {path:'payment',component: PaymentComponent},


];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
