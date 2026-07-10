# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a pure HTML + CSS + Vanilla JavaScript single-page app from scratch. The app is implemented as three files (`index.html`, `css/style.css`, `js/app.js`) inside an IIFE-scoped architecture. Each task below produces runnable, integrated code — nothing is left orphaned. Tasks progress from scaffolding through core logic to advanced features.

---

## Tasks

- [x] 1. Scaffold project files and HTML structure
  - [x] 1.1 Create `index.html` with full page structure
    - Add `<!DOCTYPE html>`, `<meta charset>`, `<meta name="viewport">`, title "Expense & Budget Visualizer"
    - Include `<link rel="stylesheet" href="css/style.css">`
    - Add Chart.js CDN `<script>` tag before `</body>`: `https://cdn.jsdelivr.net/npm/chart.js`
    - Add `<script src="js/app.js" defer></script>` after CDN tag
    - Create all semantic HTML sections with correct IDs: `#form-add`, `#input-name`, `#input-amount`, `#select-category`, `#btn-add`, `#form-error`, `#display-balance`, `#balance-section`, `#input-budget`, `#budget-error`, `#transaction-list`, `#select-sort`, `#chart-canvas`, `#chart-fallback`, `#monthly-summary`, `#select-month`, `#monthly-list`, `#monthly-total`, `#app-error-banner`
    - Category `<select>` must have options: blank default, Food, Transport, Fun
    - Sort `<select>` must have options: insertion (default), amount-asc, amount-desc, category-asc
    - _Requirements: 1.1, 2.1, 3.1, 5.6, 8.1, 9.1, 10.1, 10.2_

  - [x] 1.2 Create `css/style.css` with base layout and visual rules
    - CSS Grid or Flexbox layout for main sections
    - Transaction list container with `overflow: auto` and a fixed max-height for scrollability
    - `.balance--warning` class applying a distinct warning color to the balance display
    - Base typography, form controls, button styles, and category badge styles
    - Chart canvas dimensions and `#chart-fallback` hidden by default
    - `#app-error-banner` hidden by default (display: none), shown via a `.visible` class
    - _Requirements: 2.4, 5.5, 9.2, 9.3, 10.3_

- [x] 2. Implement IIFE shell, constants, and state in `js/app.js`
  - [x] 2.1 Write the IIFE wrapper, CONSTANTS section, and AppState object
    - Open `(function () { ... })();` wrapper; all subsequent code goes inside
    - CONSTANTS: `STORAGE_KEY_TRANSACTIONS = "ebv_transactions"`, `STORAGE_KEY_BUDGET = "ebv_budget_limit"`, `CATEGORIES = ["Food", "Transport", "Fun"]`, `MAX_AMOUNT = 999999999.99`, `MAX_NAME_LEN = 100`, `SORT_OPTIONS` enum object
    - AppState: `{ transactions: [], budgetLimit: null, sortOrder: "insertion", selectedMonth: "", _nextIndex: 0 }`
    - Add `generateId()` helper using `crypto.randomUUID()` with a fallback (`Math.random().toString(36)`)
    - Add `currentYearMonth()` helper returning `"YYYY-MM"` from the current local date
    - Add `formatAmount(n)` helper returning a number formatted to exactly 2 decimal places
    - _Requirements: 4.1, 7.2, 8.4_

  - [ ]* 2.2 Write unit tests for CONSTANTS and helper functions
    - Test `formatAmount` with integers, floats, zero, and two-decimal values
    - Test `currentYearMonth` returns a string matching `/^\d{4}-\d{2}$/`
    - Test `generateId` returns a non-empty string and two successive calls differ
    - _Requirements: 4.1_

