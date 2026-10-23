# PokeIdle Panel

A desktop panel (Windows and macOS) for running up to **4 [PokeIdle](https://pokeidle.io/app) accounts side by side**, each in a fully isolated browser session, inside a single Pokédex-styled window.

> Unofficial fan tool. It only embeds the public game page in isolated browser sessions; it does not automate, modify or inject anything into the game.

## ⬇️ Download

| System | Direct download |
| --- | --- |
| 🍎 **macOS** (Apple Silicon: M1/M2/M3/M4) | [**PokeIdle-Panel-mac-arm64.dmg**](https://github.com/gabrielsvpinheiro/pokeidle-panel/releases/latest/download/PokeIdle-Panel-mac-arm64.dmg) |
| 🍎 **macOS** (Intel) | [**PokeIdle-Panel-mac-x64.dmg**](https://github.com/gabrielsvpinheiro/pokeidle-panel/releases/latest/download/PokeIdle-Panel-mac-x64.dmg) |
| 🪟 **Windows** (64-bit) | [**PokeIdle-Panel-win-x64.exe**](https://github.com/gabrielsvpinheiro/pokeidle-panel/releases/latest/download/PokeIdle-Panel-win-x64.exe) |

All versions and release notes: [Releases page](https://github.com/gabrielsvpinheiro/pokeidle-panel/releases/latest). See [First launch](#first-launch-unsigned-builds) if your OS shows a security warning.

## Features

- **Up to 4 accounts at once**, each with its own cookies, localStorage and login (one persistent Electron session per slot). Log in once and the account stays logged in across restarts.
- **2×2 grid** with draggable dividers: resize every tile independently, double-click a divider to reset it.
- **Focus mode**: expand any account to fill the window, then go back to the grid (buttons, trainer tabs or shortcuts).
- **Keeps farming in the background**: throttling is disabled for the game views and the system is kept from suspending the app.
- **Per-account settings**: nickname, enable/disable (a disabled slot uses no memory), mute, clear session (log out) and optional **proxy** (`http`, `https`, `socks4`, `socks5`; user/password supported for HTTP(S) proxies).
- **Auto-recovery** when a game view crashes, plus a status LED per account.
- Remembers window size, layout and settings.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + 0` | Show all accounts (grid) |
| `Ctrl/Cmd + 1…4` | Focus account 1…4 |

## First launch (unsigned builds)

The installers are not code-signed yet, so the OS will warn you once:

- **macOS**: open the `.dmg`, drag the app to *Applications*, then right-click the app → **Open** → **Open**. If macOS still refuses, run `xattr -dr com.apple.quarantine "/Applications/PokeIdle Panel.app"`.
- **Windows**: SmartScreen shows "Windows protected your PC": click **More info** → **Run anyway**.

## Usage

1. Open the app. Slot 1 is active by default; use **Activate account** on the other tiles (or the ⚙ button) to enable more.
2. Log in to a different PokeIdle account in each tile.
3. Use the ⚙ button of a tile to rename it, mute it, set a proxy or clear its session.

Data (settings and session storage) lives in the Electron user-data folder:

- macOS: `~/Library/Application Support/pokeidle-panel`
- Windows: `%APPDATA%\pokeidle-panel`

Delete it to reset everything.

## Development

Requirements: Node.js 22+ and npm.

```bash
git clone <repository-url>
cd pokeidle-panel
npm install
npm run dev        # start the app with hot reload
npm run typecheck  # TypeScript check
```

> If `npm run dev` complains about downloading Electron or fails right away, make sure the `ELECTRON_RUN_AS_NODE` environment variable is not set (some editors set it): `env -u ELECTRON_RUN_AS_NODE npm run dev`.

### Building installers

```bash
npm run dist:mac   # .dmg for arm64 and x64 (must run on macOS)
npm run dist:win   # .exe (NSIS) installer (run on Windows)
```

Output goes to `dist/`. Building the Windows installer from an Apple Silicon Mac is unreliable; use the CI workflow instead.

### Releasing

Pushing a tag like `v0.2.0` triggers [.github/workflows/release.yml](.github/workflows/release.yml), which builds macOS and Windows installers on their native runners and attaches them to a GitHub Release.

```bash
git tag v0.2.0 && git push origin v0.2.0
```

### Project structure

```
src/
  main/       Electron main process: window, per-account sessions/views, proxy, config
  preload/    Safe IPC bridge exposed to the UI as window.panel
  renderer/   React UI (Pokédex-style shell, grid, settings dialog)
  shared/     Types shared between processes
scripts/      Icon generator (npm run icons)
build/        App icon
```

How it works: each account is a `WebContentsView` bound to its own `persist:account-N` session. The React UI renders placeholder tiles and reports their screen rectangles to the main process, which positions the native views over them. While a dialog is open or a divider is being dragged, the views are hidden so the UI stays on top.

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch from `main`: `git checkout -b feat/my-change`.
2. Make your change, keeping the style of the surrounding code (TypeScript strict, small focused modules, no unnecessary comments).
3. Run `npm run typecheck` and `npm run build`, and try the app with `npm run dev`.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `build:`, `chore:` …), one logical change per commit.
5. Open a pull request describing what changed and why, with a screenshot for UI changes.

Bug reports and feature ideas: open an issue with your OS, app version and steps to reproduce.

Code, comments, commits and docs are written in English.

## Notes

- Using several accounts is allowed by the game, but always check the current PokeIdle rules.
- SOCKS5 proxies that require a username/password are not supported by Chromium.
- No license has been chosen yet; add a `LICENSE` file before accepting external contributions.
