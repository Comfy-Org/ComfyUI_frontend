import type {
  ExportedSubgraph,
  ISerialisableNodeInput
} from '@/lib/litegraph/src/types/serialisation'

/**
 * Slot-level facts about a SubgraphNode host, derived from the subgraph
 * definition the op layer minted rather than from the host's doc entry.
 *
 * cmp treats a SubgraphNode host as opaque: it stores the host's promoted
 * widget values positionally under `__widgets_opaque` and, after a promoted
 * `connect`, writes only the single grown slot into the host's `inputs`. The
 * definition is the authoritative source for the host's slot order (host
 * inputs mirror `subgraph.inputNode.slots`) and for which inputs surface a
 * widget, so this module resolves both from it.
 */

export type SubgraphDefinitionIndex = ReadonlyMap<string, ExportedSubgraph>

export function indexSubgraphDefinitions(
  definitions: readonly ExportedSubgraph[]
): SubgraphDefinitionIndex {
  return new Map(definitions.map((definition) => [definition.id, definition]))
}

/**
 * Names of the subgraph inputs that surface a widget on the host, in host
 * slot order. An input is promoted when one of its links lands on an interior
 * node input that carries a `widget` reference (see
 * `SubgraphNode._resolveInputWidget`). This is the order cmp's positional
 * `__widgets_opaque` array follows.
 */
export function promotedWidgetNames(definition: ExportedSubgraph): string[] {
  const linksById = new Map(
    (definition.links ?? []).map((link) => [link.id, link])
  )
  const nodesById = new Map(
    (definition.nodes ?? []).map((node) => [String(node.id), node])
  )
  return (definition.inputs ?? []).flatMap((input) => {
    const promoted = (input.linkIds ?? []).some((linkId) => {
      const link = linksById.get(linkId)
      if (!link) return false
      const target = nodesById.get(String(link.target_id))
      return target?.inputs?.[link.target_slot]?.widget != null
    })
    return promoted ? [input.name] : []
  })
}

/**
 * The host's full input slot list in definition order, with `link` taken
 * from whatever slots the doc does carry (matched by name). Declared inputs
 * the doc omits are unlinked.
 */
export function hostInputs(
  definition: ExportedSubgraph,
  docInputs: readonly ISerialisableNodeInput[]
): ISerialisableNodeInput[] {
  const docByName = new Map(docInputs.map((input) => [input.name, input]))
  return (definition.inputs ?? []).map((input) => {
    const fromDoc = docByName.get(input.name)
    return {
      ...fromDoc,
      name: input.name,
      type: input.type,
      link: fromDoc?.link ?? null
    }
  })
}

/** Index of the named input in definition order, or -1 when undeclared. */
export function hostSlotIndex(
  definition: ExportedSubgraph,
  name: string
): number {
  return (definition.inputs ?? []).findIndex((input) => input.name === name)
}
