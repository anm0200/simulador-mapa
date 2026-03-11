# Simulador de Mapas e Intersecciones (TFG)

Este proyecto es el resultado de mi Trabajo de Fin de Grado (TFG). Se trata de una aplicación web desarrollada con Angular 21 para la simulación y visualización de datos geográficos y rutas en mapas interactivos.

## Tecnologías Principales

- Framework: [Angular 21](https://angular.dev/)
- Mapas: [Leaflet](https://leafletjs.com/)
- Lenguaje: TypeScript
- Estilos: Vanilla CSS
- Testing: [Vitest](https://vitest.dev/)
- Calidad de Código: Prettier y GitHub Actions (CI/CD)

## Configuración de Desarrollo

Para ejecutar el proyecto localmente, asegúrate de tener instalado [Node.js](https://nodejs.org/).

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm start
   ```
   Navega a http://localhost:4200/. La aplicación se recargará automáticamente al detectar cambios.

## Estructura del Proyecto

El proyecto sigue una arquitectura basada en características (features) para facilitar la escalabilidad:

- `src/app/features`: Contiene los módulos principales como el simulador de mapas, gestión de datos y algoritmos.
- `src/app/shared`: Componentes y servicios comunes utilizados en toda la aplicación.
- `.github/workflows`: Configuración de la Integración Continua (CI).

## Pruebas y Calidad

Para asegurar la estabilidad del proyecto, contamos con un sistema de integración continua en GitHub Actions que verifica:

- Formato: Uso de Prettier para un estilo de código consistente.
- Tests: Ejecución de pruebas unitarias.
- Build: Verificación de compilación exitosa.

Ejecutar tests localmente:

```bash
npm test
```

## Licencia

Este proyecto ha sido desarrollado como parte de un TFG académico.
