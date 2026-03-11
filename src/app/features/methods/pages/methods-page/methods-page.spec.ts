import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MethodsPage } from './methods-page';

describe('MethodsPage', () => {
  let component: MethodsPage;
  let fixture: ComponentFixture<MethodsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MethodsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(MethodsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
