# The Claude provider

Claude is Luna Station's primary provider. It runs through the **native Anthropic Messages API**
adapter that StarNet already shipped (`sidecar/providers/anthropic.js`), inside the same provider
abstraction, agent loop, tool gate and ledger as every other provider. There is no second runtime for
Claude.

For how you sign in (and why a Claude Pro/Max subscription can't be used), read
[AUTHENTICATION.md](AUTHENTICATION.md) first.

## Where it lives

| Piece | File |
| --- | --- |
| Profile (id `anthropic`, aliases `claude`, `claude-api`, `anthropic-api`; `billing: 'api'`; default provider) | `sidecar/providers/registry.js` |
| Wire adapter (request build, SSE parsing, retries, model catalog) | `sidecar/providers/anthropic.js` |
| Adapter selection | `sidecar/providers/factory.js` |
| Key resolution, ambient-env guard, billing-fallback guard, error text | `sidecar/index.js` (`providerEnvKey`, `missingCredentialDetail`, the run host) |
| Subscription status record | `CLAUDE_SUBSCRIPTION` in `registry.js` → `GET /api/providers` |
| Settings cards + billing labels | `frontend/app/stationui.js` |
| List prices for spend accounting | `sidecar/providers/prices.js` |

## What the adapter does

- **Models:** discovered live from `GET /v1/models` with your key. Each model's context window
  (`max_input_tokens`) and output ceiling (`max_tokens`) come from that response. Nothing is
  hard-coded except a short cold-start suggestion list, shown only while the catalog is unreachable.
- **Streaming:** Anthropic SSE is normalized into the harness event stream (`agent.token`, tool-call
  events, usage), so the station, COMMS and ledgers see Claude runs exactly like any other provider.
- **Tool use:** the harness's granted tools are sent in Anthropic's native `tools` shape. `tool_use`
  blocks run through the same capability gate, consent broker and tool-result pipeline as before.
  Thinking blocks are replayed verbatim before tool results, as the API requires.
- **Thinking / effort:** decided per model. Claude 4.6 and later get
  `thinking: {type: "adaptive"}` with `output_config.effort`. Older models get
  `{type: "enabled", budget_tokens}` kept below `max_tokens`. Models that can't turn thinking off
  (Fable, Mythos, Opus 5.5) never offer an OFF level. Effort levels a model doesn't support are
  clamped, never sent.
- **System prompts:** the agent's persona, class, station context and tool manual are sent as the
  top-level `system` block, with prompt-cache breakpoints on the static prefix and recent turns.
- **Max tokens:** explicit per-request value, else the model's reported `max_tokens`, else
  `SKYNET_ANTHROPIC_MAX_TOKENS`, else 32000.
- **Temperature:** not sent. Current Claude models (Opus 4.7+, Sonnet 5, Fable) reject sampling
  parameters, and the harness never needed them.
- **Timeouts:** connect ceiling `SKYNET_PROVIDER_CONNECT_MS` (default 30 s); stream-idle watchdog
  `SKYNET_PROVIDER_IDLE_MS` (default 300 s).
- **Retries:** two quick retries on transient failures (429/5xx/overloaded). A 401/403 is never
  retried; it ends the run with an auth error.
- **Cancellation:** STOP (or E-STOP) aborts the in-flight request through its `AbortSignal`.
- **Context overflow:** the harness compacts older turns at 65% of the model's reported window, and
  recovers reactively if the API still reports an overflow.
- **Caching knobs:** `SKYNET_ANTHROPIC_CACHE=0` disables cache breakpoints;
  `SKYNET_ANTHROPIC_CACHE_TTL=1h` uses the 1-hour tier.

## Picking a model

Choose the model in the COMMS model dock or per agent in its dossier. Use the IDs the catalog shows
(for example `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`). If a model can't do something a
run needs (for example a task needs tools and the catalog says the model has none), the run is
refused, or your saved fallback chain is used, and the reason is stated. It never silently degrades.

## Billing and the ledger

Every Claude API run is metered at Anthropic's published list prices (`prices.js`) and recorded in
the spend ledger and run history, with the model and token counts that were actually used.
Per-run and daily budgets (SETTINGS → SPENDING LIMITS) apply. Prices are the published list rates;
they are not read from your invoice.

## Running several Claude agents at once

Each agent run is its own `runOnce` with its own identity, system prompt, workspace, transcript,
tool grants and cost engine. Two Claude agents running at the same time send two independent
requests. `test/luna-claude-provider.e2e.test.js` proves this against the real sidecar: two agents
run at once and each gets its own streamed reply and its own transcript. Delegation (summon /
subagents) creates real, bounded child runs through the same path.

## Tests

- `test/provider.anthropic.test.js`: wire format, streaming, tools, thinking per model family,
  caching, catalog limits.
- `test/luna-claude-provider.e2e.test.js`: the real sidecar against a local mock of the Messages
  API. Covers default provider, billing labels, the subscription notice, the ambient-key guard,
  keychain key use, streaming, tools on tasks, concurrent agents, transcript isolation, 401/429
  without failover, key-never-leaks, the env opt-in, and no billable fallback from Ollama without
  consent.

What these tests cannot prove is a call to the real Anthropic API with your key. See the checklist
in [INSTALL.md](INSTALL.md#first-run-checklist).
