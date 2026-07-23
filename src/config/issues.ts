/**
 * The curated issue taxonomy shared by Stands, Polls and the content feed.
 *
 * Guardrail: categories describe ISSUES, never people, parties, companies,
 * communities or religions — and carry no partisan framing. Adding a
 * category is an editorial act: keep it neutral, or don't add it.
 */
export type IssueSlug =
  | 'education'
  | 'transparency'
  | 'democracy'
  | 'employment'
  | 'health'
  | 'environment'
  | 'infrastructure'
  | 'safety';

export type Issue = { slug: IssueSlug; en: string; hi: string };

export const ISSUES: Issue[] = [
  { slug: 'education', en: 'Education & exams', hi: 'शिक्षा और परीक्षाएँ' },
  { slug: 'employment', en: 'Jobs & livelihoods', hi: 'रोज़गार और आजीविका' },
  { slug: 'transparency', en: 'Transparency & accountability', hi: 'पारदर्शिता और जवाबदेही' },
  { slug: 'democracy', en: 'Democratic process', hi: 'लोकतांत्रिक प्रक्रिया' },
  { slug: 'health', en: 'Health & care', hi: 'स्वास्थ्य और देखभाल' },
  { slug: 'environment', en: 'Environment & water', hi: 'पर्यावरण और जल' },
  { slug: 'infrastructure', en: 'Roads, transport & civic works', hi: 'सड़क, परिवहन और नागरिक कार्य' },
  { slug: 'safety', en: 'Public safety', hi: 'सार्वजनिक सुरक्षा' },
];

const BY_SLUG = new Map(ISSUES.map((i) => [i.slug, i]));

export function issueLabel(slug: string, lang: string = 'en'): string {
  const i = BY_SLUG.get(slug as IssueSlug);
  if (!i) return slug;
  return lang === 'hi' ? i.hi : i.en;
}

export const isIssueSlug = (s: string): s is IssueSlug => BY_SLUG.has(s as IssueSlug);
