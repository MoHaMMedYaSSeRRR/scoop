import { Component, OnInit } from '@angular/core';
import { ProcessingService } from 'src/app/services/processing.service';

@Component({
  selector: 'app-processing-screen-component',
  templateUrl: './processing-screen-component.component.html',
  styleUrls: ['./processing-screen-component.component.scss']
})
export class ProcessingScreenComponentComponent implements OnInit {

  isLoading = false;
  progress = 0;
  remainingTime = 0;
  uploadSpeed = 0;
  downloadSpeed = 0;
  networkSpeed = 0;

  constructor(private processingService: ProcessingService) {}

  ngOnInit() {
  this.processingService.isLoading$.subscribe(val => this.isLoading = val);
  this.processingService.progress$.subscribe(val => this.progress = val);
  this.processingService.remainingTime$.subscribe(val => this.remainingTime = val);
  this.processingService.uploadSpeed$.subscribe(val => this.uploadSpeed = val);
  this.processingService.downloadSpeed$.subscribe(val => this.downloadSpeed = val);
  this.processingService.networkSpeed$.subscribe(val => this.networkSpeed = val);

  // 🟢 تشغيل المحاكاة
  this.processingService.startSpeedSimulation();
}

  getFormattedTime(): string {
    if (this.remainingTime < 60) {
      return `${this.remainingTime} ثانية`;
    } else {
      const minutes = Math.floor(this.remainingTime / 60);
      const seconds = this.remainingTime % 60;
      return `${minutes} دقيقة ${seconds} ثانية`;
    }
  }
}