- [x] 3. Implement the Storage module
  - [x] 3.1 Write the `Storage` module (section 3 of IIFE)
    - `Storage.saveTransactions()` — serialises `AppState.transactions` to JSON; wraps `localStorage.setItem` in try/catch; throws on failure
    - `Storage.saveBudgetLimit()` — serialises `AppState.budgetLimit`; wraps `localStorage.setItem` in try/catch; throws on failure
    - `Storage.load()` — reads and parses `ebv_transactions` (defaults to `[]` on missing/corrupt); reads `ebv_budget_limit` (defaults to `null` on missing/invalid); assigns parsed values to `AppState`; shows error banner on corrupt JSON
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 1.7, 3.5, 9.6_

  - [ ]* 3.2 Write property test for persistence round-trip (Property 9)
    - **Property 9: Persistence round-trip preserves all transaction data**
    - **Validates: Requirements 6.3**
    - Use `fast-check` with an array of arbitrary transaction objects; call `Storage.saveTransactions()` then `Storage.load()`; assert `AppState.transactions` deep-equals original array (all fields preserved, order preserved)
    - Tag: `// Feature: expense-budget-visualizer, Property 9: persistence round-trip`

  - [ ]* 3.3 Write unit tests for Storage error paths
    - Mock `localStorage.setItem` to throw; assert `Storage.saveTransactions()` propagates the error
    - Mock `localStorage.getItem` returning invalid JSON; assert `Storage.load()` sets `AppState.transactions = []`
    - _Requirements: 6.5, 1.7_

- [x] 4. Implement Validation and Business Logic
  - [x] 4.1 Write `validateForm()` and `validateBudgetInput()` functions (section 4 of IIFE)
    - `validateForm(name, amount, category)` — returns array of error strings; checks name non-empty and ≤ 100 chars; checks amount is a number, > 0, ≤ 999999999.99; checks category is one of the allowed values
    - `validateBudgetInput(value)` — returns error string or null; checks value is numeric, > 0, ≤ 999999999.99
    - _Requirements: 1.3, 1.4, 1.5, 9.5_

  - [ ]* 4.2 Write property test for invalid amount always rejected (Property 2)
    - **Property 2: Invalid amount is always rejected**
    - **Validates: Requirements 1.5**
    - Use `fast-check` with amounts drawn from: `fc.constant(0)`, `fc.float({ max: -0.001 })`, `fc.constant(NaN)`, `fc.float({ min: 999999999.991 })`; assert `validateForm` always returns at least one error for these inputs
    - Tag: `// Feature: expense-budget-visualizer, Property 2: invalid amount always rejected`

  - [ ]* 4.3 Write property test for invalid budget limit rejected (Property 16)
    - **Property 16: Invalid budget limit is always rejected**
    - **Validates: Requirements 9.5**
    - Use `fast-check` with invalid budget values (same classes as Property 2); assert `validateBudgetInput` always returns a non-null error string
    - Tag: `// Feature: expense-budget-visualizer, Property 16: invalid budget limit rejected`

  - [x] 4.4 Write `buildTransaction()` and `addTransaction()` business logic (section 5 of IIFE)
    - `buildTransaction(name, amount, category)` — returns a Transaction object: `{ id: generateId(), name, amount: Math.round(amount * 100) / 100, category, timestamp: new Date().toISOString(), insertionIndex: AppState._nextIndex++ }`
    - `addTransaction(tx)` — pushes tx to `AppState.transactions` (tentative); calls `Storage.saveTransactions()`; on throw: pops the tx back off and re-throws
    - `deleteTransaction(id)` — saves prior state, filters out the transaction, calls `Storage.saveTransactions()`; on throw: restores prior state and re-throws
    - _Requirements: 1.2, 3.3, 6.1, 6.2, 7.5_

  - [ ]* 4.5 Write property test for timestamp recorded at insertion time (Property 12)
    - **Property 12: Transaction timestamp is recorded at insertion time**
    - **Validates: Requirements 7.5**
    - For any call to `buildTransaction`, assert the returned timestamp is a valid ISO string and `|Date.parse(tx.timestamp) - Date.now()| < 1000`
    - Tag: `// Feature: expense-budget-visualizer, Property 12: timestamp recorded at insertion time`

  - [ ]* 4.6 Write unit tests for `buildTransaction` and rollback logic
    - Test `buildTransaction` increments `_nextIndex`, rounds amount to 2dp, sets correct fields
    - Test `addTransaction` rolls back (removes tx) when `Storage.saveTransactions` throws
    - Test `deleteTransaction` restores prior state when `Storage.saveTransactions` throws
    - _Requirements: 1.2, 1.7, 3.5_

