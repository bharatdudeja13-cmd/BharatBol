-- ============================================================
-- BharatBol - content ingest: national + state-tagged stands
-- Run AFTER phase7_geography.sql (needs stand_states).
--
-- Guardrails:
--   * Issue-framed only (never person / party / religion / community)
--   * Categories in education|employment|transparency|democracy|health|
--     environment|infrastructure|safety
--   * State codes in src/lib/states.ts tilegram codes
--   * status = live; every stand is national; stand_states = relevance tags
--   * Idempotent: fixed UUIDs + upsert; safe to re-run
--
-- Production project (SQL editor): byfwdrazysblopnlahmx
-- ============================================================

begin;

-- ---------- Stands (14) ----------
insert into public.stands (
  id, title, title_hi, description, description_hi, category, status
) values
(
  'a1000001-0000-4000-8000-000000000001',
  'Publish exam-process audits after every national board and entrance cycle',
  'हर राष्ट्रीय बोर्ड और प्रवेश परीक्षा चक्र के बाद परीक्षा-प्रक्रिया ऑडिट प्रकाशित हों',
  'After every national board and entrance examination cycle, an independent process audit should be completed and published in full. Students and families deserve open findings, not closed files. This stand is about the process, not any person or body.',
  'हर राष्ट्रीय बोर्ड और प्रवेश परीक्षा चक्र के बाद स्वतंत्र प्रक्रिया-ऑडिट पूरा हो और पूरा प्रकाशित हो। विद्यार्थियों और परिवारों को बंद फाइलें नहीं, खुले निष्कर्ष चाहिए। यह पक्ष प्रक्रिया के बारे में है, किसी व्यक्ति या संस्था के बारे में नहीं।',
  'education',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000002',
  'Open monthly youth employment and job-placement figures as public data',
  'युवा रोज़गार और नौकरी-नियुक्ति के मासिक आँकड़े सार्वजनिक आँकड़ों के रूप में खुलें',
  'Every month, youth employment, apprenticeship, and public job-placement figures should be released in machine-readable open data, with clear definitions. Families across India need honest numbers to judge whether plans are working.',
  'हर महीने युवा रोज़गार, अप्रेंटिसशिप और सार्वजनिक नौकरी-नियुक्ति के आँकड़े स्पष्ट परिभाषाओं के साथ मशीन-पठनीय खुले आँकड़ों में जारी हों। भारत भर के परिवारों को यह समझने के लिए ईमानदार संख्याएँ चाहिए कि योजनाएँ काम कर रही हैं या नहीं।',
  'employment',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000003',
  'Verifiable safeguards so every vote cast is counted correctly',
  'हर डाले गए वोट के सही गिने जाने के लिए सत्यापन-योग्य सुरक्षा उपाय',
  'Whatever preference a citizen holds, everyone depends on every vote being cast and counted correctly. Stronger, verifiable safeguards and open audit trails protect the democratic process equally for all.',
  'नागरिक की पसंद कुछ भी हो, हर कोई इस पर निर्भर है कि हर वोट सही डाला और गिना जाए। मज़बूत, सत्यापन-योग्य सुरक्षा उपाय और खुली ऑडिट पगडंडियाँ लोकतांत्रिक प्रक्रिया की समान रक्षा करती हैं।',
  'democracy',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000004',
  'Live public dashboards for essential medicines in government hospitals',
  'सरकारी अस्पतालों में ज़रूरी दवाओं के लाइव सार्वजनिक डैशबोर्ड',
  'Essential medicine stock at government hospitals and primary health centres should appear on a live public dashboard, updated daily. Empty shelves should not stay invisible. Care is a public duty, and stockouts are a public fact.',
  'सरकारी अस्पतालों और प्राथमिक स्वास्थ्य केन्द्रों में ज़रूरी दवाओं का स्टॉक प्रतिदिन अपडेट होते लाइव सार्वजनिक डैशबोर्ड पर दिखे। खाली अलमारियाँ अदृश्य न रहें। देखभाल सार्वजनिक कर्तव्य है, और स्टॉक-आउट एक सार्वजनिक तथ्य।',
  'health',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000005',
  'Publish completed public audit findings on one searchable portal within 30 days',
  'पूर्ण सार्वजनिक ऑडिट निष्कर्ष 30 दिनों में एक खोज-योग्य पोर्टल पर प्रकाशित हों',
  'When a public audit is completed, the findings should appear on a single searchable national portal within 30 days, in plain language summaries plus the full report. Delay and scatter make accountability optional.',
  'जब कोई सार्वजनिक ऑडिट पूरा हो, उसके निष्कर्ष 30 दिनों में एक खोज-योग्य राष्ट्रीय पोर्टल पर आएँ: सरल भाषा में सार और पूरी रिपोर्ट दोनों। देरी और बिखराव जवाबदेही को वैकल्पिक बना देते हैं।',
  'transparency',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000006',
  'Expand real-time air quality monitors and publish the raw open data',
  'रीयल-टाइम वायु गुणवत्ता मॉनिटर बढ़ाएँ और कच्चे खुले आँकड़े प्रकाशित करें',
  'Most people still live outside reliable real-time air quality coverage. Expand monitors into uncovered districts and publish raw readings as open data so health advice can rest on facts, not gaps.',
  'अधिकतर लोग अभी भी भरोसेमंद रीयल-टाइम वायु गुणवत्ता कवरेज से बाहर रहते हैं। बिना कवरेज वाले ज़िलों में मॉनिटर बढ़ाएँ और कच्ची रीडिंग खुले आँकड़ों में प्रकाशित करें, ताकि स्वास्थ्य सलाह अनुमान नहीं, तथ्यों पर टिके।',
  'environment',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000007',
  'A published AQI health-action plan that triggers when air turns severe',
  'जब हवा गंभीर हो तो लागू होने वाली प्रकाशित AQI स्वास्थ्य-कार्य योजना',
  'Especially relevant in Delhi: when air quality crosses severe bands, a pre-published health-action plan should trigger automatically - school and outdoor-work guidance, public alerts, and hospital readiness - with each step logged in the open.',
  'दिल्ली में विशेष रूप से प्रासंगिक: जब वायु गुणवत्ता गंभीर स्तर पार करे, पहले से प्रकाशित स्वास्थ्य-कार्य योजना अपने आप लागू हो - स्कूल और बाहरी काम का मार्गदर्शन, सार्वजनिक चेतावनी, अस्पताल तैयारी - और हर कदम खुले में दर्ज हो।',
  'environment',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000008',
  'Time-bound groundwater recharge targets with public well-level data',
  'सार्वजनिक कुएँ-स्तर आँकड़ों के साथ समयबद्ध भूजल पुनर्भरण लक्ष्य',
  'Especially relevant in Punjab, Haryana, and Rajasthan: set time-bound groundwater recharge and extraction targets, and publish well-level and block-wise stress data every quarter so over-extraction cannot stay hidden.',
  'पंजाब, हरियाणा और राजस्थान में विशेष रूप से प्रासंगिक: भूजल पुनर्भरण और दोहन के समयबद्ध लक्ष्य तय हों, और हर तिमाही कुएँ-स्तर तथा ब्लॉक-वार तनाव के आँकड़े प्रकाशित हों, ताकि अति-दोहन छुपा न रह सके।',
  'environment',
  'live'
),
(
  'a1000001-0000-4000-8000-000000000009',
  'Annual flood-embankment inspection reports funded and published before monsoon',
  'मानसून से पहले वित्तपोषित और प्रकाशित वार्षिक बाढ़-बंध जाँच रिपोर्टें',
  'Especially relevant in Assam and Bihar: every year before monsoon, embankment and flood-defence inspection reports should be completed, funded for urgent repairs, and published so residents can see what was checked and what remains weak.',
  'असम और बिहार में विशेष रूप से प्रासंगिक: हर वर्ष मानसून से पहले बाँध और बाढ़-रक्षा की जाँच रिपोर्टें पूरी हों, ज़रूरी मरम्मत का बजट लगे, और वे प्रकाशित हों ताकि निवासी देख सकें क्या जाँचा गया और कहाँ कमज़ोरी बाकी है।',
  'infrastructure',
  'live'
),
(
  'a1000001-0000-4000-8000-00000000000a',
  'A transparent timeline for suburban rail capacity and station access upgrades',
  'उपनगरीय रेल क्षमता और स्टेशन पहुँच उन्नयन की पारदर्शी समय-सीमा',
  'Especially relevant in Maharashtra: publish a clear, dated timeline for suburban rail capacity, safety systems, and step-free station access, with quarterly progress anyone can read. Crowding and access are civic facts, not private schedules.',
  'महाराष्ट्र में विशेष रूप से प्रासंगिक: उपनगरीय रेल क्षमता, सुरक्षा प्रणालियों और स्टेशन पर बिना सीढ़ी पहुँच के लिए स्पष्ट, तिथिवार समय-सीमा प्रकाशित हो, तिमाही प्रगति सहित जिसे कोई भी पढ़ सके। भीड़ और पहुँच नागरिक तथ्य हैं, निजी अनुसूची नहीं।',
  'infrastructure',
  'live'
),
(
  'a1000001-0000-4000-8000-00000000000b',
  'Monthly urban water-storage and tanker-dependency figures for Karnataka cities',
  'कर्नाटक के शहरों के लिए मासिक शहरी जल-भंडारण और टैंकर-निर्भरता आँकड़े',
  'Especially relevant in Karnataka: every month, publish city-wise reservoir storage, supply hours, and public tanker dependency in open data. Water stress should be visible early, while there is still time to act.',
  'कर्नाटक में विशेष रूप से प्रासंगिक: हर महीने शहरवार जलाशय भंडारण, आपूर्ति घंटे और सार्वजनिक टैंकर निर्भरता खुले आँकड़ों में प्रकाशित हों। जल संकट जल्दी दिखे, जब अभी कार्रवाई का समय हो।',
  'environment',
  'live'
),
(
  'a1000001-0000-4000-8000-00000000000c',
  'Landslide early-warning coverage and public risk maps for hill districts',
  'पहाड़ी ज़िलों के लिए भूस्खलन पूर्व-चेतावनी कवरेज और सार्वजनिक जोखिम मानचित्र',
  'Especially relevant in Kerala, Himachal Pradesh, and Uttarakhand: expand landslide early-warning coverage and publish district risk maps, sensor status, and evacuation-route readiness before every monsoon and winter cut season.',
  'केरल, हिमाचल प्रदेश और उत्तराखंड में विशेष रूप से प्रासंगिक: भूस्खलन पूर्व-चेतावनी कवरेज बढ़ाएँ और हर मानसून तथा शीतकालीन कट सीज़न से पहले ज़िला जोखिम मानचित्र, सेंसर स्थिति और निकासी मार्गों की तैयारी प्रकाशित करें।',
  'safety',
  'live'
),
(
  'a1000001-0000-4000-8000-00000000000d',
  'Pre-monsoon cyclone-shelter audits with public readiness scores',
  'सार्वजनिक तैयारी अंकों सहित मानसून-पूर्व चक्रवात आश्रय ऑडिट',
  'Especially relevant in Odisha and West Bengal: before each cyclone season, audit every listed shelter for capacity, water, power, and access, then publish readiness scores so coastal families know where to go and what still needs fixing.',
  'ओडिशा और पश्चिम बंगाल में विशेष रूप से प्रासंगिक: हर चक्रवात सीज़न से पहले सूचीबद्ध हर आश्रय की क्षमता, पानी, बिजली और पहुँच की जाँच हो, फिर तैयारी अंक प्रकाशित हों ताकि तटीय परिवार जान सकें कहाँ जाना है और क्या अभी सुधारना बाकी है।',
  'safety',
  'live'
),
(
  'a1000001-0000-4000-8000-00000000000e',
  'Mandatory drainage-capacity audits after every major urban flood',
  'हर बड़े शहरी बाढ़ के बाद अनिवार्य निकासी-क्षमता ऑडिट',
  'Especially relevant in Telangana and Tamil Nadu: after every major urban flood, publish a drainage-capacity audit within 60 days - what failed, what will be rebuilt, and by when - so the next season is not a repeat of the last.',
  'तेलंगाना और तमिलनाडु में विशेष रूप से प्रासंगिक: हर बड़े शहरी बाढ़ के बाद 60 दिनों में निकासी-क्षमता ऑडिट प्रकाशित हो - क्या विफल हुआ, क्या फिर बनेगा, और कब तक - ताकि अगला सीज़न पिछले जैसा न दोहराए।',
  'infrastructure',
  'live'
)
on conflict (id) do update set
  title = excluded.title,
  title_hi = excluded.title_hi,
  description = excluded.description,
  description_hi = excluded.description_hi,
  category = excluded.category,
  status = excluded.status;

