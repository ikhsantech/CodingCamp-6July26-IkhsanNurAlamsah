# Design Document — Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a zero-dependency, single-page application delivered as three static files: `index.html`, `css/style.css`, and `js/app.js`. It runs entirely in the browser with no build step, no server, and no frameworks. All state is held in an in-memory JavaScript object and kept in sync with Browser LocalStorage.

The architecture is a hand-rolled **MVC-style pipeline** inside `app.js`:

- **Model** — a plain JavaScript object (`AppState`) that is the single source of truth.
- **Controller** — event handler functions that mutate `AppState` and trigger a re-render.
- **View** — pure render functions that read `AppState` and update the DOM.

Persistence is handled by a thin `storage` module that serialises/deserialises `AppState` subsets to LocalStorage. Chart.js (loaded via CDN) is treated as an external dependency; a graceful text-fallback kicks in when it is absent.

---

## Architecture

### File Layout

```
project-root/
├── index.html          # Single HTML entry point; links CSS and JS, includes Chart.js CDN tag
├── css/
│   └── style.css       # All visual styles; responsive layout via CSS Grid/Flexbox
└── js/
    └── app.js          # All application logic — model, controller, view, storage
```

### Module Organisation inside `app.js`

`app.js` is structured as a series of clearly commented sections executed top-to-bottom at `DOMContentLoaded`. There are no ES Modules (to allow file-protocol use without CORS errors). All symbols live in the IIFE scope to avoid polluting `window`.

```
(function () {

  // ─── 1. CONSTANTS ────────────────────────────────────────────────────────
  // ─── 2. STATE ─────────────────────────────────────────────────────────────
  // ─── 3. STORAGE MODULE ───────────────────────────────────────────────────
  // ─── 4. VALIDATION ────────────────────────────────────────────────────────
  // ─── 5. BUSINESS LOGIC ────────────────────────────────────────────────────
  // ─── 6. RENDER PIPELINE ───────────────────────────────────────────────────
  // ─── 7. CHART MODULE ──────────────────────────────────────────────────────
  // ─── 8. EVENT HANDLERS ────────────────────────────────────────────────────
  // ─── 9. INIT ──────────────────────────────────────────────────────────────

})();
```

### Render Pipeline

Every mutation follows the same flow:

```
User Action
    │
    ▼
Controller (event handler)
    │  mutates AppState
    ▼
Storage.save()           ← serialise affected keys to LocalStorage
    │
    ▼
renderAll()              ← synchronous DOM update
  ├── renderBalance()
  ├── renderTransactionList()
  ├── renderMonthlySummary()
  └── updateChart()
```

`renderAll()` is cheap enough to call on every mutation (the transaction list is re-rendered from scratch each call using `innerHTML`). This avoids subtle incremental-update bugs and keeps the code simple.

---

## Components and Interfaces

### 1. Input Form (`#form-add`)

HTML elements:
- `#input-name` — `<input type="text" maxlength="100">`
- `#input-amount` — `<input type="number" step="0.01" min="0.01">`
- `#select-category` — `<select>` with options: `<option value="">Select category</option>`, Food, Transport, Fun
- `#btn-add` — `<button type="submit">`
- `#form-error` — `<div>` for inline validation messages

Controller function: `handleFormSubmit(event)` — validates inputs, calls `addTransaction()`, calls `renderAll()`, resets form.

### 2. Transaction List (`#transaction-list`)

A `<ul>` rendered by `renderTransactionList()`. Each `<li>` contains:
- Item name (text node)
- Amount (formatted with `formatAmount()`)
- Category badge
- Delete button (`data-id` attribute carries the transaction UUID)

Sort is controlled by `#select-sort`. The currently active sort order is stored in `AppState.sortOrder`.

### 3. Balance Display (`#display-balance`)

A `<span>` updated by `renderBalance()`. Applies CSS class `balance--warning` when `AppState.balance > AppState.budgetLimit` and `AppState.budgetLimit` is set.

### 4. Budget Limit Input (`#input-budget`)

