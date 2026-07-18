import { captureException, captureMessage } from '@sentry/vue'
import { until } from '@vueuse/core'
import { z } from 'zod'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { isCloud } from '@/platform/distribution/types'
import type {
  ComfyNodeDef,
  InputSpec,
  PriceBadge
} from '@/schemas/nodeDefSchema'
import { getInputSpecType } from '@/schemas/nodeDefSchema'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

const zWidgetDependency = z.object({
  name: z.string(),
  type: z.string()
})

const zPriceBadgeDepends = z.object({
  widgets: z.array(zWidgetDependency),
  inputs: z.array(z.string()),
  input_groups: z.array(z.string())
})

// Stricter than the canonical zPriceBadge: the wire contract always carries
// the full shape, so nothing is defaulted and unknown engines are rejected.
// `satisfies` ties the output to the canonical PriceBadge type so a change
// to it surfaces here as a compile error.
const zRemotePriceBadge = z.object({
  engine: z.literal('jsonata'),
  depends_on: zPriceBadgeDepends,
  expr: z.string().min(1)
}) satisfies z.ZodType<PriceBadge>

const zPriceBadgeMap = z.record(z.unknown())

type PriceBadgeMap = Record<string, PriceBadge>

const DEF_LOAD_RACE_TIMEOUT_MS = 2500

let badgeMapPromise: Promise<PriceBadgeMap | null> | null = null
let raceLostForSession = false

async function resolveSystemStats() {
  const systemStatsStore = useSystemStatsStore()
  await until(
    () => systemStatsStore.isInitialized || !!systemStatsStore.error
  ).toBe(true)
  return systemStatsStore.systemStats
}

async function fetchPriceBadgeMap(): Promise<PriceBadgeMap | null> {
  try {
    const stats = await resolveSystemStats()
    // --disable-api-nodes promises no frontend internet access; honor it
    // (same contract as releaseStore).
    if (stats?.system?.argv?.includes('--disable-api-nodes')) {
      return null
    }
    const version = stats?.system?.comfyui_version || 'nightly'
    const base = getComfyApiBaseUrl().replace(/\/+$/, '')
    const params = new URLSearchParams({
      comfyui_version: version,
      platform: isCloud ? 'cloud' : 'local'
    })
    const response = await fetch(`${base}/nodes/pricing/badges?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const parsed = zPriceBadgeMap.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error(`invalid response: ${parsed.error.message}`)
    }
    const map: PriceBadgeMap = {}
    for (const [name, rawBadge] of Object.entries(parsed.data)) {
      const badge = zRemotePriceBadge.safeParse(rawBadge)
      if (!badge.success) {
        console.warn(
          `[pricing/badges] skipping malformed badge for '${name}':`,
          badge.error.message
        )
        continue
      }
      map[name] = badge.data
    }
    return map
  } catch (error) {
    console.warn(
      '[pricing/badges] fetch failed; no core-node badges this session:',
      error
    )
    captureException(error, {
      level: 'warning',
      tags: {
        api_endpoint: '/nodes/pricing/badges',
        error_type: 'price_badge_fetch_error'
      }
    })
    return null
  }
}

/**
 * Kick off the price badge fetch chain (system_stats version -> badge map).
 * Idempotent; safe to call before node defs load so the fetch runs
 * concurrently with /object_info.
 */
export function startPriceBadgeFetch(): void {
  badgeMapPromise ??= fetchPriceBadgeMap()
}

type WidgetTypeBucket = 'number' | 'boolean' | 'string'

function bucketOfType(type: string): WidgetTypeBucket {
  const upper = type.toUpperCase()
  if (upper === 'INT' || upper === 'FLOAT') return 'number'
  if (upper === 'BOOLEAN') return 'boolean'
  return 'string'
}

/**
 * Bucket the declared type of a def input spec, or null when the spec is
 * malformed. /object_info arrives unvalidated, so the tuple head must be
 * narrowed before it reaches the canonical parser.
 */
function declaredInputBucket(spec: unknown): WidgetTypeBucket | null {
  if (!Array.isArray(spec)) return null
  // A widgetType override is what the runtime widget is constructed as.
  const options = spec[1]
  const widgetType =
    options !== null &&
    typeof options === 'object' &&
    'widgetType' in options &&
    typeof options.widgetType === 'string'
      ? options.widgetType
      : undefined
  if (widgetType) return bucketOfType(widgetType)
  const head: unknown = spec[0]
  if (typeof head !== 'string' && !Array.isArray(head)) return null
  return bucketOfType(getInputSpecType(spec as InputSpec))
}

function validateBadgeAgainstDef(
  badge: PriceBadge,
  def: ComfyNodeDef
): string | null {
  const inputs = { ...def.input?.required, ...def.input?.optional }
  for (const widget of badge.depends_on.widgets) {
    const [parent] = widget.name.split('.')
    const spec = inputs[parent]
    if (!spec) return `widget '${widget.name}' has no def input '${parent}'`
    const isNested = widget.name.includes('.')
    if (!isNested) {
      const declared = declaredInputBucket(spec)
      if (declared === null) {
        return `widget '${widget.name}' def input spec is malformed`
      }
      if (bucketOfType(widget.type) !== declared) {
        return `widget '${widget.name}' type '${widget.type}' does not match def input type`
      }
    }
  }
  for (const name of [
    ...badge.depends_on.inputs,
    ...badge.depends_on.input_groups
  ]) {
    const [parent] = name.split('.')
    if (!inputs[parent])
      return `dependency '${name}' has no def input '${parent}'`
  }
  return null
}

/**
 * Apply remotely fetched price badges to node defs, mutating them in place.
 *
 * Awaits the badge fetch for at most DEF_LOAD_RACE_TIMEOUT_MS; on timeout the
 * result is dropped for the whole session so badge state stays deterministic
 * (compiled-rule and label caches are keyed by node name and never
 * invalidated). Badges that fail validation against the def are skipped per
 * node: no badge beats a wrong one.
 */
export async function applyPriceBadges(
  defs: Record<string, ComfyNodeDef>
): Promise<void> {
  if (raceLostForSession) return
  startPriceBadgeFetch()
  const result = await Promise.race([
    badgeMapPromise,
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), DEF_LOAD_RACE_TIMEOUT_MS)
    )
  ])
  if (result === 'timeout') {
    raceLostForSession = true
    console.warn(
      '[pricing/badges] fetch lost the def-load race; no core-node badges this session'
    )
    captureMessage('price badge fetch lost def-load race', {
      level: 'warning'
    })
    return
  }
  // A concurrent apply call may have timed out and marked the session lost
  // while we were awaiting; honor the all-or-nothing session invariant.
  if (raceLostForSession) return
  if (!result) return
  for (const [name, badge] of Object.entries(result)) {
    const def = defs[name]
    if (!def) continue
    const problem = validateBadgeAgainstDef(badge, def)
    if (problem) {
      console.warn(`[pricing/badges] skipping badge for '${name}': ${problem}`)
      continue
    }
    def.price_badge = badge
  }
}
