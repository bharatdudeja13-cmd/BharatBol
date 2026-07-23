import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

/**
 * The published moderation policy (EN + हिंदी), linked from the feed,
 * the submit flow and the report dialog. Plain language on purpose:
 * people should be able to read the rules before they submit.
 */
export default function Moderation() {
  const { t, lang } = useI18n();
  const hi = lang === 'hi';

  const RULES: [string, string][] = [
    [
      'Please keep it civic',
      'BharatBol is for public civic issues. Everything you submit is published immediately, and the platform it comes from (Instagram, YouTube, X, …) is the primary moderator — we only link and embed, never re-host. Please do not submit purely personal, lifestyle, or appearance-focused content. If something does not belong, anyone can report it and it is hidden for a moderator to review.',
    ],
    [
      'Identifying anyone',
      'Nothing that identifies or exposes a private person, protester, police officer, official or bystander - no names, faces used to identify, addresses, phone numbers, ID numbers, or workplaces.',
    ],
    ['Graphic violence', 'No gore, injury, death or violent imagery.'],
    [
      'Targeting people',
      'Nothing that targets, attacks or incites against a person, party, company, community or religion. BharatBol is about issues, never about attacking people.',
    ],
    ['Sexual content', 'No sexual or explicit content.'],
    ['Minors', 'Nothing that identifies, endangers or exploits a minor.'],
    ['Clear misinformation', 'Nothing demonstrably false presented as fact.'],
    ['Off-topic', 'The feed is for civic issues in India - not general entertainment or promotion.'],
  ];

  const RULES_HI: [string, string][] = [
    [
      'कृपया इसे नागरिक रखें',
      'भारत बोल सार्वजनिक नागरिक मुद्दों के लिए है। आप जो भी भेजते हैं वह तुरंत प्रकाशित होता है, और जिस मंच से वह आता है (Instagram, YouTube, X, …) वही प्राथमिक मॉडरेटर है — हम केवल लिंक और एम्बेड करते हैं, कभी दोबारा होस्ट नहीं। कृपया विशुद्ध व्यक्तिगत, जीवनशैली या दिखावट-केंद्रित सामग्री न भेजें। यदि कुछ उपयुक्त न हो, तो कोई भी उसकी रिपोर्ट कर सकता है और वह समीक्षा के लिए छिपा दी जाती है।',
    ],
    [
      'किसी की पहचान उजागर करना',
      'ऐसा कुछ नहीं जो किसी निजी व्यक्ति, प्रदर्शनकारी, पुलिसकर्मी, अधिकारी या राहगीर की पहचान उजागर करे - नाम, पहचान के लिए इस्तेमाल चेहरे, पते, फ़ोन नंबर, पहचान संख्या या कार्यस्थल नहीं।',
    ],
    ['वीभत्स हिंसा', 'खून-ख़राबा, चोट, मृत्यु या हिंसक दृश्य नहीं।'],
    [
      'लोगों को निशाना बनाना',
      'ऐसा कुछ नहीं जो किसी व्यक्ति, दल, कंपनी, समुदाय या धर्म को निशाना बनाए या भड़काए। भारत बोल मुद्दों के बारे में है, लोगों पर हमले के बारे में कभी नहीं।',
    ],
    ['यौन सामग्री', 'यौन या अश्लील सामग्री नहीं।'],
    ['नाबालिग', 'ऐसा कुछ नहीं जो किसी नाबालिग की पहचान उजागर करे या उसे ख़तरे में डाले।'],
    ['स्पष्ट ग़लत जानकारी', 'ऐसा कुछ नहीं जो प्रमाणित रूप से झूठा हो और तथ्य की तरह प्रस्तुत हो।'],
    ['विषय से बाहर', 'यह फ़ीड भारत के नागरिक मुद्दों के लिए है - सामान्य मनोरंजन या प्रचार के लिए नहीं।'],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 space-y-10 leading-relaxed">
      <header>
        <h1 className="font-display font-bold text-3xl text-navy">{t('policy.title')}</h1>
        <p className="mt-3 text-sub">
          {hi
            ? 'अभी सबमिशन तुरंत सार्वजनिक साक्ष्य में जाते हैं। रिपोर्ट पर पोस्ट छिप जाता है; झंडे लगे आइटम /admin में दिखते हैं। मानव-पूर्व-प्रकाशन वापस लाया जा सकता है।'
            : 'Right now submissions go live as public evidence immediately. A report hides the item; flagged items surface in /admin. Human-before-public can be restored.'}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">
          {hi ? 'क्या अनुमत नहीं है' : 'What is not allowed'}
        </h2>
        <ul className="space-y-3">
          {(hi ? RULES_HI : RULES).map(([title, body]) => (
            <li key={title} className="card p-4">
              <strong className="text-ink">{title}</strong>
              <p className="text-sub text-sm mt-1">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">
          {hi ? 'हम क्या संग्रहित करते हैं' : 'What we store'}
        </h2>
        <p className="text-sub">
          {hi
            ? 'केवल लिंक और प्लेटफ़ॉर्म द्वारा सार्वजनिक रूप से दी गई जानकारी (शीर्षक, रचनाकार, थंबनेल का पता)। कोई वीडियो या तस्वीर यहाँ कॉपी या होस्ट नहीं की जाती - सब कुछ मूल प्लेटफ़ॉर्म से ही दिखता है। मूल पोस्ट हटते ही वह यहाँ से भी चला जाता है।'
            : 'Only the link and the metadata the platform itself publishes (title, creator, thumbnail address). No video or image is copied or hosted here - everything plays from the original platform. If the original is deleted, it is gone here too.'}
        </p>
        <p className="text-sub">
          {hi
            ? 'फ़ीड कभी नहीं दिखाता कि कोई पोस्ट किसने भेजा। स्पैम रोकने, दोहराव पकड़ने और शिकायत पर कार्रवाई के लिए यह जानकारी एक निजी, बंद रिकॉर्ड में रहती है जिसे ऐप या जनता कभी नहीं पढ़ सकती।'
            : 'The feed never shows who submitted an item. To stop spam, catch duplicates and act on takedown requests, that link is kept in a private, sealed record that neither the app nor the public can ever read.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">
          {hi ? 'शिकायत और हटाने का रास्ता' : 'Reporting & takedown'}
        </h2>
        <p className="text-sub">
          {hi
            ? 'हर पोस्ट पर “रिपोर्ट करें” बटन है - खाते की ज़रूरत नहीं। रिपोर्ट होते ही वह सार्वजनिक फ़ीड से हट जाता है और दोबारा जाँच के बाद ही लौटता है।'
            : 'Every item has a Report button - no account needed. A reported item leaves the public feed immediately and only returns after a human re-reviews it.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl">
          {hi ? 'सत्यापन के बारे में ईमानदारी' : 'Honesty about verification'}
        </h2>
        <p className="text-sub">
          {hi
            ? 'फ़ीड की हर सामग्री “असत्यापित” चिह्नित है। भारत बोल यह पुष्टि नहीं करता कि किसी पोस्ट में दिखाई या कही गई बात सच है - यह केवल मूल पोस्ट तक ले जाता है, ताकि आप ख़ुद देखें।'
            : 'Every feed item is labelled “unverified”. BharatBol does not certify that anything shown or claimed in a post is true - it links you to the original so you can judge it yourself.'}
        </p>
      </section>

      <p className="text-sm">
        <Link to="/feed" className="text-navy underline underline-offset-4">
          ← {t('feed.title')}
        </Link>
      </p>

      <section className="card p-5 text-sm text-sub">{t('disclaimer')}</section>
    </div>
  );
}
