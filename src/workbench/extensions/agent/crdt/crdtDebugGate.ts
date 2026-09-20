/**
 * Who may see the CRDT debug instrument, and how loud it is.
 *
 * The instrument used to be gated on `import.meta.env.DEV` alone, which is the
 * wrong audience: the people who need it are product testers driving a
 * STAGING build, where `DEV` is false. Opt-in is therefore explicit and
 * sticky — `?crdtDebug=1` turns it on for the origin until `?crdtDebug=0`
 * turns it off — so a tester can be handed a link rather than a build.
 *
 * The instrument is deliberately disabled on the production hostname
 * (review: dante01yoon on #16365, 2026-09-01). A link is something a tester
 * forwards, and a forwarded `?crdtDebug=1` landing on `cloud.comfy.org` would
 * flip the instrument on for whoever opens it there, with no re-review step —
 * unlike staging/testcloud/dev, where the audience is already internal. A
 * stale saved `Comfy.Agent.CrdtDebug.enabled=true` is also ignored there, so
 * neither query parameters nor persisted choices can retain debug events in
 * production.
 *
 * Verbosity is a separate axis on purpose. Turning the panel on should not
 * also flood the console: `?crdtDebug=trace` opts into the per-frame chatter,
 * while plain `1` keeps console output at the lifecycle level.
 */
const ENABLED_KEY = 'Comfy.Agent.CrdtDebug.enabled'
const LEVEL_KEY = 'Comfy.Agent.CrdtDebug.level'
const QUERY_PARAM = 'crdtDebug'

/**
 * The one hostname this instrument must never silently light up on via a
 * forwarded link. Keep this list to confirmed production hosts only — every
 * other origin (staging, testcloud, PR previews, desktop, local) is where
 * the "hand a tester a link" workflow this gate exists for actually runs.
 */
const PRODUCTION_HOSTNAMES = new Set(['cloud.comfy.org'])

export function isProductionHostname(
  hostname = window.location.hostname
): boolean {
  return PRODUCTION_HOSTNAMES.has(hostname)
}

/**
 * Console verbosity, ordered least-to-most chatty. `warn` is the floor: a
 * follower that refuses a doc or drops a human mint says so in every build,
 * because a silent divergence is the failure the whole instrument exists to
 * make visible.
 */
export const CRDT_LOG_LEVELS = ['warn', 'info', 'debug', 'trace'] as const

export type CrdtLogLevel = (typeof CRDT_LOG_LEVELS)[number]

const DEFAULT_LEVEL: CrdtLogLevel = 'info'

export function resolveDebugPanelEnabled(
  productGateEnabled: boolean,
  debugOverrideEnabled = isCrdtDebugEnabled()
): boolean {
  return productGateEnabled && debugOverrideEnabled
}

/**
 * Cached because {@link isLevelEnabled} runs on the CRDT hot path — once per
 * outbound frame, per applied frame and per minted op — and an uncached read
 * would put a synchronous `localStorage.getItem` on each of them, for
 * opted-out users most of all. Only the setters below change either value.
 *
 * Declared here, above `applyQueryOverride()`'s module-evaluation call, so the
 * setters it invokes are not reaching into a temporal dead zone.
 */
let cachedEnabled: boolean | null = null
let cachedStoredEnabled: string | null = null
let cachedLevel: CrdtLogLevel | null = null

function isLogLevel(value: unknown): value is CrdtLogLevel {
  return (CRDT_LOG_LEVELS as readonly unknown[]).includes(value)
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private mode / quota: the override simply does not persist.
  }
}

function readQueryParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(QUERY_PARAM)
  } catch {
    return null
  }
}

/**
 * Fold `?crdtDebug=…` into storage exactly once per load, so the choice
 * survives the reloads a debugging session is made of.
 *
 * Accepts `0`/`false`/`off` to disable, a level name to enable at that level,
 * and any other non-empty value to enable at the current level.
 *
 * Two things it deliberately does NOT do. It never writes the level unless
 * the parameter names one — otherwise reloading a bookmarked `?crdtDebug=1`
 * would silently reset a verbosity the tester chose in the panel, on the
 * reload that reproducing a subscribe bug requires. And it strips itself from
 * the URL afterwards, so a later "hide" is not undone by the next reload of
 * the same link: the parameter is an instruction, not a standing order.
 */
function applyQueryOverride(): void {
  const raw = readQueryParam()
  if (raw === null) return
  const value = raw.trim().toLowerCase()
  if (value === '') return
  const disabling = value === '0' || value === 'false' || value === 'off'
  // Opting OUT via the link must always work, on every origin — only the
  // enabling path is production-blocked. Otherwise a prod link with a typo'd
  // value could enable the instrument with no way to hand out a link back.
  if (!disabling && isProductionHostname()) {
    consumeQueryParam()
    return
  }
  setCrdtDebugEnabled(!disabling)
  if (!disabling && isLogLevel(value)) setCrdtLogLevel(value)
  consumeQueryParam()
}

function consumeQueryParam(): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete(QUERY_PARAM)
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // No History API (or an opaque origin): the flag simply stays in the URL.
  }
}

applyQueryOverride()

/**
 * Whether the CRDT debug instrument (panel + console tracing) is available.
 *
 * Production is always disabled, including stale persisted choices from an
 * older build. Elsewhere, an explicit opt-out wins over `DEV` so a developer
 * chasing a rendering bug can silence the instrument without editing code.
 */
export function isCrdtDebugEnabled(): boolean {
  if (isProductionHostname()) return false
  if (cachedEnabled === null) {
    const stored = readStoredEnabled()
    cachedEnabled =
      stored === 'true'
        ? true
        : stored === 'false'
          ? false
          : import.meta.env.DEV
  }
  return cachedEnabled
}

function readStoredEnabled(): string | null {
  if (cachedStoredEnabled === null)
    cachedStoredEnabled = readStorage(ENABLED_KEY)
  return cachedStoredEnabled
}

export function setCrdtDebugEnabled(enabled: boolean): void {
  cachedEnabled = enabled
  cachedStoredEnabled = String(enabled)
  writeStorage(ENABLED_KEY, String(enabled))
}

/**
 * Whether the user turned the instrument OFF, as opposed to never having said.
 * The ring buffer records for the never-said case — a tester who opens the
 * panel after something breaks needs the run-up — but an explicit "off" should
 * buy silence, not just a quiet console.
 */
export function isCrdtDebugOptedOut(): boolean {
  return !isCrdtDebugEnabled() && readStoredEnabled() === 'false'
}

export function crdtLogLevel(): CrdtLogLevel {
  if (cachedLevel === null) {
    const stored = readStorage(LEVEL_KEY)
    cachedLevel = isLogLevel(stored) ? stored : DEFAULT_LEVEL
  }
  return cachedLevel
}

export function setCrdtLogLevel(level: CrdtLogLevel): void {
  cachedLevel = level
  writeStorage(LEVEL_KEY, level)
}

/** Whether `level` should reach the console at the current verbosity. */
export function isLevelEnabled(level: CrdtLogLevel): boolean {
  if (level === 'warn') return true
  if (!isCrdtDebugEnabled()) return false
  return (
    CRDT_LOG_LEVELS.indexOf(level) <= CRDT_LOG_LEVELS.indexOf(crdtLogLevel())
  )
}
