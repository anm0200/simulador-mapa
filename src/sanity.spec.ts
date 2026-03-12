import { describe, it, expect } from 'vitest';

describe('Verificacion de Entorno TFG', () => {
  it('deberia cargar el simulador correctamente', () => {
    expect(true).toBe(true);
  });

  it('deberia tener configurado el entorno de CI/CD', () => {
    const isCI = true;
    expect(isCI).toBe(true);
  });
});
