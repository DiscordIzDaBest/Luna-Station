# Installing Luna Station (Windows first)

Luna Station is a private build, so there is no public download and no auto-updater. You build the
Windows installer yourself, either on GitHub Actions (no tools needed on your PC) or locally.
Linux is not a supported release target for this build. macOS builds are possible from the same
workflow but have had less use.

## Option A — build the installer on GitHub Actions (easiest)

1. On GitHub, open this repository → **Actions** → **luna-windows-build** → **Run workflow**. (The
   manual button appears once the workflow is on the default branch. Before that, it runs by
   itself whenever `.github/workflows/luna-windows-build.yml` changes on a branch, and on any
   `luna-v*` tag.) The job first runs the Luna provider tests on Windows, then builds.
2. When it finishes, download the **luna-station-windows-x64** artifact from the run page. It
   contains `Luna Station_<version>_x64-setup.exe`.
3. Run the installer. The build is **unsigned** (no code-signing certificate is configured), so
   Windows SmartScreen will say *"Windows protected your PC"*. Because you built it yourself from
   your own repository, choose **More info → Run anyway**. Do not do this for an installer from
   anywhere else.
4. Launch **Luna Station** from the Start menu.

The older multi-platform `desktop-build` workflow (inherited from StarNet) still builds Windows,
Linux and macOS test bundles. Its StarNet publishing step is disabled.

## Option B — build locally on Windows 11

Requirements: [Node.js 22](https://nodejs.org), Git, and the
[Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/) (Rust via rustup,
Microsoft C++ Build Tools, WebView2, which Windows 11 already has).

```powershell
git clone <your Luna-Station repo URL>
cd Luna-Station
npm ci
npm run desktop:build
```

The installer lands in `src-tauri\target\release\bundle\nsis\`. `npm run desktop:dev` runs the
desktop shell against your working tree without installing.

## Run from source without the desktop shell

```bash
npm ci
npm start      # http://127.0.0.1:8787
```

In this mode, keys you save are kept in that browser's local storage (there is no OS keychain).

## Run free with a local model

Install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.1`), and pick **LOCAL
OLLAMA**, either on the first-run brain screen or later in **SETTINGS → PROVIDERS**. Luna Station
reaches Ollama at `127.0.0.1:11434` and shows it ready only after it has listed your local models.
Local models are smaller than cloud models, so expect slower, rougher results on long tasks.

## First-run checklist

These are the things the automated tests cannot do for you, because they need your own accounts:

1. **Claude API:** create a key at <https://platform.claude.com/>, paste it in **SETTINGS →
   PROVIDERS → CLAUDE API → ＋ ADD KEY**, and confirm the card says **KEY SAVED · VERIFIED**. Pick a
   model (for example `claude-sonnet-5`) and send a message. Then check the run and its cost under
   the ledger. Usage is billed to that Console account.
2. **Claude Subscription card:** it should read **NOT AVAILABLE TO THIRD-PARTY APPS**. That is
   expected; see [AUTHENTICATION.md](AUTHENTICATION.md).
3. **Ollama:** with Ollama running, the LOCAL OLLAMA card should read **REACHABLE**. Select it and
   send a message.
4. **Tools:** give an agent a task that needs a tool (for example "list the files in your
   workspace"). Approve the consent prompt and confirm the result.
5. **Two agents at once:** recruit a second agent, give both a task, and watch both work at the
   same time on the station.
6. **Restart:** quit from the tray and relaunch. Your crew, transcripts and ledger should still be
   there.
7. **Connectors / MCP / schedules / Night Shift:** set up whichever you use. Schedules need
   `STARNET_CRON_ENABLED=1` in the environment Luna Station starts with (see ARCHITECTURE.md).

## Where your data is

- App data: `%APPDATA%\local.lunastation.desktop\` (workspaces, logs, startup log).
- Secrets: Windows Credential Manager, service **local.lunastation.desktop**.
- Deliverables you export: `Desktop\Luna Station deliverables\`.

Luna Station never reads or writes StarNet's folders or keychain entries, so both can be installed
side by side.

## Updating

Pull the latest code and rebuild (Option A or B), then run the new installer over the old one. The
installer upgrades in place and your data stays in `%APPDATA%`. The in-app **UPDATES** panel reports
that automatic updates are disabled in this private build.

## Uninstalling

**Settings → Apps → Installed apps → Luna Station → Uninstall.** Your data folder is left in place;
delete `%APPDATA%\local.lunastation.desktop` yourself if you want it gone.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| CLAUDE API says **NO KEY** although `ANTHROPIC_API_KEY` is set | Intended; environment keys are ignored. Save the key in the card, or set `LUNA_ALLOW_ENV_ANTHROPIC_KEY=1`. |
| "Anthropic rejected the Claude API key" | The key is wrong, revoked, or its Console org is disabled. Replace it. |
| "Anthropic API rate limit reached" | Your API account's rate limit. Wait, or raise it in the Console. |
| LOCAL OLLAMA **OFFLINE** | Start Ollama (`ollama serve`) and pull at least one model; a first load can take minutes. |
| SmartScreen blocks the installer | Expected for an unsigned self-built installer; see Option A step 3. |
| The window never appears | Quit from the tray, relaunch; check `%APPDATA%\local.lunastation.desktop\startup.log`. |
| Schedules never fire | Set `STARNET_CRON_ENABLED=1` before starting Luna Station. |
