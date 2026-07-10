# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, visualize spending distribution by category, and monitor their budget against a configurable limit. The application runs entirely in the browser using HTML, CSS, and Vanilla JavaScript with no backend or framework dependencies. All data is persisted using the Browser Local Storage API.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Transaction_List**: The scrollable UI component displaying all recorded transactions.
- **Input_Form**: The UI form used to create a new transaction.
- **Category**: A predefined classification for a transaction — one of: Food, Transport, or Fun.
- **Balance**: The running total amount calculated from all transactions currently stored.
- **Chart**: The pie chart visual component showing spending distribution by category.
- **Local_Storage**: The Browser Local Storage API used to persist transaction data client-side.
- **Monthly_Summary**: A filtered view showing transactions and totals for a selected calendar month.
- **Budget_Limit**: A user-configurable monetary threshold used to highlight excessive spending.
- **Sort_Control**: The UI control enabling users to reorder the Transaction_List.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter expense details through a form, so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL include a text field for item name (1–100 characters), a numeric field for amount (0.01–999,999,999.99), and a dropdown selector for Category with exactly the options: Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled, item name between 1–100 characters, and amount between 0.01 and 999,999,999.99, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage within 500ms.
3. IF the user submits the Input_Form with the item name field empty, THEN THE Input_Form SHALL display a validation error message identifying "Item Name is required" and SHALL NOT create a transaction.
4. IF the user submits the Input_Form with no Category selected, THEN THE Input_Form SHALL display a validation error message identifying "Category is required" and SHALL NOT create a transaction.
5. IF the user submits the Input_Form with an amount that is not a number, is zero, is negative, or exceeds 999,999,999.99, THEN THE Input_Form SHALL display a validation error message stating "Amount must be between 0.01 and 999,999,999.99" and SHALL NOT create a transaction.
6. WHEN a transaction is successfully added, THE Input_Form SHALL reset the item name field to empty, the amount field to empty, and the Category dropdown to its default unselected state.
7. IF Local_Storage is unavailable when attempting to persist a transaction, THEN THE App SHALL display an error message indicating data could not be saved and SHALL NOT add the transaction to the Transaction_List.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded expenses in a list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each transaction's item name (up to 100 characters), amount formatted as a positive decimal with exactly 2 decimal places, and Category.
2. WHEN the App loads, THE Transaction_List SHALL render all transactions previously persisted in Local_Storage in reverse chronological order (most recently added first).
3. WHEN Local_Storage contains no transactions on App load, THE Transaction_List SHALL display an empty state message such as "No transactions yet."
4. WHILE the number of transactions exceeds the visible area of the Transaction_List container, THE Transaction_List SHALL be scrollable.
5. WHEN a new transaction is added, THE Transaction_List SHALL update to display the new transaction at the top of the list without requiring a page reload.

---

### Requirement 3: Transaction Deletion

**User Story:** As a user, I want to delete individual transactions, so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL display a delete control for each transaction entry.
2. WHEN the user activates the delete control for a transaction, THE App SHALL display a confirmation prompt asking the user to confirm the deletion before proceeding.
3. WHEN the user confirms the deletion, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage within 300ms.
4. WHEN the user cancels the confirmation prompt, THE App SHALL dismiss the prompt and leave the transaction unchanged in both the Transaction_List and Local_Storage.
5. IF Local_Storage is unavailable when attempting to persist the deletion, THEN THE App SHALL display an error message indicating the deletion could not be saved and SHALL restore the transaction to the Transaction_List.
6. WHEN a transaction is deleted, THE Balance SHALL update to reflect the removal within 300ms.
7. WHEN a transaction is deleted, THE Chart SHALL update to reflect the new spending distribution within 300ms.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total spending at all times, so that I can understand my overall expenditure at a glance.

#### Acceptance Criteria

1. THE App SHALL display the Balance as the sum of all transaction amounts formatted to exactly 2 decimal places at the top of the page.
2. WHEN a transaction is added, THE App SHALL recalculate and display the updated Balance within 500ms without requiring a page reload.
3. WHEN a transaction is deleted, THE App SHALL recalculate and display the updated Balance within 500ms without requiring a page reload.
4. WHEN the App loads with no transactions in Local_Storage, THE App SHALL display a Balance of 0.00.
5. IF all transactions are deleted resulting in a zero balance, THEN THE App SHALL display a Balance of 0.00 in the default visual style.

---

### Requirement 5: Spending Distribution Chart

