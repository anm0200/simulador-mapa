import { setupTestEnvironment } from '../../../../test-setup';
setupTestEnvironment();
import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';

describe('GraphService', () => {
  let service: GraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Restricted Zones', () => {
    it('should identify and correct a path that crosses a restricted zone', () => {
      // Ruta recta de (40, -4) a (40, -2)
      const path = [
        { lat: 40, lng: -4 },
        { lat: 40, lng: -2 },
      ];

      // Zona en el medio (40, -3) con radio de 50km
      const zone = {
        id: 'test-zone',
        center: { lat: 40, lng: -3 },
        radius: 50,
      };

      // @ts-ignore - Acceder a método privado para el test
      const corrected = service.correctPathForZone(path, zone);

      expect(corrected).not.toBeNull();
      if (corrected) {
        expect(corrected.length).toBeGreaterThan(2);
        // El punto medio debe estar fuera de la zona (o al menos desplazado)
        const mid = corrected[1];
        // @ts-ignore
        const distToCenter = service.calculateDistance(mid.lat, mid.lng, zone.center.lat, zone.center.lng);
        expect(distToCenter).toBeGreaterThanOrEqual(zone.radius);
      }
    });

    it('should NOT correct a path that is far from the restricted zone', () => {
      const path = [
        { lat: 42, lng: -4 },
        { lat: 42, lng: -2 },
      ];

      const zone = {
        id: 'test-zone',
        center: { lat: 40, lng: -3 },
        radius: 50,
      };

      // @ts-ignore
      const corrected = service.correctPathForZone(path, zone);
      expect(corrected).toBeNull();
    });
  });
});
