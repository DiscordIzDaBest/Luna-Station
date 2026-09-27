# Security

Luna Station is a private, single-user build. There is no public release and no bug-bounty program.

## If you find a problem

Fix it in your own copy and add a test. The suites that guard the security model are worth
re-running after any change:

- `test/luna-claude-provider.e2e.test.js`: ambient-key guard, key never leaks into responses or
  transcripts, no billable fallback without consent, no Claude subscription credential handling.
- `test/servicekeys.env.test.js`: a pasted service key can never override internal `STARNET_*` controls.
- `test/tauri.hardening.test.js`, `test/workspace-safety.test.js`, and the permission/consent suites
  in `test/fast.list`.
- `npm run security:secrets`: full-history secret scan (needs Gitleaks in `PATH`).

A vulnerability in code inherited unchanged from StarNet should also be reported upstream, privately,
following the policy at <https://github.com/androoAGI/starnet/blob/main/SECURITY.md>.

## Scope that matters most

Secret handling (OS keychain, never in the frontend, transcripts or logs), filesystem and network
containment, permission/consent bypasses, and unintended remote access. The sidecar listens on
loopback only and every route requires the per-launch token.
