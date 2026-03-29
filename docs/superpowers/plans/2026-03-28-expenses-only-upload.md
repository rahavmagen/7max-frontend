# Expenses-Only XLS Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Expenses Only" toggle to the Upload page so users can upload a ClubGG XLS and update only the הוצאות (expenses) tab without touching players, games, or balances.

**Architecture:** New backend endpoint `POST /api/import/expenses-only` in `ImportController` delegates to a new `importExpensesOnly()` method in `ImportService` that reads only the הוצאות sheet. Frontend adds a toggle to `Upload.jsx` that routes the file to a new `uploadExpensesOnly()` API call when active.

**Tech Stack:** Java 17 / Spring Boot (backend), React + Vite (frontend), Apache POI (XLS parsing), axios (HTTP)

---

## File Map

| File | Change |
|---|---|
| `tracker/src/main/java/.../service/ImportService.java` | Add `importExpensesOnly(MultipartFile)` method |
| `tracker/src/main/java/.../controller/ImportController.java` | Add `POST /import/expenses-only` endpoint |
| `poker-frontend/src/api.js` | Add `uploadExpensesOnly(file)` export |
| `poker-frontend/src/pages/Upload.jsx` | Add expenses-only toggle + amber visual mode |

---

### Task 1: Add `importExpensesOnly()` to ImportService

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/service/ImportService.java`

- [ ] **Step 1: Add the method at the bottom of ImportService, before the closing brace**

Open `ImportService.java` and add this method. It reuses the same הוצאות parsing logic already in `importFromFiles()` — just extracted into its own method that touches nothing else:

```java
public Map<String, Object> importExpensesOnly(org.springframework.web.multipart.MultipartFile file) throws Exception {
    int imported = 0;
    int skipped = 0;

    try (org.apache.poi.ss.usermodel.Workbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(file.getInputStream())) {
        // Find הוצאות sheet
        org.apache.poi.ss.usermodel.Sheet expSheet = null;
        for (int i = 0; i < wb.getNumberOfSheets(); i++) {
            if (wb.getSheetAt(i).getSheetName().contains("הוצאות")) {
                expSheet = wb.getSheetAt(i);
                break;
            }
        }
        if (expSheet == null) {
            throw new IllegalArgumentException("הוצאות sheet not found in this file");
        }

        org.apache.poi.ss.usermodel.FormulaEvaluator expEval = wb.getCreationHelper().createFormulaEvaluator();

        // Row 2 (index 1) = admin name headers: A, C, E, G
        int[] adminColIndices = {0, 2, 4, 6};
        String[] adminNames = new String[4];
        org.apache.poi.ss.usermodel.Row headerRow = expSheet.getRow(1);
        if (headerRow != null) {
            for (int i = 0; i < adminColIndices.length; i++) {
                adminNames[i] = getTextEvaluated(headerRow, adminColIndices[i], expEval);
            }
        }

        // Collect per-row expense entries
        java.util.Map<String, Object[]> adminExpenseRows = new java.util.LinkedHashMap<>();
        java.math.BigDecimal willExpense = java.math.BigDecimal.ZERO;

        for (int r = 2; r <= expSheet.getLastRowNum(); r++) {
            org.apache.poi.ss.usermodel.Row row = expSheet.getRow(r);
            if (row == null) continue;
            willExpense = willExpense.add(parseBD(getTextEvaluated(row, 9, expEval))); // col J = wheel
            for (int i = 0; i < adminColIndices.length; i++) {
                String adminName = adminNames[i];
                if (adminName == null || adminName.isBlank()) continue;
                java.math.BigDecimal amount = parseBD(getTextEvaluated(row, adminColIndices[i], expEval));
                if (amount.compareTo(java.math.BigDecimal.ZERO) <= 0) continue;
                String notes = getTextEvaluated(row, adminColIndices[i] + 1, expEval);
                String entryKey = "XLS:" + adminName + ":" + r + ":" + i;
                adminExpenseRows.put(entryKey, new Object[]{adminName, amount, notes});
            }
        }

        // Save per-row entries (skip duplicates)
        for (Map.Entry<String, Object[]> entry : adminExpenseRows.entrySet()) {
            String uniqueRef = entry.getKey();
            if (expenseRepository.existsBySourceRef(uniqueRef)) {
                skipped++;
                continue;
            }
            Object[] rowData = entry.getValue();
            com.sevenmax.tracker.entity.AdminExpense exp = new com.sevenmax.tracker.entity.AdminExpense();
            exp.setAdminUsername((String) rowData[0]);
            exp.setAmount((java.math.BigDecimal) rowData[1]);
            String notes = (String) rowData[2];
            exp.setNotes(notes != null && !notes.isBlank() ? notes : "Imported from XLS הוצאות");
            exp.setExpenseDate(java.time.LocalDate.now());
            exp.setCreatedBy("Import");
            exp.setSourceRef(uniqueRef);
            expenseRepository.save(exp);
            imported++;
        }

        // Wheel total (col J) — replace existing XLS:WHEEL record
        expenseRepository.deleteBySourceRef("XLS:WHEEL");
        if (willExpense.compareTo(java.math.BigDecimal.ZERO) > 0) {
            com.sevenmax.tracker.entity.AdminExpense wheelExp = new com.sevenmax.tracker.entity.AdminExpense();
            wheelExp.setAdminUsername("Wheel");
            wheelExp.setAmount(willExpense);
            wheelExp.setNotes("Wheel expenses from player XLS (הוצאות col J)");
            wheelExp.setExpenseDate(java.time.LocalDate.now());
            wheelExp.setCreatedBy("Import");
            wheelExp.setSourceRef("XLS:WHEEL");
            expenseRepository.save(wheelExp);
        }

        log.info("importExpensesOnly: imported={} skipped={} wheel={}", imported, skipped, willExpense);
    }

    return Map.of("imported", imported, "skipped", skipped);
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /c/projects/tracker && ./mvnw compile -q 2>&1 | tail -20
```

Expected: no errors. If compile fails, check for missing imports — `Map` needs `import java.util.Map;` which is already at the top of the file.

- [ ] **Step 3: Commit**

```bash
cd /c/projects/tracker
git add src/main/java/com/sevenmax/tracker/service/ImportService.java
git commit -m "feat: add importExpensesOnly() to ImportService"
```

---

### Task 2: Add endpoint to ImportController

**Files:**
- Modify: `tracker/src/main/java/com/sevenmax/tracker/controller/ImportController.java`

- [ ] **Step 1: Add the new endpoint inside the class, after the `/compare` endpoint**

```java
@PostMapping("/expenses-only")
public ResponseEntity<Map<String, Object>> importExpensesOnly(
        @RequestParam("file") MultipartFile file) {
    try {
        Map<String, Object> result = importService.importExpensesOnly(file);
        return ResponseEntity.ok(result);
    } catch (IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
```

- [ ] **Step 2: Compile and start the backend to verify**

```bash
cd /c/projects/tracker && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS with no errors.

- [ ] **Step 3: Test the endpoint manually with curl (use a real XLS file)**

```bash
curl -X POST http://localhost:8080/api/import/expenses-only \
  -H "Authorization: Bearer <your-token>" \
  -F "file=@/path/to/your-file.xlsx" \
  -v
```

Expected response: `{"imported": N, "skipped": M}` where N+M = total expense rows in הוצאות sheet.

If you get `{"error": "הוצאות sheet not found"}` — the file doesn't have that sheet or the sheet name doesn't contain "הוצאות".

- [ ] **Step 4: Commit**

```bash
cd /c/projects/tracker
git add src/main/java/com/sevenmax/tracker/controller/ImportController.java
git commit -m "feat: add POST /import/expenses-only endpoint"
```

---

### Task 3: Add `uploadExpensesOnly` to frontend api.js

**Files:**
- Modify: `poker-frontend/src/api.js`

- [ ] **Step 1: Add the new function after the existing `uploadReport` function (around line 34)**

```js
export const uploadExpensesOnly = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/import/expenses-only', form, { validateStatus: s => s < 500 });
};
```

- [ ] **Step 2: Verify it looks correct**

```bash
grep -n "uploadExpensesOnly\|uploadReport" /c/projects/poker-frontend/src/api.js
```

Expected: both functions appear, one after the other.

- [ ] **Step 3: Commit**

```bash
cd /c/projects/poker-frontend
git add src/api.js
git commit -m "feat: add uploadExpensesOnly API function"
```

---

### Task 4: Add toggle and amber mode to Upload.jsx

**Files:**
- Modify: `poker-frontend/src/pages/Upload.jsx`

- [ ] **Step 1: Add `uploadExpensesOnly` to the import at the top of Upload.jsx**

Change line 2 from:
```js
import { uploadReport, getReports, deleteReport, getStalePlayers } from '../api';
```
To:
```js
import { uploadReport, uploadExpensesOnly, getReports, deleteReport, getStalePlayers } from '../api';
```

- [ ] **Step 2: Add the `expensesOnly` state variable**

After the existing `useState` declarations (around line 14), add:
```js
const [expensesOnly, setExpensesOnly] = useState(false);
```

- [ ] **Step 3: Update `processFiles` to branch on the toggle**

Replace the line inside `processFiles`:
```js
const res = await uploadReport(xlsFiles[i]);
```
With:
```js
const res = expensesOnly
  ? await uploadExpensesOnly(xlsFiles[i])
  : await uploadReport(xlsFiles[i]);
```

And replace the success message block:
```js
updated[i] = {
  ...updated[i], status: 'done',
  msg: `Period: ${res.data.periodStart} → ${res.data.periodEnd} | Rake: ${Math.round(parseFloat(res.data.totalRake))}`
};
```
With:
```js
if (expensesOnly) {
  updated[i] = {
    ...updated[i], status: 'done',
    msg: `Expenses imported: ${res.data.imported} new, ${res.data.skipped} already existed`
  };
} else {
  updated[i] = {
    ...updated[i], status: 'done',
    msg: `Period: ${res.data.periodStart} → ${res.data.periodEnd} | Rake: ${Math.round(parseFloat(res.data.totalRake))}`
  };
  if (res.data.chipMismatch != null && Number(res.data.chipMismatch) > 1) {
    setChipWarning({
      mismatch: Number(res.data.chipMismatch),
      expected: Number(res.data.chipMismatchExpected),
      actual: Number(res.data.chipMismatchActual),
    });
  }
  if (res.data.wheelExpenseWarnings?.length) {
    setWheelWarnings(prev => [...prev, ...res.data.wheelExpenseWarnings]);
  }
  if (res.data.leftClub?.length || res.data.recovered?.length) {
    setLeftClub(prev => {
      let next = [...prev];
      if (res.data.leftClub?.length) {
        for (const p of res.data.leftClub) {
          if (!next.some(x => x.id === p.id)) next.push(p);
        }
      }
      if (res.data.recovered?.length) {
        const recoveredIds = new Set(res.data.recovered.map(r => r.clubPlayerId).filter(Boolean));
        next = next.filter(x => !x.clubPlayerId || !recoveredIds.has(x.clubPlayerId));
      }
      return next;
    });
  }
}
```

- [ ] **Step 4: Add the toggle UI above the drop zone**

Add this block just before the `<div className="card">` that contains the upload area (around line 126):

```jsx
<div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
    <input
      type="checkbox"
      checked={expensesOnly}
      onChange={e => setExpensesOnly(e.target.checked)}
      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
    />
    <span style={{ color: expensesOnly ? '#f59e0b' : '#94a3b8', fontWeight: expensesOnly ? 600 : 400 }}>
      Expenses Only Mode
    </span>
  </label>
  {expensesOnly && (
    <span style={{ fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '2px 8px' }}>
      ⚠️ Only updates הוצאות tab — players, games and balances are not affected
    </span>
  )}
</div>
```

- [ ] **Step 5: Add amber border to the drop zone when in expenses-only mode**

Find the `upload-area` div and update its `className` and add an inline style:

```jsx
<div
  className={`upload-area ${dragging ? 'drag-over' : ''}`}
  style={{ cursor: processing ? 'not-allowed' : 'pointer', ...(expensesOnly ? { borderColor: '#f59e0b', borderWidth: '2px' } : {}) }}
  onDragOver={e => { e.preventDefault(); setDragging(true); }}
  onDragLeave={() => setDragging(false)}
  onDrop={handleDrop}
  onClick={() => !processing && fileRef.current.click()}
>
```

- [ ] **Step 6: Run the frontend and verify visually**

```bash
cd /c/projects/poker-frontend && npm run dev
```

Open the Upload page. Check:
- Toggle is unchecked by default — page looks exactly as before
- Check the toggle — border turns amber, warning text appears
- Upload a file with toggle on — result shows "Expenses imported: X new, Y already existed"
- Upload same file again with toggle on — result shows "Expenses imported: 0 new, N already existed" (dedup works)
- Uncheck toggle and upload — full import works exactly as before

- [ ] **Step 7: Commit**

```bash
cd /c/projects/poker-frontend
git add src/pages/Upload.jsx
git commit -m "feat: add expenses-only upload toggle to Upload page"
```

---

### Task 5: Push both repos

- [ ] **Step 1: Push backend**

```bash
cd /c/projects/tracker && git push
```

- [ ] **Step 2: Push frontend**

```bash
cd /c/projects/poker-frontend && git push
```

Expected: both push successfully, Railway/Vercel deploys automatically.
