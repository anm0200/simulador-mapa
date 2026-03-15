# Guía de Ingeniería: Algoritmos de Grafos y Caminos Mínimos

Este documento detalla la base teórica y la implementación práctica de los algoritmos fundacionales utilizados en el proyecto **"Simulador de Mapa - TFG"**.

---

## 1. Algoritmo de Dijkstra (Caminos Mínimos)

### 1.1. Base Teórica
El algoritmo de Dijkstra resuelve el problema de los caminos más cortos desde un único origen en un grafo con pesos no negativos. Funciona de manera "voraz" (greedy), seleccionando en cada paso el nodo no visitado con la menor distancia acumulada.

### 1.2. Implementación en el Proyecto
Se utiliza una lista de adyacencia y una gestión de prioridades basada en ordenación simple para encontrar la ruta de vuelo óptima.

**Fragmento Lógica Práctica:**
```typescript
while (queue.length > 0) {
  queue.sort((a, b) => a.dist - b.dist); // Selección del nodo más cercano
  const current = queue.shift();
  
  for (const edge of neighbors) {
    const newDist = distances.get(currentId) + edge.weight;
    if (newDist < distances.get(edge.targetId)) {
      distances.set(edge.targetId, newDist);
      previous.set(edge.targetId, edge); // Registro del camino
    }
  }
}
```

---

## 2. Algoritmo A* (Búsqueda Heurística)

### 2.1. Base Teórica
A* es una extensión de Dijkstra que añade una **heurística ($h(n)$)** para guiar la búsqueda. La función de coste es:
$$f(n) = g(n) + h(n)$$
Donde:
- $g(n)$: Coste real desde el inicio al nodo actual.
- $h(n)$: Estimación del coste desde el nodo actual al destino.

### 2.2. Implementación y Heurística Haversine
Como operamos sobre coordenadas geográficas, usamos la **Fórmula de Haversine** como heurística, calculando la distancia "en línea recta" sobre la curvatura terrestre.

**Lógica de Selección:**
```typescript
const h = this.calculateDistance(node.lat, node.lng, endNode.lat, endNode.lng);
const f = tentativeGScore + h;
fScore.set(edge.targetId, f); // Prioriza nodos que apuntan al destino
```

---

## 3. Algoritmo de Kruskal (MST - Minimum Spanning Tree)

### 3.1. Base Teórica
Busca conectar todos los nodos del grafo eliminando los ciclos y minimizando el peso total de las aristas. Es fundamental para optimizar infraestructuras globales.

### 3.2. Implementación Disjoint-Set (Union-Find)
Para detectar ciclos de forma eficiente, se implementó una estructura de conjuntos disjuntos con optimización de **Path Compression** y **Union by Rank**.

**Estrategia MST:**
1. Ordenar todas las aristas por peso.
2. Añadir aristas solo si sus nodos pertenecen a componentes distintos (evita ciclos).

**Código de Unión:**
```typescript
const find = (i) => {
  if (parent.get(i) === i) return i;
  const root = find(parent.get(i));
  parent.set(i, root); // Path Compression
  return root;
};
```

---

## 4. Comparativa de Eficiencia (Caso TFG)

| Algoritmo | Propósito | Coste Visibilización | Garantía |
| :--- | :--- | :--- | :--- |
| **Dijkstra** | Ruta óptima general | Alto (explora todo) | Óptimo absoluto |
| **A*** | Ruta óptima guiada | Bajo (explora objetivo) | Óptimo (si $h(n)$ es admisible) |
| **Kruskal** | Red vertebral | N/A (conecta todo) | Árbol mínimo |

---

## 5. Conclusión de Ingeniería
La combinación de estos tres algoritmos permite al simulador no solo mostrar datos, sino analizar la **conectividad aérea** desde múltiples perspectivas: eficiencia individual (A*/Dijkstra) y eficiencia de red (Kruskal).
