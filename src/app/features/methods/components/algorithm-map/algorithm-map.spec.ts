import { setupTestEnvironment } from '../../../../../test-setup';
setupTestEnvironment();
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlgorithmMap } from './algorithm-map';

describe('AlgorithmMap', () => {
  let component: AlgorithmMap;
  let fixture: ComponentFixture<AlgorithmMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlgorithmMap],
    }).compileComponents();

    fixture = TestBed.createComponent(AlgorithmMap);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
