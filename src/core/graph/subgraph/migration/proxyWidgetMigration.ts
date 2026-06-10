import { isEqual } from 'es-toolkit/compat'

import { promotedInputWidget } from '@/core/graph/subgraph/promotedInputWidget'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  findHostInputForPromotion,
  getPromotableWidgets,
  isPreviewPseudoWidget
} from '@/core/graph/subgraph/promotionUtils'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import { parseProxyWidgets } from '@/core/schemas/promotionSchema'
import type {
  ProxyWidgetErrorQuarantineEntry,
  ProxyWidgetQuarantineReason
} from '@/core/schemas/proxyWidgetQuarantineSchema'
import { parseProxyWidgetErrorQuarantine } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { asNodeId } from '@/lib/litegraph/src/utils/nodeId'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

interface LegacyProxyEntrySource extends PromotedWidgetSource {
  disambiguatingSourceNodeId?: string
}

const LEGACY_PROXY_WIDGET_PREFIX_PATTERN = /^\s*(\d+)\s*:\s*(.+)$/

interface StrippedPrefix {
  sourceWidgetName: string
  deepestPrefixId?: string
}

function stripLegacyPrefixes(sourceWidgetName: string): StrippedPrefix {
  let remaining = sourceWidgetName
  let deepestPrefixId: string | undefined
  while (true) {
    const match = LEGACY_PROXY_WIDGET_PREFIX_PATTERN.exec(remaining)
    if (!match) return { sourceWidgetName: remaining, deepestPrefixId }
    deepestPrefixId = match[1]
    remaining = match[2]
  }
}

function canResolveLegacyProxy(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  widgetName: string
): boolean {
  return (
    resolveConcretePromotedWidget(hostNode, sourceNodeId, widgetName).status ===
    'resolved'
  )
}

export function normalizeLegacyProxyWidgetEntry(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): LegacyProxyEntrySource {
  if (canResolveLegacyProxy(hostNode, sourceNodeId, sourceWidgetName)) {
    return {
      sourceNodeId,
      sourceWidgetName,
      ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
    }
  }

  const stripped = stripLegacyPrefixes(sourceWidgetName)
  const patchDisambiguatingSourceNodeId =
    stripped.deepestPrefixId ?? disambiguatingSourceNodeId

  return {
    sourceNodeId,
    sourceWidgetName: stripped.sourceWidgetName,
    ...(patchDisambiguatingSourceNodeId && {
      disambiguatingSourceNodeId: patchDisambiguatingSourceNodeId
    })
  }
}

function resolveSourceWidget(
  sourceNode: LGraphNode,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): IBaseWidget | undefined {
  if (sourceNode.isSubgraphNode()) {
    const input = sourceNode.inputs.find((input) => {
      const target = resolveSubgraphInputTarget(sourceNode, input.name)
      if (disambiguatingSourceNodeId) {
        return (
          target?.widgetName === sourceWidgetName &&
          target.nodeId === disambiguatingSourceNodeId
        )
      }
      if (input.name === sourceWidgetName) return true
      return target?.widgetName === sourceWidgetName
    })
    // Store-backed projection for a promoted input on a nested subgraph node:
    // getSlotFromWidget locates the backing slot by widgetId.
    if (input?.widgetId) return promotedInputWidget(input) ?? undefined
  }

  const widgets = sourceNode.widgets
  return (
    widgets?.find((w) => w.name === sourceWidgetName) ??
    getPromotableWidgets(sourceNode).find((w) => w.name === sourceWidgetName)
  )
}

interface FlushArgs {
  hostNode: SubgraphNode
  hostWidgetValues?: readonly unknown[]
}

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
const PROXY_BYPASS_MARKER_PROPERTY = 'proxyBypassedToSubgraphInput'

