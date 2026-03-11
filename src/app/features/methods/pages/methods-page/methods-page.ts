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

  resetKruskal() {
    this.kruskalTotalWeight = null;
    this.kruskalEdgeCount = null;
    this.kruskalPathWeight = null;
    this.kruskalPathDetails = [];
    this.kruskalEdgesDetails = [];
    this.algorithmMap?.resetSelection(); // Limpia también las aristas moradas
  }

  onSimulationFinished(result: { distance: number, visitedCount: number, path: any[] }) {
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
          time: timeH
        });
      } else {
        const timeH = edge.weight / 100; // Tren/Coche ~100 km/h
        totalTime += timeH;
        this.pathDetails.push({
          type: 'transfer',
          label: `Transbordo Terrestre`,
          distance: edge.weight,
          time: timeH
        });
      }
    }
    
    this.estimatedTimeHours = totalTime;
  }

  onKruskalFinished(result: { 
    totalWeight: number, 
    edgeCount: number, 
    mstEdges: any[], 
    mstPath: any[], 
    mstPathWeight: number 
  }) {
    this.kruskalTotalWeight = result.totalWeight;
    this.kruskalEdgeCount = result.edgeCount;
    this.kruskalPathWeight = result.mstPathWeight;
    
    // Procesar lista de aristas de Kruskal completas
    this.kruskalEdgesDetails = result.mstEdges.map(edge => ({
      type: edge.type,
      label: edge.type === 'flight' ? `Vuelo Esencial (${edge.flightId})` : 'Transbordo Terrestre',
      distance: edge.weight
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
            time: edge.weight / 800
          });
        } else {
          this.kruskalPathDetails.push({
            type: 'transfer',
            label: `Transbordo MST`,
            distance: edge.weight,
            time: edge.weight / 100
          });
        }
      }
    }
  }
}