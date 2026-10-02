import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import { t } from '../../src/i18n';
import { findBannedWords } from '../../src/lib/validate';

describe('UI strings', () => {
  it('fills placeholders', () => {
    expect(t('today.label', { age: '3 months' })).toBe('Today · 3 months');
  });
  it('never use banned words', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(findBannedWords(value), key).toEqual([]);
    }
  });
});
