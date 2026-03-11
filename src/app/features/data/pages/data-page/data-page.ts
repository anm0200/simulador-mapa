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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Header } from '../../../../shared/components/header/header';

type FlightPoint = {
  lat: number;
  lng: number;
  altitude: number;
  timestamp: number;
};

type FlightDataItem = {
  id: string;
  firstPointLabel: string;
  lastPointLabel: string;
  observedDurationSeconds: number;
  observedDurationLabel: string;
  firstDetectionTime: number;
  lastDetectionTime: number;
  firstDetectionLabel: string;
  lastDetectionLabel: string;
  minAltitude: number;
  maxAltitude: number;
  avgAltitude: number;
  pointsCount: number;
  totalDistanceKm: number;
  points: FlightPoint[];
};

@Component({
  selector: 'app-data-page',
  standalone: true,
  imports: [CommonModule, Header, FormsModule],
  templateUrl: './data-page.html',
  styleUrl: './data-page.css',
})
export class DataPage implements AfterViewInit, OnDestroy {
  @ViewChild('trajectoryMapContainer')
  private trajectoryMapContainer?: ElementRef<HTMLDivElement>;

  readonly isBrowser: boolean;

  flights: FlightDataItem[] = [];
  isLoading = true;
  loadError = '';
  currentView: 'table' | 'cards' = 'table';
  selectedFlight: FlightDataItem | null = null;
  
  // Variables de Búsqueda y Ordenación
  searchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // KPIs
  kpiLongestFlight: string = '';
  kpiAvgAltitude: string = '';
  kpiMaxPoints: number = 0;
  kpiTotalConsumptionKg: number = 0;

  // Gráfico de Categorías
  flightCategories: { label: string; count: number; percentage: number; color: string }[] = [];

  // Filtros Avanzados
  filterMinDuration: number | null = null;
  filterMaxDuration: number | null = null;
  filterMinAltitude: number | null = null;
  filterMaxAltitude: number | null = null;
  filterMinDistance: number | null = null;
  filterMaxDistance: number | null = null;
  filterMinPoints: number | null = null;
  filterMaxPoints: number | null = null;
  filterStartHour: number | null = null;
  filterEndHour: number | null = null;

