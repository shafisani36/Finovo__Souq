import { describe, expect, it } from 'vitest';
import { canSell, hasPermission, safeRedirectFor } from './rbac';

describe('canSell', () => {
  it('allows only seller accounts', () => {
    expect(canSell({ role: 'user', accountType: 'seller' })).toBe(true);
    expect(canSell({ role: 'user', accountType: 'buyer' })).toBe(false);
    expect(canSell({ role: 'admin', accountType: 'seller' })).toBe(false);
    expect(canSell(null)).toBe(false);
  });
});

describe('safeRedirectFor', () => {
  it('keeps same-site paths the role may open', () => {
    expect(safeRedirectFor('user', '/account/messages?c=1')).toBe('/account/messages?c=1');
    expect(safeRedirectFor('user', '/listings/abc')).toBe('/listings/abc');
  });

  it('refuses other sites and other roles', () => {
    expect(safeRedirectFor('user', 'https://evil.com')).toBe('/account/dashboard');
    expect(safeRedirectFor('user', '//evil.com')).toBe('/account/dashboard');
    expect(safeRedirectFor('user', '/admin/users')).toBe('/account/dashboard');
    expect(safeRedirectFor('admin', '/login')).toBe('/admin/dashboard');
  });
});

describe('hasPermission', () => {
  it('follows the role table', () => {
    expect(hasPermission('admin', 'listings:moderate')).toBe(true);
    expect(hasPermission('user', 'listings:moderate')).toBe(false);
    expect(hasPermission(null, 'messages:use')).toBe(false);
  });
});