**User Story:** As a user, I want to see a visual breakdown of my spending by category, so that I can understand where my money goes.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart where each slice represents a Category that has at least one transaction, sized proportionally to that Category's share of the total spending amount.
2. THE Chart SHALL display a label for each slice showing the Category name and its percentage of total spending rounded to one decimal place.
3. WHEN a transaction is added, THE Chart SHALL update to reflect the new spending distribution within 500ms without requiring a page reload.
4. WHEN a transaction is deleted, THE Chart SHALL update to reflect the new spending distribution within 500ms without requiring a page reload.
5. WHEN the App loads with no transactions, THE Chart SHALL display a placeholder state with no pie slices and a message such as "No spending data yet."
6. THE Chart SHALL render using Chart.js loaded via a CDN script tag in the HTML file.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved between sessions, so that I do not lose my data when I close the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL serialize the Transaction_List to JSON and write it to Local_Storage under the key "ebv_transactions".
2. WHEN a transaction is deleted, THE App SHALL serialize the updated Transaction_List to JSON and write it to Local_Storage under the key "ebv_transactions".
3. WHEN the App initializes, THE App SHALL read and deserialize transaction data from Local_Storage key "ebv_transactions" and render the Transaction_List, Balance, and Chart based on the stored data.
4. IF Local_Storage contains no data for the key "ebv_transactions" on initialization, THEN THE App SHALL initialize with an empty Transaction_List and display a Balance of 0.00.
5. IF Local_Storage data for the key "ebv_transactions" cannot be deserialized as valid JSON on initialization, THEN THE App SHALL initialize with an empty Transaction_List and display an error message indicating that saved data could not be loaded.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my expenses filtered by month, so that I can track my spending on a monthly basis.

#### Acceptance Criteria

1. THE App SHALL provide a month selector control that allows the user to choose any calendar month and year within the range of 12 months prior to the current month through the current month, inclusive.
2. WHEN the App loads, THE Monthly_Summary SHALL default to displaying the current calendar month and year.
3. WHEN the user selects a month, THE Monthly_Summary SHALL display only transactions whose recorded timestamp falls within that calendar month and year, ordered by date descending.
4. THE Monthly_Summary SHALL display the total spending amount for the selected month formatted to exactly 2 decimal places.
5. WHEN a transaction is added, THE App SHALL record the local date and time accurate to the nearest second as the transaction's timestamp.
6. WHEN no transactions exist for the selected month, THE Monthly_Summary SHALL display a message indicating no transactions for that period and a total spending of 0.00.

---

### Requirement 8: Transaction Sorting

**User Story:** As a user, I want to sort my transactions by amount or category, so that I can find and analyze entries more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer the following sorting options: by insertion order, by amount ascending, by amount descending, and by Category alphabetically ascending.
2. WHEN the user selects a sort option, THE Transaction_List SHALL re-render with transactions ordered according to the selected option within 500ms.
3. WHILE a sort option other than insertion order is active and a new transaction is added, THE Transaction_List SHALL insert the new transaction at its correct sorted position according to the active sort option.
4. THE Sort_Control SHALL default to insertion order, displaying transactions with the most recently added appearing last.
5. WHEN two transactions have equal amounts and the active sort is by amount, THE Transaction_List SHALL use insertion order as the tie-breaker.

---

### Requirement 9: Budget Limit Warning

**User Story:** As a user, I want to be warned when my total spending exceeds a budget limit I set, so that I can stay within my financial goals.

#### Acceptance Criteria

1. THE App SHALL provide a Budget_Limit input field where the user can enter a numeric value between 0.01 and 999,999,999.99 as a monetary threshold.
2. WHEN the Balance exceeds the Budget_Limit, THE App SHALL display the Balance using a distinct warning style (such as a different text color or background color) that is visually distinguishable from the default style.
3. WHEN the Balance is equal to or below the Budget_Limit, THE App SHALL display the Balance in its default visual style.
4. WHEN the user updates the Budget_Limit value to a valid number, THE App SHALL re-evaluate whether the Balance exceeds the new limit and update the visual state within 100ms.
5. IF the user sets a Budget_Limit that is not a number, is zero, is negative, or exceeds 999,999,999.99, THEN THE App SHALL display a validation error and SHALL NOT apply the new limit, leaving the previously applied limit unchanged.
6. WHERE a Budget_Limit has been set, THE App SHALL persist the Budget_Limit value in Local_Storage under the key "ebv_budget_limit" so that it is restored on the next session.
7. WHEN the App initializes and a Budget_Limit is restored from Local_Storage, THE App SHALL immediately re-evaluate whether the current Balance exceeds the restored Budget_Limit and apply the appropriate visual state.

---

### Requirement 10: Application Layout and Structure

**User Story:** As a developer, I want the application to follow a defined file structure, so that the codebase remains maintainable and consistent.

#### Acceptance Criteria

1. THE App SHALL be composed of exactly one HTML file at the project root, one CSS file located in a `css/` directory, and one JavaScript file located in a `js/` directory.
2. THE App SHALL function as a standalone web application loadable by opening the HTML file directly in a modern browser without a build step, server, or dependency installation.
3. THE App SHALL be compatible with Chrome, Firefox, Edge, and Safari in their current stable versions, meaning all acceptance criteria across all requirements must pass in each listed browser.
4. WHEN the App is loaded on a connection of at least 25 Mbps, THE App SHALL load and render the initial view above the fold in an interactive state within 2 seconds from navigation start.
5. IF any required external resource (such as Chart.js CDN) fails to load, THEN THE App SHALL display an error message indicating the resource failed to load and gracefully degrade by showing text-based spending totals per category in place of the Chart.
