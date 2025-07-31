import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('scoobToken');

  const routePath = route.routeConfig?.path; // Accessing the route path correctly

  if (token) {
    // If the token exists, user is logged in
    // If they try to access the login page, redirect them to /uploadpdf
    if (routePath === 'login' || routePath === '') {
      router.navigate(['/uploadpdf']);
      return false; // Prevent navigation to login if already logged in
    }
    return true; // Allow access to the protected pages like uploadpdf, review, etc.
  } else {
    // If no token, user is not logged in
    // Redirect them to login page for login routes
    if (routePath !== 'login') {
      router.navigate(['/login']);
      return false; // Prevent access to other routes if not logged in
    }
    return true; // Allow access to login page if no token
  }
};
