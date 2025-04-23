import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class MyhttpInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const uToken = localStorage.getItem('scoobToken');

    // Exclude MyFatoorah API from automatic token injection
    if (!request.url.includes('ExecutePayment')) {
      if (uToken) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${uToken}`,
          },
        });
      }
    }

    return next.handle(request);
  }
}
