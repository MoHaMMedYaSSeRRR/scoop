import { PaymentComponent } from './Component/payment/payment.component';
import { ReviewComponent } from './Component/review/review.component';
import { UploadpdfComponent } from './Component/uploadpdf/uploadpdf.component';
import { LoginComponent } from './Component/login/login.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FinalSheetComponent } from './Component/final-sheet/final-sheet.component';
import { authGuard } from './gaurds/auth.guard';
import { TestComponent } from './Component/test/test.component';

const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full', canActivate: [authGuard] },
  { path: 'login', component: LoginComponent, canActivate: [authGuard] },
  { path: 'uploadpdf', component: UploadpdfComponent, canActivate: [authGuard] },
  { path: 'test', component: TestComponent, canActivate: [authGuard] },
  { path: 'review', component: ReviewComponent, canActivate: [authGuard] },
  { path: 'finalsheet', component: FinalSheetComponent },
  { path: 'pay', component: PaymentComponent }
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
