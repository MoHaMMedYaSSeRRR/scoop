import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './Component/navbar/navbar.component';
import { FooterComponent } from './Component/footer/footer.component';
import { LoginComponent } from './Component/login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UploadpdfComponent } from './Component/uploadpdf/uploadpdf.component';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReviewComponent } from './Component/review/review.component';
import { PaymentComponent } from './Component/payment/payment.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { LoadingInterceptor } from './loading.interceptor';
import { NgxSpinnerModule } from 'ngx-spinner';
@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FooterComponent,
    LoginComponent,
    UploadpdfComponent,
    ReviewComponent,
    PaymentComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    CarouselModule ,
    FormsModule , 
    HttpClientModule,
    NgxSpinnerModule
  ],
  providers: [
    {provide :HTTP_INTERCEPTORS ,useClass:LoadingInterceptor , multi:true}

  ],
  bootstrap: [AppComponent]
})
export class AppModule { }