- [x] 5. Checkpoint — core state, storage, and validation ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the Render Pipeline
  - [x] 6.1 Write `computeBalance()`, `computeCategoryTotals()`, and `getSortedTransactions()` (section 5 of IIFE)
    - `computeBalance()` — reduces `AppState.transactions` amounts; returns Number rounded to 2dp
    - `computeCategoryTotals()` — returns a `Map<category, sum>` from `AppState.transactions`
    - `getSortedTransactions()` — returns a sorted copy of `AppState.transactions` per `AppState.sortOrder`; tie-breaks equal amounts by `insertionIndex` ascending
    - _Requirements: 4.1, 5.1, 8.2, 8.5_

  - [ ]* 6.2 Write property test for balance equals sum (Property 4)
    - **Property 4: Balance equals sum of all transaction amounts**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Use `fast-check` with arrays of valid transaction amounts; assert `computeBalance()` equals `amounts.reduce((a, b) => a + b, 0)` formatted to 2dp
    - Tag: `// Feature: expense-budget-visualizer, Property 4: balance equals sum`

  - [ ]* 6.3 Write property test for sort order correctness (Property 13)
    - **Property 13: Sort order is correctly applied to all transactions**
    - **Validates: Requirements 8.2**
    - Use `fast-check` with arrays of transactions; for each of the four sort options assert the output array satisfies the ordering predicate
    - Tag: `// Feature: expense-budget-visualizer, Property 13: sort order correctness`

  - [ ]* 6.4 Write property test for equal-amount tie-breaker (Property 14)
    - **Property 14: Equal-amount sort uses insertion order as tie-breaker**
    - **Validates: Requirements 8.5**
    - Use `fast-check` with pairs of transactions sharing the same amount but different `insertionIndex` values; assert the lower `insertionIndex` always comes first in amount sorts
    - Tag: `// Feature: expense-budget-visualizer, Property 14: equal-amount tie-breaker`

  - [x] 6.5 Write `renderBalance()` (section 6 of IIFE)
    - Reads `computeBalance()`; updates `#display-balance` text to formatted value
    - Adds/removes `.balance--warning` class based on `AppState.budgetLimit !== null && balance > AppState.budgetLimit`
    - _Requirements: 4.1, 4.4, 9.2, 9.3, 9.4_

  - [ ]* 6.6 Write property test for budget warning state (Property 15)
    - **Property 15: Budget warning state is correct for all balance/limit combinations**
    - **Validates: Requirements 9.2, 9.3, 9.4**
    - Use `fast-check` with valid balance and limit values; call `renderBalance()` after setting AppState; assert `.balance--warning` presence matches `balance > limit`
    - Tag: `// Feature: expense-budget-visualizer, Property 15: budget warning state`

  - [x] 6.7 Write `renderTransactionList()` (section 6 of IIFE)
    - Calls `getSortedTransactions()` to get the display list
    - If empty, renders the "No transactions yet." empty-state message in `#transaction-list`
    - Otherwise, sets `#transaction-list innerHTML` to a `<ul>` of `<li>` elements each containing: item name, formatted amount, category badge, delete `<button data-id="...">` with accessible label
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 8.2, 8.3_

  - [ ]* 6.8 Write property test for transaction list renders all fields (Property 5)
    - **Property 5: Transaction list renders exactly N items with all required fields**
    - **Validates: Requirements 2.1**
    - Use `fast-check` with arrays of 0–50 transactions; call `renderTransactionList()`; assert `#transaction-list li` count equals N and each `li` contains name, formatted amount, and category text
    - Tag: `// Feature: expense-budget-visualizer, Property 5: list renders all fields`

  - [ ]* 6.9 Write property test for new transaction appears at top (Property 6)
    - **Property 6: Newly added transaction appears at top of list in insertion order**
    - **Validates: Requirements 2.5**
    - Use `fast-check` with an existing list and a new transaction; set `AppState.sortOrder = "insertion"`, call `renderTransactionList()`; assert the first `<li>` contains the new transaction's name
    - Tag: `// Feature: expense-budget-visualizer, Property 6: new tx at top`

  - [x] 6.10 Write `renderMonthlySummary()` (section 6 of IIFE)
    - Filters `AppState.transactions` to those whose `timestamp` `YYYY-MM` prefix matches `AppState.selectedMonth`
    - Sorts filtered list by timestamp descending
    - Renders `#monthly-list` with the filtered transactions or the "No transactions for this period." empty state message
    - Updates `#monthly-total` to the formatted sum (or "0.00" when empty)
    - _Requirements: 7.3, 7.4, 7.6_

  - [ ]* 6.11 Write property test for monthly filtering is exact (Property 11)
    - **Property 11: Monthly summary filtering is exact**
    - **Validates: Requirements 7.3, 7.4**
    - Use `fast-check` with arrays of transactions at varied timestamps and an arbitrary target month; call `renderMonthlySummary()`; assert the rendered list count and total match the expected filtered+summed result
    - Tag: `// Feature: expense-budget-visualizer, Property 11: monthly filtering exact`

  - [x] 6.12 Write `renderAll()` (section 6 of IIFE)
    - Calls `renderBalance()`, `renderTransactionList()`, `renderMonthlySummary()`, and `updateChart()` in sequence
    - _Requirements: 4.2, 4.3, 5.3, 5.4_

