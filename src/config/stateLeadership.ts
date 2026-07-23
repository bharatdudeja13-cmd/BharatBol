/**
 * Public office-holder and report-contact directory for the state panel.
 * Office-holder details were audited against official government sources on
 * 23 July 2026. They must still be rechecked immediately before any report
 * is sent, since office holders and published contacts can change.
 * Grievance contacts are from CPGRAMS' state nodal-officer directory:
 * https://www.pgportal.gov.in/Home/NodalPgOfficersState
 */
export type StateLeadership = {
  designation: string;
  name: string;
  party: string;
  grievanceEmail: string;
};

/**
 * The National Portal is the public, government-maintained directory used for
 * the office-holder audit. Individual state government pages are used where a
 * recent change is not yet reflected in that directory.
 */
export const LEADERSHIP_VERIFIED_ON = '23 July 2026';
export const OFFICIAL_LEADERSHIP_DIRECTORY_URL =
  'https://www.india.gov.in/directory/whos-who/chief-ministers-of-states-and-union-territories';

export const STATE_LEADERSHIP: Record<string, StateLeadership> = {
  AP: { designation: 'Chief Minister', name: 'N. Chandrababu Naidu', party: 'Telugu Desam Party', grievanceEmail: 'pgrs-helpdesk@ap.gov.in' },
  AR: { designation: 'Chief Minister', name: 'Pema Khandu', party: 'Bharatiya Janata Party', grievanceEmail: 'mari.angu@gov.in' },
  AS: { designation: 'Chief Minister', name: 'Himanta Biswa Sarma', party: 'Bharatiya Janata Party', grievanceEmail: 'artassamdept@gmail.com' },
  BR: { designation: 'Chief Minister', name: 'Samrat Choudhary', party: 'Bharatiya Janata Party', grievanceEmail: 'cmbihar@nic.in' },
  CG: { designation: 'Chief Minister', name: 'Vishnu Deo Sai', party: 'Bharatiya Janata Party', grievanceEmail: 'pgc-gad.cg@gov.in' },
  DL: { designation: 'Chief Minister', name: 'Rekha Gupta', party: 'Bharatiya Janata Party', grievanceEmail: 'paditi@gmail.com' },
  GA: { designation: 'Chief Minister', name: 'Pramod Sawant', party: 'Bharatiya Janata Party', grievanceEmail: 'us-pgc.goa@nic.in' },
  GJ: { designation: 'Chief Minister', name: 'Bhupendra Patel', party: 'Bharatiya Janata Party', grievanceEmail: 'secartd@gujarat.gov.in' },
  HP: { designation: 'Chief Minister', name: 'Sukhvinder Singh Sukhu', party: 'Indian National Congress', grievanceEmail: 'rpgsecy-hp@nic.in' },
  HR: { designation: 'Chief Minister', name: 'Nayab Singh Saini', party: 'Bharatiya Janata Party', grievanceEmail: 'supdt.cpgrams22@gmail.com' },
  JH: { designation: 'Chief Minister', name: 'Hemant Soren', party: 'Jharkhand Mukti Morcha', grievanceEmail: 'pgportal.jhr@gmail.com' },
  JK: { designation: 'Chief Minister', name: 'Omar Abdullah', party: 'Jammu & Kashmir National Conference', grievanceEmail: 'qureshi.azee@jk.gov.in' },
  KA: { designation: 'Chief Minister', name: 'Siddaramaiah', party: 'Indian National Congress', grievanceEmail: 'us2dpar-js@karnataka.gov.in' },
  KL: { designation: 'Chief Minister', name: 'V. D. Satheesan', party: 'Indian National Congress', grievanceEmail: 'priority.cmo@kerala.gov.in' },
  MH: { designation: 'Chief Minister', name: 'Devendra Fadnavis', party: 'Bharatiya Janata Party', grievanceEmail: 'hemant.mahajan@nic.in' },
  ML: { designation: 'Chief Minister', name: 'Conrad K. Sangma', party: 'National People’s Party', grievanceEmail: 'cyril.diengdoh@gov.in' },
  MN: { designation: 'Chief Minister', name: 'Yumnam Khemchand Singh', party: 'Bharatiya Janata Party', grievanceEmail: 'leiyaphi.kh@gov.in' },
  MP: { designation: 'Chief Minister', name: 'Mohan Yadav', party: 'Bharatiya Janata Party', grievanceEmail: 'cmhelpline@mp.gov.in' },
  MZ: { designation: 'Chief Minister', name: 'Lalduhoma', party: 'Zoram People’s Movement', grievanceEmail: 'ggcmiz@gmail.com' },
  NL: { designation: 'Chief Minister', name: 'Neiphiu Rio', party: 'Nationalist Democratic Progressive Party', grievanceEmail: 'vechovo.tetseo@nic.in' },
  OD: { designation: 'Chief Minister', name: 'Mohan Charan Majhi', party: 'Bharatiya Janata Party', grievanceEmail: 'gapgpublicgrievance@gmail.com' },
  PB: { designation: 'Chief Minister', name: 'Bhagwant Mann', party: 'Aam Aadmi Party', grievanceEmail: 'grievanceredressal2@gmail.com' },
  RJ: { designation: 'Chief Minister', name: 'Bhajan Lal Sharma', party: 'Bharatiya Janata Party', grievanceEmail: 'DS.RPG@RAJASTHAN.GOV.IN' },
  SK: { designation: 'Chief Minister', name: 'Prem Singh Tamang', party: 'Sikkim Krantikari Morcha', grievanceEmail: 'gos.dopart@gmail.com' },
  TN: { designation: 'Chief Minister', name: 'C. Joseph Vijay', party: 'Tamilaga Vettri Kazhagam', grievanceEmail: 'cmcell@tn.gov.in' },
  TR: { designation: 'Chief Minister', name: 'Manik Saha', party: 'Bharatiya Janata Party', grievanceEmail: 'gaar.agt-tr@nic.in' },
  TS: { designation: 'Chief Minister', name: 'A. Revanth Reddy', party: 'Indian National Congress', grievanceEmail: 'secy-pgr-gad@telangana.gov.in' },
  UK: { designation: 'Chief Minister', name: 'Pushkar Singh Dhami', party: 'Bharatiya Janata Party', grievanceEmail: 'cm_helpline@uk.gov.in' },
  UP: { designation: 'Chief Minister', name: 'Yogi Adityanath', party: 'Bharatiya Janata Party', grievanceEmail: 'arvind.12574@gov.in' },
  WB: { designation: 'Chief Minister', name: 'Suvendu Adhikari', party: 'Bharatiya Janata Party', grievanceEmail: 'jointsecretarypar@gmail.com' },
};
