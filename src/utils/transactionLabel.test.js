import { describe, it, expect } from 'vitest';
import { getTransactionLabel } from './transactionLabel';

describe('getTransactionLabel', () => {
  // Transfer scenarios
  it('REPAYMENT from TRANSFER: → Transfer (payer side)', () => {
    expect(getTransactionLabel('REPAYMENT', 'TRANSFER:42')).toBe('Transfer');
  });
  it('CREDIT from TRANSFER: → Transfer (receiver side)', () => {
    expect(getTransactionLabel('CREDIT', 'TRANSFER:42')).toBe('Transfer');
  });
  it('REPAYMENT from PAYMENT: → Transfer', () => {
    expect(getTransactionLabel('REPAYMENT', 'PAYMENT:7')).toBe('Transfer');
  });

  // Non-transfer REPAYMENT (plain cashout)
  it('REPAYMENT with null sourceRef → Cashout', () => {
    expect(getTransactionLabel('REPAYMENT', null)).toBe('Cashout');
  });
  it('REPAYMENT with unrelated sourceRef → Cashout', () => {
    expect(getTransactionLabel('REPAYMENT', 'TRADE:2026-01-01:1234-5678')).toBe('Cashout');
  });

  // Screen credits
  it('DEPOSIT SCREEN:CREDIT → Credit Added', () => {
    expect(getTransactionLabel('DEPOSIT', 'SCREEN:CREDIT')).toBe('Credit Added');
  });
  it('WITHDRAWAL SCREEN:CREDIT → Credit Removed', () => {
    expect(getTransactionLabel('WITHDRAWAL', 'SCREEN:CREDIT')).toBe('Credit Removed');
  });

  // Other types
  it('DEPOSIT with no sourceRef → Deposit', () => {
    expect(getTransactionLabel('DEPOSIT', null)).toBe('Deposit');
  });
  it('CREDIT with no sourceRef → Send Chips', () => {
    expect(getTransactionLabel('CREDIT', null)).toBe('Send Chips');
  });
  it('WITHDRAWAL with no sourceRef → Withdrawal', () => {
    expect(getTransactionLabel('WITHDRAWAL', null)).toBe('Withdrawal');
  });
});
