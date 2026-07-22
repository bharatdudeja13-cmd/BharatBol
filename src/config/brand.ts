/**
 * BharatBol brand constants — the single source for name, taglines,
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
 * Every string is issue-framed — never a person, party, company, or community.
 */
export const SHARE_TEMPLATES = {
  whatsapp: {
    en: 'I spoke on BharatBol — {issue}. Your voice counts too 👉 {link} #BharatBol {tag}',
    hi: 'मैंने BharatBol पर अपनी बात रखी — {issue}. तुम भी बोलो 👉 {link} #BharatBol {tag}',
  },
  x: {
    en: '{n} people said {issue} matters. Where do you stand? Bharat, bol. {link} #BharatBol {tag}',
    hi: '{n} लोगों ने कहा — {issue} मायने रखता है। आप कहाँ खड़े हैं? भारत, बोल। {link} #BharatBol {tag}',
  },
  caption: {
    en: 'मैंने बोला। I spoke — {issue}. {n} voices and counting. Add yours 👉 {link} #BharatBol {tag}',
    hi: 'मैंने बोला। — {issue}. {n} आवाज़ें, और बढ़ रही हैं। अपनी जोड़ें 👉 {link} #BharatBol {tag}',
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