An `<input type="number">` outside the transaction form. Controller: `handleBudgetChange()`. Validated on blur/enter; persisted to LocalStorage key `ebv_budget_limit`.

### 5. Pie Chart (`#chart-canvas`)

A `<canvas>` element managed by `ChartModule`. Chart.js is instantiated once and mutated via `chart.data = …; chart.update()` on every `updateChart()` call.

### 6. Monthly Summary (`#monthly-summary`)

Contains:
- `#select-month` — `<select>` populated on init with 13 options (current month back 12 months, formatted as `YYYY-MM` value, `Month YYYY` label)
- `#monthly-list` — filtered `<ul>` rendered by `renderMonthlySummary()`
- `#monthly-total` — total for selected month

Controller: `handleMonthChange()` reads `#select-month` value and re-renders.

### 7. Sort Control (`#select-sort`)

Options: `insertion` (default), `amount-asc`, `amount-desc`, `category-asc`.
Controller: `handleSortChange()` updates `AppState.sortOrder` and calls `renderTransactionList()`.

---

## Data Models

### Transaction Object

```js
{
  id:        String,   // UUID v4 generated via crypto.randomUUID() or fallback
  name:      String,   // 1–100 characters
  amount:    Number,   // 0.01–999999999.99, stored as JS Number (float64)
  category:  String,   // "Food" | "Transport" | "Fun"
  timestamp: String,   // ISO 8601 local date-time string, e.g. "2025-07-06T14:23:45"
                       // Generated via new Date().toISOString() at insertion time
  insertionIndex: Number  // Auto-incrementing integer assigned at insertion time
                          // Used as stable tie-breaker for sort operations
}
```

### AppState Object

```js
const AppState = {
  transactions:  [],      // Transaction[], master list, always in insertion order
  budgetLimit:   null,    // Number | null — null means no limit set
  sortOrder:     "insertion",  // "insertion" | "amount-asc" | "amount-desc" | "category-asc"
  selectedMonth: String,  // "YYYY-MM" — currently selected month in monthly summary
  _nextIndex:    0        // Internal counter for insertionIndex assignment
};
```

### LocalStorage Schema

| Key | Value |
|---|---|
| `ebv_transactions` | JSON array of Transaction objects |
| `ebv_budget_limit` | Numeric string, or absent if not set |

---

## State Management

### Single Source of Truth

`AppState` is the only mutable state. DOM is always derived from it, never the other way around. No reading back from the DOM during computation.

### Mutation Rules

1. Every mutation function receives and returns data (no side effects in business logic).
2. After any mutation, `Storage.save()` is called before `renderAll()`.
3. If `Storage.save()` throws, the mutation is rolled back (previous state restored) and an error message is shown.

### In-Memory Derived Values

These are computed on-the-fly from `AppState.transactions` at render time, not stored:

- `balance` — `transactions.reduce((sum, t) => sum + t.amount, 0)`
- `categoryTotals` — `Map<category, sum>` used by chart
- `filteredTransactions` — transactions filtered to `selectedMonth`
- `sortedTransactions` — `[...transactions]` sorted per `sortOrder` (original array never mutated)

---

## Event Flow and Rendering Pipeline

### App Initialisation (`init()`)

```
DOMContentLoaded fires
    │
    ├── Storage.load()
    │     ├── Parse ebv_transactions from LocalStorage
    │     │     ├── Success → AppState.transactions = parsed array
    │     │     ├── Missing → AppState.transactions = []
    │     │     └── Invalid JSON → AppState.transactions = [], showError("corrupt data")
    │     └── Parse ebv_budget_limit from LocalStorage
    │           ├── Present & valid → AppState.budgetLimit = Number(value)
    │           └── Missing/invalid → AppState.budgetLimit = null
    │
    ├── populateMonthSelector()   ← builds <select> options for past 13 months
    ├── AppState.selectedMonth = currentYearMonth()
    │
    └── renderAll()
          ├── renderBalance()
          ├── renderTransactionList()
          ├── renderMonthlySummary()
          └── updateChart()
```

### Add Transaction Flow

