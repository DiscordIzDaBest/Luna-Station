# Luna Station Privacy

_Last reviewed: 2026-09-27, against this build's code._

Luna Station is a **private, local-first desktop app** derived from StarNet. It runs a small server
(the "sidecar") on your own machine (`localhost`) and does the agent work there. There is **no Luna
Station account and no Luna Station server**. The app talks only to the providers and services you
choose, with your own keys. StarNet's managed-credits cloud is switched off in this build, and the
app never contacts StarNet's servers.

## The short version

- **The app does not track you.** There is no telemetry, no analytics, no crash reporting, and no ad
  SDK. The upstream code was audited for the usual suspects (Sentry, PostHog, Mixpanel, Segment,
  Google Analytics, Amplitude, Datadog); none are present. **Automatic update checks are disabled**
  in this private build, so the app makes no update request at all.
- **Your data stays on your machine**, under your OS user's app-data directory:
  Windows `%APPDATA%\local.lunastation.desktop\workspaces\`; macOS
  `~/Library/Application Support/local.lunastation.desktop/workspaces/`. (Running the sidecar alone
  with `npm start` uses `%LOCALAPPDATA%\LunaStation\workspaces\` on Windows.)
- The app uses the network only for the configured or requested work described below. These are the
  only outbound cases.

## What leaves your machine — and only these

Luna Station makes outbound network requests in exactly these situations. Nothing else.

### 1. Your chosen AI model provider (using your key)

When an agent runs, Luna Station calls the model provider **you** configured, authenticated with
**your** API key (or your ChatGPT sign-in). Your prompts, conversation, and any content the
agent works with are sent to that provider so it can generate a response — the same as any app
that uses that provider. Luna Station is a pass-through here; it does not sit in the middle.

Depending on what you set up, that provider is one of:

- OpenRouter (`openrouter.ai`)
- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- Google Gemini (`generativelanguage.googleapis.com`)
- ChatGPT via sign-in (`chatgpt.com` / `auth.openai.com`)
- or another OpenAI-compatible provider you point it at (xAI, Groq, Mistral, DeepSeek,
  Together, Fireworks, Perplexity, Cerebras).

**Your key, your data, your account.** Luna Station never keeps a copy anywhere but your machine — the key is
yours and the request goes straight to the provider you picked.

### 2. Chat channels — only if you connect them

If you connect a chat channel, Luna Station talks to that platform to send and receive messages on the
channel you set up, authenticated with the token (or endpoint) **you** provide. Nothing is
contacted unless you connect it:

- **Discord / Telegram** — Luna Station calls that platform's API (`discord.com`, `api.telegram.org`)
  with your bot token.
- **Slack** — Luna Station calls the Slack API (`slack.com`) with your bot token.
- **Matrix** — Luna Station talks to **the homeserver you point it at** — whatever URL you configure,
  whether `matrix.org` or a server you run yourself — using your access token. Luna Station does not
  pick a server; you do.
- **Signal** — Luna Station talks to **the signal-cli REST endpoint you run** (the URL you configure for
  your own signal-cli bridge), using the account you registered there.

If you never connect a channel, Luna Station never contacts any of these services.

### 3. Spotify — only if you enable it

If you enable the Spotify integration and authorize it, Luna Station calls the Spotify API
(`api.spotify.com`, `accounts.spotify.com`) to read what's playing and control playback, using
the token you granted. If you don't enable Spotify, no Spotify requests are made.

### 4. Web search / web fetch — only when an agent uses that tool

If an agent uses its web tools, Luna Station fetches results through independent, keyless services
— web search via Mojeek (`mojeek.com`, with DuckDuckGo as a fallback) and page reading via
Jina Reader (`r.jina.ai`) — or, if you have an OpenRouter key, OpenRouter's web plugin. If the
Jina reader is unavailable or rate-limits, the page is fetched **directly from its own host**
as a fallback, so the site you asked to read may see the request come from your machine. Only
your search query or the URL you asked to read is sent, and only when an agent actually runs a
web search or fetch. (The fetch tool also refuses to reach private/internal network addresses,
as an anti-abuse guard.)

### 5. Voice / text-to-speech — only if voices are on

Agent voices are synthesized through your model provider (OpenRouter) by default. If you
configure an **ElevenLabs** voice with your own ElevenLabs key, the line to be spoken is sent
to `api.elevenlabs.io` instead. No voices, no TTS requests.

### 6. No update checks

Automatic updates are disabled in this private build (there is no update feed), so no update
manifest is ever requested. You update by rebuilding from source; see INSTALL.md.

## What Luna Station stores on your machine (and how)

Everything below lives under your per-user app-data directory (see the paths in "The short
version" above for Windows/macOS/Linux). It never leaves your machine except as described
above. Where this document says "OS keychain," that means Windows Credential Manager, the
macOS Keychain, or the Linux Secret Service (e.g. GNOME Keyring), depending on your platform —
always under the service name `local.lunastation.desktop`.

| What | Where | How it's stored |
| --- | --- | --- |
| Conversation transcripts | `transcript.jsonl` | **Plaintext** JSON on disk |
| Run history + cost ledger | `runs.jsonl`, `ledger.jsonl` | **Plaintext** JSON on disk |
| Agent memory / beliefs / to-dos | `<agent>.notebook.json`, `<agent>.todo.json`, dossier/goals | **Plaintext** JSON on disk |
| Voice cache (spoken-line audio) | `voice-cache/` | **Plaintext** audio files on disk |
| Discord / Telegram bot tokens | OS keychain (desktop) | **OS keychain** (Windows Credential Manager); plaintext fallback in bare/dev mode — see below |
| Your model-provider API keys | OS keychain (desktop) | **OS keychain** (Windows Credential Manager); loaded into app memory at launch, never written to disk by the app |
| Spotify OAuth token | `.secrets/spotify.json` | **Plaintext** JSON on disk |
| ChatGPT / Codex sign-in token | `codex/tokens.json` | **Plaintext** JSON on disk |
| Grok sign-in token | `grok/tokens.json` | **Plaintext** JSON on disk |
| Kimi sign-in token | `kimi/tokens.json` | **Plaintext** JSON on disk |
| Google and other connector credentials, account identity and configuration | `connectors/state.json` and its recovery copy | **AES-256-GCM encrypted on desktop**, with an encryption key in the OS keychain; bare sidecar development without a supplied key remains plaintext |
| Channel message history (Discord/Telegram chats the bot saw) | `channels/*.history.json` | **Plaintext** JSON on disk |
| Agent memory ledgers (accepted/declined memory proposals, dossiers, goals) | per-agent `*.json` | **Plaintext** JSON on disk |
| Station state (widgets, sub-agents, routing, quests, XP) | various `*.json` | **Plaintext** JSON on disk |
| Settings, roster, permissions, cron | various `*.json` | **Plaintext** JSON on disk |

### Secrets: keychain vs. plaintext — the honest picture

On the **desktop build**, your provider API keys and your Discord/Telegram bot tokens are held
in the **OS keychain** (Windows Credential Manager, under service `local.lunastation.desktop`), not in
a plaintext file. When you upgrade from an older build, any bot token found in the old
plaintext `channels/secrets.json` is migrated into the keychain and stripped from that file.

Connector credentials use a separate encryption key under the same keychain service,
account `connectors:encryption:v1`. Desktop startup encrypts and verifies both active
and recovery copies before removing legacy connector credential files. If the keychain
is locked or the original key is missing, Luna Station preserves the encrypted files and
reports that saved connections are unavailable; it does not replace them with empty data.
Copies of those files alone cannot unlock connections on another OS account or computer.
Protect and retain your OS credential store when restoring backups. This protects
connector credentials, not the conversations, memories or exported files that may contain
Google content; their storage is listed separately above. Google Workspace public
activation remains deferred pending the remaining verification and data-handling work.
The selected-file candidate requests only `drive.file` through Google's file picker,
without email/profile, Gmail, Calendar or whole-Drive scopes. It can access files granted
to Luna Station and files it creates. This restriction does not mean file contents remain
local: the model-provider, transcript, memory and artifact disclosures above still apply.

If you instead run the bare sidecar directly (developer mode / `node sidecar/index.js` /
tests), the OS keychain isn't reachable, so those bot tokens **fall back to a plaintext file**
(`channels/secrets.json`). This is called out plainly in the code rather than hidden.

These integration secrets are **plaintext even on desktop** today: the **Spotify** OAuth token
(`.secrets/spotify.json`) and the **ChatGPT/Codex**, **Grok**, and **Kimi** sign-in tokens
(`codex/tokens.json`, `grok/tokens.json`, and `kimi/tokens.json`). If that matters to you, keep
those integrations off. (Transcripts are run through a redaction step at write-time to avoid
capturing secret-shaped tokens in your chat history, but the transcript file itself is plaintext.)

Because this data sits in plaintext files under your user profile, anyone with access to your
Windows user account can read it. Protect your machine account accordingly.

## What we do NOT do

- We do **not** run analytics or telemetry of any kind.
- We do **not** collect crash reports.
- We do **not** have an account system. There is no Luna Station account and no Luna Station
  server.
- We do **not** sell, share, or transmit your conversations, keys, or files to anyone. The only
  outbound traffic is the specific, purpose-built requests listed above.

## Managed credits

StarNet's optional managed-credits service is switched off in Luna Station (`CLOUD_LIVE = false`). No
billing account exists, and no prompt is ever relayed through a third-party gateway. Every model
call goes directly from your machine to the provider you chose, with your key.

## Deleting your data

Your data is just files. To wipe it, uninstall Luna Station and delete its app-data folder:
Windows `%APPDATA%\local.lunastation.desktop\`; macOS
`~/Library/Application Support/local.lunastation.desktop/`. If you ran the sidecar alone with
`npm start` on Windows, also delete `%LOCALAPPDATA%\LunaStation\`. Provider API keys and channel
tokens held in the OS keychain can be removed there too (search your credential manager / keychain
for `local.lunastation.desktop`).

## Changes

This is a private build; update this document whenever the code's network or storage behavior changes.
