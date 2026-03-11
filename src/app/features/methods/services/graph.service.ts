import { Injectable } from '@angular/core';

export interface Point {
  lat: number;
  lng: number;
}

export interface Node {
  id: string; // "lat,lng"
  lat: number;
  lng: number;
  originalIndex?: number;
}

export interface Edge {
  sourceId: string;
  targetId: string;
  weight: number;
  type: 'flight' | 'transfer'; // Para diferenciar cómo se dibujan
  flightId?: string;
  path?: Point[]; 
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

@Injectable({
  providedIn: 'root'
})
export class GraphService {

  private graph: GraphData = { nodes: [], edges: [] };
  private adjacencyList: Map<string, Edge[]> = new Map();

  constructor() { }

  /**
   * Lee el archivo GeoJSON y crea un grafo basado estrictamente
   * en los extremos inicial y final de cada vuelo, sin agrupar por distancia.
   */
  async loadGraphFromRealData(clusterRadiusKm: number = 50): Promise<GraphData> {
    try {
      const response = await fetch('/data/iberian_flights_soiei4h.json');
      const geojson = await response.json();
      
      this.graph = { nodes: [], edges: [] };
      this.adjacencyList.clear();

      const features = geojson?.features ?? [];
      
      // Para clustering: Guardamos los clústeres creados
      const clusters: { id: string, lat: number, lng: number }[] = [];

      const getCluster = (lat: number, lng: number): { id: string, lat: number, lng: number } => {
        if (clusterRadiusKm <= 0) {
          return { id: `${lat},${lng}`, lat, lng };
        }

        let closest = null;
        let minDist = Infinity;
        
        for (const c of clusters) {
          const d = this.calculateDistance(lat, lng, c.lat, c.lng);
          if (d < minDist) {
            minDist = d;
            closest = c;
          }
        }

        if (closest && minDist <= clusterRadiusKm) {
          return closest; // Fusionar con un nodo/cluster cercano existente
        }

        // Crear nuevo cluster
        const newC = { id: `cluster_${clusters.length}`, lat, lng };
        clusters.push(newC);
        return newC;
      };

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];

        if (
          feature?.geometry?.type !== 'LineString' ||
          !Array.isArray(feature?.geometry?.coordinates) ||
          feature.geometry.coordinates.length < 2
        ) {
          continue;
        }

        const coords = feature.geometry.coordinates;
        const firstPoint = coords[0];
        const lastPoint = coords[coords.length - 1];

        // Obtener u agrupar endpoints
        const startNode = getCluster(firstPoint[1], firstPoint[0]); // GeoJSON is [lng, lat]
        const endNode = getCluster(lastPoint[1], lastPoint[0]);

        this.addNodeIfMissing(startNode.id, startNode.lat, startNode.lng, i);
        this.addNodeIfMissing(endNode.id, endNode.lat, endNode.lng, i);

        // Si inicio y fin caen en el mismo cluster, descartar ruta circular
        if (startNode.id === endNode.id) {
          continue;
        }

        const weight = this.calculateDistance(startNode.lat, startNode.lng, endNode.lat, endNode.lng);
        const path: Point[] = coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
        const flightId = `flight_${i}`;

        this.addEdge(startNode.id, endNode.id, weight, 'flight', flightId, path);
        this.addEdge(endNode.id, startNode.id, weight, 'flight', flightId, [...path].reverse());
      }

      // --- PASO 2: CONECTIVIDAD TOTAL (TRANSFERENCIAS) ---
      // Conectamos nodos cercanos para que el jugador pueda "hacer transbordo"
      // entre vuelos distintos. De lo contrario, los vuelos son líneas aisladas.
      const MAX_TRANSFER_DIST = 500; // km
      
