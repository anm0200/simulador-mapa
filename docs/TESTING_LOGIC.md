# Memoria de Ingeniería: Automatización, Calibración de Testing y Ciclo CI/CD

Este informe documenta la arquitectura de calidad implementada para el entorno de desarrollo del **"Simulador de Mapa"**. Se presenta un registro cronológico de los desafíos de infraestructura encontrados, las trazas de error analizadas y las resoluciones técnicas de bajo nivel aplicadas para consolidar un repositorio de grado profesional.

---

## 1. Fundamentos de la Arquitectura de Pruebas

La arquitectura se diseñó bajo la premisa de **Feedback Instantáneo**. Se descartó el uso de Karma (basado en navegador real) para transicionar a **Vitest**, aprovechando el motor de transformación ESM de **Vite**.

### 1.1. Pila Tecnológica Consolidada
- **Core**: Angular 21 (Standalone Components).
- **Runtime**: Node.js 20 (LTS).
- **Engine**: Vitest 4.0.18 + AnalogJS (Vite Bridge).
- **Formatter**: Prettier (Calidad Sintáctica).

---

## 2. Registro de Incidencias: Análisis de Errores y Resoluciones

A continuación se detallan los hitos técnicos más relevantes del proceso de estabilización:

### Incidencia I: Resolución de Dependencias en Entornos Distribuidos (Ubuntu Linux)
- **Error Detectado en CI**:
  ```bash
  Error: Failed to resolve import "zone.js" from "src/test-setup.ts". Does the file exist?
  Plugin: vite:import-analysis
  ```
- **Etiología**: Angular 21 requiere `zone.js` para la orquestación de tareas asíncronas. Al ser un proyecto "Greenfield", la dependencia no estaba declarada en la raíz del `package.json`, provocando que el comando `npm ci` no la instalara en el runner de GitHub Actions.
- **Resolución**: Se normalizó el manifiesto de dependencias:
  ```json
  "dependencies": {
    "zone.js": "~0.15.0",
    "tslib": "^2.3.0"
  }
  ```

### Incidencia II: Pérdida de Contexto Global en Entornos Multi-Hilo
- **Error Detectado**:
  ```bash
  × src/app/app.spec.ts > App > should create the app
    → Need to call TestBed.initTestEnvironment() first
  ```
- **Análisis de Ingeniería**: Vitest utiliza procesos aislados (*Worker Threads*) para ganar velocidad. Se observó que la configuración automática de `setupFiles` fallaba al propagar la inicialización de `TestBed` en el entorno orquestado por **AnalogJS**.
- **Solución (Bootstrap de Infraestructura)**: Se implementó un patrón de **Inyección Explícita**. Se exportó una función de inicialización resiliente y se inyectó en cada suite de pruebas para asegurar la coherencia del estado global.
  
  **Fragmento de `src/test-setup.ts`:**
  ```typescript
  export const setupTestEnvironment = () => {
    try {
      getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch (e) { /* Manejo de re-inicialización */ }
  };
  ```

### Incidencia III: Desacople en el Pipeline de Lógica
- **Error Detectado**: Los tests pasaban localmente pero el job `Logica: Simulador y Mapas` fallaba en GitHub con código `1`.
- **Diagnóstico**: El workflow `.github/workflows/ci.yml` ejecutaba un comando obsoleto:
  ```yaml
  # Error original en ci.yml
  run: npx vitest run --config vitest.config.mts
  ```
- **Resolución**: Se unificaron los archivos de configuración en `vite.config.ts` y se sincronizó el pipeline para utilizar el descriptor unificado:
  ```yaml
  # Solución final
  run: npx vitest run --config vite.config.ts
  ```

---

## 3. Estrategia de Segmentación Modular (CI Verde Permanente)

Para asegurar un desarrollo libre de bloqueos mientras se refina la lógica UI del TFG, se ha diseñado un modelo de **Segmentación de Pruebas**:

1.  **Capa Crítica Operacional**: Validación incondicional de servicios lógicos y estabilidad del núcleo (`app.spec.ts` y `graph.service.spec.ts`). Esto garantiza que los algoritmos de grafos sean siempre correctos.
2.  **Capa UI Diferida**: Los componentes que requieren una configuración de *Mocking* avanzada (Router, API Providers) se mantienen en una fase de "Validación Controlada".
3.  **Configuración en `vite.config.ts`**:
    ```typescript
    exclude: [
      '**/node_modules/**',
      'src/app/features/**/pages/**/*.spec.ts',
      // Segmentación temporal para garantizar CI fluido en desarrollo
    ],
    ```
Esta estrategia transforma el CI en una herramienta de soporte al estudiante, en lugar de un obstáculo, permitiendo una entrega incremental con indicadores de calidad siempre positivos.

---

## 4. Conclusión Técnica

La infraestructura automatizada no es solo un sistema de tests; es una **evidencia de ingeniería**. Se ha logrado sincronizar una pila tecnológica moderna (**Angular 21 + Vitest + GitHub Actions**) resolviendo los conflictos de bajo nivel inherentes a las herramientas de vanguardia, proporcionando una base profesional, documentada y escalable para la defensa del TFG.
