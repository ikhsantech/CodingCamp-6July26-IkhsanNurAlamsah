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

  // (Future sections — Storage, Validation, Business Logic, Render, Chart, Handlers, Init — will be added here)

})();
