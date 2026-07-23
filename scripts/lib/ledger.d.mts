export type PulseEntry = {
  id: number;
  stand_id: string;
  delta: number;
  at: string;
};
export function eventOf(delta: number): 'stood' | 'withdrew';
export function canonicalEntry(e: PulseEntry): string;
export function entryHash(e: PulseEntry): Promise<string>;
export function canonicalCheckpoint(c: { size: number; root: string }): string;
export function checkpointDigestHex(c: { size: number; root: string }): Promise<string>;
export function replayLedger(entries: PulseEntry[]): {
  stands: Record<string, number>;
  total: number;
};
