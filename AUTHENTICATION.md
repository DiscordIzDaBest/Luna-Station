# Authentication in Luna Station

This page states exactly how Luna Station authenticates to each model provider, what it does **not**
do, and why. It was written on 2026-09-27 against Anthropic's documentation as published that day.

## Summary

| Provider card | How you authenticate | Who pays | Status |
| --- | --- | --- | --- |
| **Claude Subscription** (Pro / Max) | — | — | **Not available** to this app (see below) |
| **Claude API** | Anthropic API key from the [Claude Console](https://platform.claude.com/) | Your Anthropic API account, per token | Working |
| **Local Ollama** | None | Nobody — runs on your machine | Working |
| Other providers (OpenRouter, OpenAI, Gemini, …) | That provider's key or sign-in | That provider | Working (unchanged from StarNet) |

## Claude Pro / Max subscription sign-in: not available

You asked for Luna Station to use your Claude Pro subscription through an official mechanism if
one exists for third-party apps. **None exists for this app.** Anthropic's current documentation says:

- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): *"Unless previously
  approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits
  for their products, including agents built on the Claude Agent SDK. Use the API key
  authentication methods described in the Quickstart instead."*
- [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance): developers building
  products *"should use API key authentication through Claude Console or a supported cloud
  provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own
  applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their
  users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or
  session tokens."*

Luna Station has no approval from Anthropic, so it contains **no subscription code path at all**:

- no "Sign in with Claude" OAuth flow;
- no import of `CLAUDE_CODE_OAUTH_TOKEN`, `claude setup-token` output, or Claude Code's
  `~/.claude/.credentials.json`;
- no requests to claude.ai, and no request that presents itself as Claude Code;
- no use of the Agent SDK with a claude.ai login.

The **Claude Subscription** card in **SETTINGS → PROVIDERS** exists only to show this state. It has
no sign-in button and no key field, and cannot be selected. Its text comes from the sidecar
(`CLAUDE_SUBSCRIPTION` in `sidecar/providers/registry.js`, served on `GET /api/providers`). A test
(`test/luna-claude-provider.e2e.test.js`) fails if any sidecar, shell or frontend source references
claude.ai login endpoints, Claude Code's credential file or its OAuth token variable.

**What would change this:** Anthropic publishing a supported sign-in flow for third-party apps, or
Anthropic approving this app. Then the record flips to `available: true` and a real provider profile
is added next to it. Until then, your Pro plan keeps working in Anthropic's own apps (claude.ai,
Claude Desktop, Claude Code). It does not power Luna Station's agents.

> The legal page also describes a case where a platform runs the *unmodified Claude Code binary*
> and the end user signs in to that binary themselves. That is Claude Code running its own agent
> loop, tools and permissions — not Luna Station's runtime — and it falls under Anthropic's
> Commercial Terms conditions. It was deliberately not built. Ask Anthropic before relying on it.

## Claude API (pay-per-token)

1. Create a key at <https://platform.claude.com/> (Settings → API keys). Usage is billed per token
   to that Console account. It is **separate from, and not covered by**, a Claude Pro or Max plan.
2. In Luna Station open **SETTINGS → PROVIDERS → CLAUDE API → ＋ ADD KEY** and paste it.
   - Desktop app: the key is stored in the Windows Credential Manager / macOS Keychain under the
     service `local.lunastation.desktop`. It never reaches the frontend source, the transcript or the
     logs. The shell passes it to the local sidecar as `STARNET_ANTHROPIC_API_KEY` when it starts
     the sidecar, and live after that through a token-guarded local endpoint.
   - Browser/dev mode (`npm start`): the key is held by that browser's local storage and sent to
     your local sidecar per run.
3. The card shows **KEY SAVED · VERIFIED** only after a no-generation probe (`GET /v1/models`) succeeds.

Every Claude API card is labelled **$ API BILLING** so API usage is never mistaken for plan usage.

### The `ANTHROPIC_API_KEY` environment variable is ignored by default

If `ANTHROPIC_API_KEY` happens to be set in your Windows or shell environment (often for some other
tool), Luna Station **does not use it**. The card then says the variable is set but ignored, naming
the variable but never showing its value. A run that would need it is refused with:

> Anthropic API key is not configured. (ANTHROPIC_API_KEY is set in your environment but ignored; …)

To deliberately allow the environment key, set `LUNA_ALLOW_ENV_ANTHROPIC_KEY=1` before starting Luna
Station. Keys you save in the app are always used.

### No silent failover onto API billing

A run that starts on a non-billed provider (Local Ollama, or a subscription sign-in such as
ChatGPT) **never** fails over to a pay-per-token API provider on its own. That holds even with a
fallback chain saved in SETTINGS → MODEL DEFAULTS. Such fallbacks are skipped and logged. To allow
them:

- per run, via the API: `"allowBillableFallback": true` on `POST /api/run`; or
- station-wide: set `LUNA_ALLOW_BILLABLE_FALLBACK=1`.

Fallbacks from one API-billed provider to another still follow your saved chain, because saving a
chain is an explicit choice to pay for those models.

## Local Ollama

No authentication. Luna Station talks to `http://127.0.0.1:11434/v1` (override with
`OLLAMA_BASE_URL`) and reports the endpoint reachable only after it lists your local models.

## Error messages you may see

| Message | Meaning |
| --- | --- |
| `Anthropic API key is not configured.` | No saved Claude API key (an environment key, if any, is ignored). |
| `Anthropic rejected the Claude API key` | Anthropic returned 401/403 — the key is wrong, revoked, or its org is disabled. |
| `Anthropic API rate limit reached for your API key` | HTTP 429 from Anthropic — your **API account's** limit, not a subscription limit. |
| `not signed in to <provider>` | A sign-in provider (ChatGPT, Grok, Kimi) has no valid session. |