- [x] 7. Checkpoint — full render pipeline complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the Chart Module
  - [x] 8.1 Write `ChartModule` IIFE (section 7 of `app.js`)
    - `ChartModule.init(canvasId)` — checks `window.Chart`; if absent sets `chartAvailable = false` and calls `showChartFallback()`; if present creates the Chart.js pie instance with empty data, legend at bottom, and tooltip callback showing `"Category: XX.X%"`
    - `ChartModule.update(categoryTotals)` — if not available calls `updateTextFallback(categoryTotals)`; if `categoryTotals.size === 0` calls `showChartPlaceholder()`; otherwise computes percentages, sets `chartInstance.data.labels` and `chartInstance.data.datasets[0].data`, calls `chartInstance.update("none")`
    - `showChartFallback()` — hides `#chart-canvas`, shows `#chart-fallback` with banner text "Chart unavailable — showing text summary" and an empty `<table>`
    - `showChartPlaceholder()` — shows `#chart-canvas` with no slices or shows placeholder text "No spending data yet."
    - `updateTextFallback(categoryTotals)` — re-renders the `<table>` inside `#chart-fallback` with category name and total amount columns
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 10.5_

  - [ ]* 8.2 Write property test for chart data proportions (Property 10)
    - **Property 10: Chart data proportions match category sums**
    - **Validates: Requirements 5.1, 5.2**
    - Use `fast-check` with arrays of transactions across one to three categories; call `ChartModule.update(computeCategoryTotals())`; assert `chartInstance.data.datasets[0].data` values sum to 100 and each value equals `(categoryTotal / grandTotal) * 100`
    - Tag: `// Feature: expense-budget-visualizer, Property 10: chart proportions`

  - [ ]* 8.3 Write unit tests for CDN fallback behavior
    - Mock `window.Chart = undefined` before calling `ChartModule.init`; assert `#chart-fallback` is visible and contains the banner text
    - Assert `ChartModule.update` calls `updateTextFallback` when CDN is absent
    - _Requirements: 10.5_

