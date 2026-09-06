/** Sum the `balance` of every player in `players` whose id is in `selectedIds`. */
export function sumSelectedBalances(players, selectedIds) {
  return players
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
}
