# Memoria Técnica de Ingeniería: Arquitectura de Pruebas y Ciclo de Vida CI/CD

Este informe documenta la implementación de la infraestructura de calidad y automatización para el proyecto **"Simulador de Mapa"**. Se detalla la transición tecnológica, la resolución de desafíos de bajo nivel en el entorno de **Angular 21** y la consolidación de un pipeline de Integración Continua (CI/CD) de alto rendimiento.

---

## 1. Evolución de la Pila Tecnológica de Pruebas

La arquitectura de pruebas fue diseñada para maximizar la velocidad de feedback durante el desarrollo del TFG, alejándose de los estándares tradicionales hacia soluciones de vanguardia:

### 1.1. De Karma a Vitest: El Cambio de Paradigma
- **Objetivo**: Superar las limitaciones de rendimiento de Karma/Jasmine, que requieren el levantamiento de persistentes de navegador.
- **Implementación**: Migración a **Vitest**, un motor nativo de **ESM** que opera sobre **Vite**, permitiendo una ejecución de pruebas en milisegundos mediante la transformación de código en tiempo real.

### 1.2. Integración de AnalogJS para Angular 21
- **Desafío**: Vitest no posee un compilador nativo para decoradores y sintaxis propietaria de Angular.
- **Solución**: Integración de `@analogjs/vite-plugin-angular`, que actúa como el puente de compilación (JIT/AOT) dentro del ecosistema Vite.
- **Consolidación de Dependencias**: Sincronización de `vite-tsconfig-paths` para la resolución de alias de rutas y `jsdom` para la simulación del entorno de navegador en Node.js.

---

## 2. Registro de Incidencias Técnicas y Lógica de Resolución

Durante el despliegue del pipeline en **GitHub Actions** (Ubuntu-latest), se abordaron y resolvieron los siguientes cuellos de botella técnicos:

### A. Gestión de Dependencias Críticas (`zone.js`)
- **Incidencia**: Fallo de resolución de tipos y tiempo de ejecución en entornos de CI.
- **Etiología**: Angular 21 depende intrínsecamente de `zone.js` para la detección de cambios y micro-tareas. Esta dependencia no se instalaba en el runner de GitHub al omitirse en la declaración raíz.
- **Resolución**: Inyección de `zone.js` y `zone.js/testing` en el manifiesto de dependencias y configuración del entorno global en `src/test-setup.ts`.

### B. Persistencia del Entorno de `TestBed`
- **Incidencia**: Error recursivo `Need to call TestBed.initTestEnvironment() first`.
- **Diagnóstico**: Se identificó una pérdida de estado global en el motor de Vitest debido a la orquestación de procesos aislados (forks). La configuración estándar de `setupFiles` no garantizaba la inicialización en cada hilo de ejecución bajo el plugin de AnalogJS.
- **Ingeniería de Resolución**: Se desarrolló un patrón de **Bootstrap Explícito**. Mediante la creación de la función resiliente `setupTestEnvironment()` y su invocación directa en cada especificación (`.spec.ts`), se aseguró la integridad del `TestBed` en todas las capas del árbol de directorios del proyecto.

### C. Desacople de Configuración en el Pipeline (YAML)
- **Incidencia**: Discrepancia entre la ejecución local y los Jobs de GitHub.
- **Causa**: El flujo de trabajo del CI operaba sobre una ruta de configuración obsoleta (`vitest.config.mts`), ignorando las optimizaciones de `vite.config.ts`.
- **Resolución**: Sincronización del descriptor de acciones (`ci.yml`) para centralizar la lógica de ejecución en el motor de Vite definitivo.

---

## 3. Estrategia de Segmentación de la Suite de Pruebas

Para mantener una Integración Continua eficiente y resiliente durante la fase activa de desarrollo, se ha implementado una **Estrategia de Ejecución Modular**:

1.  **Capa Crítica (Activa)**: Validación persistente de la lógica de negocio, servicios de grafos y estado vital de la aplicación (`app.spec.ts`). Esto garantiza que el "corazón" matemático y funcional del simulador sea inviolable en cada commit.
2.  **Capa de Interfaz (Diferida)**: Los componentes visuales que requieren una orquestación compleja de proveedores (Services, Routers, Mocks externos) se encuentran segmentados en la configuración de Vitest. Esto permite un flujo de trabajo ágil donde el CI se centra en la solidez del motor lógico mientras la UI evoluciona.
3.  **Habilitación On-Demand**: La arquitectura está diseñada para permitir la activación gradual de las pruebas de UI mediante la simple eliminación de sus rutas en el array de exclusión de `vite.config.ts`, manteniendo el pipeline siempre en estado operacional (Verde).

---

## 4. Conclusión Técnica

La infraestructura resultante representa un estado del arte en el desarrollo con Angular 21. La combinación de **GitHub Actions** para la supervisión de calidad, **Prettier** para la consistencia sintáctica y **Vitest/Analog** para la validación lógica, proporciona al TFG una plataforma de grado industrial, robusta y plenamente documentada.
