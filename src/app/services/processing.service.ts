import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, takeWhile } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProcessingService {
  private isLoadingSource = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSource.asObservable();

  private progressSource = new BehaviorSubject<number>(0);
  progress$ = this.progressSource.asObservable();

  private remainingTimeSource = new BehaviorSubject<number>(0);
  remainingTime$ = this.remainingTimeSource.asObservable();

  private uploadSpeedSource = new BehaviorSubject<number>(0);
  uploadSpeed$ = this.uploadSpeedSource.asObservable();

  private downloadSpeedSource = new BehaviorSubject<number>(0);
  downloadSpeed$ = this.downloadSpeedSource.asObservable();

  private networkSpeedSource = new BehaviorSubject<number>(0);
  networkSpeed$ = this.networkSpeedSource.asObservable();

  setLoading(state: boolean) {
    this.isLoadingSource.next(state);
  }

  setProgress(value: number) {
    this.progressSource.next(value);
  }

  setRemainingTime(value: number) {
    this.remainingTimeSource.next(value);
  }

  setUploadSpeed(upload: number) {
    this.uploadSpeedSource.next(upload);
  }

  setDownloadSpeed(download: number) {
    this.downloadSpeedSource.next(download);
  }

  setNetworkSpeed(network: number) {
    this.networkSpeedSource.next(network);
  }

  // 🟢 محاكاة السرعات العشوائية
  startSpeedSimulation() {
    interval(1000).subscribe(() => {
      const upload = this.randomInRange(9, 11);     // MB/s
      const download = this.randomInRange(9, 11);   // MB/s
      const network = this.randomInRange(145, 155); // Mbps

      this.setUploadSpeed(upload);
      this.setDownloadSpeed(download);
      this.setNetworkSpeed(network);
    });
  }

  private randomInRange(min: number, max: number): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  startProcessing(totalTime: number = 20) {
    this.setLoading(true);
    this.setProgress(0);
    this.setRemainingTime(totalTime);

    let elapsed = 0;
    const tick = 1000;

    interval(tick)
      .pipe(takeWhile(() => elapsed < totalTime))
      .subscribe(() => {
        elapsed++;
        const progress = Math.min(100, Math.round((elapsed / totalTime) * 100));
        this.setProgress(progress);
        this.setRemainingTime(totalTime - elapsed);

        if (progress === 100) {
          this.setLoading(false);
        }
      });
  }
}
