import { PaymentComponent } from './Component/payment/payment.component';
import { ReviewComponent } from './Component/review/review.component';
import { UploadpdfComponent } from './Component/uploadpdf/uploadpdf.component';
import { LoginComponent } from './Component/login/login.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FinalSheetComponent } from './Component/final-sheet/final-sheet.component';

const routes: Routes = [
  {path:'',component: LoginComponent , pathMatch:'full'},
  {path:'login',component: LoginComponent},
  {path:'uploadpdf',component: UploadpdfComponent},
  {path:'review',component: ReviewComponent},
  {path: 'finalsheet' , component:FinalSheetComponent},
  {path:'pay' ,component: PaymentComponent}


];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
