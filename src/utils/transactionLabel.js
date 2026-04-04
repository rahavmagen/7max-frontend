/**
 * Returns the human-readable label for a transaction row.
 * REPAYMENT from a TRANSFER:/PAYMENT: sourceRef is a player transfer (not a generic cashout).
 */
export function getTransactionLabel(type, sourceRef) {
  const isTransferSource = sourceRef &&
    (sourceRef.startsWith('TRANSFER:') || sourceRef.startsWith('PAYMENT:'));

  if (sourceRef === 'SCREEN:CREDIT' || sourceRef === 'SCREEN:PROMO') {
    return type === 'DEPOSIT' ? 'Credit Added' : 'Credit Removed';
  }
  if (type === 'REPAYMENT') return isTransferSource ? 'Transfer' : 'Cashout';
  if (type === 'CREDIT')    return isTransferSource ? 'Transfer' : 'Send Chips';
  if (type === 'DEPOSIT')   return 'Deposit';
  if (type === 'WITHDRAWAL') return 'Withdrawal';
  return type;
}
