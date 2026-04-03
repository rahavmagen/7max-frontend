# XLS Grouping Match + No-Chip-Change Checkbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 1-to-1 XLS transaction matching with a per-player grouping algorithm that confirms all pending transactions at once when their net chip delta matches the XLS; also add a "no chip change" checkbox to Manual Credit so bookkeeping-only credits auto-confirm without creating pending.

**Architecture:** Two independent changes: (1) a checkbox on the frontend passes a `noChipChange` flag to the backend which skips creating a pending transaction; (2) a new `XlsMatchingService` computes expected chip delta from pending transactions per player, compared to actual XLS net per player in a two-pass algorithm inside `ReportService.parseTradeRecord()`.

**Tech Stack:** Spring Boot, JPA, Apache POI (already in project), React, Spring Test, MockMultipartFile

**Known limitation:** Scenario 6 (transfer where receiver reduces credit partially + gives partial chips) cannot be matched by this algorithm because the CREDIT transaction amount doesn't match the XLS Claim Chips amount. It falls through to existing manual-review flow.

---

## File Map

**Backend — create:**
- `src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java`
- `src/test/java/com/sevenmax/tracker/service/XlsMatchingUnitTest.java`
- `src/test/java/com/sevenmax/tracker/XlsGroupMatchingIntegrationTest.java`
- `src/test/java/com/sevenmax/tracker/TestXlsBuilder.java`
- `src/test/resources/application.properties`

**Backend — modify:**
- `src/main/java/com/sevenmax/tracker/service/PlayerService.java` — add `noChipChange` param to `updateCredit`
- `src/main/java/com/sevenmax/tracker/controller/PlayerController.java` — read `noChipChange` from body
- `src/main/java/com/sevenmax/tracker/service/ReportService.java` — inject `XlsMatchingService`, add two-pass grouping to `parseTradeRecord`
- `src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java` — add `findByPlayerIdAndPendingConfirmationTrue`

**Frontend — modify:**
- `src/pages/Transfers.jsx` — add checkbox state + UI to Manual Credit form
- `src/api.js` — pass `noChipChange` to `updateCredit`

---

## Task 1: Backend — noChipChange in updateCredit

**Files:**
- Modify: `src/main/java/com/sevenmax/tracker/service/PlayerService.java`
- Modify: `src/main/java/com/sevenmax/tracker/controller/PlayerController.java`

- [ ] **Step 1: Add `noChipChange` param to `PlayerService.updateCredit`**

In `PlayerService.java`, change the method signature and the `setPendingConfirmation` line:

```java
@Transactional
public Player updateCredit(Long id, BigDecimal delta, String notes, String createdByUsername, boolean noChipChange) {
    Player player = getPlayer(id);
    BigDecimal newCredit = (player.getCreditTotal() != null ? player.getCreditTotal() : BigDecimal.ZERO).add(delta);
    BigDecimal currentChips = player.getCurrentChips() != null ? player.getCurrentChips() : BigDecimal.ZERO;
    player.setCreditTotal(newCredit);
    player.setBalance(currentChips.subtract(newCredit));
    Player saved = playerRepository.save(player);

    // If there's already a pending TRADE: transaction for the same player+amount,
    // confirm it instead of creating a duplicate SCREEN:CREDIT entry.
    Optional<Transaction> existingTrade = transactionRepository
            .findFirstByPlayerIdAndAmountAndPendingConfirmationTrue(player.getId(), delta.abs());
    if (existingTrade.isPresent() && existingTrade.get().getSourceRef() != null
            && existingTrade.get().getSourceRef().startsWith("TRADE:")) {
        existingTrade.get().setPendingConfirmation(false);
        transactionRepository.save(existingTrade.get());
        log.info("Manual credit confirmed existing TRADE: pending id={} player={} amount={}",
                existingTrade.get().getId(), player.getUsername(), delta.abs());
    } else {
        Transaction tx = new Transaction();
        tx.setPlayer(player);
        tx.setType(delta.compareTo(BigDecimal.ZERO) >= 0 ? Transaction.Type.DEPOSIT : Transaction.Type.WITHDRAWAL);
        tx.setAmount(delta.abs());
        tx.setNotes("Manual Credit" + (notes != null ? " - " + notes : ""));
        tx.setTransactionDate(LocalDate.now());
        tx.setCreatedByUsername(createdByUsername);
        tx.setPendingConfirmation(!noChipChange);  // <-- key change
        tx.setSourceRef("SCREEN:CREDIT");
        transactionRepository.save(tx);
    }

    return saved;
}
```