```
handleFormSubmit(e)
    │
    ├── e.preventDefault()
    ├── validateForm() → errors? → showFormErrors(), return
    ├── tx = buildTransaction(name, amount, category)
    ├── AppState.transactions.push(tx)   ← tentative
    ├── Storage.saveTransactions()
    │     └── throws? → AppState.transactions.pop(), showError(), return
    ├── resetForm()
    └── renderAll()
```

### Delete Transaction Flow

```
handleDeleteClick(id)
    │
    ├── window.confirm() → cancelled? → return
    ├── savedState = [...AppState.transactions]
    ├── AppState.transactions = transactions.filter(t => t.id !== id)
    ├── Storage.saveTransactions()
    │     └── throws? → AppState.transactions = savedState, showError(), renderAll(), return
    └── renderAll()
```

### Budget Limit Update Flow

```
handleBudgetChange(value)
    │
    ├── validateBudgetInput(value) → invalid? → showBudgetError(), return
    ├── AppState.budgetLimit = Number(value)
    ├── Storage.saveBudgetLimit()
    └── renderBalance()   ← only balance needs to re-render for warning state
```

---

## Chart.js Integration and Update Strategy

### Initialisation

```js
// ChartModule
const ChartModule = (function () {
  let chartInstance = null;
  let chartAvailable = !!window.Chart;

  function init(canvasId) {
    if (!chartAvailable) {
      showChartFallback();
      return;
    }
    const ctx = document.getElementById(canvasId).getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "pie",
      data: { labels: [], datasets: [{ data: [] }] },
      options: {
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`
            }
          }
        }
      }
    });
  }

  function update(categoryTotals) { /* see below */ }
  function showChartFallback() { /* see below */ }

  return { init, update };
})();
```

### Update Strategy

`updateChart()` is called from `renderAll()`. It computes `categoryTotals` from `AppState.transactions`, then:

```js
function update(categoryTotals) {
  if (!chartAvailable) {
    updateTextFallback(categoryTotals);
    return;
  }
  if (categoryTotals.size === 0) {
    showChartPlaceholder();
    return;
  }
  const total = [...categoryTotals.values()].reduce((a, b) => a + b, 0);
  chartInstance.data.labels = [...categoryTotals.keys()];
  chartInstance.data.datasets[0].data =
    [...categoryTotals.values()].map(v => (v / total) * 100);
  chartInstance.update("none");  // "none" = skip animation on data update
}
```

Chart.js `update("none")` is used on data-driven updates to keep the UI snappy. Animation is only used on initial render.

### CDN Fallback

If `window.Chart` is undefined after the script tag has had a chance to load (checked inside `init()`), `ChartModule` renders a `<table>` of text-based category totals inside `#chart-fallback`. The `<canvas>` is hidden, and `#chart-fallback` is shown. A user-visible banner reads "Chart unavailable — showing text summary."

---

## Error Handling

| Scenario | Detection | Recovery |
|---|---|---|
| LocalStorage unavailable on save | `try/catch` around `localStorage.setItem` | Roll back in-memory mutation, show inline error banner |
| LocalStorage unavailable on load | `try/catch` around `localStorage.getItem` | Default to empty state, show error banner |
| Corrupt JSON in `ebv_transactions` | `JSON.parse` throws | Default to empty state, show error banner "Could not load saved data" |
| Chart.js CDN fails to load | `window.Chart === undefined` at init | Show text-based category totals fallback, show user banner |
| Invalid transaction input | Client-side validation before mutation | Show field-level error messages, do not mutate state |
| Invalid budget limit input | Client-side validation before mutation | Show inline error, preserve previous limit |
| Amount floating-point edge cases | All amounts rounded to 2dp via `Math.round(v * 100) / 100` at input time | Prevents drift in sum calculations |

### Error Display

Two distinct error surfaces:

1. **Inline form errors** — `#form-error`, `#budget-error`: visible only during validation failure, cleared on next valid submission.
2. **Application banner** — `#app-error-banner`: dismissible `<div>` shown for storage/CDN errors. Auto-dismissed after 8 seconds.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction submission adds to list and persists

