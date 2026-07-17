import { captureException, captureMessage } from '@sentry/vue'
import { until } from '@vueuse/core'
import { z } from 'zod'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { isCloud } from '@/platform/distribution/types'
import type { ComfyNodeDef, PriceBadge } from '@/schemas/nodeDefSchema'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

const zWidgetDependency = z.object({
  name: z.string(),
  type: z.string()
})

const zPriceBadgeDepends = z.object({
  widgets: z.array(zWidgetDependency).optional().default([]),
  inputs: z.array(z.string()).optional().default([]),
  input_groups: z.array(z.string()).optional().default([])
})

const zRemotePriceBadge = z.object({
  engine: z.literal('jsonata').optional().default('jsonata'),
  depends_on: zPriceBadgeDepends
    .optional()
    .default({ widgets: [], inputs: [], input_groups: [] }),
  expr: z.string()
})

const zPriceBadgeMap = z.record(zRemotePriceBadge)

type PriceBadgeMap = Record<string, PriceBadge>

const DEF_LOAD_RACE_TIMEOUT_MS = 2500

let badgeMapPromise: Promise<PriceBadgeMap | null> | null = null
let raceLostForSession = false

async function resolveComfyUIVersion(): Promise<string> {
  const systemStatsStore = useSystemStatsStore()
  await until(
    () => systemStatsStore.isInitialized || !!systemStatsStore.error
  ).toBe(true)
  return systemStatsStore.systemStats?.system?.comfyui_version || 'nightly'
}

async function fetchPriceBadgeMap(): Promise<PriceBadgeMap | null> {
  try {
    const version = await resolveComfyUIVersion()
    const url = `${getComfyApiBaseUrl()}/nodes/pricing/badges`
    const params = new URLSearchParams({
      comfyui_version: version,
      platform: isCloud ? 'cloud' : 'local'
    })
    const response = await fetch(`${url}?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const parsed = zPriceBadgeMap.safeParse(await response.json())
    if (!parsed.success) {
      throw new Error(`invalid response: ${parsed.error.message}`)
    }
    return parsed.data
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

function declaredInputBucket(spec: unknown): WidgetTypeBucket {
  if (!Array.isArray(spec) || Array.isArray(spec[0])) return 'string'
  return bucketOfType(String(spec[0]))
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
    if (!isNested && bucketOfType(widget.type) !== declaredInputBucket(spec)) {
      return `widget '${widget.name}' type '${widget.type}' does not match def input type`
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
 * Overlay remotely fetched price badges onto node defs, in place.
 *
 * Awaits the badge fetch for at most DEF_LOAD_RACE_TIMEOUT_MS; on timeout the
 * result is dropped for the whole session so badge state stays deterministic
 * (compiled-rule and label caches are keyed by node name and never
 * invalidated). Badges that fail validation against the def are skipped per
 * node: no badge beats a wrong one.
 */
export async function overlayPriceBadges(
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
  if (!result) return
  for (const [name, badge] of Object.entries(result)) {
    const def = defs[name]
    if (!def) continue
    const problem = validateBadgeAgainstDef(badge, def)
    if (problem) {
      console.warn(
        `[pricing/badges] skipping overlay for '${name}': ${problem}`
      )
      continue
    }
    def.price_badge = badge
  }
}
