import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/types/slots'

import { growAutogrowInput, liveAutogrowGroupOf } from './dynamicWidgets'

/** A node's slot names in document order; an unnamed slot is `undefined`. */
export type DocumentSlotNames = readonly (string | undefined)[]

type InputGrow = {
  name: string
  type: string
  widget?: string
}

/** Where a live input lands in the document's input list. */
export type DocumentInputSlot =
  | { kind: 'slot'; slot: number }
  | { kind: 'grow'; grow: InputGrow }
  | { kind: 'absent' }

/**
 * The document index of a live input, by name. The live index stands in while
 * the document holds no such node; undefined when it holds the node but no
 * slot by that name.
 */
export function documentInputIndex(
  documentNames: DocumentSlotNames | null,
  input: Pick<INodeInputSlot, 'name'> | undefined,
  liveSlot: number
): number | undefined {
  if (documentNames === null || input === undefined) return liveSlot
  const slot = documentNames.indexOf(input.name)
  return slot === -1 ? undefined : slot
}

/**
 * The document slot a live input addresses, or the grow that appends it when
 * the document lacks it and the node grows that input dynamically.
 */
export function documentInputSlot(
  documentNames: DocumentSlotNames | null,
  node: LGraphNode | null | undefined,
  input: INodeInputSlot | undefined,
  liveSlot: number
): DocumentInputSlot {
  const slot = documentInputIndex(documentNames, input, liveSlot)
  if (slot !== undefined) return { kind: 'slot', slot }
  const grow = node && input ? inputGrow(node, input) : undefined
  return grow ? { kind: 'grow', grow } : { kind: 'absent' }
}

function inputGrow(
  node: LGraphNode,
  input: INodeInputSlot
): InputGrow | undefined {
  const widgetBacked = !!input.widget && !node.isSubgraphNode()
  if (!widgetBacked && !liveAutogrowGroupOf(node, input.name)) return undefined
  return {
    name: input.name,
    type: String(input.type),
    ...(input.widget ? { widget: input.widget.name } : {})
  }
}

/**
 * The live input a document input slot names, by name first, growing the
 * node's autogrow group when the name is a member it has not grown yet. A
 * named slot never falls back to its index; -1 when unresolved.
 */
export function resolveLiveInputSlot(
  node: LGraphNode,
  documentName: string | undefined,
  documentSlot: number
): number {
  const slot = liveSlot(
    node.inputs.map((input) => input.name),
    documentName,
    documentSlot,
    'none'
  )
  if (slot >= 0 || documentName === undefined) return slot
  return growAutogrowInput(node, documentName) ?? slot
}

/**
 * The live output a document output slot names, by name first and by index
 * when the name is stale; -1 when unresolved.
 */
export function liveOutputSlot(
  node: LGraphNode,
  documentName: string | undefined,
  documentSlot: number
): number {
  return liveSlot(
    node.outputs.map((output) => output.name),
    documentName,
    documentSlot,
    'positional'
  )
}

function liveSlot(
  liveNames: readonly string[],
  documentName: string | undefined,
  documentSlot: number,
  fallback: 'positional' | 'none'
): number {
  const byName =
    documentName === undefined ? -1 : liveNames.indexOf(documentName)
  if (byName >= 0 || (documentName !== undefined && fallback === 'none'))
    return byName
  return documentSlot < liveNames.length ? documentSlot : -1
}
