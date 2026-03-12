import { setupTestEnvironment } from '../../../../../test-setup';
setupTestEnvironment();
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MethodsPage } from './methods-page';

describe('MethodsPage', () => {
  let component: MethodsPage;
  let fixture: ComponentFixture<MethodsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MethodsPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MethodsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