- [ ] **Step 2: Read `noChipChange` in `PlayerController.updateCredit`**

In `PlayerController.java`, replace the existing `updateCredit` method body:

```java
@PatchMapping("/{id}/credit")
public ResponseEntity<?> updateCredit(@PathVariable Long id, @RequestBody Map<String, Object> body, Authentication auth) {
    if (isPlayer(auth)) return ResponseEntity.status(403).build();
    Object deltaVal = body.get("delta");
    if (deltaVal == null) return ResponseEntity.badRequest().body(Map.of("error", "delta is required"));
    BigDecimal amount = new BigDecimal(deltaVal.toString());
    String notes = (body.get("notes") != null) ? body.get("notes").toString() : null;
    boolean noChipChange = Boolean.TRUE.equals(body.get("noChipChange"));
    String username = auth != null ? auth.getName() : null;
    return ResponseEntity.ok(playerService.updateCredit(id, amount, notes, username, noChipChange));
}
```

- [ ] **Step 3: Compile and verify no errors**

```bash
cd c:/projects/tracker
./mvnw compile
```
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/sevenmax/tracker/service/PlayerService.java
git add src/main/java/com/sevenmax/tracker/controller/PlayerController.java
git commit -m "Add noChipChange flag to updateCredit — bookkeeping credits auto-confirm"
```

---

## Task 2: Frontend — No Chip Change checkbox

**Files:**
- Modify: `src/api.js`
- Modify: `src/pages/Transfers.jsx`

- [ ] **Step 1: Update `updateCredit` in `api.js`**

Change line 23 in `src/api.js`:

```js
export const updateCredit = (id, delta, notes, noChipChange = false) => api.patch(`/players/${id}/credit`, { delta, notes, noChipChange });
```

- [ ] **Step 2: Add `noChipChange` state to Transfers.jsx**

After the existing credit state declarations (around line 131), add:

```jsx
const [noChipChange, setNoChipChange] = useState(false);
```

- [ ] **Step 3: Pass `noChipChange` to the API call in `handleCreditSubmit`**

In `handleCreditSubmit` (around line 182), change the `updateCredit` call:

```jsx
await updateCredit(creditPlayerId, delta, creditNotes || null, noChipChange);
```

And reset the flag after success (alongside other resets):

```jsx
setCreditPlayerId(''); setCreditAmount(''); setCreditNotes(''); setNoChipChange(false);
```

- [ ] **Step 4: Add checkbox UI to Manual Credit form**

In the Manual Credit form, after the Notes input `<div className="form-group">` block and before the submit button, add:

```jsx
<div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <input
    type="checkbox"
    id="noChipChange"
    checked={noChipChange}
    onChange={e => setNoChipChange(e.target.checked)}
    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f59e0b' }}
  />
  <label htmlFor="noChipChange" style={{ cursor: 'pointer', color: noChipChange ? '#f59e0b' : '#94a3b8', fontSize: '0.875rem', userSelect: 'none' }}>
    No chip change (bookkeeping only — will not appear in pending)
  </label>
