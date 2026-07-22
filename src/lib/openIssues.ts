import type { Stand } from './types';
import { isIstToday } from './istDay';

export type OpenIssuesMetrics = {
  /** Live stands with no stand_states tags */
  openNational: number;
  /** Live stands with at least one state tag */
  openStateTagged: number;
  /** Live stands whose created_at is today in IST */
  addedToday: Stand[];
  /** state code → count of live stands tagged to that state */
  issuesByState: Record<string, number>;
};

/**
 * Derive open-issue geography from live stands + stand_states tags.
 * National = untagged; state intensity = tag counts (multi-state OK).
 */
export function deriveOpenIssues(
  stands: Stand[],
  standStates: Record<string, string[]>
): OpenIssuesMetrics {
  const live = stands.filter((s) => s.status === 'live' || !s.status);

  let openNational = 0;
  let openStateTagged = 0;
  const issuesByState: Record<string, number> = {};

  for (const s of live) {
    const tags = standStates[s.id] ?? [];
    if (tags.length === 0) {
      openNational += 1;
    } else {
      openStateTagged += 1;
      for (const code of tags) {
        issuesByState[code] = (issuesByState[code] ?? 0) + 1;
      }
    }
  }

  const addedToday = live
    .filter((s) => isIstToday(s.created_at))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return { openNational, openStateTagged, addedToday, issuesByState };
}

/** Top N states by open issue count. */
export function topIssueStates(
  issuesByState: Record<string, number>,
  n = 5
): { code: string; count: number }[] {
  return Object.entries(issuesByState)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, n);
}
