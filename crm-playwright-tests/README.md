# CRM Playwright E2E Tests

Automated UI + API-assisted tests for **SwiftPrint CRM** ([app.crm.swagprinthub.com](https://app.crm.swagprinthub.com)).

## In scope

| Module | UI route |
|---|---|
| Users | `/settings/users` |
| Teams | `/settings/teams` |
| Roles & Permissions | `/settings/roles-permissions` |
| Ticket Distribution | `/settings/ticket-distribution` |
| Live Chats (NST inbox) | `/live-chats` |
| Tickets | `/tickets` |
| Conversations | `/conversations` |

**Excluded:** Workspace module (`/live-chats/workspace`), all other modules.

## Setup

```bash
cd crm-playwright-tests
npm install
npx playwright install chromium

# Uses credentials from ../.env (repo root)
cp .env.example .env   # optional if ../.env exists

# Create QA test users (one-time)
npm run users:create
```

## Run tests

```bash
npm test                 # all chromium tests (admin session)
npm run test:live-chats  # NST widget inbox test only
npm run test:headed      # watch browser
npm run test:report      # open HTML report
```

## Test users

Created by `npm run users:create`:

| Key | Email | Role |
|---|---|---|
| qaAgentA | `qa-auto-agent-a@test.local` | AGENT |
| qaAgentB | `qa-auto-agent-b@test.local` | AGENT |
| qaAdminLite | `qa-auto-admin-lite@test.local` | ADMIN |

Passwords are in `fixtures/test-users.local.json` (**gitignored**).  
Public metadata (ids, emails) in `fixtures/test-users.json`.

## Live chat seeding

`live-chats.spec.ts` creates a real visitor session on **NST** via API (handoff to agent), then asserts it appears in the Live Chats **New** tab. Uses `WIDGET_PUBLIC_KEY` and `WIDGET_SITE_NAME=NST` from `.env`.

## Full manual test cases

See [`../reports/CRM_E2E_TEST_CASES.md`](../reports/CRM_E2E_TEST_CASES.md).

## Project layout

```
crm-playwright-tests/
├── tests/           # Playwright specs
├── pages/           # Page objects
├── helpers/         # API seeding
├── fixtures/        # Test user metadata
├── scripts/         # User creation & exploration
└── exploration/     # Local discovery output (gitignored)
```
