import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it('keeps an internal path, query, and hash', () => {
    expect(safeReturnPath('/styles/style-1?tab=cost#fabric')).toBe('/styles/style-1?tab=cost#fabric');
  });

  it('rejects external and auth paths', () => {
    expect(safeReturnPath('https://evil.example/inbox')).toBe('/');
    expect(safeReturnPath('//evil.example')).toBe('/');
    expect(safeReturnPath('/\\evil')).toBe('/');
    expect(safeReturnPath('/login')).toBe('/');
    expect(safeReturnPath('/accept-invitation?token=abc')).toBe('/');
    expect(safeReturnPath('/inbox?next=https://evil.example')).toBe('/');
    expect(safeReturnPath(undefined)).toBe('/');
  });
});