</div>
```

- [ ] **Step 5: Test manually**

1. Start backend locally (`./mvnw spring-boot:run`)
2. Open frontend (`npm run dev`)
3. Go to Transfers → Manual Credit
4. Enter a player, amount, check "No chip change", submit
5. Go to Pending — the transaction should NOT appear
6. Go to the player's Transactions page — it SHOULD appear as "Credit Added" or "Credit Removed"

- [ ] **Step 6: Commit and push**

```bash
cd c:/projects/poker-frontend
git add src/api.js src/pages/Transfers.jsx
git commit -m "Add no-chip-change checkbox to Manual Credit form"
git push
cd c:/projects/tracker
git push
```

---

## Task 3: Test infrastructure

**Files:**
- Create: `src/test/resources/application.properties`
- Modify: `src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java`

- [ ] **Step 1: Create test `application.properties`**

Create `src/test/resources/application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/poker_tracker
spring.datasource.username=postgres
spring.datasource.password=Pokerman1!
spring.datasource.driver-class-name=org.postgresql.Driver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
server.port=8081
logging.level.com.sevenmax=INFO
```

- [ ] **Step 2: Add `findByPlayerIdAndPendingConfirmationTrue` to `TransactionRepository`**

Add this method to `TransactionRepository.java`:

```java
List<Transaction> findByPlayerIdAndPendingConfirmationTrue(Long playerId);
```

- [ ] **Step 3: Run existing test to verify test infrastructure works**

```bash
cd c:/projects/tracker
./mvnw test -Dtest=ApplicationTests
```
Expected: BUILD SUCCESS (contextLoads passes)

- [ ] **Step 4: Commit**

```bash
git add src/test/resources/application.properties
git add src/main/java/com/sevenmax/tracker/repository/TransactionRepository.java
git commit -m "Add test application.properties (local DB) and pending query by playerId"
```

---

## Task 4: XlsMatchingService — unit tests then implementation (TDD)

**Files:**
- Create: `src/test/java/com/sevenmax/tracker/service/XlsMatchingUnitTest.java`
- Create: `src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java`

- [ ] **Step 1: Write failing unit tests**

Create `src/test/java/com/sevenmax/tracker/service/XlsMatchingUnitTest.java`:

```java
package com.sevenmax.tracker.service;

