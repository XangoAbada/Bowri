# StoryForge2

StoryForge2 is a local desktop writing workspace built with Tauri 2, React, Vite, TypeScript and SQLite.

The V1 AI provider is `codex-cli-bridge`: the app calls the official Codex CLI through Tauri commands, shows proposals in the UI, and saves changes only after user approval.
Cover generation uses OpenAI Images API (`gpt-image-2`) and requires `OPENAI_API_KEY` in the environment before the desktop app is started.

## Development

```sh
npm install
npm run desktop
```

`npm run desktop` starts the Vite browser preview only. It is useful for
frontend work, but it does not provide the Tauri/Rust backend, SQLite commands
or Codex CLI checks.

## Desktop App

To run the real desktop app with Tauri, use PowerShell from the repository root:

```powershell
cd D:\Projects\StoryForge2
npm install
npm run tauri -- dev
```

To enable cover generation in that same PowerShell session:

```powershell
$env:OPENAI_API_KEY="sk-..."
npm run tauri -- dev
```

The desktop app requires Rust/Cargo. If `cargo` is installed but the terminal
does not see it yet, open a new terminal or temporarily add Cargo to `PATH`:

```powershell
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo --version
npm run tauri -- dev
```

On Windows, install Rust with `rustup` if needed. Use the default MSVC toolchain
when the installer asks:

```powershell
winget install Rustlang.Rustup
rustup default stable
cargo --version
```

If `npm run tauri -- dev` fails with:

```text
failed to run `cargo metadata` ... program not found
```

then Tauri cannot find `cargo`. Fix it by installing Rust, opening a new
PowerShell window, and confirming this command works before retrying Tauri:

```powershell
cargo --version
npm run tauri -- dev
```

Frontend-only tests can be run with:

```sh
npm test
```
