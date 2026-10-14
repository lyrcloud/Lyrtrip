import { describe, expect, it } from 'vitest';
import { normalizeLang } from '@/i18n/LocaleContext';
import { COUNTRY_CURRENCY, LANGUAGE_DEFAULT_COUNTRY } from '@/i18n/regions';

describe('normalizeLang', () => {
  it('keeps the base language for most locales', () => {
    expect(normalizeLang('fr-CA')).toBe('fr');
    expect(normalizeLang('de')).toBe('de');
    expect(normalizeLang('pt_BR')).toBe('pt');
  });
  it('splits Chinese into simplified and traditional', () => {
    expect(normalizeLang('zh-CN')).toBe('zh-CN');
    expect(normalizeLang('zh-TW')).toBe('zh-TW');
    expect(normalizeLang('zh-HK')).toBe('zh-TW');
    expect(normalizeLang('zh')).toBe('zh-CN');
  });
  it('maps legacy codes and rejects junk', () => {
    expect(normalizeLang('no')).toBe('nb');
    expect(normalizeLang('iw')).toBe('he');
    expect(normalizeLang('')).toBe('en');
    expect(normalizeLang('<script>')).toBe('en');
  });
});

describe('country currencies', () => {
  it('covers major countries', () => {
    expect(COUNTRY_CURRENCY.US).toBe('USD');
    expect(COUNTRY_CURRENCY.GB).toBe('GBP');
    expect(COUNTRY_CURRENCY.DE).toBe('EUR');
    expect(COUNTRY_CURRENCY.JP).toBe('JPY');
    expect(COUNTRY_CURRENCY.IN).toBe('INR');
    expect(COUNTRY_CURRENCY.BD).toBe('BDT');
    expect(COUNTRY_CURRENCY.NG).toBe('NGN');
  });
  it('has a currency for every default country', () => {
    for (const country of Object.values(LANGUAGE_DEFAULT_COUNTRY)) expect(COUNTRY_CURRENCY[country]).toMatch(/^[A-Z]{3}$/);
  });
  it('uses ISO 4217-shaped codes throughout', () => {
    expect(Object.keys(COUNTRY_CURRENCY).length).toBeGreaterThanOrEqual(240);
    for (const code of Object.values(COUNTRY_CURRENCY)) expect(code).toMatch(/^[A-Z]{3}$/);
  });
});
