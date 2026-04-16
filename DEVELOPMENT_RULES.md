# 🛡️ Sherlocked ERP — Development Rules

> **GOLDEN RULE: New features must NEVER break working code.**
> These rules apply to EVERY change, EVERY feature, EVERY session — no exceptions.

---

## ✅ Current Stable Baseline

**Tag:** `v1.0-stable-calendar`
**What works:**
- Calendar displays correct times matching settings for both branches
- Timezone handling correct (Israel UTC+3)
- Slot sync (save & sync) wipes empty days and preserves booked days
- Direct Supabase connection via Management API
- Late-night slots (00:00–06:00) grouped with previous day + 🌙 icon

---

## 🔀 Rule 1 — Always Use Feature Branches

```
main        → production, always stable, always deployed
feature/*   → new features (never touch main directly)
fix/*       → bug fixes
```

**Workflow for every new feature:**
```bash
git checkout -b feature/my-new-feature
# ... make changes, test ...
git push origin feature/my-new-feature
# Only merge to main when verified working
```

**I (Antigravity) will always create a feature branch first before touching any working code.**

---

## 🗄️ Rule 2 — Database Changes Are Always Additive

- **NEVER modify** an existing working SQL function without creating a backup version first
- **ALWAYS** add new columns as nullable or with defaults — never break existing rows
- **ALWAYS** test new DB functions on a `dev` branch or via direct query before wiring to UI
- Before replacing any function: `CREATE OR REPLACE FUNCTION old_name_backup AS ...`

---

## 🔌 Rule 3 — API Routes Are Never Modified Directly

- New API endpoints go in **new files** — never modify a route that the calendar or bookings pages depend on
- If a route must change: create `route_v2.ts` alongside, switch the frontend, then delete old
- Working routes to protect:
  - `/api/bookings/calendar` — slot display
  - `/api/admin/slots/generate` — sync engine
  - `/api/bookings/[id]` — booking mutations

---

## 🧱 Rule 4 — Isolate New UI Components

- New UI features go in **new components** — never edit a working page component directly
- If a page must change: extract the working section into a component first, then extend
- Working pages to protect:
  - `dashboard/bookings/calendar/page.tsx` — main calendar
  - `dashboard/admin/calendar/page.tsx` — settings
  - `components/Sidebar.tsx` — navigation

---

## 🏷️ Rule 5 — Tag Every Stable Milestone

After every major feature is confirmed working:
```bash
git tag -a v1.X-stable-[feature] -m "Description of what works"
git push origin --tags
```

**Existing stable tags:**
| Tag | What's stable |
|-----|--------------|
| `v1.0-stable-calendar` | Full calendar with correct timezone sync |

---

## ⚡ Rule 6 — Rollback Plan Before Every Change

Before touching anything working, I will:
1. Note the current git commit hash
2. Confirm the feature branch is checked out
3. State explicitly: *"If this breaks, rollback with: `git revert [hash]`"*

---

## 📋 Checklist Before Merging Anything to Main

- [ ] Feature branch tested independently
- [ ] Calendar still shows correct times
- [ ] Sync still works (save & sync produces correct slots)
- [ ] No new ghost slots appear
- [ ] Sidebar navigation intact
- [ ] Both branches (מערב / מזרח) display correctly