      const nodesList = this.graph.nodes;
      for (let i = 0; i < nodesList.length; i++) {
        for (let j = i + 1; j < nodesList.length; j++) {
          const n1 = nodesList[i];
          const n2 = nodesList[j];
          
          const dist = this.calculateDistance(n1.lat, n1.lng, n2.lat, n2.lng);
          
          if (dist < MAX_TRANSFER_DIST && dist > 0) {
            // Penalizamos un poco el peso del transbordo para que prefiera vuelos largos reales
            const weight = dist * 1.5; 
            
            // Verificamos si ya existe una arista real entre ellos
            const existingEdges = this.adjacencyList.get(n1.id) || [];
            const alreadyConnected = existingEdges.some(e => e.targetId === n2.id);
            
            if (!alreadyConnected) {
              const path = [{lat: n1.lat, lng: n1.lng}, {lat: n2.lat, lng: n2.lng}];
              this.addEdge(n1.id, n2.id, weight, 'transfer', 'transfer', path);
              this.addEdge(n2.id, n1.id, weight, 'transfer', 'transfer', [...path].reverse());
            }
          }
        }
      }

      return this.graph;

    } catch (error) {
      console.error('Error loading graph data:', error);
      throw error;
    }
  }

  getGraph(): GraphData {
    return this.graph;
  }

  private addNodeIfMissing(id: string, lat: number, lng: number, originalIdx: number) {
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
      this.graph.nodes.push({ id, lat, lng, originalIndex: originalIdx });
    }
  }

  private addEdge(sourceId: string, targetId: string, weight: number, type: 'flight' | 'transfer', flightId: string, path: Point[]) {
    const edge: Edge = { sourceId, targetId, weight, type, flightId, path };
    this.graph.edges.push(edge);
    this.adjacencyList.get(sourceId)?.push(edge);
  }

  /**
   * Algoritmo de Dijkstra estándar
   */
  runDijkstra(startId: string, endId: string): { 
    pathMap: Map<string, Edge | null>, 
    shortestPath: Edge[],
    visitedOrder: string[],
    distance: number 
  } {
    const distances = new Map<string, number>();
    const previous = new Map<string, Edge | null>();
    const visited = new Set<string>();
    const visitedOrder: string[] = [];
    const queue: { id: string, dist: number }[] = [];

    // Initialize
    for (const node of this.graph.nodes) {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
    }

    distances.set(startId, 0);
    queue.push({ id: startId, dist: 0 });

    while (queue.length > 0) {
      // Sort to get minimum (simple priority queue)
      queue.sort((a, b) => a.dist - b.dist);
      const current = queue.shift()!;
      const currentId = current.id;

      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      visitedOrder.push(currentId);

      if (currentId === endId) {
        break; // Reached destination
      }

      const neighbors = this.adjacencyList.get(currentId) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.targetId)) continue;

        const newDist = distances.get(currentId)! + edge.weight;
        if (newDist < distances.get(edge.targetId)!) {
          distances.set(edge.targetId, newDist);
          previous.set(edge.targetId, edge);
          queue.push({ id: edge.targetId, dist: newDist });
        }
      }
    }

    // Reconstruct path
    const shortestPath: Edge[] = [];
    let curr = endId;
    
    // Check if path exists
    if (distances.get(endId) === Infinity) {
       return { pathMap: previous, shortestPath: [], visitedOrder, distance: Infinity };
    }

    while (curr !== startId) {
      const edge = previous.get(curr);
      if (edge) {
        shortestPath.unshift(edge);
        curr = edge.sourceId;
      } else {
        break;
      }
    }

    return { 
      pathMap: previous, 
      shortestPath, 
      visitedOrder,
      distance: distances.get(endId) || 0
    };
  }

  /**
   * Algoritmo de Kruskal (MST)
   * Devuelve un arreglo de aristas que forman el Árbol de Recubrimiento Mínimo.
   */
  runKruskal(): { mstEdges: Edge[], totalWeight: number, edgeProcessOrder: Edge[] } {
    // 1. Extraer TODAS las aristas y eliminar duplicados (A->B es lo mismo que B->A para MST no dirigido)
    const uniqueEdges: Edge[] = [];
    const seenMap = new Set<string>();

    for (const edge of this.graph.edges) {
      // Ordenar IDs para garantizar misma clave independientemente de la dirección
      const key = [edge.sourceId, edge.targetId].sort().join('-');
      if (!seenMap.has(key)) {
        seenMap.add(key);
        uniqueEdges.push(edge);
      }
    }

    // 2. Ordenar de menor a mayor peso
    // *Magia para el TFG*: Como preferimos VUELOS reales por encima de TRANSBORDOS,
    // "engañamos" artificialmente al sort penalizando muchísimo el transbordo
    uniqueEdges.sort((a, b) => {
      const weightA = a.type === 'transfer' ? a.weight * 10 : a.weight;
      const weightB = b.type === 'transfer' ? b.weight * 10 : b.weight;
      return weightA - weightB;
    });

    // 3. Estructura Union-Find (Conjuntos Disjuntos)
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    // Inicializar cada nodo como su propio padre (subconjunto propio)
    for (const node of this.graph.nodes) {
      parent.set(node.id, node.id);
      rank.set(node.id, 0);
    }

    // Función: Buscar la raíz del conjunto
    const find = (i: string): string => {
      if (parent.get(i) === i) {
        return i;
      }
      // Path compression
      const root = find(parent.get(i)!);
      parent.set(i, root);
      return root;
    };

    // Función: Unir dos conjuntos
    const union = (i: string, j: string): void => {
      const rootI = find(i);
      const rootJ = find(j);

      if (rootI !== rootJ) {
        const rankI = rank.get(rootI)!;
        const rankJ = rank.get(rootJ)!;

        // Union by rank
        if (rankI < rankJ) {
          parent.set(rootI, rootJ);
        } else if (rankI > rankJ) {
          parent.set(rootJ, rootI);
        } else {
          parent.set(rootJ, rootI);
          rank.set(rootI, rankI + 1);
        }
      }
    };

    const mstEdges: Edge[] = [];
    const edgeProcessOrder: Edge[] = [];
    let totalWeight = 0;

    // 4. Iterar sobre las aristas ordenadas
    for (const edge of uniqueEdges) {
      edgeProcessOrder.push(edge); // Para visualización: todas las aristas comprobadas
      
      const rootSource = find(edge.sourceId);
      const rootTarget = find(edge.targetId);

      // Si no comparten raíz, añadimos la arista al MST y unimos los conjuntos
      if (rootSource !== rootTarget) {
        mstEdges.push(edge);
        totalWeight += edge.weight;
        union(rootSource, rootTarget);
      }
      
      // OPTIMIZACIÓN REALISTA: Kruskal termina cuando tenemos N-1 aristas en el árbol
      if (mstEdges.length === this.graph.nodes.length - 1) {
        break;
      }
    }

    return { mstEdges, totalWeight, edgeProcessOrder };
  }

  /**
   * Encuentra el camino único entre dos nodos dentro de un Árbol de Recubrimiento Mínimo (MST)
   */
  findPathInMST(startId: string, endId: string, mstEdges: Edge[]): Edge[] {
    // 1. Construir lista de adyacencia bidireccional solo con las aristas del MST
    const mstAdj = new Map<string, Edge[]>();
    for (const e of mstEdges) {
      if (!mstAdj.has(e.sourceId)) mstAdj.set(e.sourceId, []);
      if (!mstAdj.has(e.targetId)) mstAdj.set(e.targetId, []);
      
      mstAdj.get(e.sourceId)!.push(e);
      // Para navegar en ambas direcciones necesitamos crear la arista inversa visualmente (para la dirección del path)
      mstAdj.get(e.targetId)!.push({ 
        ...e, 
        sourceId: e.targetId, 
        targetId: e.sourceId, 
        path: e.path ? [...e.path].reverse() : undefined 
      });
    }

    // 2. Búsqueda BFS estándar
    const queue: string[] = [startId];
    const visited = new Set<string>();
    const parent = new Map<string, Edge>();
    
    visited.add(startId);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === endId) break;
      
      const neighbors = mstAdj.get(curr) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          parent.set(edge.targetId, edge);
          queue.push(edge.targetId);
        }
      }
    }

    // 3. Reconstruir el camino desde endId hasta startId
    if (!parent.has(endId)) return []; // No están conectados (raro en un MST completo, a menos que sean disjuntos)

    const path: Edge[] = [];
    let curr = endId;
    while (curr !== startId) {
      const edge = parent.get(curr)!;
      path.unshift(edge);
      curr = edge.sourceId;
    }
    
    return path;
  }

  // Haversine formula to get distance between two points in KM
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
