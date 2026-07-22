import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'hi';

const en = {
  'app.name': 'BharatBol',
  'app.tagline': 'Bharat, speak.',
  'app.kicker': 'An independent, non-partisan civic square',
  'app.sub':
    'Whatever party you support — or none — stand on the issues that matter and be counted. Free. Public. Revocable by you.',
  'nav.stands': 'Stands',
  'nav.about': 'About',
  'nav.profile': 'My card',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
  'hero.ctaStand': 'Take a stand',
  'hero.ctaAbout': 'How counts work',
  'counts.standing': 'citizens standing',
  'counts.taken': 'stands taken by citizens across India',
  'counts.today': 'today',
  'counts.verified': 'Verified engaged citizens — one account, one stand. Not a census.',
  'receipts.title': 'Your ballot receipts',
  'receipts.explain':
    'Receipts are the anonymous proof of your stands. They exist only in this browser — export a backup to withdraw or continue from another device. BharatBol cannot restore them: that is what keeps your ballots unlinkable.',
  'receipts.export': 'Export receipts',
  'receipts.import': 'Import receipts',
  'receipts.imported': 'Receipts imported',
  'join.locked':
    'Your anonymous token for this issue lives on another device. Export your receipts there and import them here to act from this device.',
  'join.notReady': 'Your anonymous tokens are still being issued — try again in a moment.',
  'join.noKey': 'Live joining is not configured yet (registrar key missing).',
  'stand.standWith': 'I stand with this',
  'stand.standing': 'You stand with this',
  'stand.share': 'Share',
  'stand.withdraw': 'Withdraw my stand',
  'stand.live': 'Live',
  'stand.seeAll': 'See all stands',
  'stand.notFound': 'This stand could not be found.',
  'wall.title': 'Citizens standing',
  'wall.sub': 'First name and state only — shown with their permission.',
  'wall.empty': 'Be the first name on this wall.',
  'map.title': 'Where India stands',
  'map.sub': 'Tap a state to see how its citizens are standing.',
  'map.inState': 'standing in',
  'map.noData': 'No stands recorded here yet.',
  'join.title': 'Before you stand',
  'join.name': 'First name',
  'join.state': 'Your state',
  'join.statePlaceholder': 'Choose your state',
  'join.wall': 'Show me on the public wall as “First name · State”',
  'join.privacy': 'Only your first name and state can ever appear publicly. Never your full name, email, or account.',
  'join.confirm': 'Stand and be counted',
  'join.cancel': 'Not now',
  'share.title': 'Your voice is counted.',
  'share.startTitle': 'Start the call.',
  'share.sub': 'Sharing your card is how the count grows.',
  'share.button': 'Share card',
  'share.download': 'Download PNG',
  'share.whatsapp': 'WhatsApp',
  'share.x': 'X / Twitter',
  'share.instagram': 'Instagram',
  'share.instagramHint': 'Caption copied — now post the saved card.',
  'share.copy': 'Copy link',
  'share.copied': 'Link copied',
  'share.caption': 'Caption',
  'share.copyCaption': 'Copy caption',
  'share.captionCopied': 'Caption copied',
  'share.formatPost': 'Post · 4:5',
  'share.formatStory': 'Story · 9:16',
  'campaign.start': 'Start a call',
  'campaign.line': 'Bharat bol raha hai — add your voice.',
  'citizen.title': 'Your citizen card',
  'citizen.standsWith': 'stands with India',
  'profile.title': 'Your profile',
  'profile.firstName': 'First name',
  'profile.state': 'State',
  'profile.showOnWall': 'Show my first name + state on public walls',
  'profile.save': 'Save',
  'profile.saved': 'Saved',
  'profile.myStands': 'Issues you stand for',
  'profile.none': 'You haven’t taken a stand yet.',
  'profile.signInFirst': 'Sign in with Google to stand and get your citizen card.',
  'profile.delete': 'Delete my account & data',
  'profile.deleteWarn':
    'This permanently removes your account, your profile, and every stand you have taken. Counts will decrease accordingly. This cannot be undone.',
  'profile.deleteConfirm': 'Yes, erase everything',
  'disclaimer':
    'BharatBol is an independent, non-partisan civic platform. It is not affiliated with any government, party, or election authority. Counts reflect public sentiment and are not an election.',
  'footer.about': 'About & transparency',
  'footer.data': 'Your data & rights',
  'footer.source': 'Open source',
  'demo.banner': 'Demo mode — sample data. Connect Supabase to go live.',
  'misc.loading': 'Loading…',
  'misc.back': 'Back',
  'misc.error': 'Something went wrong. Please try again.',
};

