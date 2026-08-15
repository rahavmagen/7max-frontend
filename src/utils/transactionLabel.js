/**
 * Returns the human-readable label for a transaction row.
 * PAYMENT from a TRANSFER:/PAYMENT: sourceRef is a player transfer (not a generic cashout).
 */
export function getTransactionLabel(type, sourceRef) {
  const isTransferSource = sourceRef &&
    (sourceRef.startsWith('TRANSFER:') || sourceRef.startsWith('PAYMENT:'));

  if (sourceRef === 'SCREEN:CREDIT' || sourceRef === 'SCREEN:PROMO') {
    return type === 'DEPOSIT' ? 'Credit Added' : 'Credit Removed';
  }
  if (type === 'PAYMENT') return isTransferSource ? 'Transfer' : 'Cashout';
  if (type === 'CREDIT')    return isTransferSource ? 'Transfer' : 'Send Chips';
  if (type === 'DEPOSIT')   return 'Deposit';
  if (type === 'WITHDRAWAL') return 'Withdrawal';
  if (type === 'CHIP_PROMO') return 'Rakeback';
  if (type === 'PLAYER_GIFT') return 'Player Gift';
  if (type === 'LIVE_TICKET_WON') return 'זכה בכרטיס ללייב';
  if (type === 'LIVE_TICKET_USED') return 'מימש כרטיס ללייב';
  return type;
}
