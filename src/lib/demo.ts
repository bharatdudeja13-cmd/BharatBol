// Local demo data, used only when Supabase env vars are not configured.
// Lets anyone run the UI (and reviewers audit it) without a backend.
import type { Stand, Counts, WallEntry, StateRow } from './types';
import { STATES } from './states';

const mk = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

export const DEMO_STANDS: Stand[] = [
  {
    id: mk(1),
    title: 'An independent re-audit of the 2026 NEET & CBSE examinations',
    title_hi: '2026 NEET और CBSE परीक्षाओं का स्वतंत्र पुनः-ऑडिट',
    description:
      "A neutral, independent audit of this year's NEET and CBSE examination processes, with the findings published for everyone to read. This is not against any person or institution - it is for restoring every student's confidence in the system.",
    description_hi:
      'इस वर्ष की NEET और CBSE परीक्षा प्रक्रियाओं का एक तटस्थ, स्वतंत्र ऑडिट, जिसके निष्कर्ष सबके लिए प्रकाशित हों।',
    category: 'education',
    status: 'live',
    created_at: new Date().toISOString(),
  },
  {
    id: mk(2),
    title: 'Publish examination-body audit reports publicly',
    title_hi: 'परीक्षा संस्थाओं की ऑडिट रिपोर्ट सार्वजनिक हों',
    description:
      'Every audit report of every public examination body should be published openly, as a matter of routine. Transparency is not an accusation - it is how trust is built.',
    description_hi: 'हर सार्वजनिक परीक्षा संस्था की हर ऑडिट रिपोर्ट नियमित रूप से सार्वजनिक की जाए।',
    category: 'transparency',
    status: 'live',
    created_at: new Date().toISOString(),
  },
  {
    id: mk(3),
    title: 'A fixed timeline to fill vacant public teaching posts',
    title_hi: 'रिक्त सरकारी शिक्षक पदों को भरने की निश्चित समय-सीमा',
    description:
      'Lakhs of sanctioned teaching posts lie vacant across India. A clear, published timeline to fill them - with progress reported openly - would serve every child, in every state.',
    description_hi: 'लाखों स्वीकृत शिक्षक पद रिक्त हैं। इन्हें भरने की स्पष्ट, प्रकाशित समय-सीमा हर बच्चे के हित में है।',
    category: 'education',
    status: 'live',
    created_at: new Date().toISOString(),
  },
  {
    id: mk(4),
    title: 'Stronger safeguards for the integrity of every vote',
    title_hi: 'हर वोट की विश्वसनीयता के लिए मज़बूत सुरक्षा उपाय',
    description:
      'Whatever party we each support, all of us depend on every vote being counted correctly. Stronger, verifiable safeguards and open processes protect everyone equally.',
    description_hi: 'मज़बूत, सत्यापन-योग्य सुरक्षा उपाय और खुली प्रक्रियाएँ सबकी समान रूप से रक्षा करती हैं।',
    category: 'democracy',
    status: 'live',
    created_at: new Date().toISOString(),
  },
  {
    id: mk(5),
    title: 'Faster, transparent action on youth unemployment',
    title_hi: 'युवा बेरोज़गारी पर तेज़ और पारदर्शी कार्रवाई',
    description:
      'Regular, honest publication of employment data and a transparent, time-bound plan for youth employment - an issue that touches every family, across every party line.',
    description_hi: 'रोज़गार के आँकड़ों का नियमित प्रकाशन और युवा रोज़गार की पारदर्शी, समयबद्ध योजना।',
    category: 'employment',
    status: 'live',
    created_at: new Date().toISOString(),
  },
];

const NAMES = [
  'Aarti', 'Rohan', 'Fatima', 'Harpreet', 'Meena', 'Joseph', 'Ananya', 'Vikram',
  'Sneha', 'Imran', 'Kavya', 'Tenzin', 'Lakshmi', 'Arjun', 'Priya', 'Suresh',
  'Nazia', 'Gurpreet', 'Divya', 'Manoj',
];

// Deterministic pseudo-random so the demo looks stable between reloads.
const rand = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const r = rand(20260722);

export const DEMO_COUNTS: Record<string, Counts> = Object.fromEntries(
  DEMO_STANDS.map((s, i) => [
    s.id,
    { total: 18000 + Math.floor(r() * 60000) + i * 4000, today: 120 + Math.floor(r() * 900) },
  ])
);

export const DEMO_NATIONAL = Object.values(DEMO_COUNTS).reduce((a, c) => a + c.total, 0);

export const DEMO_WALL: WallEntry[] = Array.from({ length: 40 }, (_, i) => ({
  stand_id: DEMO_STANDS[Math.floor(r() * DEMO_STANDS.length)].id,
  first_name: NAMES[Math.floor(r() * NAMES.length)],
  state: STATES[Math.floor(r() * STATES.length)].code,
  created_at: new Date(Date.now() - i * 47000).toISOString(),
}));

export const DEMO_BREAKDOWN: StateRow[] = DEMO_STANDS.flatMap((s) =>
  STATES.map((st) => ({
    stand_id: s.id,
    state: st.code,
    count: Math.floor(r() * 4000),
  }))
);
