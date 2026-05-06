import { TestBed } from '@angular/core/testing';

import { POIFinder } from './poifinder';

describe('POIFinder', () => {
  let service: POIFinder;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(POIFinder);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
