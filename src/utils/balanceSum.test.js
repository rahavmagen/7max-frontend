import { describe, it, expect } from 'vitest';
import { sumSelectedBalances } from './balanceSum';

describe('sumSelectedBalances', () => {
  const players = [
    { id: 1, balance: 100 },
    { id: 2, balance: -40 },
    { id: 3, balance: 25.5 },
  ];

  it('sums only the players whose id is in the selection', () => {
    expect(sumSelectedBalances(players, new Set([1, 2]))).toBe(60);
  });

  it('returns 0 for an empty selection', () => {
    expect(sumSelectedBalances(players, new Set())).toBe(0);
  });

  it('treats a missing or non-numeric balance as 0', () => {
    const withMissing = [...players, { id: 4, balance: null }, { id: 5 }];
    expect(sumSelectedBalances(withMissing, new Set([4, 5]))).toBe(0);
  });

  it('ignores ids in the selection that are not in the players list', () => {
    expect(sumSelectedBalances(players, new Set([1, 999]))).toBe(100);
  });
});