export function flushProxyWidgetMigration(args: FlushArgs): void {
  const { hostNode, hostWidgetValues } = args

  const tuples = parseProxyWidgets(hostNode.properties.proxyWidgets)
  if (tuples.length === 0) return

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
      case 'alreadyLinked': {
        const r = repairAlreadyLinked(
          hostNode,
          entry,
          entry.plan.subgraphInputName
        )
        if (!r.ok) quarantineToAppend.push(quarantineFor(entry, r.reason))
        break
      }
      case 'createSubgraphInput': {
        const r = repairCreateSubgraphInput(
          hostNode,
          entry,
          entry.plan.sourceWidgetName
        )
        if (!r.ok) quarantineToAppend.push(quarantineFor(entry, r.reason))
        break
      }
      case 'previewExposure': {
        const r = migratePreview(hostNode, entry, previewStore, entry.plan)
        if (!r.ok) quarantineToAppend.push(quarantineFor(entry, r.reason))
        break
      }
      case 'quarantine':
        quarantineToAppend.push(quarantineFor(entry, entry.plan.reason))
        break
    }
  }

  for (const c of primitiveCohorts.values()) {
    const r = repairPrimitive(hostNode, c)
    if (!r.ok)
      for (const e of c) quarantineToAppend.push(quarantineFor(e, r.reason))
  }

  if (quarantineToAppend.length > 0) {
    appendQuarantine(hostNode, quarantineToAppend)
  }

  delete hostNode.properties.proxyWidgets
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
  const raw = hostWidgetValues[index]
  if (!isWidgetValue(raw)) return { value: undefined, isHole: true }
  return { value: raw, isHole: false }
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
      targetNodeId: asNodeId(link.target_id),
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
  const linkIds = primitiveNode.outputs?.[0]?.links ?? []
  return linkIds.flatMap((linkId) => {
    const link = subgraph.links.get(linkId)
    return link
      ? [
          {
            targetNodeId: asNodeId(link.target_id),
            targetSlot: link.target_slot
          }
        ]
      : []
  })
}

function cohortDuplicatesPrimitive(
  cohort: readonly LegacyProxyEntrySource[],
  primitiveNodeId: string
): boolean {
  return (
    cohort.filter((entry) => entry.sourceNodeId === primitiveNodeId).length >= 2
  )
}

