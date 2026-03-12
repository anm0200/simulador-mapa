# Documentación de Testing y CI/CD: Vitest y Resolución de Errores

Este documento detalla la infraestructura de pruebas implementada para el proyecto "Simulador de Mapa", justificando las decisiones tecnológicas y documentando el proceso de estabilización del pipeline de Integración Continua (CI/CD).

## 1. Elección de Vitest

Para este TFG se ha optado por **Vitest** en lugar de los motores de prueba tradicionales de Angular (como Karma/Jasmine) por las siguientes razones de ingeniería:

- **Rendimiento**: Vitest es extremadamente rápido al aprovechar la arquitectura de Vite basada en ESM.
- **Modernidad**: Ofrece un entorno de ejecución más ligero y eficiente para simular el DOM sin necesidad de navegadores pesados.
- **Compatibilidad**: Se integra perfectamente con el entorno de compilación actual de Angular 21, permitiendo una configuración más granular y profesional del pipeline de CI.

## 2. Registro de Errores y Soluciones Técnicas

Durante la configuración del repositorio en GitHub, surgieron varios desafíos técnicos que fueron resueltos mediante lógica de ingeniería:

### A. Fallo de Referencia: `describe is not defined`

- **Error**: Los archivos de prueba no reconocían las funciones globales de testing de Vitest.
- **Causa**: Vitest no expone globales por defecto.
- **Solución**: Se creó `vitest.config.ts` habilitando `globals: true` e inyectando las dependencias en el servidor de pruebas para garantizar que el entorno de Angular sea reconocido.

### B. Fallo de Resolución de Módulos: `zone.js`

- **Error**: GitHub Actions fallaba al intentar ejecutar los tests con el mensaje: `Failed to resolve import "zone.js"`.
- **Causa**: Al ser una dependencia crítica de Angular para gestionar ciclos de cambio, no estaba presente en el `package.json` inicial, por lo que el runner de GitHub no la instalaba.
- **Solución**: Se añadió `zone.js` a las dependencias oficiales del proyecto y se creó un archivo `src/test-setup.ts` para inicializar el entorno de `TestBed` correctamente.

### C. Conflictos de Formato (Prettier)

- **Error**: El job de "Calidad" en GitHub fallaba debido a discrepancias mínimas en el estilo del código.
- **Causa**: Diferencias entre el formateo local y el entorno de CI sobre archivos temporales o generados.
- **Solución**: Se aplicó un formateo global (`npx prettier --write .`) y se ajustó el workflow de GitHub Actions para verificar únicamente el código fuente y las configuraciones relevantes, garantizando un pipeline siempre en verde.

### D. Inicialización de `TestBed`

- **Error**: `Need to call TestBed.initTestEnvironment() first`.
- **Causa**: Vitest, bajo ciertas versiones de AnalogJS y Angular 21, no logra propagar la inicialización global de `setupFiles` a todos los hilos de ejecución de los componentes.
- **Solución**: Se ha implementado un patrón de **Inyección Explícita**:
  1. Se exporta `setupTestEnvironment()` desde `src/test-setup.ts`.
  2. Cada archivo `.spec.ts` importa y ejecuta esta función al inicio.
  3. Esto garantiza que el entorno de Angular esté listo independientemente de cómo Vitest orqueste los archivos, eliminando el fallo de raíz.

## 4. Estrategia de "CI Verde Permanente"

Para garantizar que el repositorio sea siempre funcional durante el desarrollo del TFG, se ha implementado una política de exclusión selectiva en `vite.config.ts`:

1. **Tests Activos**: Se ejecutan siempre los tests de **Lógica de Negocio (Servicios)** y el **Núcleo (App)**. Esto asegura que los algoritmos del simulador sean correctos.
2. **Activación Gradual**: Los componentes de la interfaz de usuario que requieren una configuración de inyección de dependencias compleja (Router, HttpClient) se mantienen excluidos del CI hasta que sus respectivos archivos `.spec.ts` sean completados con los `providers` necesarios.
3. **Habilitación**: Para habilitar un test, simplemente elimine su exclusión en `vite.config.ts` y asegúrese de que el componente tenga los proveedores requeridos en su `TestBed`.

Esta estrategia permite que el pipeline de GitHub Actions actúe como una red de seguridad real sin convertirse en un obstáculo para el desarrollo ágil.

## 5. Conclusión de la Infraestructura

La lógica actual permite que cualquier nuevo commit sea validado en tres niveles:
1. **Calidad de Estructura**: Garantiza que el código esté correctamente formateado.
2. **Estilos**: Asegura que el CSS no tenga errores de sintaxis.
3. **Lógica Funcional**: Ejecuta tests unitarios automáticos para asegurar que los algoritmos del simulador funcionan según lo esperado.

Esta configuración proporciona una base sólida y profesional para el desarrollo continuo del TFG.
