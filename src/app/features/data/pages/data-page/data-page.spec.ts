import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataPage } from './data-page';

describe('DataPage', () => {
  let component: DataPage;
  let fixture: ComponentFixture<DataPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataPage],
    }).compileComponents();

    fixture = TestBed.createComponent(DataPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
