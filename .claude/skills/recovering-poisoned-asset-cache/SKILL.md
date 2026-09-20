---
name: recovering-poisoned-asset-cache
description: 'Diagnose and recover users stuck on a blank page or endless splash screen because a CDN or browser has pinned a 404 for a boot chunk. Covers confirming the diagnosis, the origin-side fix, the edge purge, and forcing every asset URL to rotate when a redeploy cannot dislodge the cached 404. Use when users report "stuck on splash screen", "spinner forever", "blank page after deploy", a cached 404 on /assets/*, or when reloading does not fix a broken app.'
---

# Recovering a Poisoned Asset Cache

A content-hashed chunk 404s. A cache stores that 404. Every client that reads
from that cache is served a broken app, and **reloading cannot fix it** — the
client is not asking origin, and with `immutable` it will not revalidate.

This happened as IR-105: nginx stamped `Cache-Control: public, max-age=2592000,
immutable` on 404 responses, Cloudflare honoured it, and `rolldown-runtime-*.js`
— the module runtime, without which no other chunk can load — was served as a
cached 404 to a subset of users for as long as 30 days.

## Confirm the diagnosis before acting

The same symptom ("stuck on splash / spinner forever") has at least three
unrelated causes. Fixing the wrong one wastes an incident.

```bash
# 1. Is a boot asset 404ing, and is the 404 itself cached?
curl -sI https://cloud.comfy.org/assets/<chunk>.js | grep -iE 'HTTP/|cache-control|cf-cache-status|age'
```

- `HTTP/2 404` + `cf-cache-status: HIT` → **poisoned cache.** This runbook applies.
- `HTTP/2 404` + `cf-cache-status: MISS/BYPASS` → origin is genuinely missing
  the file. Different problem: check the deploy and the bucket.
- All boot assets `200` → **not this.** The app is booting and failing later.
  Check for an unregistered route or an auth stall instead; those present
  identically and this runbook will not help.

```bash
# 2. Prove the no-store fix is live, using a path that cannot exist
curl -sI https://cloud.comfy.org/assets/does-not-exist-probe-QQQ.js | grep -iE 'HTTP/|cache-control|cf-cache-status'
# want: 404 + cache-control: no-store + cf-cache-status: BYPASS
```

Run the probe **before** concluding anything. A single healthy edge node is a
sample of one — it does not prove other colos are clean.

## The three layers, and what each fix reaches

Fixing one layer does not fix the others. Work down the list.

| Layer                       | Fix                                                                    | Reaches                     |
| --------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| Origin emits cacheable 404s | nginx `no-store` on 4xx/5xx for asset locations (Comfy-Org/cloud#6472) | **New** poisonings only     |
| Edge holds poisoned entries | Cloudflare purge of the specific URLs                                  | New users hitting that colo |
| Client has it pinned        | Nothing origin-side reaches them                                       | Only a URL change does      |

That last row is the one people miss. A user whose browser holds
`max-age=2592000, immutable` for a 404 is unreachable by any server-side action.

## Forcing every asset URL to rotate

### Why a redeploy is not enough

The instinct is "ship a new build, the hashes change". **Measured, and it is
false for exactly the chunks that matter.** Two cloud builds of this repo
differing only in commit hash:

- 153 of 495 JS chunks rotated
- `rolldown-runtime`, `vendor-datadog`, `vendor-sentry`, `vendor-vue-core`
  **kept byte-identical filenames**

A content hash tracks content. Vendor chunks are leaves whose content comes from
`node_modules`, which a commit does not change. App chunks rotate because the
import specifiers inside them changed — that cascade never reaches the leaves.
So a redeploy leaves the poisoned vendor URLs exactly where they were.

### The mechanism

**In production, set the `ASSET_CACHE_BUST` repository variable** on
`Comfy-Org/ComfyUI_frontend` (Settings → Secrets and variables → Actions →
Variables) to today's date, e.g. `20260818`. Then deploy as normal.

A repo variable rather than a one-off build input is the whole point: the salt
has to apply to **every subsequent build**, not just the recovery one. A manual
one-shot build would fix the incident and then the next routine deploy would
revert every filename to the poisoned names.

`cloud-dispatch-build.yaml` reads the variable into the `frontend-asset-build`
dispatch payload as `asset_cache_bust`; `frontend-asset-predeploy.yml` in
`Comfy-Org/cloud` passes it to both `pnpm build` invocations. Unset, the
payload field is empty and the build is byte-identical to today's.

Locally, or for a manual verification build:

```bash
ASSET_CACHE_BUST=20260818 pnpm build:cloud
```

`ASSET_CACHE_BUST` inserts its value into every emitted asset filename:

```
assets/rolldown-runtime-xtsTai4I.js  ->  assets/rolldown-runtime-cb20260818-xtsTai4I.js
```

Verified: **495 of 495** hashed JS/CSS assets get a new URL, `index.html` is
rewritten to match, and unset behaviour is byte-identical to today's build.
Non-hashed static files (`favicon.ico`, `images/`, `CREDIT.txt`,
`sorted-custom-node-map.json`) do not carry hashes and are unaffected — if one
of those is the poisoned file, this will not help it.

Use a date (`20260818`) rather than a counter. It is self-describing in a URL
six months later and cannot collide.

### The trap

**Only ever increment `ASSET_CACHE_BUST`. Never clear it, and never delete the
repository variable.**

Clearing it reverts every filename to exactly the names that were poisoned, and
any client still holding those entries breaks again — with no new deploy to
blame. Treat it as a permanent, monotonic deploy variable: once set, it stays
set, and the next incident bumps it.

This is the failure mode to watch for during a repo-settings cleanup: the
variable looks like leftover incident debris precisely when it is doing its job.

The salt changes the _filename_, not the content hash — `xtsTai4I` above is
unchanged. That is deliberate and sufficient: caches key on URL.

## Verify the recovery

```bash
# New URLs are live and cacheable as 200s
curl -sI https://cloud.comfy.org/assets/rolldown-runtime-cb<salt>-<hash>.js | grep -iE 'HTTP/|cache-control'

# The old poisoned URL is gone from index.html
curl -s https://cloud.comfy.org/ | grep -oE 'assets/[^"]+\.js'
```

Then confirm in RUM that the failure actually stopped, rather than assuming:

```
@type:error @application.id:041a9897-5516-4b1f-a245-1a9aa6895488 @context.error_type:*
```

Dashboard: https://us5.datadoghq.com/dashboard/u9c-dtd-ui6

Note the ceiling on what RUM can tell you here: if a boot chunk 404s, **no
JavaScript executes**, so no in-app reporter ever fires. A flat error chart is
not evidence the cached-404 failure stopped — it is what that failure looks
like. Confirm from the server side (404 rate on `/assets/*`) instead.

## Coverage gaps worth knowing

- The nginx `no-store` fix covers `/assets/*` but **not** `/extensions/*`.
  `/extensions/core/clipspace.js` still 404s as `public, max-age=14400` and
  re-caches after every purge. Shorter TTL and not `immutable`, so it
  self-heals in ~4h — but it is uncovered.
- Nobody on the cloud team could purge the CDN or add an edge rule during
  IR-105; both needed escalation. Budget for that delay, or fix the access.
