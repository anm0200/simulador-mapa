import { Component, ViewChild } from '@angular/core';
import { Header } from '../../../../shared/components/header/header';
import { AlgorithmMap } from '../../components/algorithm-map/algorithm-map';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-methods-page',
  standalone: true,
  imports: [Header, AlgorithmMap, CommonModule, FormsModule],
  templateUrl: './methods-page.html',
  styleUrl: './methods-page.css',
})
export class MethodsPage {
  @ViewChild(AlgorithmMap) algorithmMap!: AlgorithmMap;
  public restrictionsModeActive = false;
  public restrictionRadius = 100;

  public rallySelectionActive = false;

  public activeMethod = 'none';
  public isGraphLoaded = false;

  public dijkstraDistance: number | null = null;
  public dijkstraVisitedCount: number | null = null;
  public pathDetails: any[] = [];
  public estimatedTimeHours: number | null = null;

  public kruskalTotalWeight: number | null = null;
  public kruskalEdgeCount: number | null = null;
  public kruskalPathWeight: number | null = null;
  public kruskalPathDetails: any[] = [];
  public kruskalEdgesDetails: any[] = [];

  // Pruebas para A* (similares a Dijkstra)
  public aStarDistance: number | null = null;
  public aStarVisitedCount: number | null = null;
  public aStarPathDetails: any[] = [];
  public aStarEstimatedTime: number | null = null;

  public methodExplanations: Record<string, { title: string; logic: string; usage: string }> = {
    dijkstra: {
      title: 'Algoritmo de Dijkstra',
      logic: 'Explora todos los caminos posibles desde el origen, expandiéndose en círculos concéntricos hasta encontrar el destino. Garantiza siempre el camino más corto.',
      usage: 'Ideal cuando necesitas precisión matemática absoluta y no tienes una pista de hacia dónde está el objetivo.',
    },
    aStar: {
      title: 'Algoritmo A* (A-Estrella)',
      logic: 'Es un "Dijkstra con brújula". Además de la distancia recorrida, usa una función heurística (distancia en línea recta al destino) para priorizar por dónde seguir buscando.',
      usage: 'Mucho más rápido que Dijkstra en mapas reales. Es el estándar en navegación GPS y videojuegos.',
    },
    kruskal: {
      title: 'Algoritmo de Kruskal',
      logic: 'No busca un camino entre dos puntos, sino que conecta TODOS los puntos del mapa con el mínimo coste total de infraestructura, evitando ciclos.',
      usage: 'Perfecto para diseñar redes eléctricas, de fibra óptica o tuberías de suministro con el mínimo material.',
    },
  };

  public totalNodes: number = 0;
  public totalEdges: number = 0;
  public currentRadius: number = 50;

  onGraphLoaded(graph: any) {
    this.isGraphLoaded = true;
    this.totalNodes = graph.nodes.length;
    this.totalEdges = graph.edges.length;
  }

  setMethod(methodKey: string) {
    this.activeMethod = methodKey;
    if (methodKey !== 'dijkstra') {
      this.resetDijkstra();
    }
    if (methodKey !== 'aStar') {
      this.resetAStar();
    }
    if (methodKey !== 'kruskal') {
      this.resetKruskal();
    }
  }

  rebuildGraph() {
    this.resetDijkstra();
    this.resetKruskal();
    this.isGraphLoaded = false;
    this.algorithmMap?.loadGraph(this.currentRadius);
  }

  runDijkstra() {
    this.dijkstraDistance = null;
    this.dijkstraVisitedCount = null;
    this.pathDetails = [];
    this.estimatedTimeHours = null;
    this.algorithmMap?.runDijkstra();
  }

  resetDijkstra() {
    this.dijkstraDistance = null;
    this.dijkstraVisitedCount = null;
    this.pathDetails = [];
    this.estimatedTimeHours = null;
    this.algorithmMap?.resetSelection();
  }

  runKruskal() {
    this.kruskalTotalWeight = null;
    this.kruskalEdgeCount = null;
    this.kruskalPathWeight = null;
    this.kruskalPathDetails = [];
    this.kruskalEdgesDetails = [];
    this.algorithmMap?.runKruskal();
  }

  runAStar() {
    this.aStarDistance = null;
    this.aStarVisitedCount = null;
    this.aStarPathDetails = [];
    this.aStarEstimatedTime = null;
    this.algorithmMap?.runAStar();
  }

  resetAStar() {
    this.aStarDistance = null;
    this.aStarVisitedCount = null;
    this.aStarPathDetails = [];
    this.aStarEstimatedTime = null;
    this.algorithmMap?.resetSelection();
  }

