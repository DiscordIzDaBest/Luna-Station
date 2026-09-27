'use strict';
/* Luna Station — Claude provider contract, exercised against the REAL sidecar and a local mock of the Anthropic
   Messages API (ANTHROPIC_BASE_URL). No real credentials: every key below is a fixture string.

   Proves:
     1. Claude (Anthropic API) is the default provider, labelled as pay-per-token API billing; Ollama is local/free.
     2. Claude Pro/Max subscription sign-in is reported as NOT available (policy record), and no code path exists
        that could use one (no claude.ai endpoints, no Claude Code credential/token reuse).
     3. An ANTHROPIC_API_KEY that merely exists in the environment is IGNORED (no request leaves the station) unless
        LUNA_ALLOW_ENV_ANTHROPIC_KEY=1; the keychain-scoped key the desktop shell injects is honored.
     4. Real streamed runs through the Anthropic adapter: text, token usage, tools offered on tasks, two agents running
        concurrently with separate identities and transcripts.
     5. Auth failure (401) and rate limit (429) end the run with an honest error and never fail over to another
        (billable) provider.
     6. Key material never appears in API responses or transcripts.
     7. A run on a free local provider never fails over onto pay-per-token API billing without explicit consent. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { SidecarFixture } = require('./helpers/sidecar-fixture.js');
const registry = require('../sidecar/providers/registry.js');

const AMBIENT_KEY = 'sk-ant-ambient-fixture-0000000000';
const SCOPED_KEY = 'sk-ant-scoped-fixture-1111111111';
const ROOT = path.resolve(__dirname, '..');

function sse(events) {
  return events.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join('');
}
function textReply(text, model) {
  return sse([
    { type: 'message_start', message: { id: 'msg_fixture', type: 'message', role: 'assistant', model, content: [], usage: { input_tokens: 21, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } },
    { type: 'message_stop' }
  ]);
}

(async () => {
  // ---------- 1 + 2: static contract ----------
  assert.equal(registry.DEFAULT_PROVIDER_ID, 'anthropic', 'Claude via the Anthropic API is the default provider');
  const anth = registry.getProviderProfile('anthropic');
  assert.equal(anth.billing, 'api', 'the Claude API profile is labelled as API billing');
  assert.equal(anth.ambientKeyOptInEnv, 'LUNA_ALLOW_ENV_ANTHROPIC_KEY');
  assert.equal(registry.normalizeProviderId('claude', ''), 'anthropic');
  assert.equal(registry.normalizeProviderId('claude-api', ''), 'anthropic');
  const ollama = registry.getProviderProfile('ollama');
  assert.equal(registry.billingFor(ollama), 'local');
  assert.equal(ollama.keyRequired, false, 'Ollama never needs a key (and never depends on Anthropic)');
  assert.equal(registry.billingFor(registry.getProviderProfile('codex')), 'subscription');

  const sub = registry.CLAUDE_SUBSCRIPTION;
  assert.equal(sub.available, false, 'Claude subscription sign-in is not available to this app');
  assert.ok(sub.sources.every(u => u.startsWith('https://code.claude.com/docs/')), 'the limitation cites official docs');
  assert.equal(registry.getProviderProfile('claude-subscription'), null, 'the subscription record is NOT a runnable provider');
  const station = fs.readFileSync(path.join(ROOT, 'frontend/app/stationui.js'), 'utf8');
  const fallback = station.match(/CLAUDE_SUBSCRIPTION_FALLBACK = \{[\s\S]*?reason: ([\s\S]*?),\r?\n\s*sources/);
  assert.ok(fallback, 'the UI carries an offline copy of the policy record');
  // eslint-disable-next-line no-new-func
  assert.equal(Function('return ' + fallback[1])(), sub.reason, 'UI fallback copy matches the sidecar record verbatim');
  assert.ok(!/data-act="prov-oauth-signin"[^\n]*claude-subscription/.test(station), 'no sign-in button is ever offered for the subscription card');

  // No code path may touch claude.ai login, Claude Code's stored credentials, or its OAuth token env var.
  const forbidden = /claude\.ai\/(oauth|login|api)|\.credentials\.json|CLAUDE_CODE_OAUTH_TOKEN|oauth-2025-04-20|anthropic-beta['"]?\s*:\s*['"]oauth/;
  const scan = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return (d.name === 'node_modules' || d.name === 'skills') ? [] : scan(p);
    return /\.(js|mjs|rs)$/.test(d.name) ? [p] : [];
  });
  for (const file of scan(path.join(ROOT, 'sidecar')).concat(scan(path.join(ROOT, 'src-tauri', 'src')), scan(path.join(ROOT, 'frontend', 'app')))) {
    const hit = fs.readFileSync(file, 'utf8').match(forbidden);
    assert.equal(hit, null, path.relative(ROOT, file) + ' must not reference Claude subscription credentials (' + (hit && hit[0]) + ')');
  }

  // ---------- mock Anthropic Messages API ----------
  const calls = [];
  let mode = 'ok';
  const upstream = http.createServer(async (req, res) => {
    req.setEncoding('utf8');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const key = req.headers['x-api-key'] || '';
    if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5', type: 'model', max_input_tokens: 1000000, max_tokens: 128000 }], has_more: false }));
    }
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ url: req.url, key, body });
    if (mode === '401') { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })); }
    if (mode === '429') { res.writeHead(429, { 'Content-Type': 'application/json', 'retry-after': '1' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } })); }
    const sys = JSON.stringify(body.system || '');
    const who = /AGENT_ALPHA/.test(sys) ? 'alpha' : /AGENT_BETA/.test(sys) ? 'beta' : 'solo';
    // Hold concurrent runs open briefly so they genuinely overlap on the wire.
    if (who !== 'solo') await new Promise(r => setTimeout(r, 300));
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(textReply('Reply for ' + who + '.', body.model));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + upstream.address().port + '/v1';

  const env = {
    SKYNET_FULL_ACCESS: '1', STARNET_FULL_ACCESS: '1',
    ANTHROPIC_BASE_URL: base,
    ANTHROPIC_API_KEY: AMBIENT_KEY,               // ambient: present in the environment for "some other tool"
    STARNET_ANTHROPIC_API_KEY: '', SKYNET_ANTHROPIC_API_KEY: '',
    LUNA_ALLOW_ENV_ANTHROPIC_KEY: '',
    OPENROUTER_KEY: '', OPENROUTER_API_KEY: '', STARNET_OPENROUTER_KEY: '', SKYNET_OPENROUTER_KEY: ''
  };
  const fixture = new SidecarFixture({ prefix: 'luna-claude-', env });
  const runEvents = response => response.text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const endOf = events => events.findLast(e => e.name === 'agent.run.end');
  try {
    await fixture.start();

    // ---------- 3a: ambient key ignored ----------
    let prov = await fixture.json('GET', '/api/providers');
    assert.equal(prov.status, 200);
    assert.equal(prov.body.defaultProvider, 'anthropic');
    assert.equal(prov.body.claudeSubscription.available, false);
    let anthRow = prov.body.providers.find(p => p.id === 'anthropic');
    assert.equal(anthRow.billing, 'api');
    assert.equal(anthRow.configured, false, 'an ambient ANTHROPIC_API_KEY does not configure the Claude API provider');
    assert.deepEqual(anthRow.ignoredEnvKeys, ['ANTHROPIC_API_KEY'], 'the ignored key is reported by NAME');
    assert.ok(!prov.text.includes(AMBIENT_KEY), 'the key value never leaves the sidecar');
    assert.equal(prov.body.providers.find(p => p.id === 'ollama').billing, 'local');
    // A private build links to no managed cloud (Luna Station's belongs to the upstream project).
    const linkable = await fixture.json('GET', '/api/credits/linkable');
    assert.ok(!(linkable.body && linkable.body.available), 'no managed cloud is offered: ' + linkable.text.slice(0, 200));
    assert.ok(!/starnetos\.com/.test(linkable.text), 'the upstream cloud is never named');

    const blocked = await fixture.json('POST', '/api/run', { provider: 'anthropic', model: 'claude-sonnet-5', agentId: 'solo', messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(calls.length, 0, 'NO request reaches Anthropic when the only key is an ambient one');
    assert.ok(!blocked.text.includes(AMBIENT_KEY));
    assert.ok(blocked.status >= 400 || /key|credential|configured/i.test(blocked.text), 'the run is refused with a key/configuration error: ' + blocked.text.slice(0, 300));

    // ---------- 3b + 4: keychain-scoped key honored; real streamed runs ----------
    await fixture.restart({ STARNET_ANTHROPIC_API_KEY: SCOPED_KEY });
    prov = await fixture.json('GET', '/api/providers');
    anthRow = prov.body.providers.find(p => p.id === 'anthropic');
    assert.equal(anthRow.configured, true, 'the keychain-scoped key configures the provider');
    assert.ok(!prov.text.includes(SCOPED_KEY) && !prov.text.includes(AMBIENT_KEY));

    await fixture.json('POST', '/api/roster', { updatedAt: Date.now(), agents: [
      { agentId: 'alpha', name: 'Alpha', system: 'AGENT_ALPHA identity', provider: 'anthropic', model: 'claude-sonnet-5' },
      { agentId: 'beta', name: 'Beta', system: 'AGENT_BETA identity', provider: 'anthropic', model: 'claude-sonnet-5' }
    ] });
    const run = (agentId, text, extra) => fixture.json('POST', '/api/run', Object.assign({
      provider: 'anthropic', model: 'claude-sonnet-5', agentId, streamId: 'luna-' + agentId,
      system: agentId === 'alpha' ? 'AGENT_ALPHA identity' : agentId === 'beta' ? 'AGENT_BETA identity' : 'solo',
      messages: [{ role: 'user', content: text }]
    }, extra || {}));

    const [ra, rb] = await Promise.all([run('alpha', 'hello'), run('beta', 'hello')]);
    for (const [r, who] of [[ra, 'alpha'], [rb, 'beta']]) {
      assert.equal(r.status, 200, r.text);
      const ev = runEvents(r);
      assert.equal(endOf(ev).payload.reason, 'done', who + ' run completes: ' + r.text.slice(-400));
      assert.ok(ev.some(e => e.name === 'agent.token' && e.payload.delta === 'Reply for ' + who + '.'), who + ' receives ITS OWN streamed reply');
      assert.ok(!r.text.includes(SCOPED_KEY));
    }
    const msgCalls = calls.filter(c => /\/messages$/.test(c.url));
    assert.ok(msgCalls.length >= 2);
    assert.ok(msgCalls.every(c => c.key === SCOPED_KEY), 'every request used the keychain key, never the ambient one');
    assert.ok(msgCalls.every(c => !/claude-code|claude_code/i.test(JSON.stringify(c.body.system || ''))), 'requests never present themselves as Claude Code');

    const task = await run('alpha', 'research the three largest moons of Jupiter and write a short report', { isTask: true });
    assert.equal(endOf(runEvents(task)).payload.reason, 'done', task.text.slice(-400));
    const taskWire = calls.filter(c => /\/messages$/.test(c.url)).pop().body;
    assert.ok(Array.isArray(taskWire.tools) && taskWire.tools.length > 0, 'a task run offers the agent its granted tools');
    assert.ok(taskWire.tools.every(t => t.name && t.input_schema), 'tools are sent in Anthropic native shape');

    const ta = await fixture.json('GET', '/api/transcript?agent=alpha&stream=luna-alpha&limit=200');
    const tb = await fixture.json('GET', '/api/transcript?agent=beta&stream=luna-beta&limit=200');
    assert.ok(ta.text.includes('Reply for alpha.') && !ta.text.includes('Reply for beta.'), 'alpha transcript is isolated');
    assert.ok(tb.text.includes('Reply for beta.') && !tb.text.includes('Reply for alpha.'), 'beta transcript is isolated');
    assert.ok(!ta.text.includes(SCOPED_KEY) && !tb.text.includes(SCOPED_KEY), 'transcripts never contain the key');

    // ---------- 5: auth failure + rate limit: honest error, no silent failover ----------
    for (const m of ['401', '429']) {
      mode = m;
      const before = calls.length;
      const r = await run('solo', 'hello');
      const ev = runEvents(r);
      const end = endOf(ev);
      assert.ok(end && end.payload.reason !== 'done', m + ' does not report a completed run');
      assert.ok(calls.length > before, m + ' reached the Anthropic endpoint');
      assert.ok(calls.slice(before).every(c => c.key === SCOPED_KEY), m + ' never retried on another credential');
      assert.ok(!r.text.includes(SCOPED_KEY), m + ' error text never echoes the key');
    }
    mode = 'ok';

    // ---------- 3c: explicit opt-in to the ambient key ----------
    await fixture.restart({ STARNET_ANTHROPIC_API_KEY: '', LUNA_ALLOW_ENV_ANTHROPIC_KEY: '1' });
    prov = await fixture.json('GET', '/api/providers');
    anthRow = prov.body.providers.find(p => p.id === 'anthropic');
    assert.equal(anthRow.configured, true, 'with LUNA_ALLOW_ENV_ANTHROPIC_KEY=1 the environment key is used');
    assert.deepEqual(anthRow.ignoredEnvKeys, []);
    const optRun = await run('solo', 'hello');
    assert.equal(endOf(runEvents(optRun)).payload.reason, 'done', optRun.text.slice(-400));
    assert.equal(calls[calls.length - 1].key, AMBIENT_KEY);

    // ---------- 7: a free local run never fails over onto billable API usage without consent ----------
    const routerCalls = [];
    const local = http.createServer((req, res) => {
      let raw = ''; req.on('data', b => raw += b); req.on('end', () => {
        if (req.url.startsWith('/router') && req.method === 'POST') {   // generation only; GET /models catalog lookups are free
          routerCalls.push(req.method + ' ' + req.url + ' ' + raw.slice(0, 160));
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          return res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: 'billable fallback' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2, cost: 0.001 } }) + '\n\ndata: [DONE]\n\n');
        }
        if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'local-model' }] })); }
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'model is loading, overloaded' } }));
      });
    });
    await new Promise(resolve => local.listen(0, '127.0.0.1', resolve));
    const localBase = 'http://127.0.0.1:' + local.address().port;
    try {
      await fixture.restart({ STARNET_OPENROUTER_KEY: 'sk-or-fixture-2222', SKYNET_OPENROUTER_BASE: localBase + '/router', OLLAMA_BASE_URL: localBase + '/v1' });
      const saved = await fixture.json('POST', '/api/fallback/chain', { models: ['openai/gpt-5'] });
      assert.equal(saved.status, 200, saved.text);
      const localRun = await fixture.json('POST', '/api/run', { provider: 'ollama', model: 'local-model', baseUrl: localBase + '/v1', agentId: 'solo', messages: [{ role: 'user', content: 'hello' }] });
      assert.equal(routerCalls.length, 0, JSON.stringify(routerCalls) + ' an Ollama failure did NOT fail over to billable OpenRouter without consent');
      assert.ok(endOf(runEvents(localRun)).payload.reason !== 'done', 'the local failure is reported honestly');
      const consented = await fixture.json('POST', '/api/run', { provider: 'ollama', model: 'local-model', baseUrl: localBase + '/v1', agentId: 'solo', allowBillableFallback: true, messages: [{ role: 'user', content: 'hello' }] });
      assert.ok(routerCalls.length >= 1, 'with explicit per-run consent the billable fallback is used');
      assert.equal(endOf(runEvents(consented)).payload.reason, 'done', consented.text.slice(-400));
    } finally { await new Promise(resolve => local.close(resolve)); }

    console.log('luna-claude-provider.e2e: PASS (default, billing labels, subscription notice, env-key guard, streaming, tools, concurrency, isolation, 401/429, opt-in)');
  } finally {
    await fixture.dispose();
    await new Promise(resolve => upstream.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
