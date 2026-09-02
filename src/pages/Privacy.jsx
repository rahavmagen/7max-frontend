export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem', lineHeight: 1.6, color: '#e2e8f0' }}>
      <h1>Privacy Policy — 7Max Club</h1>
      <p>Last updated: September 2026</p>

      <p>
        7Max Club ("the App") is a private management tool used to run a poker club:
        tracking games, player balances, deposits and reports for club members and
        administrators.
      </p>

      <h2>Email sending (Google API use)</h2>
      <p>
        The App sends transactional emails — such as deposit confirmations and
        administrative notifications — using the Gmail API's send-only scope
        (<code>gmail.send</code>), authorized on a single dedicated Gmail account owned
        and operated by 7Max Club (<code>7maxclub@gmail.com</code>).
      </p>
      <p>
        This access is used only to compose and send emails from that one account.
        The App does not read, search, modify, or delete any messages in that mailbox
        or any other mailbox, and it does not access the Gmail data of any end user's
        personal Google account.
      </p>

      <h2>What data we handle</h2>
      <p>
        The App stores club-operational data supplied by administrators and players —
        usernames, game results, balances and transaction records — used solely to run
        the club. This data is not sold or shared with third parties, and is not used
        for advertising.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to <code>7maxclub@gmail.com</code>.
      </p>
    </div>
  );
}
