# KashCash Deposit — Auto-Open App on Mobile

## Problem

The Deposit page shows two ways to pay: a "📱 Open KashCash App" link and a barcode/QR iframe, both rendered after clicking "Deposit". On mobile, the page's 2-column layout (deposit card + "צור קשר" contact card) stacks vertically, pushing the app link below the contact card and out of the initial viewport. Users end up on the barcode by default without realizing the app option existed, even though the app is the better experience on a phone.

## Fix

Detect device type and automatically trigger the right flow — no manual choice between two buttons.

- **Mobile:** clicking "Deposit" immediately navigates to the app deep-link (`appPaymentIntentUrl`) as part of that same click — no extra button, no barcode shown first. Payment-completion polling starts right away (existing `pollForDeposit`, since the tab won't reliably get focus/message events while the native app is in front). If the page is still visible ~1.5-2 seconds later (device stayed on this tab — a standard signal the deep-link handoff didn't happen, e.g. app not installed), automatically fall back to showing the barcode.
- **Desktop:** skip the app link entirely, show the barcode immediately (today's existing default), since there's no app to open on a PC.
- The standalone "📱 Open KashCash App" button/link is removed — this becomes fully automatic.

## Detection

`navigator.userAgent` regex: `/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)`. Computed once per component. Deliberately not reusing the `window.innerWidth < 768` pattern used elsewhere in this app (e.g. `WhatsAppMessages.jsx`) — that answers "is the viewport narrow" for responsive layout, not "is this an actual mobile device with an app," which is what matters for deciding whether to attempt a deep-link.

## Fallback detection

After triggering `window.location.href = appPaymentIntentUrl`, start a ~1.5-2 second timer. If `document.visibilityState` is still `'visible'` when it fires (the browser never handed off to the native app), show the barcode as a fallback. This is a best-effort heuristic — not foolproof across every mobile browser/OS combination — but is the standard technique for this kind of deep-link fallback and matches what's achievable without native app cooperation.

## Scope

- Frontend-only change (`Deposit.jsx`). The backend (`KashcashService`/`KashcashController`) already returns both `iframeUrl` and `appPaymentIntentUrl` unconditionally — no backend changes needed.
- No changes to the polling/webhook/finalize logic, payment status handling, or deposit history — only how the app link vs. barcode gets shown to the user.
- No changes to the "צור קשר" contact card or overall page layout beyond removing the standalone app button.