  private L: any;
  private modalMap: any;
  private modalBaseRouteLayer: any;
  private modalHighlightRouteLayer: any;
  private modalStartMarker: any;
  private modalEndMarker: any;
  private animationInterval: any;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.loadFlights();
  }

  ngOnDestroy(): void {
    this.destroyModalMap();
  }

  async loadFlights(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading = true;
    this.loadError = '';
    this.cdr.detectChanges();

    try {
      const response = await fetch('/data/iberian_flights_soiei4h.json');

      if (!response.ok) {
        throw new Error(`No se pudo cargar el JSON. Estado HTTP: ${response.status}`);
      }

      const geojson = await response.json();
      const features = Array.isArray(geojson?.features) ? geojson.features : [];

      const parsedFlights: FlightDataItem[] = [];

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];

        if (
          feature?.geometry?.type !== 'LineString' ||
          !Array.isArray(feature?.geometry?.coordinates)
        ) {
          continue;
        }

        const points: FlightPoint[] = feature.geometry.coordinates
          .filter((coord: unknown) => Array.isArray(coord) && coord.length >= 4)
          .map((coord: any) => ({
            lng: Number(coord[0]),
            lat: Number(coord[1]),
            altitude: Number(coord[2]),
            timestamp: Number(coord[3]),
          }))
          .filter(
            (point: FlightPoint) =>
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng) &&
              Number.isFinite(point.altitude) &&
              Number.isFinite(point.timestamp)
          )
          .sort((a: FlightPoint, b: FlightPoint) => a.timestamp - b.timestamp);

        if (points.length < 2) {
          continue;
        }

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        const firstDetectionTime = firstPoint.timestamp;
        const lastDetectionTime = lastPoint.timestamp;
        const observedDurationSeconds = Math.max(
          0,
          lastDetectionTime - firstDetectionTime
        );

        const altitudes = points.map((point) => point.altitude);
        const minAltitude = Math.min(...altitudes);
        const maxAltitude = Math.max(...altitudes);
        const avgAltitude =
          altitudes.reduce((sum, altitude) => sum + altitude, 0) / altitudes.length;

        // Calcular distancia total
        let totalDistanceKm = 0;
        for (let j = 0; j < points.length - 1; j++) {
          totalDistanceKm += this.calculateDistance(points[j], points[j + 1]);
        }

        const properties = feature?.properties ?? {};
        const possibleId =
          properties.callsign ||
          properties.flight_id ||
          properties.flightId ||
          properties.id ||
          properties.icao24 ||
          `flight-${i + 1}`;

        parsedFlights.push({
          id: String(possibleId).trim(),
          firstPointLabel: this.formatPointLabel(firstPoint),
          lastPointLabel: this.formatPointLabel(lastPoint),
          observedDurationSeconds,
          observedDurationLabel: this.formatDuration(observedDurationSeconds),
          firstDetectionTime,
          lastDetectionTime,
          firstDetectionLabel: this.formatDateTime(firstDetectionTime),
          lastDetectionLabel: this.formatDateTime(lastDetectionTime),
          minAltitude,
          maxAltitude,
          avgAltitude,
          pointsCount: points.length,
          totalDistanceKm,
          points,
        });
      }

      this.flights = parsedFlights;

      if (this.flights.length > 0) {
        this.updateDashboardMetrics();
      }

      this.loadError = '';
    } catch (error) {
      console.error('Error cargando vuelos en la página de datos:', error);
      this.flights = [];
      this.loadError = 'No se han podido cargar los datos de vuelos.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get filteredAndSortedFlights(): FlightDataItem[] {
    let result = this.flights;

    // 1. Buscador Inteligente (excluye IDs genéricos si el término no es exacto)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(f => {
        const isGeneric = f.id.toLowerCase().startsWith('flight-') || /^\d+$/.test(f.id);
        // Si el usuario busca algo, intentamos que no sea el ID genérico a menos que coincida exacto
        if (isGeneric && !f.id.toLowerCase().includes(term)) return false;
        return f.id.toLowerCase().includes(term);
      });
    }

    // 2. Filtros de Rango
    if (this.filterMinDuration !== null) {
      result = result.filter(f => f.observedDurationSeconds >= (this.filterMinDuration! * 60));
    }
    if (this.filterMaxDuration !== null) {
      result = result.filter(f => f.observedDurationSeconds <= (this.filterMaxDuration! * 60));
    }
    if (this.filterMinAltitude !== null) {
      result = result.filter(f => f.avgAltitude >= this.filterMinAltitude!);
    }
    if (this.filterMaxAltitude !== null) {
      result = result.filter(f => f.avgAltitude <= this.filterMaxAltitude!);
    }
    if (this.filterMinDistance !== null) {
      result = result.filter(f => f.totalDistanceKm >= this.filterMinDistance!);
    }
    if (this.filterMaxDistance !== null) {
      result = result.filter(f => f.totalDistanceKm <= this.filterMaxDistance!);
    }
    if (this.filterMinPoints !== null) {
      result = result.filter(f => f.pointsCount >= this.filterMinPoints!);
    }
    if (this.filterMaxPoints !== null) {
      result = result.filter(f => f.pointsCount <= this.filterMaxPoints!);
    }
    if (this.filterStartHour !== null || this.filterEndHour !== null) {
      result = result.filter(f => {
        const hour = new Date(f.firstDetectionTime * 1000).getHours();
        const start = this.filterStartHour ?? 0;
        const end = this.filterEndHour ?? 23;
        return hour >= start && hour <= end;
      });
    }

    // 3. Ordenación
    if (this.sortColumn) {
      result = [...result].sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (this.sortColumn) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'duration': valA = a.observedDurationSeconds; valB = b.observedDurationSeconds; break;
          case 'maxAltitude': valA = a.maxAltitude; valB = b.maxAltitude; break;
          case 'pointsCount': valA = a.pointsCount; valB = b.pointsCount; break;
          case 'distance': valA = a.totalDistanceKm; valB = b.totalDistanceKm; break;
          default: return 0;
        }

        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }

  updateDashboardMetrics(): void {
    const currentFlights = this.filteredAndSortedFlights;
    if (currentFlights.length === 0) {
      this.flightCategories = [];
      this.kpiTotalConsumptionKg = 0;
      return;
    }

    let maxDuration = 0;
    let totalAltitude = 0;
    let countAltitude = 0;
    let maxPoints = 0;
    let totalSeconds = 0;

    let corto = 0;
    let medio = 0;
    let largo = 0;

    for (const f of currentFlights) {
      if (f.observedDurationSeconds > maxDuration) maxDuration = f.observedDurationSeconds;
      if (f.avgAltitude > 0) {
        totalAltitude += f.avgAltitude;
        countAltitude++;
      }
      if (f.pointsCount > maxPoints) maxPoints = f.pointsCount;
      totalSeconds += f.observedDurationSeconds;

      const mins = f.observedDurationSeconds / 60;
      if (mins < 45) corto++;
      else if (mins < 90) medio++;
      else largo++;
    }

    this.kpiLongestFlight = this.formatDuration(maxDuration);
    this.kpiAvgAltitude = countAltitude > 0 ? this.formatAltitude(totalAltitude / countAltitude) : '0 m';
    this.kpiMaxPoints = maxPoints;
    
    // Consumo estimado: 15kg/min aprox para un avión comercial tipo A320
    this.kpiTotalConsumptionKg = Math.round((totalSeconds / 60) * 15);

    const total = currentFlights.length;
    this.flightCategories = [
      { label: 'Corto (<45m)', count: corto, percentage: (corto / total) * 100, color: '#3b82f6' },
      { label: 'Medio (45-90m)', count: medio, percentage: (medio / total) * 100, color: '#8b5cf6' },
      { label: 'Largo (>90m)', count: largo, percentage: (largo / total) * 100, color: '#ec4899' }
    ];

    this.cdr.detectChanges();
  }

  // Helper para recalcular métricas cuando cambian filtros
  onFilterChange(): void {
    this.updateDashboardMetrics();
  }

  private calculateDistance(p1: FlightPoint, p2: FlightPoint): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.updateDashboardMetrics();
    this.cdr.detectChanges();
  }

  setView(view: 'table' | 'cards'): void {
    this.currentView = view;
    this.cdr.detectChanges();
  }

  async openTrajectoryModal(flight: FlightDataItem): Promise<void> {
    this.selectedFlight = flight;
    this.cdr.detectChanges();

    if (!this.isBrowser) {
      return;
    }

    if (!this.L) {
      this.L = await import('leaflet');
    }

    setTimeout(() => {
      this.renderModalMap(flight);
    }, 80);
  }

  closeTrajectoryModal(): void {
    this.selectedFlight = null;
    this.destroyModalMap();
    this.cdr.detectChanges();
  }

  private renderModalMap(flight: FlightDataItem): void {
    if (!this.trajectoryMapContainer?.nativeElement || !this.L) {
      return;
    }

    this.destroyModalMap();

    this.modalMap = this.L.map(this.trajectoryMapContainer.nativeElement, {
      center: [40.0, -3.5],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.modalMap);

    const fullRouteLatLngs = flight.points.map((point) => [point.lat, point.lng]);

    this.modalBaseRouteLayer = this.L.polyline(fullRouteLatLngs, {
      color: '#94a3b8',
      weight: 2,
      opacity: 0.28,
    }).addTo(this.modalMap);

    this.modalHighlightRouteLayer = this.L.polyline([], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.95,
    }).addTo(this.modalMap);

    const airplaneIcon = this.L.divIcon({
      html: '<div style="font-size: 18px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">✈️</div>',
      className: 'airplane-icon-css',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    // El avión que se moverá frame a frame, lo añadimos en la primera lat long
    const movingMarker = this.L.marker(fullRouteLatLngs[0], { 
      icon: airplaneIcon,
      zIndexOffset: 1000
    }).addTo(this.modalMap);

    let currentPointIndex = 0;
    // Ajustar velocidad para que todos los vuelos tarden aproximadamente 1.5 - 2 seg en dibujarse enteros
    const speedMs = Math.max(15, Math.floor(1500 / fullRouteLatLngs.length)); 

    this.animationInterval = setInterval(() => {
      if (!this.modalMap) {
        clearInterval(this.animationInterval);
        return;
      }
      
      if (currentPointIndex >= fullRouteLatLngs.length) {
        clearInterval(this.animationInterval);
        return;
      }
      
      const point = fullRouteLatLngs[currentPointIndex];
      this.modalHighlightRouteLayer.addLatLng(point);
      movingMarker.setLatLng(point);
      
      currentPointIndex++;
    }, speedMs);

    const firstPoint = flight.points[0];
    const lastPoint = flight.points[flight.points.length - 1];

    this.modalStartMarker = this.L.circleMarker([firstPoint.lat, firstPoint.lng], {
      radius: 7,
      color: '#15803d',
      weight: 2,
      fillColor: '#22c55e',
      fillOpacity: 1,
    })
      .addTo(this.modalMap)
      .bindTooltip('Inicio', {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'flight-point-tooltip',
      });

    this.modalEndMarker = this.L.circleMarker([lastPoint.lat, lastPoint.lng], {
      radius: 7,
      color: '#b91c1c',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 1,
    })
      .addTo(this.modalMap)
      .bindTooltip('Fin', {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'flight-point-tooltip',
      });

    const group = this.L.featureGroup([
      this.modalBaseRouteLayer,
      this.modalHighlightRouteLayer,
      this.modalStartMarker,
      this.modalEndMarker,
    ]);

    const bounds = group.getBounds();
    if (bounds?.isValid?.()) {
      this.modalMap.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => {
      this.modalMap?.invalidateSize(true);

      const updatedBounds = group.getBounds();
      if (updatedBounds?.isValid?.()) {
        this.modalMap.fitBounds(updatedBounds, { padding: [30, 30] });
      }
    }, 250);

    setTimeout(() => {
      this.modalMap?.invalidateSize(true);
    }, 500);
  }

  private destroyModalMap(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    if (this.modalMap) {
      this.modalMap.remove();
      this.modalMap = null;
    }

    this.modalBaseRouteLayer = null;
    this.modalHighlightRouteLayer = null;
    this.modalStartMarker = null;
    this.modalEndMarker = null;
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, '0'))
      .join(':');
  }

  private formatDateTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString('es-ES', {
      hour12: false,
    });
  }

  private formatPointLabel(point: FlightPoint): string {
    return `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}`;
  }

  formatAltitude(value: number): string {
    return `${Math.round(value)} m`;
  }

  trackByFlightId(index: number, flight: FlightDataItem): string {
    return `${flight.id}-${index}`;
  }
}