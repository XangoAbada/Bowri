# StoryForge2

StoryForge2 is a local desktop writing workspace built with Tauri 2, React, Vite, TypeScript and SQLite.

The V1 AI provider is `codex-cli-bridge`: the app calls the official Codex CLI through Tauri commands, shows proposals in the UI, and saves changes only after user approval.

## Development

```sh
npm install
npm run desktop
```

Rust/Cargo is required to run the Tauri desktop shell. Frontend-only tests can be run with:

```sh
npm test
```
