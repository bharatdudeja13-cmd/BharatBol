import { describe, expect, it } from 'vitest';
import { standPath } from '../src/lib/standUrl';

describe('public stand URLs', () => {
  it('uses the short public ID when present', () => {
    expect(standPath({ id: 'a1000001-0000-4000-8000-000000000001', public_id: 's1a2b3c4d5e' }))
      .toBe('/stand/s1a2b3c4d5e');
  });

  it('keeps legacy UUID links working until the migration is applied', () => {
    expect(standPath({ id: 'a1000001-0000-4000-8000-000000000001', public_id: null }))
      .toBe('/stand/a1000001-0000-4000-8000-000000000001');
  });
});
