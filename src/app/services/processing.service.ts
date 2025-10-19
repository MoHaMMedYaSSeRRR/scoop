import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

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

  private progressSub?: Subscription;

  // ✅ Setter methods (required!)
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

  // ✅ Random speed generator
  private randomInRange(min: number, max: number): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  // ✅ Simulate network speeds
  startSpeedSimulation() {
    interval(1000).subscribe(() => {
      this.setUploadSpeed(this.randomInRange(9, 11));     // MB/s
      this.setDownloadSpeed(this.randomInRange(9, 11));   // MB/s
      this.setNetworkSpeed(this.randomInRange(145, 155)); // Mbps
    });
  }

  // ✅ Start simulated progress
  startProcessing(totalTime: number = 60): Subscription {
    this.setLoading(true);
    this.setProgress(0);
    this.setRemainingTime(totalTime);

    let elapsed = 0;

    // stop any previous progress loop
    this.progressSub?.unsubscribe();

    this.progressSub = interval(1000).subscribe(() => {
      elapsed++;
      const progress = Math.min(100, Math.round((elapsed / totalTime) * 100));
      this.setProgress(progress);
      this.setRemainingTime(totalTime - elapsed);

      if (elapsed >= totalTime) this.stopProcessing();
    });

    return this.progressSub;
  }

  // ✅ Stop progress cleanly
  stopProcessing() {
    this.progressSub?.unsubscribe();
    this.setLoading(false);
    this.setProgress(100);
    this.setRemainingTime(0);
  }
}
