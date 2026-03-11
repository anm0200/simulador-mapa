import { Component } from '@angular/core';
import { Header } from '../../../../shared/components/header/header';
import { MapCanvas } from '../../../map-view/components/map-canvas/map-canvas';

@Component({
  selector: 'app-home-page',
  imports: [Header, MapCanvas],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {}