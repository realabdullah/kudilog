# KudiLog 💸

A fast, local-first Progressive Web App for personal monthly budgeting. Log expenses in seconds, view insights, and own your data — no backend, no accounts, no cost.

![KudiLog](public/icons/kudilog-app-icon.svg)

---

## Features

### Core
- **Fast expense input** — type `netflix 6500` and press Enter. Done.
- **Smart parsing** — extracts name, amount, and auto-detects category from keywords
- **Monthly view** — navigate between months, default to current
- **Real-time updates** — IndexedDB-backed reactive UI via Dexie live queries
- **Edit & delete** — inline editing, tap-to-expand actions, swipe-to-reveal on mobile

### Analytics
- Total monthly spend (prominent hero number)
- Highest expense, average per entry, transaction count
- Category breakdown with proportion bars
- 6-month spending trend chart
- Month-over-month comparison with contextual insight messages
- Recurring expense detection (names appearing across 2+ months)

### Budget & Settings
- Optional monthly budget limit with colour-coded progress bar
- Multi-currency support (NGN, USD, EUR, GBP, GHS, KES, ZAR, INR, CAD, AUD)
- Dark / light mode toggle

### Data Portability
- **Export** — download all data as a structured JSON file
- **Import** — restore from backup with merge or replace modes
- Schema-versioned format designed to be backend-ready

