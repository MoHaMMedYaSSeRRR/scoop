import { Component } from '@angular/core';

@Component({
  selector: 'app-testss',
  templateUrl: './testss.component.html',
  styleUrls: ['./testss.component.scss'],
})
export class TestssComponent {
  openTab: string | null = null;
  selectedOrientation: string = '';

  toggleTab(tab: string) {
    this.openTab = this.openTab === tab ? null : tab;
    this.selectedOrientation = ''; // Reset orientation each time
  }

  selectOrientation(type: string) {
    this.selectedOrientation = type;
  }

  confirm(tab: string) {
    // Handle data submission here if needed
    this.openTab = null; // Close current tab
    this.selectedOrientation = '';
  }
}
