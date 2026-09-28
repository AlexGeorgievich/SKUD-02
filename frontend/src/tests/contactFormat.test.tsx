import {describe, expect, it} from 'vitest';
import {formatPersonalPhone, normalizePersonalPhoneInput} from '../features/hr/contactFormat';

describe('маска личного телефона', () => {
  it('постепенно форматирует российский номер и ограничивает 11 цифрами', () => {
    expect(formatPersonalPhone('8')).toBe('+7');
    expect(formatPersonalPhone('8999')).toBe('+7 (999');
    expect(formatPersonalPhone('89991234567')).toBe('+7 (999) 123-45-67');
    expect(formatPersonalPhone('+7 (999) 123-45-6788')).toBe('+7 (999) 123-45-67');
  });

  it('нормализует ввод в серверный формат', () => {
    expect(normalizePersonalPhoneInput('9991234567')).toBe('+79991234567');
    expect(normalizePersonalPhoneInput('+7 (999) 123-45-67')).toBe('+79991234567');
    expect(normalizePersonalPhoneInput('')).toBe('');
  });
});
