import type { Stand } from './types';

/** Short, stable public URL. The UUID remains the relational key. */
export function standPath(stand: Pick<Stand, 'id' | 'public_id'>): string {
  return `/stand/${encodeURIComponent(stand.public_id || stand.id)}`;
}
