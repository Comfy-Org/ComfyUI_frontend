import { isEqual } from 'es-toolkit/compat'

import { normalizeLegacyProxyWidgetEntry } from '@/core/graph/subgraph/legacyProxyWidgetNormalization'
import type { LegacyProxyEntrySource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  getPromotableWidgets,
  isPreviewPseudoWidget
} from '@/core/graph/subgraph/promotionUtils'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import { parseProxyWidgets } from '@/core/schemas/promotionSchema'
import type {
  ProxyWidgetErrorQuarantineEntry,
  ProxyWidgetQuarantineReason
} from '@/core/schemas/proxyWidgetQuarantineSchema'
import { parseProxyWidgetErrorQuarantine } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

interface FlushArgs {
  hostNode: SubgraphNode
  hostWidgetValues?: readonly unknown[]
}

interface FlushResult {
  repaired: number
  primitiveRepaired: number
  previewMigrated: number
  quarantined: number
}

const EMPTY_RESULT: FlushResult = Object.freeze({
  repaired: 0,
  primitiveRepaired: 0,
  previewMigrated: 0,
  quarantined: 0
})

interface PrimitiveBypassTargetRef {
  targetNodeId: NodeId
  targetSlot: number
}

type Plan =
  | { kind: 'alreadyLinked'; subgraphInputName: string }
  | { kind: 'createSubgraphInput'; sourceWidgetName: string }
  | {
      kind: 'primitiveBypass'
      primitiveNodeId: NodeId
      sourceWidgetName: string
      targets: readonly PrimitiveBypassTargetRef[]
    }
  | { kind: 'previewExposure'; sourcePreviewName: string }
  | { kind: 'quarantine'; reason: ProxyWidgetQuarantineReason }

interface PendingEntry {
  normalized: LegacyProxyEntrySource
  hostValue: TWidgetValue | undefined
  isHole: boolean
  plan: Plan
}

const PRIMITIVE_NODE_TYPE = 'PrimitiveNode'
const QUARANTINE_PROPERTY = 'proxyWidgetErrorQuarantine'
const QUARANTINE_VERSION = 1

export function flushProxyWidgetMigration(args: FlushArgs): FlushResult {
  const { hostNode, hostWidgetValues } = args

  const tuples = parseProxyWidgets(hostNode.properties.proxyWidgets)
  if (tuples.length === 0) return EMPTY_RESULT

  const cohort: LegacyProxyEntrySource[] = tuples.map(
    ([sourceNodeId, sourceWidgetName, disambiguator]) =>
      normalizeLegacyProxyWidgetEntry(
        hostNode,
        sourceNodeId,
        sourceWidgetName,
        disambiguator
      )
  )

  const pending: PendingEntry[] = cohort.map((normalized, index) => {
    const { value, isHole } = pickHostValue(hostWidgetValues, index)
    return {
      normalized,
      hostValue: value,
      isHole,
      plan: classify(hostNode, normalized, cohort)
    }
  })

  const previewStore = usePreviewExposureStore()
  const result: FlushResult = { ...EMPTY_RESULT }
  const quarantineToAppend: ProxyWidgetErrorQuarantineEntry[] = []
  const primitiveCohorts = new Map<NodeId, PendingEntry[]>()

  for (const entry of pending) {
    switch (entry.plan.kind) {
      case 'primitiveBypass': {
        const c = primitiveCohorts.get(entry.plan.primitiveNodeId) ?? []
        c.push(entry)
        primitiveCohorts.set(entry.plan.primitiveNodeId, c)
        break
      }
      case 'alreadyLinked':
      case 'createSubgraphInput': {
        const r = repairValue(hostNode, entry)
        if (r.ok) result.repaired += 1
        else quarantineToAppend.push(quarantineFor(entry, r.reason))
        break
      }
      case 'previewExposure': {
        const r = migratePreview(hostNode, entry, previewStore)
        if (r.ok) result.previewMigrated += 1
        else quarantineToAppend.push(quarantineFor(entry, r.reason))
        break
      }
      case 'quarantine':
        quarantineToAppend.push(quarantineFor(entry, entry.plan.reason))
        break
    }
  }

  for (const c of primitiveCohorts.values()) {
    const r = repairPrimitive(hostNode, c)
    if (r.ok) result.primitiveRepaired += 1
    else for (const e of c) quarantineToAppend.push(quarantineFor(e, r.reason))
  }

  if (quarantineToAppend.length > 0) {
    appendQuarantine(hostNode, quarantineToAppend)
    result.quarantined = quarantineToAppend.length
  }

  delete hostNode.properties.proxyWidgets

  return result
}

