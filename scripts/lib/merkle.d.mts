// Type surface for the shared Merkle module (used by src/ and tests).
export type LogEvent = {
  seq: number;
  event: 'cast' | 'withdraw';
  stand_id: string;
  nullifier: string;
  state: string | null;
  event_on: string;
};
export function canonicalEvent(e: LogEvent): string;
export function merkleRoot(events: LogEvent[], size?: number): Promise<string>;
export function inclusionProof(events: LogEvent[], index: number, size?: number): Promise<string[]>;
export function verifyInclusion(
  event: LogEvent,
  index: number,
  size: number,
  proofHex: string[],
  rootHex: string
): Promise<boolean>;
export function replayCounts(events: LogEvent[]): {
  stands: Record<string, number>;
  national: number;
};
export const toHex: (b: Uint8Array) => string;
export const fromHex: (s: string) => Uint8Array;
