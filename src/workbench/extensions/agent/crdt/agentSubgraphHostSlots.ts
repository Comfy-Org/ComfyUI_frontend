import { hasPromotedWidgetTarget } from '@/core/graph/subgraph/hasPromotedWidgetTarget'
import type {
  ExportedSubgraph,
  ISerialisableNodeInput
} from '@/lib/litegraph/src/types/serialisation'

import { allSubgraphDefinitions } from './agentSubgraphDefinitions'

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
  for (const definition of allSubgraphDefinitions(definitions)) {
    if (!index.has(definition.id)) index.set(definition.id, definition)
  }
  return index
}

/**
 * Mirrors comfy-cli `_MAX_NESTED_PROMOTION_DEPTH`: how many nested subgraph
 * instances a promoted input may be chased through before it is treated as
 * unpromoted. Also bounds cyclic definition references.
 */
const MAX_NESTED_PROMOTION_DEPTH = 32

interface DefinitionLookups {
  linksById: ReadonlyMap<number, NonNullable<ExportedSubgraph['links']>[number]>
  nodesById: ReadonlyMap<string, NonNullable<ExportedSubgraph['nodes']>[number]>
}

interface PromotionTarget {
  definition: ExportedSubgraph
  inputIndex: number
}

interface PromotionExpansion {
  hasWidget: boolean
  nested: PromotionTarget[]
}

function lookupsFor(
  definition: ExportedSubgraph,
  lookupsByDefinition: Map<ExportedSubgraph, DefinitionLookups>
): DefinitionLookups {
  const existing = lookupsByDefinition.get(definition)
  if (existing) return existing
  const lookups: DefinitionLookups = {
    linksById: new Map((definition.links ?? []).map((link) => [link.id, link])),
    nodesById: new Map(
      (definition.nodes ?? []).map((node) => [String(node.id), node])
    )
  }
  lookupsByDefinition.set(definition, lookups)
  return lookups
}

function promotionTargetForLink(
  definition: ExportedSubgraph,
  linkId: number,
  index: SubgraphDefinitionIndex,
  lookups: Map<ExportedSubgraph, DefinitionLookups>
): PromotionExpansion | undefined {
  const { linksById, nodesById } = lookupsFor(definition, lookups)
  const link = linksById.get(linkId)
  if (!link) return
  const target = nodesById.get(String(link.target_id))
  const targetInput = target?.inputs?.[link.target_slot]
  if (!target || !targetInput) return
  const nestedDefinition = index.get(target.type)
  if (!nestedDefinition) {
    return { hasWidget: targetInput.widget != null, nested: [] }
  }
  return {
    hasWidget: false,
    nested: (nestedDefinition.inputs ?? []).flatMap(
      (nestedInput, inputIndex) =>
        nestedInput.name === targetInput.name
          ? [{ definition: nestedDefinition, inputIndex }]
          : []
    )
  }
}

function expandPromotionTarget(
  target: PromotionTarget,
  index: SubgraphDefinitionIndex,
  lookups: Map<ExportedSubgraph, DefinitionLookups>
): PromotionExpansion {
  const input = target.definition.inputs?.[target.inputIndex]
  if (!input) return { hasWidget: false, nested: [] }
  const expansion: PromotionExpansion = { hasWidget: false, nested: [] }
  for (const linkId of input.linkIds ?? []) {
    const linkTarget = promotionTargetForLink(
      target.definition,
      linkId,
      index,
      lookups
    )
    if (!linkTarget) continue
    expansion.hasWidget ||= linkTarget.hasWidget
    expansion.nested.push(...linkTarget.nested)
  }
  return expansion
}

function isPromoted(
  definition: ExportedSubgraph,
  inputIndex: number,
  index: SubgraphDefinitionIndex,
  lookups: Map<ExportedSubgraph, DefinitionLookups>
): boolean {
  const root: PromotionTarget = { definition, inputIndex }
  return hasPromotedWidgetTarget(
    root,
    MAX_NESTED_PROMOTION_DEPTH,
    ({ definition, inputIndex }) => definition.inputs?.[inputIndex],
    (target) => expandPromotionTarget(target, index, lookups)
  )
}

/**
 * Names of the subgraph inputs that surface a widget on the host, in host
 * slot order. This is the order cmp's positional `__widgets_opaque` array
 * follows, and it must match the rule comfy-cli `promoted_inputs()` and
 * `SubgraphNode._resolveInputWidget` share: an input is promoted when one of
 * its links lands on
 *
 * - an interior plain node input that carries a `widget` reference, or
 * - a nested subgraph instance (node `type` found in `index`) whose
 *   same-named input is itself promoted, resolved recursively through
 *   `_resolveNestedPromotedSource`.
 *
 * A nested instance whose definition is missing from `index`, or whose chain
 * exceeds the depth cap, counts as unpromoted. So does an input whose chain
 * leads back to itself: a cyclic definition reference can never reach a real
 * widget, and the walk stops the first time it meets an input it is already
 * resolving instead of chasing the cycle to the depth cap. Each (definition,
 * input) pair is resolved once per call, so a fan-out of nested instances
 * costs linear, not exponential, work.
 */
export function promotedWidgetNames(
  definition: ExportedSubgraph,
  index: SubgraphDefinitionIndex
): string[] {
  const lookups = new Map<ExportedSubgraph, DefinitionLookups>()
  // A name declared twice cannot be mapped to one host slot (`hostSlotIndex`
  // rejects it), so it must not be reported as a settable promoted widget.
  const ambiguous = ambiguousInputNames(definition)
  return (definition.inputs ?? []).flatMap((input, inputIndex) =>
    !ambiguous.has(input.name) &&
    isPromoted(definition, inputIndex, index, lookups)
      ? [input.name]
      : []
  )
}

/**
 * The host's full input slot list in definition order. Each slot starts from
 * the declared input's presentation fields (label, shape, etc.; never the
 * definition-only `id`/`linkIds`), then takes whatever the doc carries for a
 * slot of the same name on top. `name` and `type` always come from the
 * definition.
 *
 * `link` is only present when the doc supplies it. Declared inputs the doc
 * omits, and inputs whose name is declared more than once, carry no `link`
 * key at all: cmp writes only the grown slot after a promoted connect, so an
 * omitted slot means "no information", not "unlinked". The graph mutation
 * layer resolves an absent `link` against the live host's slot at the same
 * index (see `graphMutations` `prepareInputSlots`).
 */
export function hostInputs(
  definition: ExportedSubgraph,
  docInputs: readonly unknown[]
): ISerialisableNodeInput[] {
  const ambiguous = ambiguousInputNames(definition)
  const docByName = new Map(
    docInputs
      .filter(
        (input): input is Record<string, unknown> & { name: string } =>
          input !== null &&
          typeof input === 'object' &&
          'name' in input &&
          typeof input.name === 'string'
      )
      .map((input) => [input.name, input])
  )
  return (definition.inputs ?? []).map((input) => {
    const { id: _id, linkIds: _linkIds, ...declared } = input
    const fromDoc = ambiguous.has(input.name)
      ? undefined
      : docByName.get(input.name)
    return {
      ...declared,
      ...fromDoc,
      name: input.name,
      type: input.type
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
