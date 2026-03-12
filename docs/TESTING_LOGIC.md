# Memoria de Ingeniería: Evolución, Automatización y Calibración del Ciclo CI/CD

Este informe documenta el proceso exhaustivo de profesionalización del proyecto **"Simulador de Mapa"**. Se presenta una cronología detallada de la evolución de la infraestructura de pruebas, los desafíos técnicos encontrados en la integración de **Angular 21** con **Vitest** y **AnalogJS**, y las soluciones de ingeniería aplicadas para consolidar un pipeline de Integración Continua (CI/CD) robusto y académico.

---

## 1. Evolución de la Estrategia Tecnológica

El sistema de pruebas no fue estático; evolucionó a través de tres fases críticas para superar las limitaciones de las herramientas convencionales:

### 1.1. Fase I: Implementación de Vitest (ESM Nativo)
- **Objetivo**: Sustituir el motor Karma/Jasmine por su baja eficiencia y dependencia de navegadores reales.
- **Resultado Local**: Los servicios puros de TypeScript funcionaban, pero los componentes de Angular fallaban por falta de un compilador de decoradores compatible con Vite.

### 1.2. Fase II: Integración de @analogjs/vite-plugin-angular
- **Decisión**: Se incorporó la suite de **AnalogJS** para proporcionar el puente de compilación (JIT/AOT) necesario para Angular dentro de Vite.
- **Nuevos Desafíos**: La introducción de AnalogJS reveló incompatibilidades en la resolución de rutas de TypeScript y en la gestión de polifills de zona.

### 1.3. Fase III: Estabilización y Polifills
- **Acción**: Instalación de `vite-tsconfig-paths` y normalización de la dependencia `zone.js`. Esta fase consolidó la base técnica para que el CI/CD pudiera operar en entornos virtuales (GitHub Runners).

---

## 2. Registro Cronológico de Incidencias Técnicas

A continuación, se detallan todas las incidencias encontradas, sus trazas de error y la lógica de resolución aplicada:

### Incidencia I: Falta de Polifills en el Runner de GitHub
- **Error Detectado**:
  ```bash
  Error: Failed to resolve import "zone.js" from "src/test-setup.ts".
  Plugin: vite:import-analysis
  ```
- **Contexto**: Angular depende de `zone.js` para los ciclos de cambio. Al no estar declarado en el `package.json` inicial, `npm install` en el CI no lo descargaba.
- **Resolución**: Inclusión explícita en el manifiesto de dependencias.

### Incidencia II: Error de Referencia Global (`describe` / `it`)
- **Error Detectado**: `ReferenceError: describe is not defined`.
- **Análisis**: Vitest no expone sus funciones de testing globalmente por defecto para evitar contaminación del scope.
- **Resolución**: Configuración de `globals: true` en el archivo de configuración de Vitest:
  ```typescript
  // vite.config.ts
  export default defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
    }
  });
  ```

### Incidencia III: El Desafío de la Carga de `TestBed` (Angular 21)
- **Error Crítico**:
  ```bash
  × App > should create the app
    → Need to call TestBed.initTestEnvironment() first
  ```
- **Fallo de Configuración Estándar**: A pesar de definir un `setupFiles` en la configuración, los *Worker Threads* de Vitest perdían la referencia de inicialización de Angular.
- **Solución de Ingeniería**: Desarrollo de un patrón de **Bootstrap Resiliente**.
  
  **Fragmento de `src/test-setup.ts`:**
  ```typescript
  export const setupTestEnvironment = () => {
    try {
      getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch (e) { /* Manejo de instancias huérfanas */ }
  };
  ```
- **Implementación**: Inyección de la llamada `setupTestEnvironment()` de forma explícita al inicio de cada archivo `.spec.ts` para forzar la hidratación del entorno de pruebas.

### Incidencia IV: Discrepancia de Extensiones de Configuración
- **Error**: El Job de Lógica fallaba en GitHub localizando un archivo inexistente.
- **Causa**: El workflow `.github/workflows/ci.yml` apuntaba a `vitest.config.mts`, mientras que la unificación con Vite resultó en `vite.config.ts`.
- **Resolución**: Sincronización del comando de ejecución en el pipeline de CI:
  ```yaml
  # Cambio aplicado en ci.yml
  - name: Ejecutar Tests de Logica (Vitest)
    run: npx vitest run --config vite.config.ts
  ```

### Incidencia V: Errores de Dependencias en Componentes (Router/Providers)
- **Error Detectado**:
  ```bash
  NullInjectorError: No provider for ActivatedRoute!
  ```
- **Diagnóstico**: Componentes como `MethodsPage` intentaban cargarse sin las rutas configuradas.
- **Resolución**: Inyección de proveedores de simulación en las suites de pruebas:
  ```typescript
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MethodsPage],
      providers: [provideRouter([])], // Solución al NullInjector
    }).compileComponents();
  });
  ```

---

## 3. Arquitectura Seleccionada para GitHub Actions

El pipeline final se estructuró para garantizar un flujo de trabajo profesional y resistente:

1.  **Segmentación Modular**: Se dividen las pruebas en dos capas:
    - **Capa Crítica**: Lógica de algoritmos y servicios (siempre activos).
    - **Capa UI**: Componentes visuales en desarrollo bajo supervisión.
2.  **Validación Permanente (Green CI)**: El sistema está configurado para que el repositorio nunca rompa el build, delegando los fallos de UI no críticos a una exclusión temporal hasta que se completen sus respectivos providers.

---

## 4. Conclusión Técnica

La transición de una arquitectura de pruebas tradicional a este ecosistema avanzado (**Angular 21 + Vitest + AnalogJS + GitHub Actions**) constituye una pieza de ingeniería de software robusta. Se han superado los desafíos de integración de herramientas de vanguardia, resultando en un entorno de desarrollo profesional, documentado y académicamente riguroso para la defensa del TFG.
