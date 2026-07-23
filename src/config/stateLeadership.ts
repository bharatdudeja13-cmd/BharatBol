/**
 * Public office-holder and report-contact directory for the state panel.
 * Office-holder details must be rechecked before any report is sent.
 * Grievance contacts are from CPGRAMS' state nodal-officer directory:
 * https://www.pgportal.gov.in/Home/NodalPgOfficersState
 */
export type StateLeadership = {
  designation: string;
  name: string;
  party: string;
  grievanceEmail: string;
};

export const STATE_LEADERSHIP: Record<string, StateLeadership> = {
  AP: { designation: 'Chief Minister', name: 'N. Chandrababu Naidu', party: 'Telugu Desam Party', grievanceEmail: 'pgrs-helpdesk@ap.gov.in' },
  AR: { designation: 'Chief Minister', name: 'Pema Khandu', party: 'Bharatiya Janata Party', grievanceEmail: 'mari.angu@gov.in' },
  AS: { designation: 'Chief Minister', name: 'Himanta Biswa Sarma', party: 'Bharatiya Janata Party', grievanceEmail: 'artassamdept@gmail.com' },
  BR: { designation: 'Chief Minister', name: 'Nitish Kumar', party: 'Janata Dal (United)', grievanceEmail: 'publicgrievances-bih@gov.in' },
  CG: { designation: 'Chief Minister', name: 'Vishnu Deo Sai', party: 'Bharatiya Janata Party', grievanceEmail: 'pgc-gad.cg@gov.in' },
  DL: { designation: 'Chief Minister', name: 'Rekha Gupta', party: 'Bharatiya Janata Party', grievanceEmail: 'paditi@gmail.com' },
  GA: { designation: 'Chief Minister', name: 'Pramod Sawant', party: 'Bharatiya Janata Party', grievanceEmail: 'us-pgc.goa@nic.in' },
  GJ: { designation: 'Chief Minister', name: 'Bhupendra Patel', party: 'Bharatiya Janata Party', grievanceEmail: 'secartd@gujarat.gov.in' },
  HP: { designation: 'Chief Minister', name: 'Sukhvinder Singh Sukhu', party: 'Indian National Congress', grievanceEmail: 'rpgsecy-hp@nic.in' },
  HR: { designation: 'Chief Minister', name: 'Nayab Singh Saini', party: 'Bharatiya Janata Party', grievanceEmail: 'supdt.cpgrams22@gmail.com' },
  JH: { designation: 'Chief Minister', name: 'Hemant Soren', party: 'Jharkhand Mukti Morcha', grievanceEmail: 'pgportal.jhr@gmail.com' },
  JK: { designation: 'Lieutenant Governor', name: 'Manoj Sinha', party: 'Appointed office-holder', grievanceEmail: 'qureshi.azee@jk.gov.in' },
  KA: { designation: 'Chief Minister', name: 'Siddaramaiah', party: 'Indian National Congress', grievanceEmail: 'us2dpar-js@karnataka.gov.in' },
  KL: { designation: 'Chief Minister', name: 'Pinarayi Vijayan', party: 'Communist Party of India (Marxist)', grievanceEmail: 'priority.cmo@kerala.gov.in' },
  MH: { designation: 'Chief Minister', name: 'Devendra Fadnavis', party: 'Bharatiya Janata Party', grievanceEmail: 'hemant.mahajan@nic.in' },
  ML: { designation: 'Chief Minister', name: 'Conrad K. Sangma', party: 'National People’s Party', grievanceEmail: 'cyril.diengdoh@gov.in' },
  MN: { designation: 'Governor', name: 'Ajay Kumar Bhalla', party: 'Appointed office-holder', grievanceEmail: 'leiyaphi.kh@gov.in' },
  MP: { designation: 'Chief Minister', name: 'Mohan Yadav', party: 'Bharatiya Janata Party', grievanceEmail: 'cmhelpline@mp.gov.in' },
  MZ: { designation: 'Chief Minister', name: 'Lalduhoma', party: 'Zoram People’s Movement', grievanceEmail: 'ggcmiz@gmail.com' },
  NL: { designation: 'Chief Minister', name: 'Neiphiu Rio', party: 'Nationalist Democratic Progressive Party', grievanceEmail: 'vechovo.tetseo@nic.in' },
  OD: { designation: 'Chief Minister', name: 'Mohan Charan Majhi', party: 'Bharatiya Janata Party', grievanceEmail: 'gapgpublicgrievance@gmail.com' },
  PB: { designation: 'Chief Minister', name: 'Bhagwant Mann', party: 'Aam Aadmi Party', grievanceEmail: 'grievanceredressal2@gmail.com' },
  RJ: { designation: 'Chief Minister', name: 'Bhajan Lal Sharma', party: 'Bharatiya Janata Party', grievanceEmail: 'DS.RPG@RAJASTHAN.GOV.IN' },
  SK: { designation: 'Chief Minister', name: 'Prem Singh Tamang', party: 'Sikkim Krantikari Morcha', grievanceEmail: 'gos.dopart@gmail.com' },
  TN: { designation: 'Chief Minister', name: 'M. K. Stalin', party: 'Dravida Munnetra Kazhagam', grievanceEmail: 'cmcell@tn.gov.in' },
  TR: { designation: 'Chief Minister', name: 'Manik Saha', party: 'Bharatiya Janata Party', grievanceEmail: 'gaar.agt-tr@nic.in' },
  TS: { designation: 'Chief Minister', name: 'A. Revanth Reddy', party: 'Indian National Congress', grievanceEmail: 'secy-pgr-gad@telangana.gov.in' },
  UK: { designation: 'Chief Minister', name: 'Pushkar Singh Dhami', party: 'Bharatiya Janata Party', grievanceEmail: 'cm_helpline@uk.gov.in' },
  UP: { designation: 'Chief Minister', name: 'Yogi Adityanath', party: 'Bharatiya Janata Party', grievanceEmail: 'arvind.12574@gov.in' },
  WB: { designation: 'Chief Minister', name: 'Mamata Banerjee', party: 'All India Trinamool Congress', grievanceEmail: 'jointsecretarypar@gmail.com' },
};
