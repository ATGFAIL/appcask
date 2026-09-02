/**
 * @format
 */
import { activeTabIndex } from '../src/shell/TabBar';
import type { NavigationTab } from '@appcask/config';

const tabs: NavigationTab[] = [
  { label: 'Home', url: 'https://acme.example/' },
  { label: 'Shop', url: 'https://acme.example/shop' },
  { label: 'Account', url: 'https://acme.example/account' },
];

test('matches the longest URL prefix', () => {
  expect(activeTabIndex(tabs, 'https://acme.example/shop/item/42')).toBe(1);
  expect(activeTabIndex(tabs, 'https://acme.example/account')).toBe(2);
});

test('falls back to the first tab', () => {
  expect(activeTabIndex(tabs, 'https://acme.example/')).toBe(0);
  expect(activeTabIndex(tabs, 'https://acme.example/about')).toBe(0);
});

test('handles an unrelated URL', () => {
  expect(activeTabIndex(tabs, 'https://other.example/x')).toBe(0);
});
