import { 
  Component, 
  ElementRef, 
  ViewChild, 
  Inject, 
  PLATFORM_ID, 
  AfterViewInit, 
  OnDestroy,
  Output,
  EventEmitter
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GraphService, GraphData, Node, Edge } from '../../services/graph.service';

@Component({
  selector: 'app-algorithm-map',
  standalone: true,
  templateUrl: './algorithm-map.html',
  styleUrl: './algorithm-map.css'
})
export class AlgorithmMap implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainerRef!: ElementRef<HTMLDivElement>;

  @Output() simulationFinished = new EventEmitter<{ 
    distance: number, 
    visitedCount: number,
    path: Edge[]
  }>();
  @Output() kruskalFinished = new EventEmitter<{ 
    totalWeight: number, 
    edgeCount: number,
    mstEdges: Edge[],
    mstPath: Edge[],
    mstPathWeight: number
  }>();
  @Output() graphLoaded = new EventEmitter<GraphData>();

  private map: any;
  private L: any;
  private isBrowser: boolean;

  private graphData: GraphData | null = null;
  private nodeMarkers: Map<string, any> = new Map();
  private edgeLines: any[] = [];
  
  private selectedStartNode: string | null = null;
  private selectedEndNode: string | null = null;

  // Animación Dijkstra
  private animationTimeouts: any[] = [];
  private explorationLayers: any[] = [];
  private pathLayer: any = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(GraphService) private graphService: GraphService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
    this.L = await import('leaflet');
    this.initMap();
    await this.loadGraph();
  }

  ngOnDestroy(): void {
    this.clearAnimation();
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    this.map = this.L.map(this.mapContainerRef.nativeElement, {
      center: [40.0, -3.5],
      zoom: 6,
      zoomControl: true
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(this.map);
  }

  public async loadGraph(radiusKm: number = 50): Promise<void> {
    if (this.map) {
      this.clearAlgorithmResults();
      for (const line of this.edgeLines) this.map.removeLayer(line);
      this.nodeMarkers.forEach(marker => this.map.removeLayer(marker));
      this.nodeMarkers.clear();
      this.edgeLines = [];
    }
  
    this.graphData = await this.graphService.loadGraphFromRealData(radiusKm);
    this.graphLoaded.emit(this.graphData);
    this.renderGraph();
  }

  private renderGraph(): void {
    if (!this.graphData || !this.map || !this.L) return;

    const bounds = this.L.latLngBounds([]);

    // Dibujar aristas (Rutas de Vuelo Base)
    // Para no saturar el mapa, podemos dibujar solo en un tono muy sutil
    const renderedEdges = new Set<string>();

    for (const edge of this.graphData.edges) {
      // Evitar pintar A->B y B->A dos veces si comparten trazo
      const edgeKey = [edge.sourceId, edge.targetId].sort().join('-');
      if (renderedEdges.has(edgeKey)) continue;
      renderedEdges.add(edgeKey);

      if (edge.path) {
        const latlngs = edge.path.map((p: any) => [p.lat, p.lng]);
        
        let polyline: any;
        if (edge.type === 'flight') {
          // Vuelo real (Gris sólido)
          polyline = this.L.polyline(latlngs, {
            color: '#64748b', 
            weight: 4,        
            opacity: 0.6      
          }).addTo(this.map);
        } else {
          // Transbordo (Gris claro punteado)
          polyline = this.L.polyline(latlngs, {
            color: '#94a3b8', 
            weight: 2,        
            opacity: 0.3,
            dashArray: '4, 6'
          }).addTo(this.map);
        }
        
        this.edgeLines.push(polyline);
      }
    }

    // Dibujar nodos (Puntos de inicio y fin)
    for (const node of this.graphData.nodes) {
      bounds.extend([node.lat, node.lng]);
      
      const marker = this.L.circleMarker([node.lat, node.lng], {
        radius: 5,
        fillColor: '#3b82f6', // blue-500
        color: '#1e3a8a',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      marker.bindTooltip(`Nodo: ${node.lat.toFixed(2)}, ${node.lng.toFixed(2)}`);
      
      marker.on('click', () => this.onNodeClick(node.id));
      
      this.nodeMarkers.set(node.id, marker);
    }

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private onNodeClick(nodeId: string): void {
    if (this.animationTimeouts.length > 0) return; // Si está animando, bloquear

    const marker = this.nodeMarkers.get(nodeId);
    
    // Si ya está seleccionado, lo desseleccionamos
    if (this.selectedStartNode === nodeId) {
      this.selectedStartNode = null;
      marker.setStyle({ fillColor: '#3b82f6', radius: 5 }); // Reset a azul
      return;
    }
    
    if (this.selectedEndNode === nodeId) {
      this.selectedEndNode = null;
      marker.setStyle({ fillColor: '#3b82f6', radius: 5 }); // Reset a azul
      return;
    }

    // Selección nueva
    if (!this.selectedStartNode) {
      this.selectedStartNode = nodeId;
      marker.setStyle({ fillColor: '#22c55e', radius: 8 }); // Origen en Verde
    } else if (!this.selectedEndNode) {
      this.selectedEndNode = nodeId;
      marker.setStyle({ fillColor: '#ef4444', radius: 8 }); // Destino en Rojo
    } else {
      // Si ya hay 2, reseteamos el origen y ponemos el nuevo como origen
      const oldStartMarker = this.nodeMarkers.get(this.selectedStartNode);
      if (oldStartMarker) oldStartMarker.setStyle({ fillColor: '#3b82f6', radius: 5 });
      
      this.selectedStartNode = nodeId;
      marker.setStyle({ fillColor: '#22c55e', radius: 8 });
      
      // Reseteamos rutas anteriores al hacer nueva selección completa
      this.clearAlgorithmResults();
    }
  }

  public runDijkstra(): void {
    if (!this.selectedStartNode || !this.selectedEndNode) {
      console.warn('Selecciona origen y destino primero');
      return;
    }

    this.clearAnimation();
    this.clearAlgorithmResults();

    const result = this.graphService.runDijkstra(this.selectedStartNode, this.selectedEndNode);

    if (result.distance === Infinity) {
      alert('No hay ruta posible entre estos puntos en los datos actuales.');
      return;
    }

    this.animateExploration(result);
  }

  public runKruskal(): void {
    if (!this.graphData || this.graphData.nodes.length === 0) return;

    this.clearAnimation();
    this.clearAlgorithmResults();

    const result = this.graphService.runKruskal();
    this.animateKruskal(result);
  }

  private animateKruskal(result: any): void {
    const { mstEdges, totalWeight, edgeProcessOrder } = result;
    const ANIMATION_SPEED_MS = 20; // Más rápido porque hay muchas aristas

    // Animamos las aristas que forman parte del MST final
    for (let i = 0; i < mstEdges.length; i++) {
      const edge = mstEdges[i];

      const timeout = setTimeout(() => {
        if (edge.path) {
          const latlngs = edge.path.map((p: any) => [p.lat, p.lng]);
          
          let color = '#8b5cf6'; // violet-500 para vuelos en MST
          let dashArray = '';
          
          if (edge.type === 'transfer') {
            color = '#c4b5fd'; // violet aclarado para transbordos MST
            dashArray = '5, 5';
          }

          const mstLayer = this.L.polyline(latlngs, {
            color: color,
            weight: 4,
            opacity: 0.9,
            dashArray: dashArray
          }).addTo(this.map);
          
          this.explorationLayers.push(mstLayer);
        }
      }, i * ANIMATION_SPEED_MS);
      this.animationTimeouts.push(timeout);
    }

    // Al finalizar
    const finalTimeout = setTimeout(() => {
      
      let mstPath: Edge[] = [];
      let mstPathWeight = 0;
      
      // Si el usuario seleccionó un origen y destino, calculamos el camino que los une por dentro del MST
      if (this.selectedStartNode && this.selectedEndNode) {
        mstPath = this.graphService.findPathInMST(this.selectedStartNode, this.selectedEndNode, mstEdges);
        mstPathWeight = mstPath.reduce((acc, edge) => acc + edge.weight, 0);
        
        // Lo dibujamos llamando al mismo método que usa Dijkstra
        this.drawShortestPath(mstPath);
      }

      this.kruskalFinished.emit({ 
        totalWeight, 
        edgeCount: mstEdges.length,
        mstEdges,
        mstPath,
        mstPathWeight
      });
    }, mstEdges.length * ANIMATION_SPEED_MS);
    
    this.animationTimeouts.push(finalTimeout);
  }

  private animateExploration(result: any): void {
    const { visitedOrder, shortestPath, pathMap, distance } = result;
    const ANIMATION_SPEED_MS = 50; // milisegundos por paso

    // Animamos los nodos visitados
    for (let i = 0; i < visitedOrder.length; i++) {
      const nodeId = visitedOrder[i];
      // Ignorar origen y destino para que no pierdan su color
      if (nodeId === this.selectedStartNode || nodeId === this.selectedEndNode) continue;

      const timeout = setTimeout(() => {
        const marker = this.nodeMarkers.get(nodeId);
        if (marker) {
          marker.setStyle({ fillColor: '#f59e0b' }); // Naranja para explorado
        }
        
        // Dibujamos la arista por la que llegamos a este nodo en la exploración
        const edgeToReach = pathMap.get(nodeId);
        if (edgeToReach && edgeToReach.path) {
          const latlngs = edgeToReach.path.map((p: any) => [p.lat, p.lng]);
          const expLayer = this.L.polyline(latlngs, {
            color: '#fcd34d', // amarillo claro
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5'
          }).addTo(this.map);
          this.explorationLayers.push(expLayer);
        }

      }, i * ANIMATION_SPEED_MS);
      this.animationTimeouts.push(timeout);
    }

    // Al finalizar la exploración, dibujamos la ruta final
    const finalTimeout = setTimeout(() => {
      this.drawShortestPath(shortestPath);
      this.simulationFinished.emit({ 
        distance, 
        visitedCount: visitedOrder.length,
        path: shortestPath
      });
    }, visitedOrder.length * ANIMATION_SPEED_MS);
    
    this.animationTimeouts.push(finalTimeout);
  }

  private drawShortestPath(shortestPath: Edge[]): void {
    const layers: any[] = [];
    
    // Iterar sobre cada arista del camino mínimo para aplicarle su estilo
    for (const edge of shortestPath) {
      if (edge.path) {
        const latlngs = edge.path.map((p: any) => [p.lat, p.lng]);
        
        let polyline: any;
        if (edge.type === 'flight') {
          // Vuelo: Trazo continuo verde
          polyline = this.L.polyline(latlngs, {
            color: '#10b981', // emerald-500
            weight: 5,
            opacity: 0.9,
          });
        } else {
          // Transbordo: Trazo punteado/con guiones verde
          polyline = this.L.polyline(latlngs, {
            color: '#10b981', 
            weight: 5,
            opacity: 0.9,
            dashArray: '8, 10' // Punteado para diferenciarlos
          });
        }
        layers.push(polyline);
      }
    }

    if (layers.length > 0) {
      // Agrupamos las líneas en un FeatureGroup para mandarlas al mapa de golpe
      this.pathLayer = this.L.featureGroup(layers).addTo(this.map);
      
      // Animamos el zoom hacia toda la ruta completa
      this.map.fitBounds(this.pathLayer.getBounds(), { padding: [50, 50], animate: true });
    }
  }

  public resetSelection(): void {
    this.clearAnimation();
    this.clearAlgorithmResults();
    
    if (this.selectedStartNode) {
      const marker = this.nodeMarkers.get(this.selectedStartNode);
      if (marker) marker.setStyle({ fillColor: '#3b82f6', radius: 5 });
      this.selectedStartNode = null;
    }
    
    if (this.selectedEndNode) {
      const marker = this.nodeMarkers.get(this.selectedEndNode);
      if (marker) marker.setStyle({ fillColor: '#3b82f6', radius: 5 });
      this.selectedEndNode = null;
    }
  }

  private clearAnimation(): void {
    for (const timeout of this.animationTimeouts) {
      clearTimeout(timeout);
    }
    this.animationTimeouts = [];
  }

  private clearAlgorithmResults(): void {
    // Resetear colores explorados
    this.nodeMarkers.forEach((marker, id) => {
      if (id !== this.selectedStartNode && id !== this.selectedEndNode) {
        marker.setStyle({ fillColor: '#3b82f6', radius: 5 });
      }
    });

    // Limpiar lineas exploradas
    for (const layer of this.explorationLayers) {
      this.map?.removeLayer(layer);
    }
    this.explorationLayers = [];

    // Limpiar ruta final
    if (this.pathLayer) {
      this.map?.removeLayer(this.pathLayer);
      this.pathLayer = null;
    }
  }
}