-- ---------- State relevance tags (phase7 stand_states) ----------
delete from public.stand_states
where stand_id in (
  'a1000001-0000-4000-8000-000000000007',
  'a1000001-0000-4000-8000-000000000008',
  'a1000001-0000-4000-8000-000000000009',
  'a1000001-0000-4000-8000-00000000000a',
  'a1000001-0000-4000-8000-00000000000b',
  'a1000001-0000-4000-8000-00000000000c',
  'a1000001-0000-4000-8000-00000000000d',
  'a1000001-0000-4000-8000-00000000000e'
);

insert into public.stand_states (stand_id, state) values
  ('a1000001-0000-4000-8000-000000000007', 'DL'),
  ('a1000001-0000-4000-8000-000000000008', 'PB'),
  ('a1000001-0000-4000-8000-000000000008', 'HR'),
  ('a1000001-0000-4000-8000-000000000008', 'RJ'),
  ('a1000001-0000-4000-8000-000000000009', 'AS'),
  ('a1000001-0000-4000-8000-000000000009', 'BR'),
  ('a1000001-0000-4000-8000-00000000000a', 'MH'),
  ('a1000001-0000-4000-8000-00000000000b', 'KA'),
  ('a1000001-0000-4000-8000-00000000000c', 'KL'),
  ('a1000001-0000-4000-8000-00000000000c', 'HP'),
  ('a1000001-0000-4000-8000-00000000000c', 'UK'),
  ('a1000001-0000-4000-8000-00000000000d', 'OD'),
  ('a1000001-0000-4000-8000-00000000000d', 'WB'),
  ('a1000001-0000-4000-8000-00000000000e', 'TS'),
  ('a1000001-0000-4000-8000-00000000000e', 'TN');

commit;
