# AGENTS.md

## Testing Policy

- Do not run tests, builds, Playwright checks, or other verification commands. The user is the only person who performs testing and verification.
- After UI changes, describe what the user should inspect manually, especially awkward spacing, weak alignment, cramped or wasted space, poor proportions, visual imbalance, and overall layout coherence.

## Commit Hygiene

- Before committing, remove unnecessary generated log files from the project directory, especially root-level `*.log` files from Vite, Tauri, or local preview runs.
