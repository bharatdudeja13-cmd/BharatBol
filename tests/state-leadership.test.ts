import { describe, expect, it } from 'vitest';
import {
  LEADERSHIP_VERIFIED_ON,
  OFFICIAL_LEADERSHIP_DIRECTORY_URL,
  STATE_LEADERSHIP,
} from '../src/config/stateLeadership';
import { STATES } from '../src/lib/states';

describe('state leadership directory', () => {
  it('has a complete, usable public-office record for every tilegram state', () => {
    for (const state of STATES) {
      const office = STATE_LEADERSHIP[state.code];
      expect(office, `${state.name} needs a public-office record`).toBeDefined();
      expect(office.designation).not.toHaveLength(0);
      expect(office.name).not.toHaveLength(0);
      expect(office.party).not.toHaveLength(0);
      expect(office.grievanceEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it('identifies when and where the office-holder audit was performed', () => {
    expect(LEADERSHIP_VERIFIED_ON).toBe('23 July 2026');
    expect(OFFICIAL_LEADERSHIP_DIRECTORY_URL).toMatch(/^https:\/\/www\.india\.gov\.in\//);
  });
});
