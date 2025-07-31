import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { data } from 'jquery';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private _AuthService: AuthService,
    private _ToastrService: ToastrService,
    private _router: Router
  ) {}
  ngOnInit(): void {
    this._AuthService.setLoginState(false);
    
  }

  step1: boolean = true;
  step2: boolean = false;

  loginForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.email]),
  });

  otpForm: FormGroup = new FormGroup({
    digit1: new FormControl('', [Validators.required, Validators.maxLength(1)]),
    digit2: new FormControl('', [Validators.required, Validators.maxLength(1)]),
    digit3: new FormControl('', [Validators.required, Validators.maxLength(1)]),
    digit4: new FormControl('', [Validators.required, Validators.maxLength(1)]),
    digit5: new FormControl('', [Validators.required, Validators.maxLength(1)]),
    digit6: new FormControl('', [Validators.required, Validators.maxLength(1)]),
  });
  email: any;
  login(form: FormGroup) {
    this.email = form.value.email;
    console.log(form.value);
    localStorage.setItem('scoobEmail', this.email);
    this._AuthService.login(form.value).subscribe({
      next: (res) => {
        if (res.result == true) {
          this._ToastrService.success(res.message);
          // console.log('Logged in successfully:', res);
          this.step1 = false;
          this.step2 = true;
        }
      },
      error: (err) => {
        this._ToastrService.error(' عنوان بريد الكتروني غير صالح ');
      },
    });
  }
  resendOtp() {
    this._AuthService.resendOtp(this.loginForm.value).subscribe({
      next: (res) => {
        if (res.result == true) {
          this._ToastrService.success(res.message);
        }
      },
    });
  }
  otp: any;
  sendOtp() {
    if (this.otpForm.valid) {
      const otp = Object.values(this.otpForm.value).join('');
      console.log('OTP:', otp);
      const data: any = {
        email: this.email,
        otp:otp,
        
      };
      this._AuthService.verifyOtp(data).subscribe({
        next: (res) => {
          if (res.result == true) {
            console.log(res)
            this._ToastrService.success('تم تسجيل الدخول بنجاح');
            localStorage.setItem('scoobToken', res.data.token);
             this._router.navigate(['/uploadpdf']);
             this._AuthService.setLoginState(true);

          }
        },
        error: (err) => {
          this._ToastrService.error('كود التحقق غير صحيح');
          this.otpForm.reset();
        },
      });
    }
  }

  onInput(event: any, index: number): void {
    const inputValue = event.target.value;

    if (inputValue.length === 1 && index < this.otpInputs.length - 1) {
      // Move to the next input field
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    } else if (inputValue.length === 1 && index === this.otpInputs.length - 1) {
      // Last input: unfocus the field
      event.target.blur();
    }
  }
}
