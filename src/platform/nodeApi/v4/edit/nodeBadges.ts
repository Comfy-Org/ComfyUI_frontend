import { reportError } from '@comfyorg/telemetry/reportError'
import { isPlainObject } from 'es-toolkit'

import { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callIsolated } from '@/platform/nodeApi/shared/listeners'
import type { BadgeDef, Unsubscribe } from '@/platform/nodeApi/v4/types'

const MEMBER = 'addBadge'

const BADGE_FIELDS = {
  text: true,
  color: true,
  bgColor: true,
  onClick: true
} satisfies Record<keyof BadgeDef, true>

type BadgeEntry = LGraphNode['badges'][number]

/** Checks a pack's badge before the node is touched. */
export function checkedBadge(badge: unknown): BadgeEntry {
  if (typeof badge === 'function') {
    return computedBadge(() => Reflect.apply(badge, undefined, []))
  }
  const fields = badgeFields(badge)
  if (!fields) {
    throw invalidArgument(MEMBER, 'a badge or a function that gives one', badge)
  }
  return new LGraphBadge(fields)
}

/** Puts the badge on the node's title bar until the disposer is called. */
export function attachBadge(node: LGraphNode, badge: BadgeEntry): Unsubscribe {
  node.badges.push(badge)
  node.setDirtyCanvas(true)
  return () => {
    const index = node.badges.indexOf(badge)
    if (index === -1) return
    node.badges.splice(index, 1)
    node.setDirtyCanvas(true)
  }
}

function computedBadge(define: () => unknown): () => LGraphBadge {
  const badge = new LGraphBadge({ text: '' })
  let failed = false
  return () => {
    if (failed) return badge
    const result = callIsolated(MEMBER, define)
    const fields = result.ok ? badgeFields(result.value) : undefined
    if (fields) return Object.assign(badge, fields)
    failed = true
    badge.text = ''
    if (result.ok) {
      reportError(invalidArgument(MEMBER, 'a badge', result.value), {
        errorType: 'node_api_listener_failure',
        surface: 'platform',
        tags: { event: MEMBER }
      })
    }
    return badge
  }
}

const DEFAULT_COLORS = new LGraphBadge({ text: '' })

type BadgeFields = Pick<LGraphBadge, 'text' | 'fgColor' | 'bgColor' | 'onClick'>

function badgeFields(value: unknown): BadgeFields | undefined {
  const fields = badgeShaped(value)
  if (!fields) return undefined
  const { text, color, bgColor, onClick } = fields
  return {
    text,
    fgColor: color ?? DEFAULT_COLORS.fgColor,
    bgColor: bgColor ?? DEFAULT_COLORS.bgColor,
    onClick:
      onClick &&
      (() => callIsolated(MEMBER, () => Reflect.apply(onClick, undefined, [])))
  }
}

function badgeShaped(value: unknown) {
  if (!isPlainObject(value)) return undefined
  const fields: Readonly<Record<string, unknown>> = { ...value }
  const { text, color, bgColor, onClick } = fields
  const isBadge =
    Object.keys(fields).every((field) => Object.hasOwn(BADGE_FIELDS, field)) &&
    typeof text === 'string' &&
    isOptionalText(color) &&
    isOptionalText(bgColor) &&
    (onClick === undefined || typeof onClick === 'function')
  return isBadge ? { text, color, bgColor, onClick } : undefined
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}
