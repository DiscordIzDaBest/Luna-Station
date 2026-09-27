# Luna Station v0.12.4

First private Luna Station build, derived from StarNet v0.12.4.

- Claude via the Anthropic API is the default provider; every provider card states how it is billed.
- Claude Pro/Max sign-in is shown as unavailable to third-party apps (Anthropic policy); no subscription credential handling exists.
- An ambient `ANTHROPIC_API_KEY` is ignored unless `LUNA_ALLOW_ENV_ANTHROPIC_KEY=1`; no silent failover from a free/local run onto API billing.
- Claude model limits come from the Models API (`max_input_tokens`, `max_tokens`).
- New identity, icons, installer art and an original 24-member crew; own app id, data folder and keychain namespace.
- Auto-update and StarNet's managed cloud are disabled; Windows installer built by the `luna-windows-build` workflow.