### PWA
- Installable on iOS and Android home screens
- Fully offline — works with no network connection
- App shell cached via Workbox service worker

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Storage | IndexedDB via [Dexie.js](https://dexie.org/) |
| Reactivity | `dexie-react-hooks` (useLiveQuery) |
| Styling | Tailwind CSS v4 |
| PWA | vite-plugin-pwa + Workbox |
| IDs | `uuid` v4 |
| Build | Vite |

**Bundle size:** ~110 KB gzipped (JS) — no router, no state management library, no icon library.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/kudilog.git
cd kudilog

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

The output goes to `dist/`. It includes:
- Optimised JS/CSS bundles
- `sw.js` — Workbox service worker for offline support
- `manifest.webmanifest` — PWA manifest

### Preview the Production Build

```bash
npm run preview
```

---

## Usage

### Logging an Expense

Type in the fast input field at the top of the dashboard:

```
netflix 6500
uber eats 3400
rent 85000
coffee 800 food
```

**Format:** `<name> <amount>` — the last numeric token is the amount; everything else is the name.

- Commas in amounts are accepted: `45,000`
- Decimals work: `salary 250000.50`
- Category is auto-detected from keywords (e.g. "uber" → transport, "netflix" → entertainment)
- Press **Enter** to submit instantly, **Escape** to clear

For more control, click **More options** to open the full form with explicit name, amount, and category fields.

### Navigating Months

Use the `‹` and `›` arrows in the header to move between months. Tap the month label to jump back to the current month.

### Editing / Deleting

- **Tap** any expense row to reveal edit and delete actions
- **Swipe left** on mobile to reveal the delete shortcut
- **Edit inline** — change name and amount directly in the row, press Enter to save

### Analytics

Switch to the **Insights** tab to see:
- Summary stats grid
- Budget progress (if a limit is set)
- AI-free insight messages (e.g. "You spent 18% more than last month")
- 6-month bar chart
- Category breakdown
- Recurring expense patterns

### Export Your Data

1. Go to **Settings** → **Data** → **Export JSON**
2. A file named `kudilog-export-YYYY-MM-DD.json` is downloaded
3. Keep this as a backup or use it to migrate to another device

### Import / Restore

1. Go to **Settings** → **Data** → **Import JSON**
2. Select your `.json` backup file
3. Preview the file contents (record count, export date, schema version)
4. Choose:
   - **Merge** — adds imported records without deleting existing data (safe default)
   - **Replace** — wipes all existing data and restores from the file

### Installing as an App

**iOS (Safari):**
1. Open KudiLog in Safari
2. Tap the Share button (square with arrow)
3. Tap "Add to Home Screen"

**Android (Chrome):**
1. Open KudiLog in Chrome
2. Tap the three-dot menu
3. Tap "Install app" or "Add to Home screen"

**Desktop (Chrome/Edge):**
- Click the install icon in the address bar

---

## Project Structure

```
kudilog/
├── public/
│   ├── favicon.svg            # SVG favicon
│   └── icons/
│       ├── icon-192.png       # PWA icon (192×192)
│       └── icon-512.png       # PWA icon (512×512)
├── src/
│   ├── components/
│   │   ├── analytics/
│   │   │   └── AnalyticsView.jsx   # Stats, trend chart, category breakdown
│   │   ├── expenses/
│   │   │   ├── ExpenseInput.jsx    # Fast input + expanded form
│   │   │   ├── ExpenseItem.jsx     # Single expense row (edit/delete/swipe)
│   │   │   └── ExpenseList.jsx     # List with search and sort
│   │   ├── layout/
│   │   │   └── AppLayout.jsx       # Header, bottom nav, month switcher
│   │   ├── settings/
│   │   │   └── SettingsView.jsx    # Currency, budget, export/import, theme
│   │   └── ui/
│   │       └── index.jsx           # Modal, Badge, Toast, Skeleton, Button, etc.
│   ├── db/
│   │   └── db.js                   # Dexie schema (versioned), seed helpers
│   ├── hooks/
│   │   └── useExpenses.js          # All data hooks: queries, mutations, analytics
│   ├── utils/
│   │   ├── exportImport.js         # JSON export/import logic + validation
│   │   ├── formatters.js           # Currency, dates, percentages, category meta
│   │   └── parseInput.js           # Free-form "name amount" parser
│   ├── App.jsx                     # Root component, tab routing, settings wiring
│   ├── index.css                   # Tailwind import, animations, PWA overrides
│   └── main.jsx                    # React DOM entry point
├── index.html                      # HTML shell with PWA meta tags
├── vite.config.js                  # Vite + Tailwind + PWA plugin config
└── package.json
```

---

## Data Schema

### Expense

```json
{
  "id":        "550e8400-e29b-41d4-a716-446655440000",
  "name":      "Netflix",
  "amount":    6500,
  "category":  "entertainment",
  "month":     "2025-04",
  "createdAt": "2025-04-29T10:32:00.000Z",
  "updatedAt": "2025-04-29T10:32:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID v4) | Unique identifier |
| `name` | `string` | Expense label, trimmed |
| `amount` | `number` | Amount as a plain float |
| `category` | `string` | Category slug or empty string |
| `month` | `string` | `YYYY-MM` — auto-assigned at creation |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp, updated on edit |

### Categories

| Slug | Label |
|---|---|
| `food` | Food & Dining |
| `transport` | Transport |
| `entertainment` | Entertainment |
| `shopping` | Shopping |
| `health` | Health |
| `bills` | Bills & Utilities |
| `education` | Education |
| `personal` | Personal Care |
| `travel` | Travel |
| `other` | Other |

---

## Export Format

The JSON export is structured to be backend-ready and self-describing:

```json
{
  "meta": {
    "appName": "kudilog",
    "schemaVersion": 1,
    "exportedAt": "2025-04-29T12:00:00.000Z",
    "recordCount": {
      "expenses": 42,
      "settings": 3
    }
  },
  "data": {
    "expenses": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Netflix",
        "amount": 6500,
        "category": "entertainment",
        "month": "2025-04",
        "createdAt": "2025-04-29T10:32:00.000Z",
        "updatedAt": "2025-04-29T10:32:00.000Z"
      }
    ],
    "settings": [
      { "id": "currency",     "value": "NGN"   },
      { "id": "monthlyBudget","value": 150000  },
      { "id": "theme",        "value": "dark"  }
    ]
  }
}
```

### Import Behaviour

| Mode | Description |
|---|---|
| `merge` | Uses `bulkPut` — imported records overwrite by ID, existing records not in the file are kept |
| `replace` | Clears all expenses and settings, then inserts the imported data |

Import validates:
- `meta.appName` must be `"kudilog"`
- `meta.schemaVersion` must be ≤ current schema version
- Each expense must have `id`, `name`, `amount`, and `month`

---

## Database

KudiLog uses [Dexie.js](https://dexie.org/) as a thin wrapper around IndexedDB.

### Schema (v1)

```js
db.version(1).stores({
  expenses: "id, month, category, createdAt, updatedAt",
  settings: "id",
});
```

Indexes on `month` and `category` allow fast per-month and per-category queries without full table scans.

### Schema Migrations

To add a new schema version, add a new `db.version(n)` block in `src/db/db.js`. Dexie handles the IndexedDB upgrade transaction automatically.

```js
// Example future migration
db.version(2).stores({
  expenses: "id, month, category, createdAt, updatedAt, tags",
  settings: "id",
}).upgrade(tx => {
  return tx.expenses.toCollection().modify(exp => {
    exp.tags = [];
  });
});
```

---

## Performance

| Metric | Value |
|---|---|
| JS bundle (gzipped) | ~110 KB |
| CSS bundle (gzipped) | ~8 KB |
| First load (fast 3G) | < 2s |
| IndexedDB write | < 5ms |
| Re-render on add | ~16ms (single frame) |

All analytics are computed in-process from IndexedDB — no network calls, no server round trips.

---

## Development Notes

### Reactive Data Flow

```
IndexedDB (Dexie)
    │
    └─▶ useLiveQuery (dexie-react-hooks)
            │
            └─▶ React component re-renders automatically on any DB write
```

`useLiveQuery` subscribes to the relevant IndexedDB object stores. Any write — add, update, delete — triggers a re-evaluation of the query and a re-render of the subscribed component. No manual cache invalidation needed.

### Adding a New Category

1. Open `src/utils/formatters.js`
2. Add an entry to the `CATEGORIES` array: `{ id: "...", label: "...", emoji: "..." }`
3. Add keywords to the `CATEGORY_KEYWORDS` map in `src/utils/parseInput.js`

### Adding a New Currency

1. Open `src/components/settings/SettingsView.jsx`
2. Add an entry to the `CURRENCIES` array: `{ code: "...", label: "...", symbol: "..." }`
3. Add the symbol to `CURRENCY_SYMBOLS` in `src/utils/formatters.js`

---

## Roadmap

- [ ] Recurring expense auto-tagging
- [ ] Spending notifications (budget threshold alerts)
- [ ] CSV export
- [ ] Multiple budgets (per category)
- [ ] Optional cloud sync via exported JSON + REST API
- [ ] AI-assisted categorisation (local model via WebLLM)
- [ ] Multi-currency per expense

---