import com.sevenmax.tracker.entity.Player;
import com.sevenmax.tracker.entity.Transaction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class XlsMatchingUnitTest {

    private final XlsMatchingService service = new XlsMatchingService();

    private Transaction tx(Transaction.Type type, int amount) {
        Player p = new Player();
        p.setUsername("test");
        Transaction t = new Transaction();
        t.setPlayer(p);
        t.setType(type);
        t.setAmount(BigDecimal.valueOf(amount));
        return t;
    }

    @Test
    void scenario1_addCredit_matchesSendChips() {
        // Add Credit +1000: DEPOSIT, chip delta = +1000, XLS Send Chips +1000, xls_net = +1000
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.DEPOSIT, 1000)),
                BigDecimal.valueOf(1000)
        )).isTrue();
    }

    @Test
    void scenario2_removeCredit_matchesClaimChips() {
        // Remove Credit -1000: WITHDRAWAL, chip delta = -1000, XLS Claim Chips +1000, xls_net = -1000
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.WITHDRAWAL, 1000)),
                BigDecimal.valueOf(-1000)
        )).isTrue();
    }

    @Test
    void scenario4_transfer_payerSide() {
        // Transfer A→B: payer A gets REPAYMENT, XLS Send Chips +1000 to A, xls_net = +1000
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.REPAYMENT, 1000)),
                BigDecimal.valueOf(1000)
        )).isTrue();
    }

    @Test
    void scenario4_transfer_receiverSide() {
        // Transfer A→B: receiver B gets CREDIT, XLS Claim Chips +1000 from B, xls_net = -1000
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.CREDIT, 1000)),
                BigDecimal.valueOf(-1000)
        )).isTrue();
    }

    @Test
    void scenario5_transfer_receiverReducedCreditNoChips() {
        // Transfer A→B, B uses noChipChange → B's WITHDRAWAL auto-confirmed, not pending
        // XLS: nothing for B → xls_net = 0
        // Pending is empty → isGroupMatch returns false (correct: no pending to confirm)
        assertThat(service.isGroupMatch(List.of(), BigDecimal.valueOf(0))).isFalse();
    }

    @Test
    void scenario8_promotion_matchesSendChips() {
        // Promotion +500: DEPOSIT, chip delta = +500, XLS Send Chips +500, xls_net = +500
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.DEPOSIT, 500)),
                BigDecimal.valueOf(500)
        )).isTrue();
    }

    @Test
    void multipleActivities_summed() {
        // Player has two pending: Add Credit +1000 and Add Credit +500
        // XLS: Send Chips +1000 + Send Chips +500 → xls_net = +1500
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.DEPOSIT, 1000), tx(Transaction.Type.DEPOSIT, 500)),
                BigDecimal.valueOf(1500)
        )).isTrue();
    }

    @Test
    void mismatch_doesNotMatch() {
        assertThat(service.isGroupMatch(
                List.of(tx(Transaction.Type.DEPOSIT, 1000)),
                BigDecimal.valueOf(500)
        )).isFalse();
    }

    @Test
    void emptyPending_neverMatches() {
        assertThat(service.isGroupMatch(List.of(), BigDecimal.valueOf(1000))).isFalse();
    }

    @Test
    void expectedChipDelta_mixedTypes() {
        // DEPOSIT 1000 → +1000, CREDIT 500 → -500, net = +500
        BigDecimal delta = service.expectedChipDelta(
                List.of(tx(Transaction.Type.DEPOSIT, 1000), tx(Transaction.Type.CREDIT, 500))
        );
        assertThat(delta).isEqualByComparingTo(BigDecimal.valueOf(500));
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure (class doesn't exist yet)**

```bash
cd c:/projects/tracker
./mvnw test -Dtest=XlsMatchingUnitTest
```
Expected: COMPILE ERROR — `XlsMatchingService cannot be found`

- [ ] **Step 3: Implement `XlsMatchingService`**

Create `src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java`:

```java
package com.sevenmax.tracker.service;

import com.sevenmax.tracker.entity.Transaction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class XlsMatchingService {

    /**
     * Returns true if the XLS net chip delta matches the expected chip delta from the
     * pending transactions. xlsNet = sum(Send Chips positive) - sum(Claim Chips) for this player.
     * Empty pending never matches.
     */
    public boolean isGroupMatch(List<Transaction> pending, BigDecimal xlsNet) {
        if (pending.isEmpty()) return false;
        return expectedChipDelta(pending).compareTo(xlsNet) == 0;
    }

    /**
     * Computes expected net chip change from a list of pending transactions.
     * Each type has a known chip impact on the XLS Trade Record:
     *   DEPOSIT   → club sends chips to player       → +amount
     *   REPAYMENT → payer got cash, club sends chips → +amount
     *   WITHDRAWAL → club claims chips from player   → -amount
     *   CREDIT    → receiver got cash, chips claimed → -amount
     *   WHEEL_EXPENSE → nightly cost, chips claimed  → -amount
     */
    public BigDecimal expectedChipDelta(List<Transaction> pending) {
        return pending.stream()
                .map(this::chipDelta)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal chipDelta(Transaction tx) {
        return switch (tx.getType()) {
            case DEPOSIT    -> tx.getAmount();
            case REPAYMENT  -> tx.getAmount();
            case WITHDRAWAL -> tx.getAmount().negate();
            case CREDIT     -> tx.getAmount().negate();
            case WHEEL_EXPENSE -> tx.getAmount().negate();
        };
    }
}
```

- [ ] **Step 4: Run unit tests — expect all to pass**

```bash
./mvnw test -Dtest=XlsMatchingUnitTest
```
Expected: BUILD SUCCESS, 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/test/java/com/sevenmax/tracker/service/XlsMatchingUnitTest.java
git add src/main/java/com/sevenmax/tracker/service/XlsMatchingService.java
git commit -m "TDD: XlsMatchingService with unit tests for group chip delta matching"
```

---

## Task 5: Integration test helpers

**Files:**
- Create: `src/test/java/com/sevenmax/tracker/TestXlsBuilder.java`

- [ ] **Step 1: Create `TestXlsBuilder`**

Create `src/test/java/com/sevenmax/tracker/TestXlsBuilder.java`:

```java
package com.sevenmax.tracker;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;

/**
 * Builds a minimal valid ClubGG XLS file for integration tests.
 * Trade Record columns: 0=date, 4=tradeType, 6=amount, 14=clubPlayerId, 15=nickname.
 * Data starts at row 5 (0-indexed), matching parseTradeRecord expectations.
 */
public class TestXlsBuilder {

    private final XSSFWorkbook workbook = new XSSFWorkbook();
    private final Sheet tradeSheet;
    private int nextRow = 5;

    public TestXlsBuilder() {
        workbook.createSheet("Club Member Balance"); // required by uploadReport
        tradeSheet = workbook.createSheet("Trade Record");
        for (int i = 0; i < 5; i++) tradeSheet.createRow(i); // header rows 0-4
    }

    /** Send Chips positive: club sends chips to player → player chips increase */
    public TestXlsBuilder addSendChips(String clubPlayerId, String nickname, int amount, String date) {
        Row row = tradeSheet.createRow(nextRow++);
        row.createCell(0).setCellValue(date);
        row.createCell(4).setCellValue("Send Chips");
        row.createCell(6).setCellValue(amount);
        row.createCell(14).setCellValue(clubPlayerId != null ? clubPlayerId : "");
        row.createCell(15).setCellValue(nickname != null ? nickname : "");
        return this;
    }

    /** Claim Chips: club claims chips from player → player chips decrease */
    public TestXlsBuilder addClaimChips(String clubPlayerId, String nickname, int amount, String date) {
        Row row = tradeSheet.createRow(nextRow++);
        row.createCell(0).setCellValue(date);
        row.createCell(4).setCellValue("Claim Chips");
        row.createCell(6).setCellValue(amount);
        row.createCell(14).setCellValue(clubPlayerId != null ? clubPlayerId : "");
        row.createCell(15).setCellValue(nickname != null ? nickname : "");
        return this;
    }

    public MockMultipartFile build(String fileName) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        workbook.close();
        return new MockMultipartFile(
                "file", fileName,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray()
        );
    }
}
```

- [ ] **Step 2: Compile and verify**

```bash
./mvnw compile -Dscope=test
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add src/test/java/com/sevenmax/tracker/TestXlsBuilder.java
git commit -m "Add TestXlsBuilder helper for integration tests"
```

---

## Task 6: Write integration tests (TDD — before wiring grouping)

**Files:**
- Create: `src/test/java/com/sevenmax/tracker/XlsGroupMatchingIntegrationTest.java`

- [ ] **Step 1: Create integration test class**

Create `src/test/java/com/sevenmax/tracker/XlsGroupMatchingIntegrationTest.java`:

```java
package com.sevenmax.tracker;

import com.sevenmax.tracker.entity.*;
import com.sevenmax.tracker.repository.*;
import com.sevenmax.tracker.service.ReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class XlsGroupMatchingIntegrationTest {

    @Autowired ReportService reportService;
    @Autowired PlayerRepository playerRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.findByUsername("TEST_ADMIN").orElseGet(() -> {
            User u = new User();
            u.setUsername("TEST_ADMIN");
            u.setPasswordHash("$2a$10$test");
            u.setRole(User.Role.ADMIN);
            return userRepository.save(u);
        });
    }

    /** Creates or resets a test player, deleting all existing transactions for them. */
    private Player setupPlayer(String username, String clubId) {
        Player player = playerRepository.findByUsername(username).orElseGet(() -> {
            Player p = new Player();
            p.setUsername(username);
            p.setClubPlayerId(clubId);
            p.setBalance(BigDecimal.ZERO);
            p.setCurrentChips(BigDecimal.ZERO);
            p.setCreditTotal(BigDecimal.ZERO);
            return playerRepository.save(p);
        });
        // Delete all previous transactions (including TRADE: from prior runs)
        List<Transaction> existing = transactionRepository.findByPlayerIdOrderByTransactionDateDesc(player.getId());
        transactionRepository.deleteAll(existing);
        return player;
    }

    private Transaction createPending(Player player, Transaction.Type type, int amount, String sourceRef) {
        Transaction tx = new Transaction();
        tx.setPlayer(player);
        tx.setType(type);
        tx.setAmount(BigDecimal.valueOf(amount));
        tx.setPendingConfirmation(true);
        tx.setSourceRef(sourceRef);
        tx.setTransactionDate(LocalDate.now());
        tx.setNotes("Test pending");
        return transactionRepository.save(tx);
    }

    /** Each test uses a unique date suffix to avoid dedup key collisions across runs. */
    private String uniqueDate() {
        return "2026-04-03 " + System.nanoTime();
    }

    // ───────────────────────────────────────────────
    // Scenario 1: Add Credit → confirmed by Send Chips
    // ───────────────────────────────────────────────
    @Test
    void scenario1_addCredit_confirmedBySendChips() throws Exception {
        Player player = setupPlayer("TEST_S1", "TEST_CLUB_S1");
        Transaction pending = createPending(player, Transaction.Type.DEPOSIT, 1000, "SCREEN:CREDIT");

        var xls = new TestXlsBuilder()
                .addSendChips("TEST_CLUB_S1", "TEST_S1", 1000, uniqueDate())
                .build("test-s1.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("pending should be confirmed").isFalse();
        long pendingCount = transactionRepository.findByPlayerIdAndPendingConfirmationTrue(player.getId()).size();
        assertThat(pendingCount).as("no remaining pending").isZero();
    }

    // ───────────────────────────────────────────────
    // Scenario 2: Remove Credit (chips) → confirmed by Claim Chips
    // ───────────────────────────────────────────────
    @Test
    void scenario2_removeCredit_confirmedByClaimChips() throws Exception {
        Player player = setupPlayer("TEST_S2", "TEST_CLUB_S2");
        Transaction pending = createPending(player, Transaction.Type.WITHDRAWAL, 1000, "SCREEN:CREDIT");

        var xls = new TestXlsBuilder()
                .addClaimChips("TEST_CLUB_S2", "TEST_S2", 1000, uniqueDate())
                .build("test-s2.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("pending should be confirmed").isFalse();
    }

    // ───────────────────────────────────────────────
    // Scenario 4A: Transfer payer → confirmed by Send Chips to payer
    // ───────────────────────────────────────────────
    @Test
    void scenario4a_transfer_payerSide_confirmedBySendChips() throws Exception {
        Player payer = setupPlayer("TEST_S4A", "TEST_CLUB_S4A");
        Transaction pending = createPending(payer, Transaction.Type.REPAYMENT, 1000, "TRANSFER:999");

        var xls = new TestXlsBuilder()
                .addSendChips("TEST_CLUB_S4A", "TEST_S4A", 1000, uniqueDate())
                .build("test-s4a.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("payer pending should be confirmed").isFalse();
    }

    // ───────────────────────────────────────────────
    // Scenario 4B: Transfer receiver → confirmed by Claim Chips from receiver
    // ───────────────────────────────────────────────
    @Test
    void scenario4b_transfer_receiverSide_confirmedByClaimChips() throws Exception {
        Player receiver = setupPlayer("TEST_S4B", "TEST_CLUB_S4B");
        Transaction pending = createPending(receiver, Transaction.Type.CREDIT, 1000, "TRANSFER:999");

        var xls = new TestXlsBuilder()
                .addClaimChips("TEST_CLUB_S4B", "TEST_S4B", 1000, uniqueDate())
                .build("test-s4b.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("receiver pending should be confirmed").isFalse();
    }

    // ───────────────────────────────────────────────
    // Scenario 8: Promotion → confirmed by Send Chips
    // ───────────────────────────────────────────────
    @Test
    void scenario8_promotion_confirmedBySendChips() throws Exception {
        Player player = setupPlayer("TEST_S8", "TEST_CLUB_S8");
        Transaction pending = createPending(player, Transaction.Type.DEPOSIT, 500, "SCREEN:PROMO");

        var xls = new TestXlsBuilder()
                .addSendChips("TEST_CLUB_S8", "TEST_S8", 500, uniqueDate())
                .build("test-s8.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("promo pending should be confirmed").isFalse();
    }

    // ───────────────────────────────────────────────
    // Mismatch: wrong amount → pending stays
    // ───────────────────────────────────────────────
    @Test
    void mismatch_pendingRemainsIfNoMatch() throws Exception {
        Player player = setupPlayer("TEST_SMIS", "TEST_CLUB_SMIS");
        Transaction pending = createPending(player, Transaction.Type.DEPOSIT, 1000, "SCREEN:CREDIT");

        // XLS shows 500, pending expects 1000 → no match
        var xls = new TestXlsBuilder()
                .addSendChips("TEST_CLUB_SMIS", "TEST_SMIS", 500, uniqueDate())
                .build("test-mismatch.xlsx");
        reportService.uploadReport(xls, testUser);

        Transaction updated = transactionRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getPendingConfirmation()).as("pending should remain when amounts mismatch").isTrue();
    }
}
```

- [ ] **Step 2: Run integration tests — expect failures (grouping not yet wired)**

```bash
./mvnw test -Dtest=XlsGroupMatchingIntegrationTest
```
Expected: Tests run but scenario1-8 FAIL (pending not confirmed because grouping not yet implemented)

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/test/java/com/sevenmax/tracker/XlsGroupMatchingIntegrationTest.java
git commit -m "TDD: integration tests for XLS grouping match (currently failing)"
```

---

## Task 7: Wire grouping algorithm into ReportService

**Files:**
- Modify: `src/main/java/com/sevenmax/tracker/service/ReportService.java`

- [ ] **Step 1: Inject `XlsMatchingService` into `ReportService`**

Add to the existing `@RequiredArgsConstructor` field list in `ReportService.java`:

```java
private final XlsMatchingService xlsMatchingService;
```

- [ ] **Step 2: Add two-pass grouping to `parseTradeRecord`**

In `parseTradeRecord`, BEFORE the existing row-by-row `for` loop (before line `int lastRow = sheet.getLastRowNum();`), add:

```java
// ── Pass 1: Aggregate XLS net chip delta per player (skip already-imported and wheel rows) ──
Map<Long, BigDecimal> xlsNetByPlayerId = new java.util.LinkedHashMap<>();
for (int r = 5; r <= sheet.getLastRowNum(); r++) {
    Row row = sheet.getRow(r);
    if (row == null) continue;
    String dateStr = getCellValue(row, 0);
    String tradeType = getCellValue(row, 4);
    String amountStr = getCellValue(row, 6);
    String clubPlayerId = getCellValue(row, 14);
    String nickname = getCellValue(row, 15);
    if (dateStr == null || dateStr.isBlank()) continue;
    if (tradeType == null || (!tradeType.equals("Send Chips") && !tradeType.equals("Claim Chips"))) continue;
    BigDecimal rawAmount = parseBigDecimal(amountStr);
    if (rawAmount.compareTo(BigDecimal.ZERO) == 0) continue;
    // Skip Send Chips negative (wheel expenses) — handled by existing logic
    if (tradeType.equals("Send Chips") && rawAmount.compareTo(BigDecimal.ZERO) < 0) continue;
    String sourceRef = "TRADE:" + dateStr + ":" + (clubPlayerId != null ? clubPlayerId : nickname);
    if (transactionRepository.existsBySourceRef(sourceRef)) continue; // skip already-imported
    Player p = null;
    if (clubPlayerId != null && !clubPlayerId.isBlank() && !clubPlayerId.equals("-"))
        p = playerRepository.findByClubPlayerIdSafe(clubPlayerId).stream().findFirst().orElse(null);
    if (p == null && nickname != null && !nickname.isBlank())
        p = findPlayerByUsername(nickname).orElse(null);
    if (p == null) continue;
    BigDecimal delta = tradeType.equals("Send Chips") ? rawAmount : rawAmount.abs().negate();
    xlsNetByPlayerId.merge(p.getId(), delta, BigDecimal::add);
}

// ── Pass 2: Group match — confirm all pending for players whose net chip delta matches ──
Set<Long> groupMatchedPlayerIds = new java.util.HashSet<>();
for (Map.Entry<Long, BigDecimal> entry : xlsNetByPlayerId.entrySet()) {
    Long playerId = entry.getKey();
    BigDecimal xlsNet = entry.getValue();
    List<Transaction> pending = transactionRepository.findByPlayerIdAndPendingConfirmationTrue(playerId)
            .stream()
            .filter(tx -> tx.getSourceRef() == null || !tx.getSourceRef().startsWith("TRADE:"))
            .collect(java.util.stream.Collectors.toList());
    if (xlsMatchingService.isGroupMatch(pending, xlsNet)) {
        for (Transaction tx : pending) {
            tx.setPendingConfirmation(false);
            transactionRepository.save(tx);
            confirmLinkedPlayerTransfer(tx);
        }
        groupMatchedPlayerIds.add(playerId);
        log.info("Group match: playerId={} xlsNet={} confirmedPending={}", playerId, xlsNet, pending.size());
    }
}
```

- [ ] **Step 3: Add `confirmLinkedPlayerTransfer` helper method to `ReportService`**

Add this private method anywhere in `ReportService.java`:

```java
private void confirmLinkedPlayerTransfer(Transaction tx) {
    if (tx.getSourceRef() == null || !tx.getSourceRef().startsWith("TRANSFER:")) return;
    try {
        Long transferId = Long.parseLong(tx.getSourceRef().substring(9));
        playerTransferRepository.findById(transferId).ifPresent(t -> {
            if (!Boolean.TRUE.equals(t.getConfirmed())) {
                t.setConfirmed(true);
                t.setConfirmedAt(java.time.LocalDateTime.now());
                t.setConfirmedBy("Import");
                playerTransferRepository.save(t);
                log.info("Auto-confirmed PlayerTransfer id={} via group match", t.getId());
            }
        });
    } catch (NumberFormatException ignored) {}
}
```

- [ ] **Step 4: Skip group-matched players in the existing row-by-row loop**

In the existing `for (int r = 5; r <= lastRow; r++)` loop, right after the player is resolved (after `if (player == null) continue;`), add:

```java
// Skip players already confirmed by group matching
if (groupMatchedPlayerIds.contains(player.getId())) continue;
```

- [ ] **Step 5: Compile**

```bash
./mvnw compile
```
Expected: BUILD SUCCESS

- [ ] **Step 6: Run unit tests to verify nothing broken**

```bash
./mvnw test -Dtest=XlsMatchingUnitTest
```
Expected: BUILD SUCCESS, 9 tests passing

- [ ] **Step 7: Run integration tests — expect all to pass**

```bash
./mvnw test -Dtest=XlsGroupMatchingIntegrationTest
```
Expected: BUILD SUCCESS, all 6 tests passing

Check local UI: open the player pages for TEST_S1 through TEST_S8 and verify:
- Transaction shows as confirmed (not in pending table)
- Correct label and amount

- [ ] **Step 8: Run all tests**

```bash
./mvnw test
```
Expected: BUILD SUCCESS, all tests passing

- [ ] **Step 9: Commit and push**

```bash
git add src/main/java/com/sevenmax/tracker/service/ReportService.java
git commit -m "Wire XLS grouping match into ReportService — auto-confirm pending by player net chip delta"
git push
```
