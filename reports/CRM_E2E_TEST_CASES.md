# SwiftPrint CRM — E2E Test Cases (Scoped Modules)

**Application:** [app.crm.swagprinthub.com](https://app.crm.swagprinthub.com)  
**API:** `api.crm.swagprinthub.com` · Chat API: `api.chat.crm.swagprinthub.com`  
**Date:** 12 July 2026  
**Automation:** `crm-playwright-tests/` (Playwright)

## Scope

| In scope | Route |
|---|---|
| Users | `/settings/users` |
| Teams | `/settings/teams` |
| Roles & Permissions | `/settings/roles-permissions` |
| Ticket Distribution | `/settings/ticket-distribution` |
| Live Chats (NST) | `/live-chats` |
| Tickets | `/tickets` |
| Conversations | `/conversations` |

| **Excluded** | Reason |
|---|---|
| Live Chat Workspace | `/live-chats/workspace` — out of scope per request |
| All other modules | Out of scope |

## Test types legend

| Code | Type |
|---|---|
| S | Smoke |
| F | Functional |
| N | Negative |
| V | Validation |
| A | Authorization / RBAC |
| I | Integration |
| R | Regression |

## QA test users (automation)

Created via `npm run users:create` in `crm-playwright-tests/`.

| ID | Email | Role | Team | Purpose |
|---|---|---|---|---|
| QA-U-A | `qa-auto-agent-a@test.local` | AGENT | ASI Team | Agent flows, live chat, RBAC |
| QA-U-B | `qa-auto-agent-b@test.local` | AGENT | ASI Team | Distribution / transfer |
| QA-U-L | `qa-auto-admin-lite@test.local` | ADMIN | ASI Team | Admin-lite permissions |

Passwords: `fixtures/test-users.local.json` (local only, not in git).

---

## 1. Users (`/settings/users`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| U-01 | S | Users page loads | Login as admin → open Users | Heading "Users", Add User button |
| U-02 | F | List QA users | Open Users → search `qa-auto-` | All 3 QA users visible |
| U-03 | F | Filter tabs | Click All / Active / Inactive | Counts update, list filters |
| U-04 | F | Add User dialog | Click Add User | Form: email, name, role, team |
| U-05 | F | Create user | Fill valid data → Save | User in list, can login |
| U-06 | F | Edit user | Open user → change role/team → Save | Changes persisted |
| U-07 | F | Deactivate user | Set inactive | User marked inactive tab |
| U-08 | N | Duplicate email | Create user with existing email | Validation error |
| U-09 | N | Invalid email format | `not-an-email` | Validation error |
| U-10 | V | Empty required fields | Submit blank form | Blocked with errors |
| U-11 | A | Agent cannot manage users | Login as QA-U-A → Users | No Add User / access denied |
| U-12 | I | User team assignment | Assign to ASI Team | Visible under Teams module |
| U-13 | I | Role change updates access | AGENT → ADMIN | Menus match new role |
| U-14 | R | Search by email | Search `qa-auto-agent-a` | Single result |
| U-15 | R | Pagination | >1 page of users | Next/prev works |

**API:** `GET/POST /api/users` · Fields: `email`, `fullName`, `password`, `roleKey`, `teamId`

---

## 2. Teams (`/settings/teams`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| T-01 | S | Teams page loads | Open Teams | Heading "Teams", New team button |
| T-02 | F | ASI Team listed | View team list | ASI Team row visible |
| T-03 | F | Team columns | Check table headers | Team members, Folders, Smart lists |
| T-04 | F | Create team | New team → name → Save | Team appears |
| T-05 | F | Add member | Open team → add QA-U-A | Member count increases |
| T-06 | F | Remove member | Remove member | Member removed |
| T-07 | F | Folder grants | Assign folder access | Saved on team |
| T-08 | N | Duplicate team name | Create same name | Error |
| T-09 | N | Delete team with members | Delete active team | Warning or blocked |
| T-10 | A | Agent cannot create team | Login QA-U-A | New team hidden/denied |
| T-11 | I | Ticket auto-assign by smart list | Sync ticket matching team rule | Assigned to team |
| T-12 | R | Edit team display name | Rename → Save | Updated in list |

**API:** `GET /api/teams`

---

## 3. Roles & Permissions (`/settings/roles-permissions`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| R-01 | S | Page loads | Open Roles & Permissions | Roles/permissions UI visible |
| R-02 | F | System roles listed | View roles | MASTER_ADMIN, ADMIN, AGENT visible |
| R-03 | F | View role permissions | Select AGENT role | Permission checklist loads |
| R-04 | F | Toggle permission | Enable/disable perm → Save | Saved (admin only) |
| R-05 | F | Create custom role | New role + permissions | Role created |
| R-06 | N | Role with zero permissions | Assign to test user | Minimal UI access |
| R-07 | A | AGENT cannot edit roles | Login QA-U-A | Read-only or denied |
| R-08 | I | Permission `chat.*` | Remove live chat perm | QA user cannot open Live Chats |
| R-09 | I | Permission `tickets.*` | Remove tickets perm | Cannot open Tickets |
| R-10 | R | Rename custom role | Edit name | Updated without breaking users |

**API:** `GET /api/roles`, `GET /api/roles/{id}` (includes `permissionIds`), `GET /api/permissions`

---

## 4. Ticket Distribution (`/settings/ticket-distribution`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| TD-01 | S | Page loads | Open Ticket distribution | Heading + folders panel |
| TD-02 | F | Folders list loads | Wait for folders | Folder tree populated |
| TD-03 | F | View rules for folder | Select folder | Rules list for folder |
| TD-04 | F | Create assignment rule | Add rule (domain match) | Rule saved |
| TD-05 | F | Enable/disable rule | Toggle isEnabled | State persists |
| TD-06 | F | Assign to user | Set assigneeUserId | Rule shows assignee |
| TD-07 | F | Assign to team | Set assigneeTeamId | Rule shows team |
| TD-08 | N | Invalid pattern | Empty pattern | Validation error |
| TD-09 | I | Inbound email matches rule | Sync mailbox ticket | Auto-assigned per rule |
| TD-10 | I | Priority order | Multiple rules same folder | Higher priority wins |
| TD-11 | R | Edit rule | Change pattern | New tickets use new rule |

**API:** `GET /api/distribution-rules` → `{ rules: [...] }`

---

## 5. Live Chats (`/live-chats`) — NST widget

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| LC-01 | S | Page loads | Open Live Chats | Heading, tab filters |
| LC-02 | F | Tabs New/Assigned/Closed | Click each tab | List updates |
| LC-03 | F | Site filter NST | Select NST site | Only NST chats |
| LC-04 | I | Visitor handoff → pending | API: create session + handoff on NST | Chat in **New** tab |
| LC-05 | F | Preview pending chat | Click pending row | Visitor name + preview |
| LC-06 | F | Accept chat | Accept button | Moves to Assigned |
| LC-07 | F | Agent reply | Type reply → Send | Message in thread |
| LC-08 | F | Close chat | End/close action | Moves to Closed |
| LC-09 | N | Accept already accepted | Second agent accepts | Error / 403 |
| LC-10 | A | Agent without chat perm | Login restricted user | Live Chats blocked |
| LC-11 | I | Presence Available | Set AVAILABLE | Can receive chats |
| LC-12 | R | Search visitor name | Search `PW-LC-` tag | Seeded chat found |

**Not tested:** `/live-chats/workspace` (Workspace module — excluded)

**API seed:** `POST /api/public/chat/sessions` → profile → message → bot handoff (`liveAgentHandoff: true`)

---

## 6. Tickets (`/tickets`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| TK-01 | S | Page loads | Open Tickets | "All tickets" heading |
| TK-02 | F | Tab: Assigned to me | Click tab | Filtered list |
| TK-03 | F | Tab: Shared with me | Click tab | Shared tickets |
| TK-04 | F | Tab: Resolved | Click tab | Resolved tickets |
| TK-05 | F | Open ticket detail | Click ticket row | Detail pane loads |
| TK-06 | F | Reply to ticket | Compose reply → Send | Message in thread |
| TK-07 | F | Change status | Open → In progress → Resolved | Status updates |
| TK-08 | F | Assign agent | Reassign dropdown | New assignee |
| TK-09 | N | Reply empty body | Send blank | Validation |
| TK-10 | A | Agent scope | Login QA-U-A | Only permitted tickets |
| TK-11 | I | Import from mailbox | Trigger sync (if avail) | New tickets appear |
| TK-12 | R | Workspace filter | Change workspace filter | List scoped |

**API:** `GET /api/tickets?take=N` → `{ tickets, total, page, pageSize }`

---

## 7. Conversations (`/conversations`)

| ID | Type | Test case | Steps | Expected |
|---|---|---|---|---|
| CV-01 | S | Page loads | Open Conversations | Heading + recent list |
| CV-02 | F | Recent list | View left panel | Recent customers/tickets |
| CV-03 | F | Open conversation | Click list item | Thread in right pane |
| CV-04 | F | Reply in conversation | Send message | Appears in thread |
| CV-05 | F | Shared tab | Switch to Shared | Shared conversations |
| CV-06 | N | Reply on closed ticket | Send on closed | Blocked or warning |
| CV-07 | A | Agent access | Login QA-U-A | Sees permitted conversations |
| CV-08 | I | Link to ticket | Open from ticket | Same thread |
| CV-09 | R | Order: open tickets first | Toggle setting | Order persists |

**API:** `GET /api/conversations?take=N` → `{ customers, total, page, pageSize }`

---

## Automation coverage map

| Module | Playwright spec | Automated IDs |
|---|---|---|
| Users | `tests/users.spec.ts` | U-01, U-02, U-03 |
| Teams | `tests/teams.spec.ts` | T-01, T-02, T-03 |
| Roles | `tests/roles-permissions.spec.ts` | R-01, R-02, R-03 |
| Ticket Distribution | `tests/ticket-distribution.spec.ts` | TD-01, TD-02, TD-03 |
| Live Chats | `tests/live-chats.spec.ts` | LC-01, LC-02, LC-03 |
| Tickets | `tests/tickets.spec.ts` | TK-01, TK-02, TK-03 |
| Conversations | `tests/conversations.spec.ts` | CV-01, CV-02, CV-03 |
| RBAC | `tests/rbac.spec.ts` | RBAC-01, RBAC-02 |

Remaining cases (U-04–U-15, etc.) are documented for **manual** or **future automation** expansion.

---

## How to run automation

```bash
cd crm-playwright-tests
npm install
npx playwright install chromium
npm run users:create
npm test
```

Credentials: repo root `.env` (never commit).  
Report: `crm-playwright-tests/playwright-report/index.html`