  resetKruskal() {
    this.kruskalTotalWeight = null;
    this.kruskalEdgeCount = null;
    this.kruskalPathWeight = null;
    this.kruskalPathDetails = [];
    this.kruskalEdgesDetails = [];
    this.algorithmMap?.resetSelection(); // Limpia también las aristas moradas
  }

  toggleRestrictionsMode() {
    this.restrictionsModeActive = !this.restrictionsModeActive;
    if (this.algorithmMap) {
      this.algorithmMap.restrictionsMode = this.restrictionsModeActive;
    }
  }

  clearRestrictionZones() {
    this.algorithmMap?.clearRestrictedZones();
  }

  syncRestrictionRadius() {
    if (this.algorithmMap) {
      this.algorithmMap.restrictionRadius = this.restrictionRadius;
    }
  }

  toggleRallySelection() {
    this.rallySelectionActive = !this.rallySelectionActive;
    if (this.algorithmMap) {
      this.algorithmMap.isRallyMode = this.rallySelectionActive;
      // Si activamos rally, deseleccionamos origen/destino normal para no confundir
      if (this.rallySelectionActive) {
        this.algorithmMap.resetSelection();
      }
    }
  }

  runRally() {
    let algo: 'dijkstra' | 'astar' | 'kruskal' = 'dijkstra';
    if (this.activeMethod === 'astar') algo = 'astar';
    if (this.activeMethod === 'kruskal') algo = 'kruskal';

    this.algorithmMap?.runRallyAlgorithm(algo);
  }

  clearRally() {
    this.resetDijkstra();
    this.resetAStar();
    this.resetKruskal();
    this.algorithmMap?.clearRallySelection();
  }

  onSimulationFinished(result: { distance: number; visitedCount: number; path: any[] }) {
    this.dijkstraDistance = result.distance;
    this.dijkstraVisitedCount = result.visitedCount;

    // Procesar desglose de la ruta y tiempo estimado
    this.pathDetails = [];
    let totalTime = 0;

    for (const edge of result.path) {
      if (edge.type === 'flight') {
        const timeH = edge.weight / 800; // Avión ~800 km/h
        totalTime += timeH;
        this.pathDetails.push({
          type: 'flight',
          label: `Vuelo Real (${edge.flightId})`,
          distance: edge.weight,
          time: timeH,
        });
      } else {
        const timeH = edge.weight / 100; // Tren/Coche ~100 km/h
        totalTime += timeH;
        this.pathDetails.push({
          type: 'transfer',
          label: `Transbordo Terrestre`,
          distance: edge.weight,
          time: timeH,
        });
      }
    }

    this.estimatedTimeHours = totalTime;
  }

  onAStarFinished(result: { distance: number; visitedCount: number; path: any[] }) {
    this.aStarDistance = result.distance;
    this.aStarVisitedCount = result.visitedCount;
    this.aStarPathDetails = [];
    let totalTime = 0;

    for (const edge of result.path) {
      const isFlight = edge.type === 'flight';
      const timeH = edge.weight / (isFlight ? 800 : 100);
      totalTime += timeH;
      this.aStarPathDetails.push({
        type: edge.type,
        label: isFlight ? `Vuelo (${edge.flightId})` : 'Transbordo',
        distance: edge.weight,
        time: timeH,
      });
    }
    this.aStarEstimatedTime = totalTime;
  }

  onKruskalFinished(result: {
    totalWeight: number;
    edgeCount: number;
    mstEdges: any[];
    mstPath: any[];
    mstPathWeight: number;
  }) {
    this.kruskalTotalWeight = result.totalWeight;
    this.kruskalEdgeCount = result.edgeCount;
    this.kruskalPathWeight = result.mstPathWeight;

    // Procesar lista de aristas de Kruskal completas
    this.kruskalEdgesDetails = result.mstEdges.map((edge) => ({
      type: edge.type,
      label: edge.type === 'flight' ? `Vuelo Esencial (${edge.flightId})` : 'Transbordo Terrestre',
      distance: edge.weight,
    }));

    // Procesar desglose del camino MST si hay nodos seleccionados
    this.kruskalPathDetails = [];
    if (result.mstPath && result.mstPath.length > 0) {
      for (const edge of result.mstPath) {
        if (edge.type === 'flight') {
          this.kruskalPathDetails.push({
            type: 'flight',
            label: `Vuelo por MST (${edge.flightId})`,
            distance: edge.weight,
            time: edge.weight / 800,
          });
        } else {
          this.kruskalPathDetails.push({
            type: 'transfer',
            label: `Transbordo MST`,
            distance: edge.weight,
            time: edge.weight / 100,
          });
        }
      }
    }
  }
}
