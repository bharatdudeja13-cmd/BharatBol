/**
 * §2 verification spine: RFC 6962 Merkle tree + open recount.
 * "Same public log + same script = same numbers" is asserted here with
 * a pinned fixture root, so any accidental change to the leaf encoding
 * or tree shape (which would orphan every committed checkpoint) fails CI.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
// @ts-expect-error — shared plain-ESM module, used verbatim by node scripts and browser
import { merkleRoot, inclusionProof, verifyInclusion, replayCounts, canonicalEvent } from '../scripts/lib/merkle.mjs';
// @ts-expect-error — same
import { readLogFile } from '../scripts/lib/log.mjs';

type Ev = {
  seq: number;
  event: 'cast' | 'withdraw';
  stand_id: string;
  nullifier: string;
  state: string | null;
  event_on: string;
};

const FIXTURE = readLogFile(join(__dirname, 'fixtures/sample-log.jsonl')) as Ev[];

// Pinned: if this changes, every previously committed checkpoint breaks.
const FIXTURE_ROOT = '238f8c1538cf48471a2b6297e08705072d0cb497046b7beb6ac03e3cf0043e89';

const mkEvent = (seq: number, over: Partial<Ev> = {}): Ev => ({
  seq,
  event: 'cast',
  stand_id: '00000000-0000-4000-8000-000000000001',
  nullifier: seq.toString(16).padStart(2, '0').repeat(32),
  state: 'MH',
  event_on: '2026-07-22',
  ...over,
});

describe('recount (same log + same script = same numbers)', () => {
  it('replays the fixture to the expected totals', () => {
    const { stands, national } = replayCounts(FIXTURE);
    expect(stands['00000000-0000-4000-8000-000000000001']).toBe(5);
    expect(stands['00000000-0000-4000-8000-000000000002']).toBe(5);
    expect(national).toBe(10);
  });

  it('rejects a log where withdrawals exceed casts', () => {
    expect(() =>
      replayCounts([mkEvent(1, { event: 'withdraw' })])
    ).toThrow(/inconsistent/);
  });

  it('canonical leaf encoding is stable and field-ordered', () => {
    expect(canonicalEvent(FIXTURE[0])).toBe(
      '{"seq":1,"event":"cast","stand_id":"00000000-0000-4000-8000-000000000001","nullifier":"0101010101010101010101010101010101010101010101010101010101010101","state":"MH","event_on":"2026-07-20"}'
    );
  });
});

describe('merkle root', () => {
  it('fixture root is pinned — leaf encoding and tree shape must never drift', async () => {
    expect(await merkleRoot(FIXTURE)).toBe(FIXTURE_ROOT);
  });

  it('is deterministic', async () => {
    expect(await merkleRoot(FIXTURE)).toBe(await merkleRoot([...FIXTURE]));
  });

  it('changes if any single event is tampered with', async () => {
    for (const i of [0, 7, FIXTURE.length - 1]) {
      const tampered = FIXTURE.map((e, j) => (j === i ? { ...e, state: 'PB' } : e));
      expect(await merkleRoot(tampered)).not.toBe(FIXTURE_ROOT);
    }
  });

  it('changes if events are reordered or truncated', async () => {
    const swapped = [...FIXTURE];
    [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
    expect(await merkleRoot(swapped)).not.toBe(FIXTURE_ROOT);
    expect(await merkleRoot(FIXTURE, FIXTURE.length - 1)).not.toBe(FIXTURE_ROOT);
  });
});

describe('inclusion proofs (RFC 6962 / RFC 9162)', () => {
  it('every leaf verifies in every tree size from 1 to 16', async () => {
    const events = Array.from({ length: 16 }, (_, i) => mkEvent(i + 1));
    for (let size = 1; size <= 16; size++) {
      const root = await merkleRoot(events, size);
      for (let index = 0; index < size; index++) {
        const proof = await inclusionProof(events, index, size);
        expect(await verifyInclusion(events[index], index, size, proof, root)).toBe(true);
      }
    }
  }, 60000);

  it('a proof fails for a tampered event, wrong index, or wrong root', async () => {
    const size = FIXTURE.length;
    const root = await merkleRoot(FIXTURE);
    const proof = await inclusionProof(FIXTURE, 5, size);
    expect(await verifyInclusion(FIXTURE[5], 5, size, proof, root)).toBe(true);
    expect(await verifyInclusion({ ...FIXTURE[5], state: 'PB' }, 5, size, proof, root)).toBe(false);
    expect(await verifyInclusion(FIXTURE[5], 6, size, proof, root)).toBe(false);
    expect(await verifyInclusion(FIXTURE[5], 5, size, proof, '0'.repeat(64))).toBe(false);
  });

  it('a proof against an older checkpoint (prefix of the log) still verifies', async () => {
    const size = 10; // checkpoint taken before the last four events
    const root = await merkleRoot(FIXTURE, size);
    const proof = await inclusionProof(FIXTURE, 2, size);
    expect(await verifyInclusion(FIXTURE[2], 2, size, proof, root)).toBe(true);
  });
});
