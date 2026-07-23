/**
 * BharatBol brand constants - the single source for name, taglines,
 * hashtag, and share copy. All share templates are editable constants
 * and MUST stay issue-framed and non-partisan (guardrails §7).
 */

export const BRAND = {
  name: 'BharatBol',
  nameHi: 'भारत बोल',
  /** Wordmark parts: regular + bold, so the call-to-action pops. */
  wordmark: { regular: 'Bharat', bold: 'Bol' },
  wordmarkHi: { regular: 'भारत', bold: 'बोल' },
  hashtag: '#BharatBol',
} as const;

/** Default tagline first; alternates kept for future use. */
export const TAGLINES = {
  en: ['Bharat, speak.', 'Where Bharat speaks.', 'Your voice. Counted.'],
  hi: ['भारत, बोल।', 'जहाँ भारत बोलता है।', 'आपकी आवाज़। गिनी हुई।'],
} as const;

/**
 * Prewritten share copy. Placeholders: {issue} {n} {link} {tag}.
 * Every string is issue-framed - never a person, party, company, or community.
 */
export const SHARE_TEMPLATES = {
  whatsapp: {
    en: 'This matters to me: {issue}. Have a look and decide for yourself: {link}',
    hi: 'मेरे लिए यह मुद्दा मायने रखता है: {issue}। देखिए और अपना विचार बनाइए: {link}',
  },
  x: {
    en: '{issue} deserves a clear public count. See the issue and decide where you stand: {link} {tag}',
    hi: '{issue} पर साफ़ सार्वजनिक गिनती होनी चाहिए। मुद्दा देखें और अपना पक्ष तय करें: {link} {tag}',
  },
  caption: {
    en: 'I chose to stand on this: {issue}. The public count is here: {link} {tag}',
    hi: 'मैंने इस मुद्दे पर पक्ष लिया है: {issue}। सार्वजनिक गिनती यहाँ है: {link} {tag}',
  },
} as const;

export function fillTemplate(
  tpl: string,
  vars: { issue: string; n: string; link: string; tag: string }
): string {
  return tpl
    .replaceAll('{issue}', vars.issue)
    .replaceAll('{n}', vars.n)
    .replaceAll('{link}', vars.link)
    .replaceAll('{tag}', vars.tag)
    .replace(/\s+/g, ' ')
    .trim();
}
