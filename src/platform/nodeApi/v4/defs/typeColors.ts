import { isStoreKey } from '@/platform/nodeApi/v4/checkedFields'
import { once } from 'es-toolkit'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { DefRegistry, Unsubscribe } from '@/platform/nodeApi/v4/types'

type TypeColorMembers = Pick<
  DefRegistry,
  'typeColor' | 'setTypeColor' | 'nodeColor' | 'isTypeCompatible'
>

interface TypeColors extends TypeColorMembers {
  reapply(): void
}

interface Claim {
  readonly color: string
}

interface ClaimedType {
  readonly hostColor: string | undefined
  readonly claims: Claim[]
}

export function createTypeColors(): TypeColors {
  const claimed = new Map<string, ClaimedType>()

  function newestColor(type: string): string | undefined {
    return claimed.get(type)?.claims.at(-1)?.color
  }

  function release(type: string, entry: ClaimedType, claim: Claim): void {
    const linkColors = LGraphCanvas.link_type_colors
    const wasShown = linkColors[type] === newestColor(type)
    entry.claims.splice(entry.claims.indexOf(claim), 1)
    const next = newestColor(type)
    if (next === undefined) claimed.delete(type)
    if (!wasShown) return
    if (next !== undefined) linkColors[type] = next
    else if (entry.hostColor !== undefined) linkColors[type] = entry.hostColor
    else delete linkColors[type]
  }

  return {
    typeColor(type) {
      checkedText('typeColor', 'a type name', type)
      return shownColor(type) || undefined
    },

    setTypeColor(type, color): Unsubscribe {
      checkedText('setTypeColor', 'a type name', type)
      if (!isStoreKey(type)) {
        throw invalidArgument('setTypeColor', 'a type name', type)
      }
      checkedText('setTypeColor', 'a color', color)
      const shown = shownColor(type)
      if (shown && shown !== newestColor(type)) {
        throw invalidArgument(
          'setTypeColor',
          'a type the palette leaves uncolored',
          type
        )
      }
      const entry = claimed.get(type) ?? { hostColor: shown, claims: [] }
      claimed.set(type, entry)
      const claim: Claim = { color }
      entry.claims.push(claim)
      LGraphCanvas.link_type_colors[type] = color
      return once(() => release(type, entry, claim))
    },

    nodeColor(name) {
      checkedText('nodeColor', 'a color name', name)
      if (!Object.hasOwn(LGraphCanvas.node_colors, name)) return undefined
      const { color, bgcolor, groupcolor } = LGraphCanvas.node_colors[name]
      return Object.freeze({ color, bgColor: bgcolor, groupColor: groupcolor })
    },

    isTypeCompatible(outputType, inputType) {
      checkedText('isTypeCompatible', 'an output type', outputType)
      checkedText('isTypeCompatible', 'an input type', inputType)
      return LiteGraph.isValidConnection(outputType, inputType)
    },

    reapply() {
      for (const type of claimed.keys()) {
        const color = newestColor(type)
        if (color !== undefined && !shownColor(type)) {
          LGraphCanvas.link_type_colors[type] = color
        }
      }
    }
  }
}

function shownColor(type: string): string | undefined {
  const linkColors = LGraphCanvas.link_type_colors
  return Object.hasOwn(linkColors, type) ? linkColors[type] : undefined
}

function checkedText(member: string, needed: string, value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    throw invalidArgument(member, needed, value)
  }
  return value
}