*For any* valid transaction (item name 1–100 chars, amount between 0.01 and 999,999,999.99, category one of Food/Transport/Fun), submitting the form should result in the Transaction_List length increasing by exactly 1 and LocalStorage key `ebv_transactions` containing a JSON array that includes the new transaction.

**Validates: Requirements 1.2, 6.1**

---

### Property 2: Invalid amount is always rejected

*For any* amount value that is not a number, is zero, is negative, or exceeds 999,999,999.99, submitting the form should display a validation error and leave the Transaction_List and LocalStorage unchanged.

**Validates: Requirements 1.5**

---

### Property 3: Form resets after successful submission

*For any* valid transaction submission, after the transaction is added the item name field, amount field, and category dropdown should all be in their default empty/unselected state.

**Validates: Requirements 1.6**

---

### Property 4: Balance equals sum of all transaction amounts

*For any* set of transactions stored in the app, the displayed Balance should equal the arithmetic sum of all transaction amounts, formatted to exactly 2 decimal places. This invariant must hold after every add and every delete.

**Validates: Requirements 4.1, 4.2, 4.3**

---

### Property 5: Transaction list renders all required fields

*For any* set of N transactions in the app, the Transaction_List should render exactly N items, and each rendered item should display the transaction's item name, amount formatted to exactly 2 decimal places, and category.

**Validates: Requirements 2.1**

---

### Property 6: Newly added transaction appears at top of list

*For any* existing Transaction_List and any new valid transaction added while default sort (insertion order showing newest-first) is active, the new transaction should appear at index 0 of the rendered list.

**Validates: Requirements 2.5**

---

### Property 7: Delete removes transaction from list and storage

*For any* list of N transactions and any transaction T in that list, confirming the deletion of T should result in a Transaction_List of N−1 items that does not contain T, and LocalStorage `ebv_transactions` should likewise not contain T.

**Validates: Requirements 3.3, 6.2**

---

### Property 8: Cancel delete leaves state unchanged

*For any* list of transactions, cancelling the delete confirmation should leave both the in-memory Transaction_List and LocalStorage `ebv_transactions` identical to their state before the delete was initiated.

**Validates: Requirements 3.4**

---

### Property 9: Persistence round-trip preserves all transaction data

*For any* set of transactions written to LocalStorage and any subsequent app initialisation, the Transaction_List, Balance, and Chart rendered on load should reflect exactly the transactions that were persisted — no data loss, no reordering, no field truncation.

**Validates: Requirements 6.3**

---

### Property 10: Chart data proportions match category sums

*For any* set of transactions, the value assigned to each category slice in the chart data should equal that category's total amount divided by the overall total amount, such that all slice values sum to 100%.

**Validates: Requirements 5.1, 5.2**

---

### Property 11: Monthly summary filtering is exact

*For any* set of transactions with varied timestamps and any selected month M, the Monthly_Summary should display exactly the transactions whose timestamp falls within calendar month M, no more and no less, ordered by timestamp descending. The displayed monthly total should equal the arithmetic sum of those filtered transactions' amounts.

**Validates: Requirements 7.3, 7.4**

---

### Property 12: Transaction timestamp is recorded at insertion time

*For any* transaction addition, the stored timestamp should be a valid ISO date-time string that falls within 1 second of the system time at the moment the add operation was executed.

**Validates: Requirements 7.5**

---

### Property 13: Sort order is correctly applied to all transactions

*For any* list of transactions, applying sort option "amount-asc" should produce a list where each transaction's amount is ≤ the next; "amount-desc" should produce a list where each amount is ≥ the next; "category-asc" should produce a list where category names are in non-descending alphabetical order; "insertion" should preserve insertion index order.

**Validates: Requirements 8.2**

---

### Property 14: Equal-amount sort uses insertion order as tie-breaker

*For any* pair of transactions with identical amounts, when sorted by amount (ascending or descending), the one with the lower insertionIndex should appear before the one with the higher insertionIndex.