function pickHostValue(
  hostWidgetValues: readonly unknown[] | undefined,
  index: number
): { value: TWidgetValue | undefined; isHole: boolean } {
  if (
    hostWidgetValues === undefined ||
    index < 0 ||
    index >= hostWidgetValues.length ||
    !Object.hasOwn(hostWidgetValues, index)
  ) {
    return { value: undefined, isHole: true }
  }
  return { value: hostWidgetValues[index] as TWidgetValue, isHole: false }
}

function findHostInputForLinkedSource(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string,
  subgraphInputName?: string
): INodeInputSlot | 'ambiguous' | undefined {
  const candidates = subgraphInputName
    ? hostNode.inputs.filter((input) => input.name === subgraphInputName)
    : hostNode.inputs
  const matches = candidates.filter((input) => {
    const widget = input._widget
    return (
      !!widget &&
      isPromotedWidgetView(widget) &&
      widget.sourceNodeId === sourceNodeId &&
      widget.sourceWidgetName === sourceWidgetName
    )
  })
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  return 'ambiguous'
}

function collectTargetsStrict(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode
): PrimitiveBypassTargetRef[] | undefined {
  const subgraph = hostNode.subgraph
  const output = primitiveNode.outputs?.[0]
  const linkIds = output?.links ?? []
  const targets: PrimitiveBypassTargetRef[] = []
  for (const linkId of linkIds) {
    const link = subgraph.links.get(linkId)
    if (!link) return undefined
    targets.push({
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    })
  }
  return targets
}

function collectTargetsSkippingDangling(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode
): PrimitiveBypassTargetRef[] {
  const subgraph = hostNode.subgraph
  const output = primitiveNode.outputs?.[0]
  const linkIds = output?.links ?? []
  const targets: PrimitiveBypassTargetRef[] = []
  for (const linkId of linkIds) {
    const link = subgraph.links.get(linkId)
    if (!link) continue
    targets.push({
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    })
  }
  return targets
}

function cohortReferencesPrimitive(
  cohort: readonly LegacyProxyEntrySource[],
  primitiveNodeId: string
): boolean {
  let count = 0
  for (const entry of cohort) {
    if (entry.sourceNodeId === primitiveNodeId) {
      count += 1
      if (count >= 2) return true
    }
  }
  return false
}

