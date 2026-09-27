# Luna Station architecture

Luna Station is a private build derived from [StarNet](https://github.com/androoAGI/starnet) (MIT).
The runtime architecture is StarNet's, unchanged in shape. This page is the map; the more detailed
upstream map is [CODE_MAP.md](CODE_MAP.md).

## Processes

```
┌──────────────────────────── Luna Station.exe (Tauri 2, src-tauri/) ─────────────────────────────┐
│  • owns the window, tray, single-instance lock, OS keychain (service local.lunastation.desktop)   │
│  • spawns ONE bundled node.exe running sidecar/index.js, passing per-launch API/IPC tokens and    │
│    the keys you saved (as STARNET_<PROVIDER>_API_KEY) in the child's environment                  │
│  • guardian thread respawns the sidecar if it dies; kills it on quit / before an install          │
│  • native auto-update is compiled in but DISABLED (LUNA_UPDATES_ENABLED = false)                  │
└──────────────┬───────────────────────────────────────────────────────────────────────────────────┘
               │ http://127.0.0.1:<port>  (token-guarded HTTP + SSE/NDJSON, loopback only)
┌──────────────▼──────────────── sidecar (Node, sidecar/) ────────────────────────────────────────┐
│  index.js      HTTP routes, run host (runOnce), event emission, persistence wiring               │
│  loop.js       the agent loop: model turn → tool calls → results → next turn, bounded             │
│  providers/    registry (profiles, billing class) + adapters: anthropic, openai-compatible        │
│                (Ollama, OpenAI, xAI, …), openrouter, gemini, codex; rate-limit + price tables     │
│  capability/   station layout → the exact tool allowlist a run may use                            │
│  tools/        filesystem, shell, web, browser, desktop, notebook, recall, skills, image, …       │
│  permissions.js / permgrants.js  consent broker: ask / grant / deny, time-boxed                   │
│  mcp/          MCP client (HTTP + stdio transports, OAuth 2.1) and the curated catalog            │
│  channels/     Telegram, Discord, Slack, Signal, Matrix adapters + owner pairing                  │
│  cron*.js      scheduled routines (opt-in); nightshift*.js unattended leash                       │
│  *-store.js    atomic fsync-then-rename stores: transcripts, runs, memory, ledger, tasks, …      │
└──────────────┬───────────────────────────────────────────────────────────────────────────────────┘
               │ static files + the same localhost API
┌──────────────▼──────────────── frontend (vanilla JS, frontend/) ─────────────────────────────────┐
│  app/world.js     the station canvas — a projection of runtime state, never a simulation         │
│  app/app.js       roster (frontend owns it; sidecar mirrors it), run state, event bus            │
│  app/chat.js      COMMS; app/stationui.js settings/providers/dossiers; ~80 other modules          │
│  js/assets.js     crew sprite engine (Luna crew sets from scripts/luna-art)                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
shared/  frozen event + schema contracts used by both sides (additive-only)
```

Nothing runs in a cloud service of ours. Network traffic leaves the machine only for: the model
provider you selected; web/browser tools an agent is permitted to use; MCP servers and connectors
you configured. StarNet's managed cloud is switched off (`CLOUD_LIVE = false`) and the updater has
no endpoint.

## An agent run, end to end

1. COMMS (or a schedule, a channel message, or a delegation) calls `POST /api/run` with the agent
   id, provider, model and messages.
2. The run host resolves the provider profile and credential (keychain key → never an ignored
   ambient env key), checks budgets, and refuses up front if the key or model is missing.
3. The capability layer turns the agent's bay/loadout into its tool list; MCP tools the agent was
   granted are added.
4. `loop.js` streams a model turn through the adapter. Tool calls pass the capability gate and the
   consent broker (which may ask you), run, and their results feed the next turn. Hard ceilings on
   turns, tool bytes, dollars and unpriced tokens bound every run.
5. Every event (`agent.token`, `tool.*`, `agent.cost`, `agent.run.end`, …) is validated against
   `shared/events.js`, persisted where it matters (transcript, run journal, ledger) and streamed to
   the frontend. The station animates **only** from these events: an agent shown working has a live run.

Concurrency: each agent has its own run mutex; different agents run in parallel. Delegation and
summons create real child runs with their own bounds.

## Providers and billing

`registry.js` holds one profile per provider with a `billing` class:

| class | meaning | examples |
| --- | --- | --- |
| `api` | pay-per-token on the key owner's account | Claude API, OpenAI API, OpenRouter, Gemini |
| `local` | runs on this machine | Ollama |
| `subscription` | a sign-in that uses that vendor's plan | ChatGPT (Codex), Grok, Kimi |
| `endpoint` | your own OpenAI-compatible URL | Custom |

The run host refuses to fail over from a non-`api` run onto an `api` provider unless you consent
(see [AUTHENTICATION.md](AUTHENTICATION.md)). Claude Pro/Max sign-in is not a provider; see
the same page.

## Data on disk

Desktop (Windows): `%APPDATA%\local.lunastation.desktop\workspaces\` (the sidecar run alone with
`npm start` uses `%LOCALAPPDATA%\LunaStation\workspaces\`). Override with `STARNET_WORKSPACES`.

| What | Where (under the workspace root) |
| --- | --- |
| roster, station layout, saves | `agent.save.json`, `agent.roster.json`, `*.station*` |
| transcripts, run journal, run history | per-agent folders, `runs/`, transcript stores |
| memory (cortex), dossier, goals | memory/dossier stores |
| spend ledger, budgets | ledger + budget files |
| tasks, briefs, deliverables index | task/brief/deliverable stores |
| schedules | cron store |
| connector config (tokens → OS keychain on desktop) | `connectors/`, `channels/` |

Secrets: provider keys, channel bot tokens and the connector encryption key live in the OS keychain
on desktop. The sidecar keeps them in memory and never writes them into transcripts, run
history, diagnostics or API responses. OAuth sign-in tokens for ChatGPT/Grok/Kimi are files under
the workspace (as in StarNet).

## Subsystems (unchanged from StarNet)

- **MCP:** SETTINGS → ABILITIES. HTTP MCP servers and OAuth connectors work in the desktop app.
  Local stdio MCP servers are disabled by the desktop shell by default (`STARNET_MCP_STDIO=0`); the
  bare sidecar allows them.
- **Connectors:** Telegram, Discord, Slack, Signal, Matrix (SYSTEM → CHANNELS), with owner pairing.
- **Schedules:** WORK → AUTOMATION. The scheduler only arms when `STARNET_CRON_ENABLED=1` is set in
  the environment Luna Station starts with. Runs use the agent's own provider and the
  `autonomous` consent surface (ungranted mutations are denied).
- **Night Shift:** SETTINGS → NIGHT SHIFT. Explicit leash (what may run unattended, spend caps);
  every away-action is logged for review.
- **Voice:** push-to-talk dictation and one station voice (local or provider-backed).
- **Ledger:** real per-run tokens and list-price cost, budgets, run history.

## Build

- Sidecar only: `npm start` → <http://127.0.0.1:8787>.
- Desktop: `npm run desktop:dev` / `npm run desktop:build` (Windows NSIS installer), or the
  `desktop-build` GitHub Actions workflow. See [INSTALL.md](INSTALL.md).
- Art: `node scripts/luna-art/brand.mjs <dir>` and `node scripts/luna-art/install-crew.mjs`.
