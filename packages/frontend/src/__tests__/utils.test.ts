import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDateRelative, getInitials, cn } from '@/lib/utils';

describe('formatCurrency', () => {
  it('should format positive amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('€');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
  });

  it('should format negative amounts', () => {
    const result = formatCurrency(-89.90);
    expect(result).toContain('89,90');
  });
});

describe('getInitials', () => {
  it('should return initials from first and last name', () => {
    expect(getInitials('Max', 'Mustermann')).toBe('MM');
  });

  it('should return first initial only when no last name', () => {
    expect(getInitials('Max', null)).toBe('M');
  });

  it('should return ? when no names provided', () => {
    expect(getInitials(null, null)).toBe('?');
  });

  it('should handle empty strings', () => {
    expect(getInitials('', '')).toBe('?');
  });
});

describe('formatDateRelative', () => {
  it('should return "Heute" for today', () => {
    const today = new Date().toISOString();
    expect(formatDateRelative(today)).toBe('Heute');
  });

  it('should return "Gestern" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateRelative(yesterday.toISOString())).toBe('Gestern');
  });

  it('should return "Vor X Tagen" for recent dates', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatDateRelative(threeDaysAgo.toISOString())).toBe('Vor 3 Tagen');
  });
});

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra');
    expect(result).toBe('base extra');
  });
});
