import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  step1:boolean = true;
  step2:boolean = false;

  loginForm:FormGroup=new FormGroup ({
      email:new FormControl('',[Validators.email])    
  })
  otpForm:FormGroup=new FormGroup({
    digit1: new FormControl('', [Validators.required, Validators.maxLength(1)]),
      digit2: new FormControl('', [Validators.required, Validators.maxLength(1)]),
      digit3: new FormControl('', [Validators.required, Validators.maxLength(1)]),
      digit4: new FormControl('', [Validators.required, Validators.maxLength(1)]),
      digit5: new FormControl('', [Validators.required, Validators.maxLength(1)]),
      digit6: new FormControl('', [Validators.required, Validators.maxLength(1)])
  })

  login(form:FormGroup){
    console.log(this.loginForm.value)
    this.step1 = false;
    this.step2 = true;
  }
  sendOtp(){
    if (this.otpForm.valid) {
      const otp = Object.values(this.otpForm.value).join('');
      console.log('OTP:', otp);
    }

  }
}
