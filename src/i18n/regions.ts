// Country → currency (ISO 3166-1 alpha-2 → ISO 4217), used to show prices in the visitor's money.
const COUNTRY_CURRENCY_LIST =
  'AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN ' +
  'BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD ' +
  'CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CX:AUD CY:EUR CZ:CZK ' +
  'DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR ' +
  'GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD ' +
  'HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY ' +
  'KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD ' +
  'MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN ' +
  'NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PR:USD PS:ILS PT:EUR PW:USD PY:PYG ' +
  'QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP SZ:SZL ' +
  'TC:USD TD:XAF TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS ' +
  'VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWG';

export const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  COUNTRY_CURRENCY_LIST.split(' ').map(pair => pair.split(':') as [string, string]),
);

// When the browser language has no region (plain "fr"), the most likely country for it.
export const LANGUAGE_DEFAULT_COUNTRY: Record<string, string> = {
  ar: 'SA', bn: 'BD', cs: 'CZ', da: 'DK', de: 'DE', el: 'GR', en: 'US', es: 'ES', et: 'EE', fa: 'IR', fi: 'FI',
  fil: 'PH', fr: 'FR', he: 'IL', hi: 'IN', hr: 'HR', hu: 'HU', id: 'ID', it: 'IT', ja: 'JP', ka: 'GE', kk: 'KZ',
  km: 'KH', ko: 'KR', lo: 'LA', lt: 'LT', lv: 'LV', mn: 'MN', ms: 'MY', my: 'MM', nb: 'NO', ne: 'NP', nl: 'NL',
  no: 'NO', pl: 'PL', pt: 'BR', ro: 'RO', ru: 'RU', si: 'LK', sk: 'SK', sl: 'SI', sq: 'AL', sr: 'RS', sv: 'SE',
  sw: 'KE', ta: 'IN', te: 'IN', th: 'TH', tl: 'PH', tr: 'TR', uk: 'UA', ur: 'PK', uz: 'UZ', vi: 'VN', zh: 'CN',
  am: 'ET', az: 'AZ', hy: 'AM', is: 'IS', mk: 'MK', bg: 'BG', af: 'ZA', zu: 'ZA', yo: 'NG', ha: 'NG', ig: 'NG',
};

// Languages offered in the picker (native names). Any other browser language is still translated.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' }, { code: 'it', name: 'Italiano' }, { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' }, { code: 'sv', name: 'Svenska' }, { code: 'da', name: 'Dansk' },
  { code: 'nb', name: 'Norsk' }, { code: 'fi', name: 'Suomi' }, { code: 'pl', name: 'Polski' },
  { code: 'cs', name: 'Čeština' }, { code: 'hu', name: 'Magyar' }, { code: 'ro', name: 'Română' },
  { code: 'el', name: 'Ελληνικά' }, { code: 'tr', name: 'Türkçe' }, { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' }, { code: 'ar', name: 'العربية' }, { code: 'he', name: 'עברית' },
  { code: 'fa', name: 'فارسی' }, { code: 'ur', name: 'اردو' }, { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' }, { code: 'ta', name: 'தமிழ்' }, { code: 'te', name: 'తెలుగు' },
  { code: 'ne', name: 'नेपाली' }, { code: 'th', name: 'ไทย' }, { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' }, { code: 'ms', name: 'Bahasa Melayu' }, { code: 'fil', name: 'Filipino' },
  { code: 'zh-CN', name: '简体中文' }, { code: 'zh-TW', name: '繁體中文' }, { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }, { code: 'sw', name: 'Kiswahili' }, { code: 'am', name: 'አማርኛ' },
];

export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);
