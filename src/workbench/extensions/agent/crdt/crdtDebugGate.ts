/**
 * Who may see the CRDT debug instrument, and how loud it is.
 *
 * The instrument used to be gated on `import.meta.env.DEV` alone, which is the
 * wrong audience: the people who need it are product testers driving a
 * STAGING build, where `DEV` is false. Opt-in is therefore explicit and
 * sticky — `?crdtDebug=1` turns it on for the origin until `?crdtDebug=0`
 * turns it off — so a tester can be handed a link rather than a build.
 *
 * Verbosity is a separate axis on purpose. Turning the panel on should not
 * also flood the console: `?crdtDebug=trace` opts into the per-frame chatter,
 * while plain `1` keeps console output at the lifecycle level.
 */
const ENABLED_KEY = 'Comfy.Agent.CrdtDebug.enabled'
const LEVEL_KEY = 'Comfy.Agent.CrdtDebug.level'
const QUERY_PARAM = 'crdtDebug'

/**
 * Console verbosity, ordered least-to-most chatty. `warn` is the floor: a
 * follower that refuses a doc or drops a human mint says so in every build,
 * because a silent divergence is the failure the whole instrument exists to
 * make visible.
 */
export const CRDT_LOG_LEVELS = ['warn', 'info', 'debug', 'trace'] as const

export type CrdtLogLevel = (typeof CRDT_LOG_LEVELS)[number]

const DEFAULT_LEVEL: CrdtLogLevel = 'info'

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
  writeStorage(ENABLED_KEY, disabling ? 'false' : 'true')
  if (!disabling && isLogLevel(value)) writeStorage(LEVEL_KEY, value)
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
 * An explicit opt-out wins over `DEV` so a developer chasing a rendering bug
 * can silence the instrument without editing code.
 */
export function isCrdtDebugEnabled(): boolean {
  const stored = readStorage(ENABLED_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return import.meta.env.DEV
}

export function setCrdtDebugEnabled(enabled: boolean): void {
  writeStorage(ENABLED_KEY, String(enabled))
}

export function crdtLogLevel(): CrdtLogLevel {
  const stored = readStorage(LEVEL_KEY)
  return isLogLevel(stored) ? stored : DEFAULT_LEVEL
}

export function setCrdtLogLevel(level: CrdtLogLevel): void {
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
