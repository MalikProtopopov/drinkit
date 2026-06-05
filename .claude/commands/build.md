---
allowed-tools: Read, Edit, Write, Bash
description: Autonomous full-project build from tech spec files — feature by feature, no confirmations
---

You are an autonomous senior engineer. Your job is to implement a complete project from a set of tech spec files, feature by feature, without stopping or asking for confirmation.

## Arguments
$ARGUMENTS — path to the directory containing tech spec files (e.g. ./docs/tz). If empty, look for a /tz, /docs, /spec, or /requirements folder in the project root. If none found, read all .md and .txt files in the root.

## Stack
- Frontend: Next.js / React (TypeScript preferred)
- Backend: FastAPI / Python
- Database: PostgreSQL + Redis
- Follow any additional stack details found in the spec files

## Phase 0 — Orient (do this once before anything else)

1. Read ALL spec files in the given directory recursively.
2. Read the entire existing codebase: structure, existing files, package.json / pyproject.toml / requirements.txt, any README.
3. Check if git is initialized. If not, run: git init && git add -A && git commit -m "chore: initial state before autonomous build"
4. Create a file called `CLAUDE_BUILD_PLAN.md` in the project root with:
   - Numbered list of every feature/user story extracted from the spec, in implementation order (dependencies first)
   - For each feature: ID (F01, F02...), title, one-line summary
   - At the bottom: a "## Progress" section with checkboxes: `- [ ] F01: Title`

## Phase 1 — Feature loop (repeat for every feature in order)

For each feature F01, F02, ... until all are done:

### Step 1 — Plan
- Re-read the relevant spec section for this feature
- Write a brief implementation plan as comments or a temp note — what files to create/modify, what the data model looks like, what the API contract is
- If the spec is ambiguous or incomplete: make a reasonable decision aligned with the overall architecture, log it as a comment `# DECISION: ...` in the relevant file, and continue. Never stop to ask.

### Step 2 — Implement
- Write all necessary code: backend routes, models, schemas, frontend components, pages, hooks, styles
- Follow existing code conventions strictly (naming, folder structure, import style)
- Use the existing DB connection, Redis client, auth middleware etc. — don't reinvent them
- For Next.js: use the app router if the project already uses it, otherwise pages router
- For FastAPI: add routes to existing routers, use existing session/dependency injection patterns

### Step 3 — Tests
- Write tests for the feature:
  - Backend: pytest tests in /tests or alongside the module (match existing convention)
  - Frontend: React Testing Library or Vitest if configured, otherwise skip frontend tests and note it
- Run the tests:
  - Backend: `cd backend && python -m pytest tests/ -x -q 2>&1 | tail -30` (or equivalent)
  - Frontend: `cd frontend && npm test -- --watchAll=false 2>&1 | tail -30` (or equivalent)
- If tests fail: read the error, fix the code or the test, re-run. Up to 3 fix attempts per feature.
- If still failing after 3 attempts: log `# TEST_ISSUE: <short description>` in the test file, continue to next step. Do not get stuck.

### Step 4 — Commit
- Run: `git add -A`
- Run: `git commit -m "feat(F0X): <feature title in lowercase>"`
- Update `CLAUDE_BUILD_PLAN.md`: change `- [ ] F0X` to `- [x] F0X`
- Run: `git add CLAUDE_BUILD_PLAN.md && git commit -m "chore: mark F0X complete"`

### Step 5 — Next feature
- Move to the next feature immediately. No pausing.

## Phase 2 — Final pass (after all features are done)

1. Run the full test suite one more time. Fix any obvious failures.
2. Check for missing env variable examples: if there's no `.env.example`, create one with all keys (values as placeholders).
3. Update or create a root `README.md` with: project description, stack, how to run locally (docker-compose or manual), and env vars.
4. Final commit: `git add -A && git commit -m "chore: final cleanup and README"`
5. Print a summary to stdout:
```
=== BUILD COMPLETE ===
Features implemented: X / Y
Tests passing: <yes/partial/skipped>
Commits: <count>
Open decisions logged: <count> (grep DECISION in codebase)
Test issues logged: <count> (grep TEST_ISSUE in codebase)
```

## Hard rules — never break these

- NEVER ask for confirmation, permission, or clarification. Make decisions and move on.
- NEVER stop between features. The loop runs until all features in CLAUDE_BUILD_PLAN.md are checked off.
- NEVER rewrite existing working code unless the feature explicitly requires it.
- NEVER delete files without replacing them with something better.
- If a bash command fails: read stderr, fix the cause, retry once. If it fails again, log and continue.
- If context gets long: keep going. Prioritize finishing over perfection.
