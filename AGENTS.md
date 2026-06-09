# AGENTS.md

## Testing Policy

- Do not run front-end tests, Playwright checks, or other automated UI verification. The user is the only person who performs front-end testing and UI verification.
- Build commands and backend tests may be run when they are useful for validating non-UI changes.
- After UI changes, describe what the user should inspect manually, especially awkward spacing, weak alignment, cramped or wasted space, poor proportions, visual imbalance, and overall layout coherence.

## Migration Hygiene

- Do not edit existing database migration files that may already have been applied locally or by another developer.
- When changing the database schema or migration behavior, add a new migration instead of modifying a previously applied migration.
- If a migration must be corrected immediately after creation, first verify it has not been applied; otherwise create a follow-up migration.

## AI Field Controls

- Every text input or textarea added to the app should include an AI generation button.
- Each AI field generation must include the meaningful context fields for that generation target.
- The `+` context button should let the author attach relevant fields to the active prompt context where the screen supports contextual AI prompts.
- AI-generated text must go through the proposal/acceptance flow and must not be saved permanently without user confirmation.

## Commit Hygiene

- Before committing, remove unnecessary generated log files from the project directory, especially root-level `*.log` files from Vite, Tauri, or local preview runs.
