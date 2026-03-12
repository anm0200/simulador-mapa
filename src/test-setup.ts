import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

/**
 * Inicializa el entorno de pruebas de Angular.
 * Esta función debe ser llamada en cada archivo .spec.ts para garantizar 
 * que TestBed esté listo, especialmente en entornos basados en Vitest y AnalogJS.
 */
export const setupTestEnvironment = () => {
  try {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  } catch (e) {
    // Ya inicializado, podemos ignorar el error
  }
};