function classify(
  hostNode: SubgraphNode,
  normalized: LegacyProxyEntrySource,
  cohort: readonly LegacyProxyEntrySource[]
): Plan {
  const linkedInput = findHostInputForLinkedSource(
    hostNode,
    normalized.sourceNodeId,
    normalized.sourceWidgetName
  )
  if (linkedInput === 'ambiguous') {
    return { kind: 'quarantine', reason: 'ambiguousSubgraphInput' }
  }
  if (linkedInput) {
    return { kind: 'alreadyLinked', subgraphInputName: linkedInput.name }
  }

  const sourceNode = hostNode.subgraph.getNodeById(normalized.sourceNodeId)
  if (!sourceNode) {
    return { kind: 'quarantine', reason: 'missingSourceNode' }
  }

  if (sourceNode.type === PRIMITIVE_NODE_TYPE) {
    const targets = collectTargetsSkippingDangling(hostNode, sourceNode)
    const cohortDuplicated = cohortReferencesPrimitive(
      cohort,
      normalized.sourceNodeId
    )
    if (targets.length >= 1 || cohortDuplicated) {
      return {
        kind: 'primitiveBypass',
        primitiveNodeId: sourceNode.id,
        sourceWidgetName: normalized.sourceWidgetName,
        targets
      }
    }
    return { kind: 'quarantine', reason: 'unlinkedSourceWidget' }
  }

  const promotableWidgets = getPromotableWidgets(sourceNode)
  const sourceWidget = promotableWidgets.find(
    (w) => w.name === normalized.sourceWidgetName
  )
  if (!sourceWidget) {
    return { kind: 'quarantine', reason: 'missingSourceWidget' }
  }

  if (
    normalized.sourceWidgetName.startsWith('$$') ||
    isPreviewPseudoWidget(sourceWidget)
  ) {
    return {
      kind: 'previewExposure',
      sourcePreviewName: normalized.sourceWidgetName
    }
  }

  return {
    kind: 'createSubgraphInput',
    sourceWidgetName: normalized.sourceWidgetName
  }
}

function applyHostValue(widget: IBaseWidget, entry: PendingEntry): void {
  if (entry.isHole) return
  if (
    isPromotedWidgetView(widget) &&
    typeof widget.hydrateHostValue === 'function'
  ) {
    widget.hydrateHostValue(entry.hostValue)
    return
  }
  widget.value = entry.hostValue as TWidgetValue
}

function addUniqueSubgraphInput(
  subgraph: Subgraph,
  baseName: string,
  type: string
): SubgraphInput {
  const existingNames = subgraph.inputs.map((input) => input.name)
  const uniqueName = nextUniqueName(baseName, existingNames)
  return subgraph.addInput(uniqueName, type)
}

type RepairValueResult =
  | { ok: true; subgraphInputName: string }
  | { ok: false; reason: ProxyWidgetQuarantineReason }

function repairValue(
  hostNode: SubgraphNode,
  entry: PendingEntry
): RepairValueResult {
  if (entry.plan.kind === 'alreadyLinked') {
    return repairAlreadyLinked(hostNode, entry, entry.plan.subgraphInputName)
  }
  if (entry.plan.kind === 'createSubgraphInput') {
    return repairCreateSubgraphInput(
      hostNode,
      entry,
      entry.plan.sourceWidgetName
    )
  }
  throw new Error(`repairValue: invalid plan kind ${entry.plan.kind}`)
}

function repairAlreadyLinked(
  hostNode: SubgraphNode,
  entry: PendingEntry,
  subgraphInputName: string
): RepairValueResult {
  const hostInput = findHostInputForLinkedSource(
    hostNode,
    entry.normalized.sourceNodeId,
    entry.normalized.sourceWidgetName,
    subgraphInputName
  )
  if (hostInput === 'ambiguous') {
    return { ok: false, reason: 'ambiguousSubgraphInput' }
  }
  if (!hostInput || !hostInput._widget) {
    return { ok: false, reason: 'missingSubgraphInput' }
  }
  applyHostValue(hostInput._widget, entry)
  return { ok: true, subgraphInputName: hostInput.name }
}

