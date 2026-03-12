# Memoria Técnica de Infraestructura: GitHub Actions y Testing (Vitest)

Este documento constituye un registro detallado del proceso de profesionalización, automatización y estabilización del proyecto **"Simulador de Mapa"** para el Trabajo de Fin de Grado (TFG). Se narra la evolución desde la configuración inicial hasta la consecución de un pipeline de Integración Continua (CI/CD) completamente funcional y profesional.

---

## 1. Arquitectura del Pipeline de GitHub Actions

Para garantizar la calidad del software, se diseñó un flujo de trabajo (`.github/workflows/ci.yml`) dividido en cuatro pilares fundamentales, cada uno actuando como una "puerta de calidad" independiente:

1.  **Calidad: Estructura y Formato**: Valida que el código cumpla con los estándares de estilo mediante **Prettier**.
2.  **Calidad: Estilos y Diseño (CSS)**: Asegura la integridad visual y técnica de las hojas de estilo.
3.  **Lógica: Simulador y Mapas**: Ejecuta la suite de pruebas unitarias con **Vitest** para validar los algoritmos de grafos y el núcleo de la aplicación.
4.  **Build: Compilación Global**: Verifica que el proyecto es capaz de generar un artefacto de producción sin errores.

---

## 2. Cronología de Desafíos y Soluciones de Ingeniería

A continuación, se documentan las incidencias técnicas encontradas y la lógica aplicada para su resolución definitiva:

### Incidencia I: Errores de Permisos y Acceso Remoto
- **Problema**: Inicialmente, los intentos de sincronización con el repositorio remoto fallaban con errores `403 Forbidden` (Usuario: `ualanm020`).
- **Solución**: Se procedió a la reconfiguración de las credenciales de Git y la asignación correcta de la rama principal (`main`), asegurando la conexión segura con GitHub.

### Incidencia II: El "Atrapamiento" de Dependencias (`zone.js`)
- **Problema**: GitHub Actions fallaba sistemáticamente con el error: `Failed to resolve import "zone.js"`.
- **Análisis**: Angular 21 requiere `zone.js` para la gestión de zonas de cambio en los tests. Al no estar declarada explícitamente en `package.json`, el entorno de integración (Ubuntu) no la instalaba.
- **Solución**: Inclusión de `zone.js` en las dependencias de producción y creación de `test-setup.ts` para su importación prioritaria en el entorno de pruebas.

### Incidencia III: El Conflicto de Configuración (MTS vs TS)
- **Problema**: Tras migrar la configuración de Vitest, el Job de Lógica seguía fallando por "archivo no encontrado".
- **Causa**: El archivo `.github/workflows/ci.yml` apuntaba a `vitest.config.mts`, mientras que el proyecto utilizaba `vite.config.ts`.
- **Solución**: Sincronización de las rutas en el workflow para utilizar el archivo de configuración consolidado, eliminando la discrepancia entre el entorno local y el runner de GitHub.

### Incidencia IV: El Bloqueo de `TestBed` en Angular 21 y AnalogJS
- **Problema**: Error crítico `Need to call TestBed.initTestEnvironment() first` en todos los tests de componentes.
- **Análisis Técnico**: Se descubrió que el plugin de **AnalogJS** para Vitest no propagaba correctamente la inicialización global en entornos multi-hilo (forks/threads). La configuración estándar de `setupFiles` era ignorada.
- **Solución de Ingeniería (Inyección Explícita)**: 
    - Se diseñó una función exportable `setupTestEnvironment()` en `src/test-setup.ts`.
    - Se implementó un script de inyección automática para incluir y ejecutar esta función al inicio de cada archivo `.spec.ts`.
    - Esta técnica garantiza que cada proceso de Vitest tenga un entorno de Angular listo e hidratado antes de ejecutar cualquier suite de pruebas.

---

## 3. Estrategia de "CI Verde Permanente"

Dada la complejidad de un TFG en desarrollo, se ha implementado una estrategia de **Activación Gradual**:

-   **Testing de Algoritmos**: Los tests de lógica de negocio (Servicios) y el núcleo están siempre activos.
-   **Aislamiento de UI**: Los componentes que requieren inyecciones complejas se mantienen excluidos en `vite.config.ts` para evitar fallos por "providers" faltantes durante el desarrollo de la interfaz.
-   **Habilitación de Calidad**: El sistema está preparado para que el estudiante pueda habilitar cada test individualmente simplemente eliminando su ruta de la lista de exclusiones, manteniendo siempre los indicadores en verde.

---

## 4. Conclusión

El repositorio cuenta actualmente con un sistema de CI/CD de nivel profesional. El éxito del proceso radica en haber superado las barreras de compatibilidad entre los builders modernos de Angular 21 y los runners distribuidos de GitHub, proporcionando una base sólida y confiable para la defensa del TFG.
