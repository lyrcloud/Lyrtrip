// [ISO code, name, dial code]; +1 and +7 countries share a dial code, so options are keyed by ISO.
// Same list as Lyrshop's sign-in form.
export const PHONE_COUNTRIES: [string, string, string][] = [
  ['AF', 'Afghanistan', '93'], ['DZ', 'Algeria', '213'], ['AR', 'Argentina', '54'], ['AU', 'Australia', '61'],
  ['AT', 'Austria', '43'], ['BH', 'Bahrain', '973'], ['BD', 'Bangladesh', '880'], ['BE', 'Belgium', '32'],
  ['BR', 'Brazil', '55'], ['CA', 'Canada', '1'], ['CL', 'Chile', '56'], ['CN', 'China', '86'],
  ['CO', 'Colombia', '57'], ['CZ', 'Czechia', '420'], ['DK', 'Denmark', '45'], ['DO', 'Dominican Republic', '1'],
  ['EC', 'Ecuador', '593'], ['EG', 'Egypt', '20'], ['ET', 'Ethiopia', '251'], ['FI', 'Finland', '358'],
  ['FR', 'France', '33'], ['DE', 'Germany', '49'], ['GH', 'Ghana', '233'], ['GR', 'Greece', '30'],
  ['HK', 'Hong Kong', '852'], ['HU', 'Hungary', '36'], ['IN', 'India', '91'], ['ID', 'Indonesia', '62'],
  ['IQ', 'Iraq', '964'], ['IE', 'Ireland', '353'], ['IL', 'Israel', '972'], ['IT', 'Italy', '39'],
  ['JM', 'Jamaica', '1'], ['JP', 'Japan', '81'], ['JO', 'Jordan', '962'], ['KZ', 'Kazakhstan', '7'],
  ['KE', 'Kenya', '254'], ['KW', 'Kuwait', '965'], ['LB', 'Lebanon', '961'], ['MY', 'Malaysia', '60'],
  ['MX', 'Mexico', '52'], ['MA', 'Morocco', '212'], ['NP', 'Nepal', '977'], ['NL', 'Netherlands', '31'],
  ['NZ', 'New Zealand', '64'], ['NG', 'Nigeria', '234'], ['NO', 'Norway', '47'], ['OM', 'Oman', '968'],
  ['PK', 'Pakistan', '92'], ['PS', 'Palestine', '970'], ['PE', 'Peru', '51'], ['PH', 'Philippines', '63'],
  ['PL', 'Poland', '48'], ['PT', 'Portugal', '351'], ['PR', 'Puerto Rico', '1'], ['QA', 'Qatar', '974'],
  ['RO', 'Romania', '40'], ['RU', 'Russia', '7'], ['SA', 'Saudi Arabia', '966'], ['SG', 'Singapore', '65'],
  ['ZA', 'South Africa', '27'], ['KR', 'South Korea', '82'], ['ES', 'Spain', '34'], ['LK', 'Sri Lanka', '94'],
  ['SD', 'Sudan', '249'], ['SE', 'Sweden', '46'], ['CH', 'Switzerland', '41'], ['SY', 'Syria', '963'],
  ['TW', 'Taiwan', '886'], ['TZ', 'Tanzania', '255'], ['TH', 'Thailand', '66'], ['TN', 'Tunisia', '216'],
  ['TR', 'Türkiye', '90'], ['UG', 'Uganda', '256'], ['UA', 'Ukraine', '380'], ['AE', 'United Arab Emirates', '971'],
  ['GB', 'United Kingdom', '44'], ['US', 'United States', '1'], ['VE', 'Venezuela', '58'], ['VN', 'Vietnam', '84'],
  ['YE', 'Yemen', '967'],
];

export function countryFlag(iso: string) {
  return String.fromCodePoint(...[...iso].map(letter => 0x1f1a5 + letter.charCodeAt(0)));
}

// The first browser language with a listed region, e.g. en-IN → IN.
export function guessPhoneCountry() {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  const region = tags
    .map(tag => tag.split(/[-_]/)[1]?.toUpperCase())
    .find(part => part && PHONE_COUNTRIES.some(([iso]) => iso === part));
  return region || 'US';
}

// E.164 from what was typed: a leading + means the number already has its country code;
// otherwise the selected country's code goes in front, minus the local trunk 0.
export function toE164(raw: string, iso: string) {
  const digits = raw.replace(/\D/g, '');
  const phone = raw.trim().startsWith('+')
    ? `+${digits}`
    : `+${PHONE_COUNTRIES.find(([code]) => code === iso)?.[2] ?? ''}${digits.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
