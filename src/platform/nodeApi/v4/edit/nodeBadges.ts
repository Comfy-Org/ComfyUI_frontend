import { reportError } from '@comfyorg/telemetry/reportError'

import { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { callIsolated } from '@/platform/nodeApi/shared/listeners'
import {
  checkedFields,
  optionalCallback
} from '@/platform/nodeApi/v4/checkedFields'
import type { BadgeDef, Unsubscribe } from '@/platform/nodeApi/v4/types'
import { checkedOptionalString, checkedString } from './checkedArguments'

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
  return new LGraphBadge(badgeFields(badge))
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
    try {
      if (result.ok) return Object.assign(badge, badgeFields(result.value))
    } catch (error) {
      reportError(error, {
        errorType: 'node_api_listener_failure',
        surface: 'platform',
        tags: { event: MEMBER }
      })
    }
    failed = true
    badge.text = ''
    return badge
  }
}

const DEFAULT_COLORS = new LGraphBadge({ text: '' })

type BadgeFields = Pick<LGraphBadge, 'text' | 'fgColor' | 'bgColor' | 'onClick'>

function badgeFields(value: unknown): BadgeFields {
  const fields = checkedFields(MEMBER, 'a badge', value, BADGE_FIELDS)
  const onClick = optionalCallback(MEMBER, 'onClick', fields.onClick)
  return {
    text: checkedString(MEMBER, 'text', fields.text),
    fgColor:
      checkedOptionalString(MEMBER, 'color', fields.color) ??
      DEFAULT_COLORS.fgColor,
    bgColor:
      checkedOptionalString(MEMBER, 'bgColor', fields.bgColor) ??
      DEFAULT_COLORS.bgColor,
    onClick:
      onClick &&
      (() => callIsolated(MEMBER, () => Reflect.apply(onClick, undefined, [])))
  }
}
