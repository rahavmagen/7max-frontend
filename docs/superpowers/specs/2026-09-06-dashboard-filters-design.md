# Dashboard filter cleanup + ad-hoc balance sum

## Problem

The Players Dashboard (`src/pages/Dashboard.jsx`) has three stat tiles (Total Players, Left Club, No Full Name) that add visual clutter and aren't needed as click-to-filter shortcuts — the "Missing Names" report elsewhere already covers that use case. Agent accounts and their downline players also clutter the main table by default, as do zero-balance players. Separately, there's no way to quickly total the balance of an arbitrary hand-picked subset of players (e.g. to check whether a few related players net out).

## Changes

### 1. Remove three stat tiles
Delete the "Total Players", "Left Club", and "No Full Name" `stat-card` blocks from the `stats-grid`, along with the `showLeftClubOnly` and `showNoFullName` state and their filtering logic (dead once the tiles are gone). The "Not Exists" tile (`showStaleOnly`/`staleCount`) is untouched.

`activeCount`, `leftClubCount`, `noFullNameCount` become unused and are removed. `isLeftClub` is also removed (no longer referenced). `isStale` stays (still used by `showStaleOnly` and the "NOT EXISTS" row badge).

### 2. Hide agent-related players by default
New checkbox, default **unchecked** (hidden): **"Show agent players"**. When unchecked, filter out any row where `p.isAgent` is true OR `p.agentId` is set (both agent accounts and their downline). When checked, show everyone regardless of agent relationship.

### 3. Zero-balance players hidden by default
Rename the existing `hideZero` checkbox to **"Show zero balance players"**, flip its default to **unchecked** (hidden by default — matching the new agent checkbox), and invert the filter condition accordingly (checked = show zero-balance rows too; unchecked = filter out `balance === 0`).

### 4. Ad-hoc balance sum via row checkboxes
Add a checkbox as the first column of the table. Selection is tracked as a `Set` of player ids in component state, independent of the current search/filter/sort — so toggling filters or searching does not lose a selection made earlier.

When the selection is non-empty, show a small inline summary in the filter bar: `"{n} selected — Balance: {sum}"` plus a `Clear` link/button that empties the selection. The sum uses the same `fmt()` currency formatter already used elsewhere on the page. This is display-only — nothing is persisted, sent to the backend, or restored on reload.

## Out of scope
- No changes to the "Not Exists" tile or its filter.
- No changes to any other page (the Missing Names report, Left Club definition elsewhere, etc. are untouched).
- No persistence of the balance-sum selection across page reloads or navigation.
