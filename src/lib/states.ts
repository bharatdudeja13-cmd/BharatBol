export type StateTile = {
  code: string;
  name: string;
  hi: string;
  col: number; // 0-based column in the 9×9 tilegram
  row: number; // 0-based row
};

/** India tilegram layout — 9×9 grid, per the design spec. */
export const STATES: StateTile[] = [
  { code: 'JK', name: 'Jammu & Kashmir', hi: 'जम्मू-कश्मीर', col: 2, row: 0 },
  { code: 'HP', name: 'Himachal Pradesh', hi: 'हिमाचल प्रदेश', col: 3, row: 1 },
  { code: 'PB', name: 'Punjab', hi: 'पंजाब', col: 1, row: 1 },
  { code: 'UK', name: 'Uttarakhand', hi: 'उत्तराखंड', col: 4, row: 2 },
  { code: 'HR', name: 'Haryana', hi: 'हरियाणा', col: 2, row: 2 },
  { code: 'DL', name: 'Delhi', hi: 'दिल्ली', col: 3, row: 2 },
  { code: 'RJ', name: 'Rajasthan', hi: 'राजस्थान', col: 1, row: 3 },
  { code: 'UP', name: 'Uttar Pradesh', hi: 'उत्तर प्रदेश', col: 4, row: 3 },
  { code: 'BR', name: 'Bihar', hi: 'बिहार', col: 5, row: 3 },
  { code: 'SK', name: 'Sikkim', hi: 'सिक्किम', col: 6, row: 2 },
  { code: 'AR', name: 'Arunachal Pradesh', hi: 'अरुणाचल प्रदेश', col: 8, row: 2 },
  { code: 'GJ', name: 'Gujarat', hi: 'गुजरात', col: 0, row: 4 },
  { code: 'MP', name: 'Madhya Pradesh', hi: 'मध्य प्रदेश', col: 3, row: 4 },
  { code: 'CG', name: 'Chhattisgarh', hi: 'छत्तीसगढ़', col: 4, row: 4 },
  { code: 'JH', name: 'Jharkhand', hi: 'झारखंड', col: 5, row: 4 },
  { code: 'WB', name: 'West Bengal', hi: 'पश्चिम बंगाल', col: 6, row: 4 },
  { code: 'AS', name: 'Assam', hi: 'असम', col: 7, row: 3 },
  { code: 'ML', name: 'Meghalaya', hi: 'मेघालय', col: 7, row: 4 },
  { code: 'NL', name: 'Nagaland', hi: 'नागालैंड', col: 8, row: 3 },
  { code: 'MN', name: 'Manipur', hi: 'मणिपुर', col: 8, row: 4 },
  { code: 'TR', name: 'Tripura', hi: 'त्रिपुरा', col: 7, row: 5 },
  { code: 'MZ', name: 'Mizoram', hi: 'मिज़ोरम', col: 8, row: 5 },
  { code: 'MH', name: 'Maharashtra', hi: 'महाराष्ट्र', col: 1, row: 5 },
  { code: 'GA', name: 'Goa', hi: 'गोवा', col: 1, row: 6 },
  { code: 'TS', name: 'Telangana', hi: 'तेलंगाना', col: 3, row: 5 },
  { code: 'OD', name: 'Odisha', hi: 'ओडिशा', col: 5, row: 5 },
  { code: 'KA', name: 'Karnataka', hi: 'कर्नाटक', col: 2, row: 6 },
  { code: 'AP', name: 'Andhra Pradesh', hi: 'आंध्र प्रदेश', col: 4, row: 6 },
  { code: 'TN', name: 'Tamil Nadu', hi: 'तमिलनाडु', col: 3, row: 7 },
  { code: 'KL', name: 'Kerala', hi: 'केरल', col: 2, row: 8 },
];

const byCode = new Map(STATES.map((s) => [s.code, s]));

export function stateName(code: string | null | undefined, lang: 'en' | 'hi' = 'en'): string {
  if (!code) return '';
  const s = byCode.get(code);
  if (!s) return code;
  return lang === 'hi' ? s.hi : s.name;
}

/** Intensity scale for the map, low → high standing. */
export const INTENSITY = ['#E7EBF1', '#A9C3D9', '#5F8FBF', '#2E5E9E', '#15305E'];

export function intensityBucket(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}