function repairCreateSubgraphInput(
  hostNode: SubgraphNode,
  entry: PendingEntry,
  sourceWidgetName: string
): RepairValueResult {
  const subgraph = hostNode.subgraph
  const sourceNode: LGraphNode | null = subgraph.getNodeById(
    entry.normalized.sourceNodeId
  )
  if (!sourceNode) {
    return { ok: false, reason: 'missingSourceNode' }
  }

  const sourceWidget = sourceNode.widgets?.find(
    (w) => w.name === sourceWidgetName
  )
  if (!sourceWidget) {
    return { ok: false, reason: 'missingSourceWidget' }
  }

  const slot: INodeInputSlot | undefined =
    sourceNode.getSlotFromWidget(sourceWidget)
  if (!slot) {
    // TODO(adr-0009): synthesize a backing input slot during the wiring slice.
    console.warn(
      '[proxyWidgetMigration] source widget has no backing input slot; quarantining',
      {
        sourceNodeId: entry.normalized.sourceNodeId,
        sourceWidgetName
      }
    )
    return { ok: false, reason: 'missingSubgraphInput' }
  }

  const slotType = String(slot.type ?? sourceWidget.type ?? '*')
  const newSubgraphInput = addUniqueSubgraphInput(
    subgraph,
    sourceWidgetName,
    slotType
  )
  if (slot.label !== undefined) newSubgraphInput.label = slot.label
  const link = newSubgraphInput.connect(slot, sourceNode)
  if (!link) {
    subgraph.removeInput(newSubgraphInput)
    return { ok: false, reason: 'missingSubgraphInput' }
  }

  const hostInput = hostNode.inputs.find(
    (input) => input.name === newSubgraphInput.name
  )
  if (!hostInput?._widget) {
    return { ok: true, subgraphInputName: newSubgraphInput.name }
  }

  applyHostValue(hostInput._widget, entry)
  return { ok: true, subgraphInputName: newSubgraphInput.name }
}

type RepairPrimitiveResult =
  | { ok: true; subgraphInputName: string; reconnectCount: number }
  | { ok: false; reason: 'primitiveBypassFailed' }

const PRIMITIVE_FAILED: RepairPrimitiveResult = {
  ok: false,
  reason: 'primitiveBypassFailed'
}

interface SnapshotLink {
  primitiveSlot: number
  targetNodeId: NodeId
  targetSlot: number
}

interface CohortValidationOk {
  ok: true
  primitiveNodeId: NodeId
  sourceWidgetName: string
  uniqueEntries: readonly PendingEntry[]
}

function failPrimitive(message: string, ctx?: unknown): RepairPrimitiveResult {
  console.warn(`[proxyWidgetMigration] ${message}`, ctx)
  return PRIMITIVE_FAILED
}

function userRenamedTitle(primitiveNode: LGraphNode): string | undefined {
  const title = primitiveNode.title
  return title && title !== PRIMITIVE_NODE_TYPE ? title : undefined
}

function validateCohort(
  cohort: readonly PendingEntry[]
): CohortValidationOk | { ok: false } {
  const first = cohort[0]
  if (!first || first.plan.kind !== 'primitiveBypass') return { ok: false }
  const { primitiveNodeId, sourceWidgetName } = first.plan
  for (const entry of cohort) {
    if (
      entry.plan.kind !== 'primitiveBypass' ||
      entry.plan.primitiveNodeId !== primitiveNodeId ||
      entry.plan.sourceWidgetName !== sourceWidgetName
    ) {
      return { ok: false }
    }
  }
  const uniqueEntries: PendingEntry[] = []
  for (const entry of cohort) {
    if (!uniqueEntries.some((k) => isEqual(k.normalized, entry.normalized))) {
      uniqueEntries.push(entry)
    }
  }
  return { ok: true, primitiveNodeId, sourceWidgetName, uniqueEntries }
}

function rollback(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode,
  newSubgraphInput: SubgraphInput | undefined,
  snapshot: readonly SnapshotLink[]
): void {
  if (newSubgraphInput) {
    try {
      hostNode.subgraph.removeInput(newSubgraphInput)
    } catch (e) {
      console.warn('[proxyWidgetMigration] rollback removeInput failed', e)
    }
  }
  for (const link of snapshot) {
    const targetNode = hostNode.subgraph.getNodeById(link.targetNodeId)
    if (!targetNode) continue
    primitiveNode.connect(link.primitiveSlot, targetNode, link.targetSlot)
  }
}