function classify(
  hostNode: SubgraphNode,
  normalized: LegacyProxyEntrySource,
  cohort: readonly LegacyProxyEntrySource[]
): Plan {
  const linkedInput = findHostInputForPromotion(
    hostNode,
    normalized.sourceNodeId,
    normalized.sourceWidgetName
  )
  if (linkedInput) {
    return { kind: 'alreadyLinked', subgraphInputName: linkedInput.name }
  }

  const sourceNode = hostNode.subgraph.getNodeById(normalized.sourceNodeId)
  if (!sourceNode) {
    return { kind: 'quarantine', reason: 'missingSourceNode' }
  }

  if (sourceNode.type === PRIMITIVE_NODE_TYPE) {
    const bypassedTo = sourceNode.properties?.[PROXY_BYPASS_MARKER_PROPERTY]
    if (typeof bypassedTo === 'string') {
      const existingInput = hostNode.inputs.find(
        (input) => input.name === bypassedTo
      )
      if (existingInput) {
        return { kind: 'alreadyLinked', subgraphInputName: existingInput.name }
      }
    }

    const targets = collectTargetsSkippingDangling(hostNode, sourceNode)
    const cohortDuplicated = cohortDuplicatesPrimitive(
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

  const sourceWidget = resolveSourceWidget(
    sourceNode,
    normalized.sourceWidgetName,
    normalized.disambiguatingSourceNodeId
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

function applyHostValueToInput(
  input: INodeInputSlot,
  entry: PendingEntry
): boolean {
  if (!input.widgetId || entry.isHole) return Boolean(input.widgetId)
  return useWidgetValueStore().setValue(input.widgetId, entry.hostValue)
}

function applyHostLabelToInput(
  input: INodeInputSlot,
  label: string | undefined
): void {
  if (label === undefined) return
  input.label = label
  if (!input.widgetId) return
  const state = useWidgetValueStore().getWidget(input.widgetId)
  if (state) state.label = label
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

type Outcome<TOk, TReason = ProxyWidgetQuarantineReason> =
  | ({ ok: true } & TOk)
  | { ok: false; reason: TReason }

type RepairValueResult = Outcome<{ subgraphInputName: string }>

function repairAlreadyLinked(
  hostNode: SubgraphNode,
  entry: PendingEntry,
  subgraphInputName: string
): RepairValueResult {
  // Resolve by name directly: source-id matching would miss for primitive
  // bypasses, where the view's `sourceNodeId` is the consumer, not the
  // primitive.
  const matches = hostNode.inputs.filter(
    (input) => input.name === subgraphInputName
  )
  if (matches.length === 0) {
    return { ok: false, reason: 'missingSubgraphInput' }
  }
  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguousSubgraphInput' }
  }
  const hostInput = matches[0]
  if (!applyHostValueToInput(hostInput, entry)) {
    return { ok: false, reason: 'missingSubgraphInput' }
  }
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

  const sourceWidget = resolveSourceWidget(
    sourceNode,
    sourceWidgetName,
    entry.normalized.disambiguatingSourceNodeId
  )
  if (!sourceWidget) {
    return { ok: false, reason: 'missingSourceWidget' }
  }

  const slot: INodeInputSlot | undefined =
    sourceNode.getSlotFromWidget(sourceWidget)
  if (!slot) {
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
  if (hostInput) {
    applyHostLabelToInput(hostInput, slot.label)
    applyHostValueToInput(hostInput, entry)
  }
  return { ok: true, subgraphInputName: newSubgraphInput.name }
}

type RepairPrimitiveResult = Outcome<
  { subgraphInputName: string; reconnectCount: number },
  'primitiveBypassFailed'
>

const PRIMITIVE_FAILED: RepairPrimitiveResult = {
  ok: false,
  reason: 'primitiveBypassFailed'
}

interface SnapshotLink extends PrimitiveBypassTargetRef {
  primitiveSlot: number
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
      targetNodeId: asNodeId(l.target_id),
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

  const hostInput = hostNode.inputs.find(
    (input) => input.name === newSubgraphInput.name
  )
  if (hostInput) {
    const valueEntry = validated.uniqueEntries.find((e) => !e.isHole)
    if (valueEntry) {
      applyHostValueToInput(hostInput, valueEntry)
    } else {
      const primitiveValue = primitiveNode.widgets?.find(
        (w) => w.name === validated.sourceWidgetName
      )?.value as TWidgetValue | undefined
      if (primitiveValue !== undefined) {
        applyHostValueToInput(hostInput, {
          ...validated.uniqueEntries[0],
          hostValue: primitiveValue,
          isHole: false
        })
      }
    }
  }

  primitiveNode.properties ??= {}
  primitiveNode.properties[PROXY_BYPASS_MARKER_PROPERTY] = newSubgraphInput.name

  return {
    ok: true,
    subgraphInputName: newSubgraphInput.name,
    reconnectCount: targets.length
  }
}

type MigratePreviewResult = Outcome<
  { previewName: string },
  'missingSourceNode' | 'missingSourceWidget'
>

function migratePreview(
  hostNode: SubgraphNode,
  entry: PendingEntry,
  store: ReturnType<typeof usePreviewExposureStore>,
  plan: { kind: 'previewExposure'; sourcePreviewName: string }
): MigratePreviewResult {
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
  return makeQuarantineEntry({
    originalEntry,
    reason,
    hostValue: entry.isHole ? undefined : entry.hostValue
  })
}

export function appendQuarantine(
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

export function makeQuarantineEntry(args: {
  originalEntry: SerializedProxyWidgetTuple
  reason: ProxyWidgetQuarantineReason
  hostValue?: TWidgetValue
}): ProxyWidgetErrorQuarantineEntry {
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