- [x] 9. Implement Event Handlers
  - [x] 9.1 Write `handleFormSubmit(event)` (section 8 of IIFE)
    - `e.preventDefault()`
    - Read values from `#input-name`, `#input-amount`, `#select-category`
    - Call `validateForm()`; if errors, render error messages in `#form-error` and return
    - Clear `#form-error`
    - Call `buildTransaction()` then `addTransaction(tx)`
    - On storage throw: display error in `#app-error-banner` and return
    - On success: clear form fields (name → "", amount → "", category → ""), call `renderAll()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 9.2 Write property test for valid submission adds to list and persists (Property 1)
    - **Property 1: Valid transaction submission adds to list and persists**
    - **Validates: Requirements 1.2, 6.1**
    - Use `fast-check` with valid name/amount/category combinations; simulate form submit; assert `AppState.transactions.length` increased by 1 and `localStorage.getItem("ebv_transactions")` contains the new transaction
    - Tag: `// Feature: expense-budget-visualizer, Property 1: valid submission adds and persists`

  - [ ]* 9.3 Write property test for form resets after submission (Property 3)
    - **Property 3: Form resets after successful submission**
    - **Validates: Requirements 1.6**
    - Use `fast-check` with valid input; simulate form submit; assert `#input-name.value === ""`, `#input-amount.value === ""`, `#select-category.value === ""`
    - Tag: `// Feature: expense-budget-visualizer, Property 3: form resets after submission`

  - [x] 9.4 Write `handleDeleteClick(id)` (section 8 of IIFE)
    - Call `window.confirm()` with a confirmation message; return early if cancelled
    - Save current transactions to `savedState`
    - Call `deleteTransaction(id)`
    - On storage throw: restore `AppState.transactions = savedState`, show error in `#app-error-banner`, call `renderAll()`, return
    - On success: call `renderAll()`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 9.5 Write property test for delete removes from list and storage (Property 7)
    - **Property 7: Delete removes transaction from list and storage**
    - **Validates: Requirements 3.3, 6.2**
    - Use `fast-check` with a non-empty transactions array and an arbitrary valid index; simulate confirmed delete; assert `AppState.transactions.length === N - 1` and the deleted tx id is absent from both `AppState.transactions` and localStorage
    - Tag: `// Feature: expense-budget-visualizer, Property 7: delete removes from list and storage`

  - [ ]* 9.6 Write property test for cancel delete leaves state unchanged (Property 8)
    - **Property 8: Cancel delete is a no-op**
    - **Validates: Requirements 3.4**
    - Use `fast-check` with a non-empty transactions array; mock `window.confirm` to return false; simulate delete; assert `AppState.transactions` and localStorage are unchanged
    - Tag: `// Feature: expense-budget-visualizer, Property 8: cancel delete is no-op`

  - [x] 9.7 Write `handleBudgetChange(value)` (section 8 of IIFE)
    - Call `validateBudgetInput(value)`; if error, show in `#budget-error` and return
    - Clear `#budget-error`
    - Set `AppState.budgetLimit = Math.round(parseFloat(value) * 100) / 100`
    - Call `Storage.saveBudgetLimit()`; on throw: show error in `#app-error-banner`, restore previous limit
    - Call `renderBalance()`
    - _Requirements: 9.4, 9.5, 9.6_

  - [ ]* 9.8 Write property test for budget limit round-trip (Property 17)
    - **Property 17: Budget limit persists and restores correctly**
    - **Validates: Requirements 9.6, 9.7**
    - Use `fast-check` with valid limit values; call `handleBudgetChange(limit)`; assert `localStorage.getItem("ebv_budget_limit")` equals the limit; call `Storage.load()`; assert `AppState.budgetLimit` equals the original limit
    - Tag: `// Feature: expense-budget-visualizer, Property 17: budget limit round-trip`

  - [x] 9.9 Write `handleSortChange()` and `handleMonthChange()` (section 8 of IIFE)
    - `handleSortChange()` — reads `#select-sort` value, sets `AppState.sortOrder`, calls `renderTransactionList()`
    - `handleMonthChange()` — reads `#select-month` value, sets `AppState.selectedMonth`, calls `renderMonthlySummary()`
    - _Requirements: 8.2, 8.3, 7.3_

  - [x] 9.10 Write `showAppError(msg)` and `showFormError(msg)` utility functions
    - `showAppError(msg)` — sets text of `#app-error-banner`, adds `.visible` class, starts an 8-second `setTimeout` to remove `.visible`
    - `showFormError(msg)` — sets text of `#form-error`
    - _Requirements: 1.7, 3.5, 6.5_

