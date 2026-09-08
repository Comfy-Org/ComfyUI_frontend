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

/**
 * Flattens the definition tree (each definition may carry nested
 * `definitions.subgraphs`) into one id-keyed index. The first definition
 * seen for an id wins, so a nested copy never shadows a top-level one.
 */
export function indexSubgraphDefinitions(
  definitions: readonly ExportedSubgraph[]
): SubgraphDefinitionIndex {
  const index = new Map<string, ExportedSubgraph>()
  const visit = (definition: ExportedSubgraph) => {
    if (!index.has(definition.id)) index.set(definition.id, definition)
    for (const nested of definition.definitions?.subgraphs ?? []) visit(nested)
  }
  for (const definition of definitions) visit(definition)
  return index
}

/**
 * Declared input names that appear more than once. A repeated name cannot be
 * resolved to a single host slot, so callers treat it as undeclared.
 */
function ambiguousInputNames(definition: ExportedSubgraph): Set<string> {
  const seen = new Set<string>()
  const ambiguous = new Set<string>()
  for (const input of definition.inputs ?? []) {
    if (seen.has(input.name)) ambiguous.add(input.name)
    seen.add(input.name)
  }
  return ambiguous
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
 * the doc omits, and inputs whose name is declared more than once, are
 * unlinked.
 */
export function hostInputs(
  definition: ExportedSubgraph,
  docInputs: readonly ISerialisableNodeInput[]
): ISerialisableNodeInput[] {
  const ambiguous = ambiguousInputNames(definition)
  const docByName = new Map(docInputs.map((input) => [input.name, input]))
  return (definition.inputs ?? []).map((input) => {
    const fromDoc = ambiguous.has(input.name)
      ? undefined
      : docByName.get(input.name)
    return {
      ...fromDoc,
      name: input.name,
      type: input.type,
      link: fromDoc?.link ?? null
    }
  })
}

/**
 * Index of the named input in definition order, or -1 when the name is
 * undeclared or declared more than once.
 */
export function hostSlotIndex(
  definition: ExportedSubgraph,
  name: string
): number {
  if (ambiguousInputNames(definition).has(name)) return -1
  return (definition.inputs ?? []).findIndex((input) => input.name === name)
}