**Validates: Requirements 8.5**

---

### Property 15: Budget warning state is correct for all balance/limit combinations

*For any* valid budget limit L and any computed balance B: if B > L the balance element should carry the warning CSS class; if B ≤ L the warning CSS class should be absent.

**Validates: Requirements 9.2, 9.3, 9.4**

---

### Property 16: Invalid budget limit is always rejected

*For any* budget limit value that is not a number, is zero, is negative, or exceeds 999,999,999.99, the app should display a validation error and leave the previously applied budget limit unchanged.

**Validates: Requirements 9.5**

---

### Property 17: Budget limit persists and restores correctly

*For any* valid budget limit L set by the user, LocalStorage key `ebv_budget_limit` should equal L after the setting operation, and on the next app initialisation the restored limit should trigger the correct warning state given the current balance.

**Validates: Requirements 9.6, 9.7**

---

## Testing Strategy

### Dual Testing Approach

Both unit/example-based tests and property-based tests are used:

- **Example-based tests** cover specific scenarios, edge cases, and structural checks (presence of DOM elements, empty states, single-path error conditions).
- **Property-based tests** cover universal correctness claims across randomised input spaces (amount validation, balance invariants, sorting, persistence round-trips, filtering).

### Property-Based Testing Library

**fast-check** (JavaScript) is the chosen PBT library. It is the de-facto standard for property-based testing in JavaScript and supports arbitrary generators for primitives, arrays, and structured objects.

Each property test is configured for a minimum of **100 runs** (`{ numRuns: 100 }`).

Each property test carries a comment tag:
```js
// Feature: expense-budget-visualizer, Property N: <property_text>
```

### Unit / Example-Based Tests

Cover:
- Form field presence and attributes (Req 1.1, 8.1, 9.1)
- Empty state messages on load (Req 2.3, 4.4, 5.5, 6.4, 7.6)
- Delete confirmation prompt is shown (Req 3.2)
- Month selector defaults to current month (Req 7.2)
- Month selector range (Req 7.1 — 13 options)
- LocalStorage failure on add (Req 1.7) and delete (Req 3.5) — mocked
- Corrupt LocalStorage recovery (Req 6.5) — edge case
- Chart.js CDN fallback banner and text table (Req 10.5) — mocked
- Sort control defaults to insertion order (Req 8.4)

### Property Tests (one test per property above)

| Property | Arbitraries | What varies |
|---|---|---|
| P1 — valid submission adds & persists | name (string 1–100), amount (float), category | All valid input combinations |
| P2 — invalid amount rejected | amount (0, negative, NaN, >999999999.99) | All classes of invalid amount |
| P3 — form resets after add | name, amount, category | Any valid combination |
| P4 — balance equals sum | array of transactions | Array size, individual amounts |
| P5 — list renders all fields | array of transactions | Array size, all three field values |
| P6 — new tx at top of list | existing list, new tx | Existing list contents |
| P7 — delete removes from list & storage | list, index to delete | List size, which item is deleted |
| P8 — cancel delete is a no-op | list, index | List size, which item is targeted |
| P9 — persistence round-trip | array of transactions | Array size, all fields |
| P10 — chart proportions | array of transactions | Category distribution, amounts |
| P11 — monthly filtering | array of txs at various dates, target month | Date distributions, months |
| P12 — timestamp within 1s | (any transaction addition) | Timing |
| P13 — sort order correctness | array of txs, sort option | List size, amounts, categories |
| P14 — equal-amount tie-breaker | pair of equal-amount txs | Amount, insertion indices |
| P15 — budget warning state | balance amount, budget limit | Balance/limit combinations |
| P16 — invalid budget limit rejected | invalid limit values | All invalid classes |
| P17 — budget limit round-trip | valid limit, transactions | Limit values |

### Smoke / Structural Checks

- HTML contains `<script src="...chart.js...">` CDN tag
- `index.html`, `css/style.css`, `js/app.js` all exist at correct paths
- CSS sets `overflow: auto` or `overflow: scroll` on the transaction list container