function repairPrimitive(
  hostNode: SubgraphNode,
  cohort: readonly PendingEntry[]
): RepairPrimitiveResult {
  const validated = validateCohort(cohort)
  if (!validated.ok)
    return failPrimitive('cohort validation failed', { cohort })

  const subgraph = hostNode.subgraph
  const primitiveNode = subgraph.getNodeById(validated.primitiveNodeId)
  if (!primitiveNode) return failPrimitive('primitive node missing', validated)
  if (primitiveNode.type !== PRIMITIVE_NODE_TYPE) {
    return failPrimitive('node is not a PrimitiveNode', primitiveNode.type)
  }

  const targets = collectTargetsStrict(hostNode, primitiveNode)
  if (!targets?.length)
    return failPrimitive('no targets to reconnect', validated)

  const primitiveOutput = primitiveNode.outputs?.[0]
  if (!primitiveOutput) return failPrimitive('primitive has no output')
  const primitiveOutputType = String(primitiveOutput.type ?? '*')

  for (const target of targets) {
    const targetNode = subgraph.getNodeById(target.targetNodeId)
    if (!targetNode) return failPrimitive('target node missing', target)
    const targetSlot = targetNode.inputs?.[target.targetSlot]
    if (!targetSlot) return failPrimitive('target slot missing', target)
    const targetType = String(targetSlot.type ?? '*')
    if (
      targetType !== primitiveOutputType &&
      targetType !== '*' &&
      primitiveOutputType !== '*'
    ) {
      return failPrimitive('target slot type incompatible', {
        target,
        targetType,
        primitiveOutputType
      })
    }
  }

  const baseName = userRenamedTitle(primitiveNode) ?? validated.sourceWidgetName
  const snapshot: SnapshotLink[] = (primitiveOutput.links ?? [])
    .map((id) => subgraph.links.get(id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
    .map((l) => ({
      primitiveSlot: l.origin_slot,
      targetNodeId: l.target_id,
      targetSlot: l.target_slot
    }))

  let newSubgraphInput: SubgraphInput | undefined
  try {
    newSubgraphInput = addUniqueSubgraphInput(
      subgraph,
      baseName,
      primitiveOutputType
    )

    for (const snap of snapshot) {
      const targetNode = subgraph.getNodeById(snap.targetNodeId)
      if (!targetNode)
        throw new Error(
          `target node ${snap.targetNodeId} disappeared mid-mutation`
        )
      targetNode.disconnectInput(snap.targetSlot, false)
    }

    for (const target of targets) {
      const targetNode = subgraph.getNodeById(target.targetNodeId)
      if (!targetNode)
        throw new Error(`target node ${target.targetNodeId} disappeared`)
      const targetSlot = targetNode.inputs?.[target.targetSlot]
      if (!targetSlot)
        throw new Error(`target slot ${target.targetSlot} disappeared`)
      const link = newSubgraphInput.connect(targetSlot, targetNode)
      if (!link) {
        throw new Error('SubgraphInput.connect returned no link')
      }
    }
  } catch (e) {
    rollback(hostNode, primitiveNode, newSubgraphInput, snapshot)
    return failPrimitive('mutation failed; rolled back', { error: e })
  }

  const valueEntry = validated.uniqueEntries.find((e) => !e.isHole)
  if (valueEntry && newSubgraphInput._widget) {
    applyHostValue(newSubgraphInput._widget, valueEntry)
  } else if (!valueEntry) {
    const primitiveValue = primitiveNode.widgets?.find(
      (w) => w.name === validated.sourceWidgetName
    )?.value as TWidgetValue | undefined
    if (primitiveValue !== undefined && newSubgraphInput._widget) {
      newSubgraphInput._widget.value = primitiveValue
    }
  }

  return {
    ok: true,
    subgraphInputName: newSubgraphInput.name,
    reconnectCount: targets.length
  }
}

type MigratePreviewResult =
  | { ok: true; previewName: string }
  | { ok: false; reason: 'missingSourceNode' | 'missingSourceWidget' }

function migratePreview(
  hostNode: SubgraphNode,
  entry: PendingEntry,
  store: ReturnType<typeof usePreviewExposureStore>
): MigratePreviewResult {
  const plan = entry.plan
  if (plan.kind !== 'previewExposure') {
    throw new Error(`migratePreview: invalid plan kind ${plan.kind}`)
  }

  const sourceNode = hostNode.subgraph.getNodeById(
    entry.normalized.sourceNodeId
  )
  if (!sourceNode) {
    return { ok: false, reason: 'missingSourceNode' }
  }

  const isCanonicalPseudo = plan.sourcePreviewName.startsWith('$$')
  if (!isCanonicalPseudo) {
    const widget = sourceNode.widgets?.find(
      (w) => w.name === plan.sourcePreviewName
    )
    if (!widget) {
      return { ok: false, reason: 'missingSourceWidget' }
    }
  }

  const hostNodeLocator = String(hostNode.id)
  const existing = store
    .getExposures(hostNode.rootGraph.id, hostNodeLocator)
    .find(
      (exposure) =>
        exposure.sourceNodeId === entry.normalized.sourceNodeId &&
        exposure.sourcePreviewName === plan.sourcePreviewName
    )
  if (existing) return { ok: true, previewName: existing.name }

  const added = store.addExposure(hostNode.rootGraph.id, hostNodeLocator, {
    sourceNodeId: entry.normalized.sourceNodeId,
    sourcePreviewName: plan.sourcePreviewName
  })

  return { ok: true, previewName: added.name }
}

function quarantineFor(
  entry: PendingEntry,
  reason: ProxyWidgetQuarantineReason
): ProxyWidgetErrorQuarantineEntry {
  const { sourceNodeId, sourceWidgetName, disambiguatingSourceNodeId } =
    entry.normalized
  const originalEntry: SerializedProxyWidgetTuple = disambiguatingSourceNodeId
    ? [sourceNodeId, sourceWidgetName, disambiguatingSourceNodeId]
    : [sourceNodeId, sourceWidgetName]
  const result: ProxyWidgetErrorQuarantineEntry = {
    originalEntry,
    reason,
    attemptedAtVersion: QUARANTINE_VERSION
  }
  if (!entry.isHole && entry.hostValue !== undefined) {
    result.hostValue = entry.hostValue
  }
  return result
}

function appendQuarantine(
  hostNode: SubgraphNode,
  entries: readonly ProxyWidgetErrorQuarantineEntry[]
): void {
  if (entries.length === 0) return
  const existing = parseProxyWidgetErrorQuarantine(
    hostNode.properties[QUARANTINE_PROPERTY]
  )
  const merged = [...existing]
  for (const candidate of entries) {
    if (
      !merged.some((e) => isEqual(e.originalEntry, candidate.originalEntry))
    ) {
      merged.push(candidate)
    }
  }
  if (merged.length === 0) delete hostNode.properties[QUARANTINE_PROPERTY]
  else hostNode.properties[QUARANTINE_PROPERTY] = merged
}

export function readHostQuarantine(
  hostNode: SubgraphNode
): ProxyWidgetErrorQuarantineEntry[] {
  return parseProxyWidgetErrorQuarantine(
    hostNode.properties[QUARANTINE_PROPERTY]
  )
}

interface MakeQuarantineEntryArgs {
  originalEntry: SerializedProxyWidgetTuple
  reason: ProxyWidgetQuarantineReason
  hostValue?: TWidgetValue
}

export function makeQuarantineEntry(
  args: MakeQuarantineEntryArgs
): ProxyWidgetErrorQuarantineEntry {
  const entry: ProxyWidgetErrorQuarantineEntry = {
    originalEntry: args.originalEntry,
    reason: args.reason,
    attemptedAtVersion: QUARANTINE_VERSION
  }
  if (args.hostValue !== undefined) {
    entry.hostValue = args.hostValue
  }
  return entry
}

export function appendHostQuarantine(
  hostNode: SubgraphNode,
  entries: readonly ProxyWidgetErrorQuarantineEntry[]
): void {
  appendQuarantine(hostNode, entries)
}
