import { Component, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UploadService } from 'src/app/services/upload.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  subscriptionStatusText: string = '';

  constructor(private _AuthService: AuthService , 
    private _Router:Router,
    private eRef: ElementRef ,
    private _UploadService:UploadService
  ) { }
  isLogin: boolean = this._AuthService.isLoggedIn;
  ngOnInit(): void {
    this._AuthService.isLoggedIn$.subscribe((status) => {
      this.isLogin = status;
    });
        this._AuthService.subscriptionStatus$.subscribe(status => {
      this.subscriptionStatusText = status;
    });
  }
  toggleIsPay() {
    this._UploadService.setIsPay(true);
    console.log("isPay set to true");
  }
   isLoggedIn() {
    this.isLogin = this._AuthService.isLoggedIn;
    console.log(this.isLogin);
  }
  showUserMenu = false;

toggleUserMenu() {
  this.showUserMenu = !this.showUserMenu;
}
  logout() {
    localStorage.removeItem('scoobToken');
    this._Router.navigate(['/login']);
    this._AuthService.setLoginState(false);
    localStorage.removeItem('selectedPackageId');
    localStorage.removeItem('userPackageId');
    localStorage.removeItem('pageCount');
  this.subscriptionStatusText = '';
  this.isLoggedIn(); 
  }
   @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.showUserMenu = false;
    }
  }
}
