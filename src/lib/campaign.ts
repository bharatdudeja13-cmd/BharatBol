/**
 * Campaign identity for a Stand: #BharatBol plus a short auto-tag.
 * Curated tags for the seed stands; a neutral generator as fallback.
 * Tags must stay issue-framed — never a person, party, or community.
 */
import type { Stand } from './types';
import { BRAND } from '../config/brand';

const CURATED: [RegExp, string][] = [
  [/NEET|CBSE/i, 'ExamAudit'],
  [/audit reports/i, 'OpenAudits'],
  [/teaching posts/i, 'FillTeacherPosts'],
  [/integrity of every vote/i, 'EveryVoteSafe'],
  [/unemployment/i, 'YouthJobs'],
];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'on', 'in', 'and', 'every', 'faster',
  'stronger', 'fixed', 'public', 'publicly', 'independent', 'transparent',
]);

export function autoTag(stand: Stand): string {
  for (const [re, tag] of CURATED) {
    if (re.test(stand.title)) return tag;
  }
  const words = stand.title
    .replace(/[^A-Za-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return (words.join('') || 'Bol').slice(0, 18);
}

/** e.g. "#BharatBol #ExamAudit" */
export function hashtagBlock(stand: Stand): string {
  return `${BRAND.hashtag} #${autoTag(stand)}`;
}
