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

export interface RestrictedZone {
  id: string;
  center: Point;
  radius: number; // km
}

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private graph: GraphData = { nodes: [], edges: [] };
  private originalEdges: Edge[] = []; // Para restaurar si se quitan restricciones
  private adjacencyList: Map<string, Edge[]> = new Map();
  private restrictedZones: RestrictedZone[] = [];

  constructor() {}

  /**
   * Lee el archivo GeoJSON y crea un grafo basado estrictamente
   * en los extremos inicial y final de cada vuelo, sin agrupar por distancia.
   */
  async loadGraphFromRealData(clusterRadiusKm: number = 50): Promise<GraphData> {
    try {
      const response = await fetch('/data/iberian_flights_soiei4h.json');
      const geojson = await response.json();

      this.graph = { nodes: [], edges: [] };
      this.originalEdges = [];
      this.adjacencyList.clear();

      const features = geojson.features || [];

      // Para clustering: Guardamos los clústeres creados
      const clusters: { id: string; lat: number; lng: number }[] = [];

      const getCluster = (lat: number, lng: number): { id: string; lat: number; lng: number } => {
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
          feature.geometry.type !== 'LineString' ||
          !Array.isArray(feature.geometry.coordinates) ||
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

        const weight = this.calculateDistance(
          startNode.lat,
          startNode.lng,
          endNode.lat,
          endNode.lng,
        );
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
            const alreadyConnected = existingEdges.some((e) => e.targetId === n2.id);

            if (!alreadyConnected) {
              const path = [
                { lat: n1.lat, lng: n1.lng },
                { lat: n2.lat, lng: n2.lng },
              ];
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

  private addEdge(
    sourceId: string,
    targetId: string,
    weight: number,
    type: 'flight' | 'transfer',
    flightId: string,
    path: Point[],
  ) {
    const edge: Edge = { sourceId, targetId, weight, type, flightId, path };
    this.graph.edges.push(edge);
    this.originalEdges.push({ ...edge, path: [...path] });
    this.adjacencyList.get(sourceId)?.push(edge);
  }

  // --- NUEVA LÓGICA: RALLYS AÉREOS (ZONAS RESTRINGIDAS) ---

  setRestrictedZones(zones: RestrictedZone[]) {
    this.restrictedZones = zones;
    this.applyRestrictions();
  }

  clearRestrictedZones() {
    this.restrictedZones = [];
    this.applyRestrictions();
  }

  /**
   * Re-calcula la geometría y pesos de todas las aristas
   * basándose en las zonas restringidas actuales.
   */
  private applyRestrictions() {
    // 1. Restaurar aristas originales
    this.graph.edges = this.originalEdges.map((e) => ({ ...e, path: [...(e.path || [])] }));

    // 2. Si no hay zonas, terminar
    if (this.restrictedZones.length === 0) {
      this.rebuildAdjacencyList();
      return;
    }

    // 3. Para cada arista, verificar y corregir contra cada zona
    for (const edge of this.graph.edges) {
      if (edge.type !== 'flight' || !edge.path) continue;

      let edgeAffected = false;
      for (const zone of this.restrictedZones) {
        const corrected = this.correctPathForZone(edge.path, zone);
        if (corrected) {
          edge.path = corrected;
          edgeAffected = true;
        }
      }

      if (edgeAffected) {
        // ACTUALIZAR PESO con una penalización masiva (x100)
        // Esto asegura que Dijkstra lo evite si hay CUALQUIER otra alternativa
        edge.weight = this.calculatePathDistance(edge.path) * 100;
      }
    }

    this.rebuildAdjacencyList();
  }

  private rebuildAdjacencyList() {
    this.adjacencyList.clear();
    for (const node of this.graph.nodes) {
      this.adjacencyList.set(node.id, []);
    }
    for (const edge of this.graph.edges) {
      this.adjacencyList.get(edge.sourceId)?.push(edge);
    }
  }

  private calculatePathDistance(path: Point[]): number {
    let dist = 0;
    for (let i = 0; i < path.length - 1; i++) {
      dist += this.calculateDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    }
    return dist;
  }

  /**
   * Toma una trayectoria y la "dobla" para que bordee la zona si la atraviesa.
   */
  private correctPathForZone(path: Point[], zone: RestrictedZone): Point[] | null {
    let intersects = false;
    const newPath: Point[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];

      const dist1 = this.calculateDistance(p1.lat, p1.lng, zone.center.lat, zone.center.lng);
      const dist2 = this.calculateDistance(p2.lat, p2.lng, zone.center.lat, zone.center.lng);

      // Si el segmento entra en la zona (o alguno de sus puntos extremos)
      if (dist1 < zone.radius || dist2 < zone.radius) {
        intersects = true;
        const midPoint = this.getArcMidpoint(p1, p2, zone);
        newPath.push(p1);
        newPath.push(midPoint);
      } else {
        // Verificar punto medio del segmento
        const latMid = (p1.lat + p2.lat) / 2;
        const lngMid = (p1.lng + p2.lng) / 2;
        const distMid = this.calculateDistance(latMid, lngMid, zone.center.lat, zone.center.lng);

        if (distMid < zone.radius) {
          intersects = true;
          const midPoint = this.getArcMidpoint(p1, p2, zone);
          newPath.push(p1);
          newPath.push(midPoint);
        } else {
          newPath.push(p1);
        }
      }
    }
    
    // Evitar duplicados consecutivos
    newPath.push(path[path.length - 1]);
    const cleanPath: Point[] = [];
    for (let i = 0; i < newPath.length; i++) {
      if (i === 0 || newPath[i].lat !== newPath[i-1].lat || newPath[i].lng !== newPath[i-1].lng) {
        cleanPath.push(newPath[i]);
      }
    }

    return intersects ? cleanPath : null;
  }

  /**
   * Encuentra un punto en el borde del círculo para desviar la ruta.
   */
  private getArcMidpoint(p1: Point, p2: Point, zone: RestrictedZone): Point {
    // Vector desde el centro del círculo hacia el punto medio de p1 y p2
    const latMid = (p1.lat + p2.lat) / 2;
    const lngMid = (p1.lng + p2.lng) / 2;

    const dLat = latMid - zone.center.lat;
    const dLng = lngMid - zone.center.lng;
    const distanceInDegrees = Math.sqrt(dLat * dLat + dLng * dLng);

    // Si el punto medio está justo en el centro (raro), desplazamos ligeramente
    if (distanceInDegrees === 0) {
      return { lat: p1.lat + 0.01, lng: p1.lng + 0.01 };
    }

    // Convertimos el radio de KM a grados aproximados (1 grado ~ 111.32 km)
    const targetDistanceDegrees = (zone.radius + 1) / 111.32;
    const ratio = targetDistanceDegrees / distanceInDegrees;

    return {
      lat: zone.center.lat + dLat * ratio,
      lng: zone.center.lng + dLng * ratio
    };
  }

  /**
   * Algoritmo de Dijkstra estándar
   */
  runDijkstra(
    startId: string,
    endId: string,
  ): {
    pathMap: Map<string, Edge | null>;
    shortestPath: Edge[];
    visitedOrder: string[];
    distance: number;
  } {
    const distances = new Map<string, number>();
    const previous = new Map<string, Edge | null>();
    const visited = new Set<string>();
    const visitedOrder: string[] = [];
    const queue: { id: string; dist: number }[] = [];

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
      distance: distances.get(endId) || 0,
    };
  }

  /**
   * Algoritmo A*
   * Utiliza la distancia Haversine como heurística.
   */
  runAStar(
    startId: string,
    endId: string,
  ): {
    pathMap: Map<string, Edge | null>;
    shortestPath: Edge[];
    visitedOrder: string[];
    distance: number;
  } {
    const endNode = this.graph.nodes.find((n) => n.id === endId);
    if (!endNode) return { pathMap: new Map(), shortestPath: [], visitedOrder: [], distance: Infinity };

    const gScore = new Map<string, number>(); // Coste real desde el inicio
    const fScore = new Map<string, number>(); // Coste estimado total (g + h)
    const previous = new Map<string, Edge | null>();
    const visited = new Set<string>();
    const visitedOrder: string[] = [];
    const openSet: { id: string; f: number }[] = [];

    for (const node of this.graph.nodes) {
      gScore.set(node.id, Infinity);
      fScore.set(node.id, Infinity);
      previous.set(node.id, null);
    }

    gScore.set(startId, 0);
    const hStart = this.calculateDistance(
      this.graph.nodes.find((n) => n.id === startId)!.lat,
      this.graph.nodes.find((n) => n.id === startId)!.lng,
      endNode.lat,
      endNode.lng,
    );
    fScore.set(startId, hStart);
    openSet.push({ id: startId, f: hStart });

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentId = current.id;

      if (visited.has(currentId)) continue;
      visited.add(currentId);
      visitedOrder.push(currentId);

      if (currentId === endId) break;

      const neighbors = this.adjacencyList.get(currentId) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.targetId)) continue;

        const tentativeGScore = gScore.get(currentId)! + edge.weight;

        if (tentativeGScore < gScore.get(edge.targetId)!) {
          previous.set(edge.targetId, edge);
          gScore.set(edge.targetId, tentativeGScore);

          const targetNode = this.graph.nodes.find((n) => n.id === edge.targetId)!;
          const h = this.calculateDistance(targetNode.lat, targetNode.lng, endNode.lat, endNode.lng);
          const f = tentativeGScore + h;
          fScore.set(edge.targetId, f);

          if (!openSet.some((item) => item.id === edge.targetId)) {
            openSet.push({ id: edge.targetId, f });
          }
        }
      }
    }

    const shortestPath: Edge[] = [];
    let curr = endId;
    if (gScore.get(endId) === Infinity) {
      return { pathMap: previous, shortestPath: [], visitedOrder, distance: Infinity };
    }

    while (curr !== startId) {
      const edge = previous.get(curr);
      if (edge) {
        shortestPath.unshift(edge);
        curr = edge.sourceId;
      } else break;
    }

    return {
      pathMap: previous,
      shortestPath,
      visitedOrder,
      distance: gScore.get(endId) || 0,
    };
  }

  /**
   * Algoritmo de Kruskal (MST)
   * Devuelve un arreglo de aristas que forman el Árbol de Recubrimiento Mínimo.
   */
  runKruskal(): { mstEdges: Edge[]; totalWeight: number; edgeProcessOrder: Edge[] } {
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
        path: e.path ? [...e.path].reverse() : undefined,
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
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Ejecuta un algoritmo a través de múltiples puntos (waypoints) en secuencia.
   */
  runMultiPointAlgorithm(
    nodeIds: string[],
    algorithm: 'dijkstra' | 'astar' | 'kruskal'
  ): {
    path: Edge[];
    distance: number;
    visitedCount: number;
    segments: { from: string; to: string; distance: number; path: Edge[]; fullResult?: any }[];
  } {
    let totalPath: Edge[] = [];
    let totalDistance = 0;
    let totalVisited = 0;
    const segments: { from: string; to: string; distance: number; path: Edge[]; fullResult?: any }[] = [];

    // Para Kruskal, pre-calculamos el MST global una vez
    let mstEdges: Edge[] = [];
    if (algorithm === 'kruskal') {
      mstEdges = this.runKruskal().mstEdges;
    }

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const start = nodeIds[i];
      const end = nodeIds[i + 1];
      let result: any;

      if (algorithm === 'dijkstra') {
        result = this.runDijkstra(start, end);
        segments.push({ from: start, to: end, distance: result.distance, path: result.shortestPath, fullResult: result });
        totalPath = [...totalPath, ...result.shortestPath];
        totalDistance += result.distance;
        totalVisited += result.visitedOrder.length;
      } else if (algorithm === 'astar') {
        result = this.runAStar(start, end);
        segments.push({ from: start, to: end, distance: result.distance, path: result.shortestPath, fullResult: result });
        totalPath = [...totalPath, ...result.shortestPath];
        totalDistance += result.distance;
        totalVisited += result.visitedOrder.length;
      } else if (algorithm === 'kruskal') {
        const path = this.findPathInMST(start, end, mstEdges);
        const distance = path.reduce((acc, e) => acc + e.weight, 0);
        segments.push({ from: start, to: end, distance, path, fullResult: { shortestPath: path, visitedOrder: [] } });
        totalPath = [...totalPath, ...path];
        totalDistance += distance;
        totalVisited += this.graph.nodes.length;
      }
    }

    return {
      path: totalPath,
      distance: totalDistance,
      visitedCount: totalVisited,
      segments
    };
  }
}
