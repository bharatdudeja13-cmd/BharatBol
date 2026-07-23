/**
 * Supported UI languages for BharatBol.
 * Full dictionaries today: en, hi. Other locales appear in the picker and
 * fall back to English until translations land.
 */
export type LangCode =
  | 'en'
  | 'hi'
  | 'as'
  | 'bn'
  | 'brx'
  | 'doi'
  | 'gu'
  | 'kn'
  | 'ks'
  | 'kok'
  | 'mai'
  | 'ml'
  | 'mni'
  | 'mr'
  | 'ne'
  | 'or'
  | 'pa'
  | 'sa'
  | 'sat'
  | 'sd'
  | 'ta'
  | 'te'
  | 'ur';

export type LangOption = {
  code: LangCode;
  /** English name for search / accessibility */
  name: string;
  /** Native endonym shown in the picker */
  native: string;
  /** BCP-47 tags that map to this locale (browser detect) */
  tags: string[];
};

/** Scheduled languages of India + English (practical UI set). */
export const LANG_OPTIONS: LangOption[] = [
  { code: 'en', name: 'English', native: 'English', tags: ['en'] },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', tags: ['hi'] },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', tags: ['as'] },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', tags: ['bn'] },
  { code: 'brx', name: 'Bodo', native: 'बड़ो', tags: ['brx'] },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', tags: ['doi'] },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', tags: ['gu'] },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', tags: ['kn'] },
  { code: 'ks', name: 'Kashmiri', native: 'کٲشُر', tags: ['ks'] },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी', tags: ['kok'] },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', tags: ['mai'] },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', tags: ['ml'] },
  { code: 'mni', name: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ', tags: ['mni'] },
  { code: 'mr', name: 'Marathi', native: 'मराठी', tags: ['mr'] },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', tags: ['ne'] },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', tags: ['or', 'ory'] },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', tags: ['pa'] },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', tags: ['sa'] },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', tags: ['sat'] },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي', tags: ['sd'] },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', tags: ['ta'] },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', tags: ['te'] },
  { code: 'ur', name: 'Urdu', native: 'اردو', tags: ['ur'] },
];

const BY_CODE = new Map(LANG_OPTIONS.map((l) => [l.code, l]));

export function isLangCode(s: string | null | undefined): s is LangCode {
  return !!s && BY_CODE.has(s as LangCode);
}

export function langOption(code: LangCode): LangOption {
  return BY_CODE.get(code) ?? LANG_OPTIONS[0];
}

/** Compact label for the header language button. */
export function langButtonLabel(code: LangCode): string {
  if (code === 'en') return 'EN';
  if (code === 'hi') return 'हिं';
  const opt = langOption(code);
  return opt.native.slice(0, 2);
}

/**
 * Map navigator.language / languages to closest supported LangCode.
 * Tries exact tag, then primary subtag (e.g. bn-IN → bn).
 */
export function detectBrowserLang(
  languages: readonly string[] = typeof navigator !== 'undefined'
    ? [...(navigator.languages ?? []), navigator.language]
    : ['en']
): LangCode {
  for (const raw of languages) {
    if (!raw) continue;
    const lower = raw.toLowerCase().replace('_', '-');
    const primary = lower.split('-')[0] ?? lower;
    for (const opt of LANG_OPTIONS) {
      if (opt.tags.some((t) => t === lower || t === primary)) return opt.code;
    }
    // Common aliases
    if (primary === 'or' || primary === 'ory') return 'or';
  }
  return 'en';
}

export const LANG_STORAGE_KEY = 'bharatbol:lang';
