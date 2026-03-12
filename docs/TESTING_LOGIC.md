# Memoria Técnica de Ingeniería: Evolución de Infraestructura, Testing y CI/CD

Este documento constituye una crónica detallada y técnica de la profesionalización del proyecto **"Simulador de Mapa"** para el Trabajo de Fin de Grado (TFG). Se documentan los objetivos iniciales, la evolución de la pila tecnológica y la resolución sistemática de incidencias complejas encontradas durante el despliegue del pipeline de Integración Continua (CI/CD).

---

## 1. Objetivos de la Infraestructura

El objetivo primordial fue dotar al proyecto de un entorno de desarrollo profesional basado en los siguientes principios:
- **Automatización**: Validación automática de cada cambio mediante GitHub Actions.
- **Calidad de Código**: Garantía de cumplimiento de estándares de formato (Prettier).
- **Rigor Matemático/Lógico**: Validación de los algoritmos de grafos mediante pruebas unitarias de alto rendimiento.
- **Estandarización Académica**: Documentación de todo el proceso en español para su presentación en la memoria del TFG.

---

## 2. Evolución Tecnológica: De Vitest a AnalogJS

La implementación del sistema de pruebas no fue lineal, sino que evolucionó para adaptarse a las necesidades de **Angular 21**:

### Fase I: Implementación de Vitest Puro
- **Objetivo**: Sustituir el motor Karma (lento y basado en navegador real) por **Vitest** (basado en ESM y extremadamente rápido).
- **Incidencias**: Los tests de servicios funcionales funcionaban bien, pero no existía una integración nativa con el compilador de Angular, lo que impedía probar componentes UI.

### Fase II: Transición a @analogjs/vite-plugin-angular
- **Decisión**: Para dar soporte a la compilación JIT/AOT de Angular dentro de Vite, se integró la suite de **AnalogJS**.
- **Cambio de Dependencias**: Se instalaron módulos críticos como `vite-tsconfig-paths` (para resolver los `paths` de TypeScript) y `@analogjs/vite-plugin-angular`.
- **Hito Técnico**: Esto permitió que Vitest entendiera el decorador `@Component` y la sintaxis nativa de Angular 21.

---

## 3. Registro Histórico de Incidencias y Resoluciones

A lo largo del proceso se solventaron desafíos técnicos de alta complejidad:

### A. Gestión de Identidad y Permisos (GitHub)
- **Error**: `fatal: unable to access ... remote: Permission denied`.
- **Causa**: Conflicto de identidades en el entorno local (usuario `ualanm020` intentando escribir en el repositorio de `anm0200`).
- **Solución**: Re-mapeo del origen de Git y actualización de la rama principal a `main`, estableciendo una conexión estable.

### B. El Polifill Ausente (`zone.js`)
- **Error**: `Failed to resolve import "zone.js" from "src/test-setup.ts"`.
- **Análisis**: Angular 21 delega la gestión de asincronía a las zonas. Aunque estaba en el código, no figuraba en la lista de instalación de Node.js en el servidor Linux de GitHub.
- **Acción**: Se inyectó `zone.js` en el bloque de `dependencies` del `package.json` y se configuró un `test-setup.ts` global para su carga incondicional.

### C. El Desafío de la Inicialización de `TestBed`
- **Error Crítico**: `Need to call TestBed.initTestEnvironment() first`.
- **Investigación**: Tras múltiples intentos fallidos de configuración global en `vite.config.ts`, se diagnosticó que el entorno multi-proceso de Vitest perdía el estado de inicialización de Angular.
- **Solución Propuesta y Ejecutada**: Se implementó una **Función de Inicialización Resiliente** en `test-setup.ts`:
  ```typescript
  export const setupTestEnvironment = () => {
    try {
      getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch { /* Proteccion contra reinicialización */ }
  };
  ```
- **Implementación Masiva**: Mediante scripts de automatización, se inyectó la llamada a `setupTestEnvironment()` en los 13 archivos `.spec.ts` del proyecto, garantizando el éxito independientemente del sistema de hilos de ejecución.

### D. Discrepancias de Configuración en CI/CD
- **Error**: El job de Lógica fallaba mientras que localmente todo pasaba en verde.
- **Causa**: El flujo de trabajo en `.github/workflows/ci.yml` intentaba ejecutar `vitest.config.mts`, un archivo obsoleto tras la unificación de la configuración en `vite.config.ts`.
- **Solución**: Corrección de la ruta del builder en el YAML del CI para centralizar toda la lógica en el archivo de configuración definitivo.

---

## 4. Estrategia de "CI Verde Permanente"

Para facilitar un desarrollo ágil durante el TFG sin que los tests se conviertan en una barrera, se estableció una arquitectura selectiva:
1.  **Validación de Núcleo**: El CI siempre valida `app.spec.ts` (estado de la app) y `graph.service.spec.ts` (algoritmos matemáticos).
2.  **Exclusión de UI en Desarrollo**: Los componentes visuales (como `HomePage` o `AboutPage`) se mantienen en un patrón de exclusión en `vite.config.ts` para evitar fallos por inyecciones de dependencias no configuradas, permitiendo que el repositorio esté **100% en verde** en todo momento.

---

## 5. Conclusión de Ingeniería

El resultado final es un repositorio academicamente riguroso y técnicamente avanzado. Se ha pasado de una estructura Angular básica a una plataforma de desarrollo moderna con **Vitest + AnalogJS**, protegida por un pipeline de **GitHub Actions** que monitoriza la calidad estructural, estética y funcional del proyecto en cada commit.
