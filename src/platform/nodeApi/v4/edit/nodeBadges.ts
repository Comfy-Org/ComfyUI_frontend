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
  const checked = badgeFrom(badge)
  if (!checked.ok) {
    throw invalidArgument(MEMBER, 'a badge or a function that gives one', badge)
  }
  return checked.badge
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
  const hidden = new LGraphBadge({ text: '' })
  let failed = false
  return () => {
    if (failed) return hidden
    const result = callIsolated(MEMBER, define)
    if (!result.ok) {
      failed = true
      return hidden
    }
    const checked = badgeFrom(result.value)
    if (checked.ok) return checked.badge
    failed = true
    reportError(invalidArgument(MEMBER, 'a badge', result.value), {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: MEMBER }
    })
    return hidden
  }
}

type CheckedBadge = { ok: true; badge: LGraphBadge } | { ok: false }

function badgeFrom(value: unknown): CheckedBadge {
  if (!isPlainObject(value)) return { ok: false }
  const fields: Readonly<Record<string, unknown>> = value
  const { text, color, bgColor, onClick } = fields
  if (
    !Object.keys(fields).every((field) => Object.hasOwn(BADGE_FIELDS, field)) ||
    typeof text !== 'string' ||
    !isOptionalText(color) ||
    !isOptionalText(bgColor) ||
    (onClick !== undefined && typeof onClick !== 'function')
  ) {
    return { ok: false }
  }
  return {
    ok: true,
    badge: new LGraphBadge({
      text,
      ...(color === undefined ? {} : { fgColor: color }),
      ...(bgColor === undefined ? {} : { bgColor }),
      ...(onClick === undefined
        ? {}
        : {
            onClick: () =>
              callIsolated(MEMBER, () => Reflect.apply(onClick, undefined, []))
          })
    })
  }
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}