- [x] 10. Checkpoint — all handlers wired and rendering end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement the Init function and wire everything together
  - [x] 11.1 Write `populateMonthSelector()` and `init()` (section 9 of IIFE)
    - `populateMonthSelector()` — generates 13 `<option>` elements for the current month and the 12 prior months; each option has value `"YYYY-MM"` and label `"Month YYYY"`; appends to `#select-month`
    - `init()` — calls `Storage.load()`, sets `AppState.selectedMonth = currentYearMonth()`, calls `populateMonthSelector()`, sets `#select-month` value to `AppState.selectedMonth`, calls `ChartModule.init("chart-canvas")`, calls `renderAll()`
    - Add `document.addEventListener("DOMContentLoaded", init)` as the last line of the IIFE
    - _Requirements: 6.3, 6.4, 7.1, 7.2_

  - [ ]* 11.2 Write unit tests for init and month selector
    - Test `populateMonthSelector()` produces exactly 13 `<option>` elements
    - Test the first option value equals `currentYearMonth()`
    - Test `init()` loads from storage and calls `renderAll()` (use spies)
    - _Requirements: 7.1, 7.2, 6.3_

  - [x] 11.3 Attach all event listeners inside `init()`
    - `document.getElementById("form-add").addEventListener("submit", handleFormSubmit)`
    - `document.getElementById("select-sort").addEventListener("change", handleSortChange)`
    - `document.getElementById("select-month").addEventListener("change", handleMonthChange)`
    - `document.getElementById("transaction-list").addEventListener("click", (e) => { if (e.target.dataset.id) handleDeleteClick(e.target.dataset.id); })`
    - `document.getElementById("input-budget").addEventListener("change", (e) => handleBudgetChange(e.target.value))`
    - _Requirements: 1.2, 3.2, 8.2, 7.3, 9.4_

  - [ ]* 11.4 Write smoke / structural checks
    - Assert `index.html` exists and contains a `<script>` tag referencing `chart.js` CDN
    - Assert `css/style.css` exists
    - Assert `js/app.js` exists
    - Assert `#transaction-list` container CSS includes `overflow: auto` or `overflow: scroll`
    - _Requirements: 5.6, 10.1, 10.2_

- [x] 12. Final checkpoint — full app integrated and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- All property tests use `fast-check` with `{ numRuns: 100 }` minimum and carry the comment tag format specified in the design.
- Each task references specific requirements for full traceability.
- The render pipeline (`renderAll`) is synchronous and re-renders the full DOM on every mutation — no incremental patching is needed.
- The `#chart-fallback` element is hidden by default in CSS and shown only when `window.Chart` is undefined at init time.
- Amount rounding (`Math.round(v * 100) / 100`) must be applied at input time to prevent floating-point drift in balance calculations.
- All sort operations must work on a shallow copy of `AppState.transactions` — the original array must never be mutated by sort.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["6.6", "6.7"] },
    { "id": 8, "tasks": ["6.8", "6.9", "6.10"] },
    { "id": 9, "tasks": ["6.11", "6.12", "8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 12, "tasks": ["9.5", "9.6", "9.7", "9.9", "9.10"] },
    { "id": 13, "tasks": ["9.8", "11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3"] },
    { "id": 15, "tasks": ["11.4"] }
  ]
}
```
