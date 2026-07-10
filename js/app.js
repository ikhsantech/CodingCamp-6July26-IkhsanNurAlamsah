(function () {

  // ─── 1. CONSTANTS ────────────────────────────────────────────────────────

  const STORAGE_KEY_TRANSACTIONS = "ebv_transactions";
  const STORAGE_KEY_BUDGET = "ebv_budget_limit";
  const CATEGORIES = ["Food", "Transport", "Fun"];
  const MAX_AMOUNT = 999999999.99;
  const MAX_NAME_LEN = 100;
  const SORT_OPTIONS = {
    INSERTION: "insertion",
    AMOUNT_ASC: "amount-asc",
    AMOUNT_DESC: "amount-desc",
    CATEGORY_ASC: "category-asc"
  };

  // ─── 2. STATE ─────────────────────────────────────────────────────────────

  const AppState = {
    transactions: [],
    budgetLimit: null,
    sortOrder: "insertion",
    selectedMonth: "",
    _nextIndex: 0
  };

  // ─── 3. HELPERS ───────────────────────────────────────────────────────────

  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function currentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function formatAmount(n) {
    return Number(n).toFixed(2);
  }

  // ─── 4. STORAGE MODULE ───────────────────────────────────────────────────

  const Storage = {
    /**
     * Serialise AppState.transactions to JSON and persist to localStorage.
     * Throws if localStorage.setItem fails (e.g. storage quota exceeded or
     * private-browsing restrictions).
     */
    saveTransactions() {
      try {
        localStorage.setItem(
          STORAGE_KEY_TRANSACTIONS,
          JSON.stringify(AppState.transactions)
        );
      } catch (err) {
        throw new Error("Could not save transactions: " + (err.message || err));
      }
    },

    /**
     * Serialise AppState.budgetLimit to JSON and persist to localStorage.
     * Throws if localStorage.setItem fails.
     */
    saveBudgetLimit() {
      try {
        localStorage.setItem(
          STORAGE_KEY_BUDGET,
          JSON.stringify(AppState.budgetLimit)
        );
      } catch (err) {
        throw new Error("Could not save budget limit: " + (err.message || err));
      }
    },

    /**
     * Read and parse stored data from localStorage, then hydrate AppState.
     *
     * ebv_transactions:
     *   - Missing key  → AppState.transactions = []
     *   - Corrupt JSON → AppState.transactions = [], show error banner
     *   - Valid JSON   → AppState.transactions = parsed array
     *
     * ebv_budget_limit:
     *   - Missing / null / invalid number → AppState.budgetLimit = null
     *   - Valid numeric value             → AppState.budgetLimit = parsed Number
     */
    load() {
      // ── Load transactions ──────────────────────────────────────────────
      let rawTransactions;
      try {
        rawTransactions = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      } catch (err) {
        // localStorage itself is inaccessible (e.g. security restrictions)
        AppState.transactions = [];
        if (typeof showAppError === "function") {
          showAppError("Could not access saved data. Storage may be unavailable.");
        }
        rawTransactions = null;
      }

      if (rawTransactions === null || rawTransactions === undefined) {
        // Key does not exist — start with empty list (Req 6.4)
        AppState.transactions = [];
      } else {
        try {
          const parsed = JSON.parse(rawTransactions);
          AppState.transactions = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          // Corrupt JSON (Req 6.5, 1.7)
          AppState.transactions = [];
          if (typeof showAppError === "function") {
            showAppError("Could not load saved data. Your transaction history has been reset.");
          }
        }
      }

      // ── Restore _nextIndex so new transactions get unique, incrementing indices
      if (AppState.transactions.length > 0) {
        const maxIndex = AppState.transactions.reduce(
          (max, tx) => (typeof tx.insertionIndex === "number" && tx.insertionIndex > max ? tx.insertionIndex : max),
          -1
        );
        AppState._nextIndex = maxIndex + 1;
      } else {
        AppState._nextIndex = 0;
      }

      // ── Load budget limit ──────────────────────────────────────────────
      let rawBudget;
      try {
        rawBudget = localStorage.getItem(STORAGE_KEY_BUDGET);
      } catch (err) {
        rawBudget = null;
      }

      if (rawBudget === null || rawBudget === undefined) {
        // Key absent — no limit set (Req 9.6 / default state)
        AppState.budgetLimit = null;
      } else {
        try {
          const parsed = JSON.parse(rawBudget);
          const num = Number(parsed);
          // Accept only finite positive numbers within the allowed range
          if (isFinite(num) && num > 0 && num <= MAX_AMOUNT) {
            AppState.budgetLimit = num;
          } else {
            AppState.budgetLimit = null;
          }
        } catch (err) {
          // Invalid stored value — fall back to no limit
          AppState.budgetLimit = null;
        }
      }
    }
  };

  // ─── 5. VALIDATION ────────────────────────────────────────────────────────

  /**
   * Validates the transaction form inputs.
   *
   * @param {string} name       - The item name entered by the user.
   * @param {*}      amount     - The amount value entered by the user (may be a string or number).
   * @param {string} category   - The selected category.
   * @returns {string[]} An array of error strings. Empty array means all inputs are valid.
   *
   * Rules (Requirements 1.3, 1.4, 1.5):
   *   - name must be non-empty and at most MAX_NAME_LEN (100) characters.
   *   - amount must be a finite number, greater than 0, and at most MAX_AMOUNT (999,999,999.99).
   *   - category must be one of the CATEGORIES values ("Food", "Transport", "Fun").
   */
  function validateForm(name, amount, category) {
    const errors = [];

    // ── Name validation (Req 1.3) ──────────────────────────────────────────
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (trimmedName.length === 0) {
      errors.push("Item Name is required.");
    } else if (trimmedName.length > MAX_NAME_LEN) {
      errors.push(`Item Name must be ${MAX_NAME_LEN} characters or fewer.`);
    }

    // ── Amount validation (Req 1.5) ────────────────────────────────────────
    const numericAmount = Number(amount);
    if (amount === "" || amount === null || amount === undefined || isNaN(numericAmount) || !isFinite(numericAmount)) {
      errors.push("Amount must be between 0.01 and 999,999,999.99.");
    } else if (numericAmount <= 0) {
      errors.push("Amount must be between 0.01 and 999,999,999.99.");
    } else if (numericAmount > MAX_AMOUNT) {
      errors.push("Amount must be between 0.01 and 999,999,999.99.");
    }

    // ── Category validation (Req 1.4) ──────────────────────────────────────
    if (!CATEGORIES.includes(category)) {
      errors.push("Category is required.");
    }

    return errors;
  }

  /**
   * Validates a budget limit input value.
   *
   * @param {*} value - The raw value from the budget input field.
   * @returns {string|null} An error string if invalid, or null if valid.
   *
   * Rules (Requirement 9.5):
   *   - value must be numeric (not NaN, not empty), greater than 0, and at most MAX_AMOUNT.
   */
  function validateBudgetInput(value) {
    const num = Number(value);

    if (value === "" || value === null || value === undefined || isNaN(num) || !isFinite(num)) {
      return "Budget limit must be a number between 0.01 and 999,999,999.99.";
    }
    if (num <= 0) {
      return "Budget limit must be a number between 0.01 and 999,999,999.99.";
    }
    if (num > MAX_AMOUNT) {
      return "Budget limit must be a number between 0.01 and 999,999,999.99.";
    }

    return null;
  }

  // ─── 6. BUSINESS LOGIC ───────────────────────────────────────────────────

  /**
   * Constructs a new Transaction object from raw user inputs.
   *
   * @param {string} name       - The item name (already validated).
   * @param {number} amount     - The raw amount (already validated); rounded to 2dp.
   * @param {string} category   - The selected category (already validated).
   * @returns {{ id: string, name: string, amount: number, category: string, timestamp: string, insertionIndex: number }}
   *
   * Requirements: 1.2, 7.5
   */
  function buildTransaction(name, amount, category) {
    return {
      id: generateId(),
      name,
      amount: Math.round(amount * 100) / 100,
      category,
      timestamp: new Date().toISOString(),
      insertionIndex: AppState._nextIndex++
    };
  }

  /**
   * Appends a transaction to AppState and persists it to storage.
   * Uses a tentative-push / rollback pattern to keep state consistent
   * if Storage.saveTransactions() throws (e.g. quota exceeded).
   *
   * @param {{ id: string, name: string, amount: number, category: string, timestamp: string, insertionIndex: number }} tx
   * @throws {Error} Re-throws any error from Storage.saveTransactions().
   *
   * Requirements: 1.2, 6.1, 6.2
   */
  function addTransaction(tx) {
    AppState.transactions.push(tx);
    try {
      Storage.saveTransactions();
    } catch (err) {
      // Roll back the tentative push so state stays consistent
      AppState.transactions.pop();
      throw err;
    }
  }

  /**
   * Removes the transaction with the given id from AppState and persists
   * the updated list to storage.
   * Saves the prior state so it can be restored if Storage.saveTransactions() throws.
   *
   * @param {string} id - The id of the transaction to remove.
   * @throws {Error} Re-throws any error from Storage.saveTransactions().
   *
   * Requirements: 3.3, 6.1, 6.2
   */
  function deleteTransaction(id) {
    const priorState = AppState.transactions.slice();
    AppState.transactions = AppState.transactions.filter(tx => tx.id !== id);
    try {
      Storage.saveTransactions();
    } catch (err) {
      // Restore prior state so nothing is lost on a storage failure
      AppState.transactions = priorState;
      throw err;
    }
  }

  // ─── 7. COMPUTE FUNCTIONS ────────────────────────────────────────────────

  /**
   * Computes the total balance across all transactions.
   *
   * Reduces AppState.transactions by summing each transaction's amount,
   * then rounds the result to exactly 2 decimal places using the same
   * banker-safe pattern as buildTransaction (multiply → Math.round → divide).
   *
   * @returns {number} The balance rounded to 2 decimal places.
   *
   * Requirements: 4.1, 5.1
   */
  function computeBalance() {
    const raw = AppState.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    return Math.round(raw * 100) / 100;
  }

  /**
   * Computes the total spending per category across all transactions.
   *
   * Iterates AppState.transactions once, accumulating a running sum for each
   * unique category string. Amounts are kept as plain numbers; rounding is the
   * caller's responsibility (e.g. when formatting for display or chart data).
   *
   * @returns {Map<string, number>} A Map keyed by category name whose values
   *   are the unrounded sum of transaction amounts for that category.
   *
   * Requirements: 4.1, 5.1
   */
  function computeCategoryTotals() {
    const totals = new Map();
    for (const tx of AppState.transactions) {
      const prev = totals.get(tx.category) || 0;
      totals.set(tx.category, prev + tx.amount);
    }
    return totals;
  }

  /**
   * Returns a sorted shallow copy of AppState.transactions according to
   * AppState.sortOrder.  The original array is never mutated.
   *
   * Sort options (SORT_OPTIONS enum):
   *   "insertion"    — ascending by insertionIndex (natural entry order)
   *   "amount-asc"   — ascending by amount;  tie-break: insertionIndex asc
   *   "amount-desc"  — descending by amount; tie-break: insertionIndex asc
   *   "category-asc" — ascending by category string (locale-aware);
   *                    tie-break: insertionIndex asc
   *
   * Tie-breaking by insertionIndex ensures a stable, deterministic order for
   * any two transactions that compare equal on the primary key.
   *
   * @returns {Array} A new array containing all transactions in the
   *   requested order.
   *
   * Requirements: 8.2, 8.5
   */
  function getSortedTransactions() {
    const copy = AppState.transactions.slice();

    switch (AppState.sortOrder) {
      case SORT_OPTIONS.AMOUNT_ASC:
        copy.sort((a, b) =>
          a.amount !== b.amount
            ? a.amount - b.amount
            : a.insertionIndex - b.insertionIndex
        );
        break;

      case SORT_OPTIONS.AMOUNT_DESC:
        copy.sort((a, b) =>
          a.amount !== b.amount
            ? b.amount - a.amount
            : a.insertionIndex - b.insertionIndex
        );
        break;

      case SORT_OPTIONS.CATEGORY_ASC:
        copy.sort((a, b) => {
          const cmp = a.category.localeCompare(b.category);
          return cmp !== 0 ? cmp : a.insertionIndex - b.insertionIndex;
        });
        break;

      case SORT_OPTIONS.INSERTION:
      default:
        copy.sort((a, b) => a.insertionIndex - b.insertionIndex);
        break;
    }

    return copy;
  }

  // ─── 8. RENDER FUNCTIONS ─────────────────────────────────────────────────

  /**
   * Renders the current balance into the #display-balance element and
   * toggles the `.balance--warning` CSS class when the balance exceeds
   * the configured budget limit.
   *
   * Logic:
   *   1. Read the balance via computeBalance().
   *   2. Format it to 2 decimal places with formatAmount().
   *   3. Set the text content of #display-balance to the formatted value.
   *   4. Add `.balance--warning` when:
   *        AppState.budgetLimit !== null  AND  balance > AppState.budgetLimit
   *      Remove the class in all other cases (no limit set, or within budget).
   *
   * Requirements: 4.1, 4.4, 9.2, 9.3, 9.4
   */
  function renderBalance() {
    const balance = computeBalance();
    const el = document.getElementById("display-balance");
    if (!el) return;

    el.textContent = formatAmount(balance);

    const overBudget =
      AppState.budgetLimit !== null && balance > AppState.budgetLimit;

    if (overBudget) {
      el.classList.add("balance--warning");
    } else {
      el.classList.remove("balance--warning");
    }
  }

  /**
   * Renders the monthly summary section for the currently selected month.
   *
   * Steps:
   *   1. Filter AppState.transactions to those whose timestamp YYYY-MM prefix
   *      matches AppState.selectedMonth.
   *   2. Sort the filtered list by timestamp descending (most recent first).
   *   3. Render #monthly-list:
   *        - If no transactions match, show "No transactions for this period."
   *        - Otherwise render a <ul> of <li> elements each showing name,
   *          formatted amount, and category badge.
   *   4. Update #monthly-total to the formatted sum of matched amounts,
   *      or "0.00" when the filtered list is empty.
   *
   * Requirements: 7.3, 7.4, 7.6
   */
  function renderMonthlySummary() {
    const listEl = document.getElementById("monthly-list");
    const totalEl = document.getElementById("monthly-total");
    if (!listEl || !totalEl) return;

    // 1. Filter to the selected month
    const filtered = AppState.transactions.filter(
      tx => typeof tx.timestamp === "string" &&
            tx.timestamp.slice(0, 7) === AppState.selectedMonth
    );

    // 2. Sort descending by timestamp (most recent first)
    const sorted = filtered.slice().sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );

    // 3. Render list
    if (sorted.length === 0) {
      listEl.innerHTML = "<p>No transactions for this period.</p>";
    } else {
      const items = sorted.map(tx => `
        <li class="transaction-item">
          <span class="tx-name">${escapeHtml(tx.name)}</span>
          <span class="tx-amount">${formatAmount(tx.amount)}</span>
          <span class="tx-category category-badge">${escapeHtml(tx.category)}</span>
        </li>`).join("");
      listEl.innerHTML = `<ul>${items}</ul>`;
    }

    // 4. Update total
    const total = sorted.reduce((sum, tx) => sum + tx.amount, 0);
    totalEl.textContent = sorted.length === 0 ? "0.00" : formatAmount(Math.round(total * 100) / 100);
  }

  /**
   * Escapes HTML special characters to prevent XSS when inserting
   * user-supplied strings into innerHTML.
   *
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  
  // --- RENDER: TRANSACTION LIST -------------------------------------------

  /**
   * Renders the transaction list into #transaction-list.
   *
   * Retrieves a sorted copy of the transactions via getSortedTransactions().
   * - If empty: shows "No transactions yet." empty-state message.
   * - Otherwise: builds a <ul> of <li> elements, each containing:
   *     - item name
   *     - formatted amount (via formatAmount)
   *     - category badge (<span class="badge">)
   *     - delete <button data-id="..."> with accessible aria-label
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 8.2, 8.3
   */
  function renderTransactionList() {
    var listEl = document.getElementById("transaction-list");
    if (!listEl) return;

    var transactions = getSortedTransactions();

    if (transactions.length === 0) {
      listEl.innerHTML = '<p class="empty-state">No transactions yet.</p>';
      return;
    }

    var items = transactions.map(function (tx) {
      var safeName     = escapeHtml(tx.name);
      var safeCategory = escapeHtml(tx.category);
      var safeId       = escapeHtml(tx.id);

      return (
        '<li class="transaction-item">' +
          '<span class="transaction-name">' + safeName + '</span>' +
          '<span class="transaction-amount">' + formatAmount(tx.amount) + '</span>' +
          '<span class="badge">' + safeCategory + '</span>' +
          '<button class="btn-delete" data-id="' + safeId + '" ' +
            'aria-label="Delete transaction: ' + safeName + '">Delete</button>' +
        '</li>'
      );
    });

    listEl.innerHTML = '<ul class="transaction-list-ul">' + items.join('') + '</ul>';
  }

  /**
   * Re-renders all UI sections in one synchronous pass.
   *
   * Call this after any mutation to AppState (add, delete, sort change,
   * month change, budget change) to keep every panel in sync.
   *
   * Sequence:
   *   1. renderBalance()          — balance display + budget warning class
   *   2. renderTransactionList()  — sorted transaction list
   *   3. renderMonthlySummary()   — monthly filter panel + total
   *   4. ChartModule.update()     — pie chart (guarded: only called if
   *                                 ChartModule is defined and has an update
   *                                 method, so this file compiles safely
   *                                 before ChartModule is declared)
   *
   * Requirements: 4.2, 4.3, 5.3, 5.4
   */
  function renderAll() {
    renderBalance();
    renderTransactionList();
    renderMonthlySummary();

    // ChartModule is defined later in the IIFE (section 7).
    // Guard against the case where this function is called before that
    // section is reached (e.g. during unit tests or partial load).
    if (typeof ChartModule !== "undefined" && ChartModule.update) {
      ChartModule.update(computeCategoryTotals());
    }
  }

  // ─── 9. CHART MODULE ─────────────────────────────────────────────────────

  /**
   * ChartModule — manages the Chart.js pie chart (or a text-table fallback
   * when Chart.js is unavailable).
   *
   * Private state (closed over in the IIFE scope):
   *   chartInstance   — the Chart.js instance, or null before init.
   *   chartAvailable  — true when window.Chart was present at init time.
   *
   * Public API:
   *   ChartModule.init(canvasId)          — initialise once at app start.
   *   ChartModule.update(categoryTotals)  — refresh chart / fallback table.
   *
   * Requirements: 5.1, 5.2, 5.5, 5.6, 10.5
   */

  // Private state
  var chartInstance  = null;
  var chartAvailable = true;

  // Color palette for pie slices — cycles when there are more than 5 categories
  var CHART_COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Hides #chart-canvas, shows #chart-fallback with a banner message and an
   * empty <table> ready for updateTextFallback() to populate.
   * Called when window.Chart is absent at init time.
   */
  function showChartFallback() {
    var canvas   = document.getElementById("chart-canvas");
    var fallback = document.getElementById("chart-fallback");
    if (canvas)   canvas.style.display   = "none";
    if (fallback) {
      fallback.style.display = "";          // restore CSS default (block / flex)
      fallback.innerHTML =
        '<p class="chart-fallback-banner">Chart unavailable \u2014 showing text summary</p>' +
        '<table class="chart-fallback-table"><thead><tr>' +
          '<th>Category</th><th>Total</th>' +
        '</tr></thead><tbody></tbody></table>';
    }
  }

  /**
   * Renders the chart canvas in a "no data" state showing placeholder text.
   * Called when categoryTotals is empty but Chart.js is available.
   */
  function showChartPlaceholder() {
    var canvas   = document.getElementById("chart-canvas");
    var fallback = document.getElementById("chart-fallback");

    // Hide any previously-shown fallback table
    if (fallback) fallback.style.display = "none";

    if (canvas) {
      canvas.style.display = "";           // make sure the canvas is visible
    }

    // If there's a live chart instance, clear its data so the canvas is blank
    if (chartInstance) {
      chartInstance.data.labels              = [];
      chartInstance.data.datasets[0].data   = [];
      chartInstance.data.datasets[0].backgroundColor = [];
      chartInstance.update("none");
    }

    // Show a text placeholder beneath / over the canvas via a sibling element
    var placeholder = document.getElementById("chart-placeholder-text");
    if (!placeholder) {
      placeholder = document.createElement("p");
      placeholder.id        = "chart-placeholder-text";
      placeholder.className = "chart-placeholder";
      placeholder.textContent = "No spending data yet.";
      if (canvas && canvas.parentNode) {
        canvas.parentNode.insertBefore(placeholder, canvas.nextSibling);
      }
    }
    placeholder.style.display = "";
  }

  /**
   * Re-renders the <tbody> of the fallback <table> inside #chart-fallback
   * with one row per category: category name | formatted total amount.
   *
   * @param {Map<string, number>} categoryTotals
   */
  function updateTextFallback(categoryTotals) {
    var fallback = document.getElementById("chart-fallback");
    if (!fallback) return;

    var tbody = fallback.querySelector("tbody");
    if (!tbody) return;

    if (categoryTotals.size === 0) {
      tbody.innerHTML = '<tr><td colspan="2">No spending data yet.</td></tr>';
      return;
    }

    var rows = "";
    categoryTotals.forEach(function (total, category) {
      rows +=
        "<tr>" +
          "<td>" + escapeHtml(category) + "</td>" +
          "<td>" + formatAmount(total)  + "</td>" +
        "</tr>";
    });
    tbody.innerHTML = rows;
  }

  // ── Public object ──────────────────────────────────────────────────────

  var ChartModule = {
    /**
     * Initialise the chart.
     *
     * Checks window.Chart:
     *   - Absent  → sets chartAvailable = false, calls showChartFallback().
     *   - Present → creates a Chart.js pie instance on <canvas id="canvasId">
     *               with empty data, legend at bottom, and a tooltip callback
     *               that formats the value as "Category: XX.X%".
     *
     * @param {string} canvasId — id of the <canvas> element.
     */
    init: function (canvasId) {
      if (typeof window === "undefined" || !window.Chart) {
        chartAvailable = false;
        showChartFallback();
        return;
      }

      var canvas = document.getElementById(canvasId);
      if (!canvas) return;

      chartInstance = new window.Chart(canvas, {
        type: "pie",
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: []
          }]
        },
        options: {
          plugins: {
            legend: {
              position: "bottom"
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  var value = Number(context.parsed).toFixed(1);
                  return (context.label || "Unknown") + ": " + value + "%";
                }
              }
            }
          }
        }
      });
    },

    /**
     * Update the chart (or fallback table) with the latest category totals.
     *
     * @param {Map<string, number>} categoryTotals — output of computeCategoryTotals().
     *
     * Behaviour:
     *   - chartAvailable = false → delegates to updateTextFallback().
     *   - categoryTotals.size === 0 → calls showChartPlaceholder().
     *   - Otherwise → computes per-category percentages, updates
     *     chartInstance.data.labels / datasets[0].data, and calls
     *     chartInstance.update("none") for a no-animation refresh.
     */
    update: function (categoryTotals) {
      if (!chartAvailable) {
        updateTextFallback(categoryTotals);
        return;
      }

      if (!chartInstance) return;

      // Hide any placeholder text from a previous empty state
      var placeholder = document.getElementById("chart-placeholder-text");
      if (placeholder) placeholder.style.display = "none";

      if (categoryTotals.size === 0) {
        showChartPlaceholder();
        return;
      }

      // Show the canvas in case it was hidden
      var canvas = document.getElementById("chart-canvas");
      if (canvas) canvas.style.display = "";

      // Compute grand total for percentage calculation
      var grandTotal = 0;
      categoryTotals.forEach(function (total) {
        grandTotal += total;
      });

      var labels     = [];
      var dataPoints = [];
      var colors     = [];
      var colorIdx   = 0;

      categoryTotals.forEach(function (total, category) {
        var pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
        labels.push(category);
        dataPoints.push(Math.round(pct * 10) / 10);   // 1 decimal place
        colors.push(CHART_COLORS[colorIdx % CHART_COLORS.length]);
        colorIdx++;
      });

      chartInstance.data.labels                       = labels;
      chartInstance.data.datasets[0].data             = dataPoints;
      chartInstance.data.datasets[0].backgroundColor  = colors;
      chartInstance.update("none");
    }
  };

  // ─── 10. EVENT HANDLERS ──────────────────────────────────────────────────

  /**
   * Handles the "Add Transaction" form submit event.
   *
   * Flow:
   *   1. Prevent default browser form submission.
   *   2. Read raw values from the three form controls.
   *   3. Validate inputs via validateForm(); show errors and abort if invalid.
   *   4. Clear any previous form error message.
   *   5. Build a transaction object and attempt to persist it.
   *   6. On storage failure: show the app-level error banner and abort.
   *   7. On success: reset the form fields and re-render the full UI.
   *
   * @param {Event} e - The submit event fired by #form-add.
   *
   * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    // ── 1. Read form values ──────────────────────────────────────────────
    var nameEl     = document.getElementById("input-name");
    var amountEl   = document.getElementById("input-amount");
    var categoryEl = document.getElementById("select-category");

    var name     = nameEl     ? nameEl.value     : "";
    var amount   = amountEl   ? amountEl.value   : "";
    var category = categoryEl ? categoryEl.value : "";

    // ── 2. Validate ──────────────────────────────────────────────────────
    var errors = validateForm(name, Number(amount), category);
    var formErrorEl = document.getElementById("form-error");

    if (errors.length > 0) {
      // Render each error message into #form-error (Req 1.3, 1.4, 1.5)
      if (formErrorEl) {
        formErrorEl.innerHTML = errors.map(function (msg) {
          return "<p>" + escapeHtml(msg) + "</p>";
        }).join("");
      }
      return;
    }

    // ── 3. Clear previous form error ────────────────────────────────────
    if (formErrorEl) {
      formErrorEl.innerHTML = "";
    }

    // ── 4. Build and persist transaction ────────────────────────────────
    var tx = buildTransaction(name.trim(), Number(amount), category);

    try {
      addTransaction(tx);
    } catch (err) {
      // Storage failure — show app-level banner (Req 1.7)
      if (typeof showAppError === "function") {
        showAppError("Could not save transaction: " + (err.message || err));
      }
      return;
    }

    // ── 5. Reset form fields on success (Req 1.6) ────────────────────────
    if (nameEl)     nameEl.value     = "";
    if (amountEl)   amountEl.value   = "";
    if (categoryEl) categoryEl.value = "";

    // ── 6. Re-render all UI sections ─────────────────────────────────────
    renderAll();
  }

  // ─── 10. EVENT HANDLERS ──────────────────────────────────────────────────

  /**
   * Handles a click on a transaction's delete button.
   *
   * Flow:
   *   1. Prompt the user for confirmation via window.confirm().
   *      If the user cancels, return immediately — no state change.
   *   2. Snapshot the current transaction list as `savedState`.
   *   3. Call deleteTransaction(id) which updates AppState and attempts
   *      to persist to localStorage.
   *   4. Storage failure path:
   *        - Restore AppState.transactions from savedState.
   *        - Show the error in #app-error-banner via showAppError().
   *        - Call renderAll() so the UI reflects the restored state.
   *        - Return early.
   *   5. Success path: call renderAll() to reflect the deletion.
   *
   * @param {string} id - The id of the transaction to delete.
   *
   * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  function handleDeleteClick(id) {
    // Step 1 — confirm with the user before doing anything destructive (Req 3.2, 3.4)
    var confirmed = window.confirm("Are you sure you want to delete this transaction?");
    if (!confirmed) return;

    // Step 2 — snapshot current state so we can roll back on storage failure (Req 3.5)
    var savedState = AppState.transactions.slice();

    // Step 3 — attempt the deletion (updates AppState + calls Storage.saveTransactions)
    try {
      deleteTransaction(id);
    } catch (err) {
      // Step 4 — storage threw; restore state and surface the error (Req 3.5, 3.6)
      AppState.transactions = savedState;
      showAppError("Could not delete transaction. Your data has not been changed.");
      renderAll();
      return;
    }

    // Step 5 — success; re-render to reflect the removal (Req 3.3, 3.7)
    renderAll();
  }

  // ─── 10. EVENT HANDLERS ──────────────────────────────────────────────────

  /**
   * Handles a change to the budget limit input field.
   *
   * Steps:
   *   1. Validate the raw value via validateBudgetInput().
   *      - On error: display the message in #budget-error and return early.
   *   2. Clear #budget-error (input is valid).
   *   3. Save the previous limit for rollback, then set
   *      AppState.budgetLimit = Math.round(parseFloat(value) * 100) / 100.
   *   4. Persist via Storage.saveBudgetLimit().
   *      - On throw: show the error in #app-error-banner via showAppError(),
   *        restore the previous budgetLimit, and return.
   *   5. Call renderBalance() to update the balance display and warning class.
   *
   * @param {string} value - Raw value from the #input-budget field.
   *
   * Requirements: 9.4, 9.5, 9.6
   */
  function handleBudgetChange(value) {
    // 1. Validate
    var error = validateBudgetInput(value);
    if (error) {
      var budgetErrorEl = document.getElementById("budget-error");
      if (budgetErrorEl) budgetErrorEl.textContent = error;
      return;
    }

    // 2. Clear error
    var budgetErrorEl = document.getElementById("budget-error");
    if (budgetErrorEl) budgetErrorEl.textContent = "";

    // 3. Save previous limit for rollback; update AppState
    var previousLimit = AppState.budgetLimit;
    AppState.budgetLimit = Math.round(parseFloat(value) * 100) / 100;

    // 4. Persist — rollback on failure
    try {
      Storage.saveBudgetLimit();
    } catch (err) {
      showAppError("Could not save budget limit. Please try again.");
      AppState.budgetLimit = previousLimit;
      return;
    }

    // 5. Re-render balance (applies / removes warning class)
    renderBalance();
  }

  // ─── 10. EVENT HANDLERS ──────────────────────────────────────────────────

  /**
   * Handles changes to the #select-sort dropdown.
   *
   * Reads the current value from #select-sort, updates AppState.sortOrder,
   * then re-renders the transaction list to reflect the new ordering.
   *
   * Requirements: 8.2, 8.3
   */
  function handleSortChange() {
    var selectEl = document.getElementById("select-sort");
    if (!selectEl) return;

    AppState.sortOrder = selectEl.value;
    renderTransactionList();
  }

  /**
   * Handles changes to the #select-month dropdown.
   *
   * Reads the current value from #select-month, updates AppState.selectedMonth,
   * then re-renders the monthly summary section to show transactions for the
   * newly selected month.
   *
   * Requirements: 7.3, 8.3
   */
  function handleMonthChange() {
    var selectEl = document.getElementById("select-month");
    if (!selectEl) return;

    AppState.selectedMonth = selectEl.value;
    renderMonthlySummary();
  }

  // ─── 11. ERROR UTILITIES ─────────────────────────────────────────────────

  // Timer ID for the auto-hide timeout on the app-level error banner.
  // Stored in closure scope so a new call can cancel any pending timer.
  var _appErrorTimer = null;

  /**
   * Displays a message in the #app-error-banner and auto-hides it after 8 s.
   *
   * If called while a previous banner is still visible, the prior countdown
   * is cancelled and a fresh 8-second window begins — preventing an old timer
   * from dismissing a newer error prematurely.
   *
   * @param {string} msg — The error message to display.
   *
   * Requirements: 1.7, 3.5, 6.5
   */
  function showAppError(msg) {
    var banner = document.getElementById("app-error-banner");
    if (!banner) return;

    // Cancel any previously-running auto-hide timer
    if (_appErrorTimer !== null) {
      clearTimeout(_appErrorTimer);
      _appErrorTimer = null;
    }

    banner.textContent = msg;
    banner.classList.add("visible");

    _appErrorTimer = setTimeout(function () {
      banner.classList.remove("visible");
      _appErrorTimer = null;
    }, 8000);
  }

  /**
   * Displays a message in the #form-error element.
   *
   * @param {string} msg — The error message to display.
   *
   * Requirements: 1.7
   */
  function showFormError(msg) {
    var formError = document.getElementById("form-error");
    if (!formError) return;
    formError.textContent = msg;
  }

  // ─── 11. INIT ───────────────────────────────────────────────────────────────

  /**
   * Populates the #select-month dropdown with 13 options:
   * the current month and the 12 prior months.
   *
   * Each option:
   *   value       — "YYYY-MM"
   *   textContent — "Month YYYY" (e.g. "July 2025")
   *
   * Options are inserted in reverse-chronological order so the current month
   * appears at the top and the oldest month at the bottom.
   *
   * Requirements: 7.1, 7.2
   */
  function populateMonthSelector() {
    var selectEl = document.getElementById("select-month");
    if (!selectEl) return;

    // Start from the current month and step backwards 12 times (13 options total)
    var now = new Date();

    for (var i = 0; i < 13; i++) {
      // Compute the target month by cloning today's date and subtracting i months.
      // Setting date to 1 avoids "month overflow" bugs (e.g. Jan 31 − 1 month ≠ Dec 31).
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);

      var year  = d.getFullYear();
      var month = String(d.getMonth() + 1).padStart(2, "0");
      var value = year + "-" + month;
      var label = d.toLocaleString("default", { month: "long" }) + " " + year;

      var option = document.createElement("option");
      option.value       = value;
      option.textContent = label;
      selectEl.appendChild(option);
    }
  }

  /**
   * Application entry point — called once when the DOM is ready.
   *
   * Steps (Requirements 6.3, 6.4, 7.1, 7.2):
   *   1. Load persisted data from LocalStorage into AppState.
   *   2. Set the default selected month to the current calendar month.
   *   3. Populate the #select-month dropdown with the 13-month range.
   *   4. Sync the dropdown's displayed value to the default month.
   *   5. Initialise the Chart.js module (or its text fallback).
   *   6. Perform a full render so the UI reflects the loaded state.
   *
   * NOTE: Event listener wiring is handled separately in task 11.3.
   */
  function init() {
    // 1. Hydrate AppState from localStorage
    Storage.load();

    // 2. Default the monthly summary to the current month
    AppState.selectedMonth = currentYearMonth();

    // 3. Build the month selector options
    populateMonthSelector();

    // 4. Ensure the <select> reflects the current month
    var selectMonth = document.getElementById("select-month");
    if (selectMonth) {
      selectMonth.value = AppState.selectedMonth;
    }

    // 5. Initialise Chart.js (or show the text-table fallback)
    ChartModule.init("chart-canvas");

    // 6. Render all UI panels from the loaded state
    renderAll();

    // 7. Wire up event listeners (Requirements: 1.2, 3.2, 8.2, 7.3, 9.4)
    document.getElementById("form-add").addEventListener("submit", handleFormSubmit);
    document.getElementById("select-sort").addEventListener("change", handleSortChange);
    document.getElementById("select-month").addEventListener("change", handleMonthChange);
    document.getElementById("transaction-list").addEventListener("click", function (e) {
      if (e.target.dataset.id) handleDeleteClick(e.target.dataset.id);
    });
    document.getElementById("input-budget").addEventListener("change", function (e) {
      handleBudgetChange(e.target.value);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

})();
