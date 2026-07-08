# Remote User Data (PostHog payloads)

Fetch per-user / per-cohort JSON from PostHog feature-flag payloads to tune UI
behavior (element ordering, which content to surface, survey shape, …) from the
PostHog dashboard **without a frontend release**.

This is for personalization hints only. Every key has a hardcoded default that
must always be shippable — never gate anything critical on a remote value.

## For engineers

### Consuming a value

```ts
import { z } from 'zod'

import { useRemoteUserData } from '@/platform/remoteUserData/useRemoteUserData'

const { data, isLoaded } = useRemoteUserData({
  key: 'app-mode-template-order',
  schema: z.object({ templateIds: z.array(z.string()) }),
  defaultValue: { templateIds: DEFAULT_APP_MODE_TEMPLATE_IDS }
  // mode: 'snapshot' (default) | 'reactive'
})
```

- `data` — validated payload, or `defaultValue` if absent/invalid. Never throws.
- `isLoaded` — shared readiness signal. Instantly `true` in OSS/desktop or when
  PostHog is disabled; in cloud it is `false` until the first authoritative flag
  response (after auth resolves), then `true` forever. Gate UI that must not
  render-then-reorder on this (show a skeleton while `false`). A blocked or slow
  `/flags` request holds `false` for up to the ~3s backstop, so only gate
  reorderable secondary content — render primary, above-the-fold UI on defaults
  immediately rather than behind a skeleton.

### Registering a key

Add the flag key to `REMOTE_USER_DATA_KEYS` in
`src/platform/remoteUserData/keys.ts`. Registration is what makes the cloud
provider fetch that key's payload, and keeps the flag inventory greppable.

### snapshot vs reactive

- **`snapshot`** (default) — resolves once (when `isLoaded` flips true, or
  immediately if already loaded) then freezes for the instance's lifetime. Later
  reloads, including values arriving after the timeout backstop, do not touch it.
  Use for anything the user interacts with mid-flow: surveys, welcome tiles,
  modal content. A fresh instance (e.g. reopening a flow) takes a fresh snapshot.
- **`reactive`** — tracks every flag reload. Opt-in, for passive UI where a rare
  late update is harmless (e.g. sidebar ordering).

Snapshot is the default because it cannot mutate mid-interaction.

### Ordering payloads

For "ordered list of ids" payloads whose ids reference content that ships
separately, resolve through `resolvePrioritizedIds(payloadIds, defaultIds,
validIds, limit)`: it drops ids missing from the registry and backfills from the
defaults, so a stale or typo'd payload can never produce an empty/broken list.

### Segmenting telemetry

Under `snapshot`, a user whose `/flags` response beat the ~3s timeout sees the
targeted config; one whose didn't sees defaults. Give flow-driving payloads a
`version`/`variant` field and attach it to the flow's telemetry events so
analysis segments by what the user actually saw.

### Dev override

In dev builds only:

```js
localStorage.setItem(
  'ff:app-mode-template-order',
  JSON.stringify({ templateIds: ['flux-schnell'] })
)
localStorage.removeItem('ff:app-mode-template-order')
```

### Constraints

- Values exist only in cloud builds; OSS/desktop always get defaults at zero cost.
- Targeting by cohort/person properties only matches **identified** (logged-in)
  users. Anonymous users get percentage rollout at best.

## For marketing / product

You change behavior entirely from the PostHog dashboard — no deploy.

1. **Feature Flags → New feature flag.** Use the exact key an engineer registered
   (e.g. `app-mode-template-order`). Kebab-case, describes what it tunes.
2. **Release conditions** — target by cohort, person properties (e.g.
   `subscription_tier`, or survey answers already set on the person), or a
   percentage rollout. Person-property targeting only reaches logged-in users.
3. **Payload** — add the JSON payload. Edit it anytime; changes take effect on
   users' next session without a release.
4. **A/B experiments** — a multivariate flag carries one payload per variant, so
   variants can be measured against existing telemetry events.

### Payload shapes per key

| Key                       | JSON shape                                             | Notes                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-mode-template-order` | `{ "templateIds": ["flux-schnell", "sdxl-turbo", …] }` | Ordered template ids for the app-mode welcome screen. Unknown ids are dropped and the default list backfills, so a typo can't blank the screen. Valid template ids come from the template registry — ask an engineer for the current list. |

Keep every payload valid JSON — a malformed or unexpected payload is ignored and
the user silently gets the shipped default.