const hi: Record<keyof typeof en, string> = {
  'app.name': 'भारत बोल',
  'app.tagline': 'भारत, बोल।',
  'app.kicker': 'एक स्वतंत्र, गैर-दलीय नागरिक मंच',
  'app.sub':
    'आप किसी भी दल के समर्थक हों — या किसी के नहीं — जो मुद्दे मायने रखते हैं उन पर खड़े हों और गिने जाएँ। निःशुल्क। सार्वजनिक। आपके हाथ में।',
  'nav.stands': 'मुद्दे',
  'nav.about': 'परिचय',
  'nav.profile': 'मेरा कार्ड',
  'nav.signIn': 'साइन इन',
  'nav.signOut': 'साइन आउट',
  'hero.ctaStand': 'अपना पक्ष रखें',
  'hero.ctaAbout': 'गिनती कैसे होती है',
  'counts.standing': 'नागरिक साथ खड़े हैं',
  'counts.taken': 'भारत भर के नागरिकों ने पक्ष लिए हैं',
  'counts.today': 'आज',
  'counts.verified': 'सत्यापित सक्रिय नागरिक — एक खाता, एक पक्ष। यह जनगणना नहीं है।',
  'receipts.title': 'आपकी मतपत्र रसीदें',
  'receipts.explain':
    'रसीदें आपके पक्षों का गुमनाम प्रमाण हैं। ये केवल इसी ब्राउज़र में हैं — दूसरे डिवाइस से जारी रखने या वापस लेने के लिए बैकअप निर्यात करें। भारत बोल इन्हें बहाल नहीं कर सकता: यही आपकी गुमनामी की गारंटी है।',
  'receipts.export': 'रसीदें निर्यात करें',
  'receipts.import': 'रसीदें आयात करें',
  'receipts.imported': 'रसीदें आयात हुईं',
  'join.locked':
    'इस मुद्दे का आपका गुमनाम टोकन दूसरे डिवाइस पर है। वहाँ से रसीदें निर्यात कर यहाँ आयात करें।',
  'join.notReady': 'आपके गुमनाम टोकन अभी जारी हो रहे हैं — थोड़ी देर में फिर प्रयास करें।',
  'join.noKey': 'लाइव जुड़ाव अभी कॉन्फ़िगर नहीं है (रजिस्ट्रार कुंजी अनुपस्थित)।',
  'stand.standWith': 'मैं इसके साथ हूँ',
  'stand.standing': 'आप इसके साथ खड़े हैं',
  'stand.share': 'साझा करें',
  'stand.withdraw': 'अपना समर्थन वापस लें',
  'stand.live': 'लाइव',
  'stand.seeAll': 'सभी मुद्दे देखें',
  'stand.notFound': 'यह मुद्दा नहीं मिला।',
  'wall.title': 'साथ खड़े नागरिक',
  'wall.sub': 'सिर्फ़ पहला नाम और राज्य — उनकी अनुमति से।',
  'wall.empty': 'इस दीवार पर पहला नाम आपका हो।',
  'map.title': 'भारत कहाँ खड़ा है',
  'map.sub': 'किसी राज्य पर टैप करें और देखें वहाँ के नागरिक कैसे खड़े हैं।',
  'map.inState': 'साथ खड़े हैं —',
  'map.noData': 'यहाँ अभी कोई गिनती दर्ज नहीं है।',
  'join.title': 'खड़े होने से पहले',
  'join.name': 'पहला नाम',
  'join.state': 'आपका राज्य',
  'join.statePlaceholder': 'अपना राज्य चुनें',
  'join.wall': 'सार्वजनिक दीवार पर मुझे “पहला नाम · राज्य” के रूप में दिखाएँ',
  'join.privacy': 'सार्वजनिक रूप से केवल आपका पहला नाम और राज्य ही दिख सकता है। कभी भी पूरा नाम, ईमेल या खाता नहीं।',
  'join.confirm': 'खड़े हों और गिने जाएँ',
  'join.cancel': 'अभी नहीं',
  'share.title': 'आपकी आवाज़ गिनी गई।',
  'share.startTitle': 'आवाज़ शुरू कीजिए।',
  'share.sub': 'अपना कार्ड साझा करना ही गिनती बढ़ाता है।',
  'share.button': 'कार्ड साझा करें',
  'share.download': 'PNG डाउनलोड',
  'share.whatsapp': 'व्हाट्सऐप',
  'share.x': 'X / ट्विटर',
  'share.instagram': 'इंस्टाग्राम',
  'share.instagramHint': 'कैप्शन कॉपी हुआ — अब सहेजा कार्ड पोस्ट करें।',
  'share.copy': 'लिंक कॉपी करें',
  'share.copied': 'लिंक कॉपी हुआ',
  'share.caption': 'कैप्शन',
  'share.copyCaption': 'कैप्शन कॉपी करें',
  'share.captionCopied': 'कैप्शन कॉपी हुआ',
  'share.formatPost': 'पोस्ट · 4:5',
  'share.formatStory': 'स्टोरी · 9:16',
  'campaign.start': 'आवाज़ उठाइए',
  'campaign.line': 'भारत बोल रहा है — अपनी आवाज़ जोड़िए।',
  'citizen.title': 'आपका नागरिक कार्ड',
  'citizen.standsWith': 'भारत के साथ खड़े हैं',
  'profile.title': 'आपकी प्रोफ़ाइल',
  'profile.firstName': 'पहला नाम',
  'profile.state': 'राज्य',
  'profile.showOnWall': 'सार्वजनिक दीवारों पर मेरा पहला नाम + राज्य दिखाएँ',
  'profile.save': 'सहेजें',
  'profile.saved': 'सहेजा गया',
  'profile.myStands': 'जिन मुद्दों के साथ आप खड़े हैं',
  'profile.none': 'आपने अभी तक कोई पक्ष नहीं लिया है।',
  'profile.signInFirst': 'खड़े होने और अपना नागरिक कार्ड पाने के लिए Google से साइन इन करें।',
  'profile.delete': 'मेरा खाता और डेटा मिटाएँ',
  'profile.deleteWarn':
    'इससे आपका खाता, प्रोफ़ाइल और आपके सभी पक्ष स्थायी रूप से हट जाएँगे। गिनती उसी अनुसार घटेगी। इसे वापस नहीं किया जा सकता।',
  'profile.deleteConfirm': 'हाँ, सब कुछ मिटाएँ',
  'disclaimer':
    'भारत बोल एक स्वतंत्र, गैर-दलीय नागरिक मंच है। यह किसी सरकार, दल या चुनाव प्राधिकरण से संबद्ध नहीं है। ये संख्याएँ जन-भावना दर्शाती हैं — यह कोई चुनाव नहीं है।',
  'footer.about': 'परिचय व पारदर्शिता',
  'footer.data': 'आपका डेटा व अधिकार',
  'footer.source': 'ओपन सोर्स',
  'demo.banner': 'डेमो मोड — नमूना डेटा। लाइव होने के लिए Supabase जोड़ें।',
  'misc.loading': 'लोड हो रहा है…',
  'misc.back': 'वापस',
  'misc.error': 'कुछ गड़बड़ हुई। कृपया फिर प्रयास करें।',
};

const DICTS: Record<Lang, Record<string, string>> = { en, hi };

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof en) => string;
};

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => en[k] });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem('bharatbol:lang') === 'hi' ? 'hi' : 'en'
  );
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('bharatbol:lang', l);
    document.documentElement.lang = l;
  }, []);
  const t = useCallback(
    (key: keyof typeof en) => DICTS[lang][key] ?? en[key],
    [lang]
  );
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
