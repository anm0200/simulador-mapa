import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type FlightPoint = {
  lat: number;
  lng: number;
  altitude: number;
  timestamp: number;
};

type FlightTrack = {
  id: string;
  points: FlightPoint[];
  startTime: number;
  endTime: number;
  fullRouteLayer: any;
  progressLayer: any;
  planeMarker: any;
};

@Component({
  selector: 'app-map-canvas',
  imports: [],
  templateUrl: './map-canvas.html',
  styleUrl: './map-canvas.css',
})
export class MapCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainerRef!: ElementRef<HTMLDivElement>;

  isPlaying = true;

  formattedSimulationTime = '--:--:--';
  simulationProgress = 0;

  activeFlightsCount = 0;
  totalFlightsCount = 0;
  loopCount = 1;

  speedOptions = [1, 2, 5, 10, 30, 60, 120];
  speedMultiplier = 60;

  private readonly isBrowser: boolean;
  private readonly planeRotationOffset = -90;

  private map: any;
  private L: any;

  private flights: FlightTrack[] = [];

  private animationFrameId: number | null = null;
  private lastFrameTime = 0;

  private simulationStart = 0;
  private simulationEnd = 0;
  private simulationCurrent = 0;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    this.L = await import('leaflet');
    this.initMap();
    await this.loadAllFlights();
    this.startAnimation();
  }

  ngOnDestroy(): void {
    this.stopAnimation();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    this.map = this.L.map(this.mapContainerRef.nativeElement, {
      center: [40.0, -3.5],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);
  }

  private async loadAllFlights(): Promise<void> {
    try {
      const response = await fetch('/data/iberian_flights_soiei4h.json');
      const geojson = await response.json();

      const features = geojson?.features ?? [];
      const collectedFlights: FlightTrack[] = [];

      let globalMinTime = Number.POSITIVE_INFINITY;
      let globalMaxTime = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];

        if (
          feature?.geometry?.type !== 'LineString' ||
          !Array.isArray(feature?.geometry?.coordinates)
        ) {
          continue;
        }

        const points: FlightPoint[] = feature.geometry.coordinates
          .filter((coord: any) => Array.isArray(coord) && coord.length >= 4)
          .map((coord: any) => ({
            lng: coord[0],
            lat: coord[1],
            altitude: coord[2],
            timestamp: coord[3],
          }))
          .sort((a: FlightPoint, b: FlightPoint) => a.timestamp - b.timestamp);

        if (points.length < 2) {
          continue;
        }

        const startTime = points[0].timestamp;
        const endTime = points[points.length - 1].timestamp;

        globalMinTime = Math.min(globalMinTime, startTime);
        globalMaxTime = Math.max(globalMaxTime, endTime);

        const fullRouteLatLngs = points.map((p) => [p.lat, p.lng]);

        const fullRouteLayer = this.L.polyline(fullRouteLatLngs, {
          color: '#94a3b8',
          weight: 2,
          opacity: 0.28,
        }).addTo(this.map);

        const progressLayer = this.L.polyline([], {
          color: '#2563eb',
          weight: 4,
          opacity: 0.95,
        }).addTo(this.map);

        const planeIcon = this.L.divIcon({
          className: 'plane-marker',
          html: '<div class="plane-marker__icon">✈</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const planeMarker = this.L.marker([points[0].lat, points[0].lng], {
          icon: planeIcon,
          opacity: 0,
        }).addTo(this.map);

        collectedFlights.push({
          id: `flight-${i}`,
          points,
          startTime,
          endTime,
          fullRouteLayer,
          progressLayer,
          planeMarker,
        });
      }

      this.flights = collectedFlights;
      this.totalFlightsCount = this.flights.length;

      if (!this.flights.length) {
        console.error('No se ha podido cargar ningún vuelo válido.');
        return;
      }

      this.simulationStart = globalMinTime;
      this.simulationEnd = globalMaxTime;
      this.simulationCurrent = this.simulationStart;

      const allBounds = this.L.featureGroup(
        this.flights.map((f) => f.fullRouteLayer)
      ).getBounds();

      if (allBounds.isValid()) {
        this.map.fitBounds(allBounds, { padding: [30, 30] });
      }

      this.updateAllFlights();
      this.updateSimulationInfo();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error cargando todos los vuelos:', error);
    }
  }

  private startAnimation(): void {
    this.stopAnimation();
    this.lastFrameTime = performance.now();

    const animate = (now: number) => {
      if (!this.flights.length) {
        this.animationFrameId = requestAnimationFrame(animate);
        return;
      }

      if (!this.isPlaying) {
        this.lastFrameTime = now;
        this.animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.simulationCurrent += (deltaMs / 1000) * this.speedMultiplier;

      if (this.simulationCurrent > this.simulationEnd) {
        this.simulationCurrent = this.simulationStart;
        this.loopCount += 1;
      }

      this.updateAllFlights();
      this.updateSimulationInfo();
      this.cdr.detectChanges();

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateAllFlights(): void {
    let activeCount = 0;

    for (const flight of this.flights) {
      if (this.simulationCurrent < flight.startTime) {
        flight.progressLayer.setLatLngs([]);
        flight.progressLayer.setStyle({
          color: '#2563eb',
          opacity: 0,
          weight: 4,
        });

        flight.fullRouteLayer.setStyle({
          color: '#94a3b8',
          opacity: 0.1,
          weight: 2,
        });

        flight.planeMarker.setOpacity(0);
        continue;
      }

      if (this.simulationCurrent > flight.endTime) {
        const fullLatLngs = flight.points.map((p) => [p.lat, p.lng]);

        flight.progressLayer.setLatLngs(fullLatLngs);
        flight.progressLayer.setStyle({
          color: '#2563eb',
          opacity: 0.18,
          weight: 3,
        });

        flight.fullRouteLayer.setStyle({
          color: '#94a3b8',
          opacity: 0.08,
          weight: 2,
        });

        flight.planeMarker.setOpacity(0);
        continue;
      }

      activeCount += 1;

      flight.fullRouteLayer.setStyle({
        color: '#94a3b8',
        opacity: 0.2,
        weight: 2,
      });

      const segmentIndex = this.findSegmentIndex(
        flight.points,
        this.simulationCurrent
      );

      const pointA = flight.points[segmentIndex];
      const pointB = flight.points[Math.min(segmentIndex + 1, flight.points.length - 1)];

      const duration = pointB.timestamp - pointA.timestamp;
      const ratio =
        duration <= 0 ? 0 : (this.simulationCurrent - pointA.timestamp) / duration;

      const currentLat = pointA.lat + (pointB.lat - pointA.lat) * ratio;
      const currentLng = pointA.lng + (pointB.lng - pointA.lng) * ratio;

      const travelled = flight.points
        .slice(0, segmentIndex + 1)
        .map((p) => [p.lat, p.lng]);

      travelled.push([currentLat, currentLng]);

      flight.progressLayer.setLatLngs(travelled);
      flight.progressLayer.setStyle({
        color: '#2563eb',
        opacity: 0.95,
        weight: 4,
      });

      flight.planeMarker.setLatLng([currentLat, currentLng]);
      flight.planeMarker.setOpacity(1);

      const bearing = this.getBearingDegrees(
        pointA.lat,
        pointA.lng,
        pointB.lat,
        pointB.lng
      );

      this.setPlaneRotation(flight.planeMarker, bearing);
    }

    this.activeFlightsCount = activeCount;
  }

  private findSegmentIndex(points: FlightPoint[], currentTime: number): number {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      if (currentTime >= a.timestamp && currentTime <= b.timestamp) {
        return i;
      }
    }

    return Math.max(0, points.length - 2);
  }

  private getBearingDegrees(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const toDeg = (value: number) => (value * 180) / Math.PI;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const lambda1 = toRad(lon1);
    const lambda2 = toRad(lon2);

    const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  private setPlaneRotation(marker: any, angleDeg: number): void {
    const element = marker.getElement();
    if (!element) {
      return;
    }

    const icon = element.querySelector('.plane-marker__icon') as HTMLElement | null;
    if (!icon) {
      return;
    }

    icon.style.transform = `rotate(${angleDeg + this.planeRotationOffset}deg)`;
  }

  private updateSimulationInfo(): void {
    if (!this.flights.length || !this.simulationStart || !this.simulationEnd) {
      this.formattedSimulationTime = '--:--:--';
      this.simulationProgress = 0;
      return;
    }

    const totalDuration = this.simulationEnd - this.simulationStart;
    const elapsed = this.simulationCurrent - this.simulationStart;

    const date = new Date(this.simulationCurrent * 1000);
    this.formattedSimulationTime = date.toLocaleString('es-ES', {
      hour12: false,
    });

    this.simulationProgress =
      totalDuration <= 0
        ? 0
        : Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));
  }

  togglePlayback(): void {
    this.isPlaying = !this.isPlaying;
    this.lastFrameTime = performance.now();
    this.cdr.detectChanges();
  }

  restartSimulation(): void {
    if (!this.flights.length) {
      return;
    }

    this.simulationCurrent = this.simulationStart;
    this.loopCount = 1;
    this.updateAllFlights();
    this.updateSimulationInfo();
    this.lastFrameTime = performance.now();
    this.cdr.detectChanges();
  }

  changeSpeed(value: string): void {
    const parsed = Number(value);

    if (!Number.isNaN(parsed) && parsed > 0) {
      this.speedMultiplier = parsed;
      this.cdr.detectChanges();
    }
  }
}