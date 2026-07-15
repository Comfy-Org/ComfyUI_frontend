import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import { t } from '@/i18n'
import { registerBadgeIcon } from '@/lib/litegraph/src/badgeIconRegistry'
import { trackGraphStructure } from '@/lib/litegraph/src/graphStructureRevision'
import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { setBadgeRowsProvider } from '@/lib/litegraph/src/nodeBadgeDraw'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import type { BadgeData, CoreBadgePart } from '@/types/badgeData'
import type { NodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'
import { widgetId } from '@/types/widgetId'
import { adjustColor } from '@/utils/colorUtil'
import { mapUniqueNodes } from '@/utils/graphTraversalUtil'
import type { UUID } from '@/utils/uuid'

/** The badge-relevant projection of a node's definition. */
interface NodeDefBadgeSources {
  isCoreNode: boolean
  lifecycleText: string
  sourceText: string
}

/** How a node participates in credits pricing, decided by the gatherer. */
type PricingBadgeSources =
  | { kind: 'none' }
  | { kind: 'api-node'; label: string }
  | { kind: 'subgraph'; apiNodeCount: number; singleLabel: string }

/**
 * The domain state a node's badges are computed from. Plain data so
 * {@link computeBadges} stays pure — {@link nodeBadges}' computed
 * gathers these from the live stores.
 */
export interface BadgeSources {
  nodeId: NodeId
  nodeDef: NodeDefBadgeSources | null
  badgeModes: {
    id: NodeBadgeMode
    lifecycle: NodeBadgeMode
    source: NodeBadgeMode
  }
  colors: { fgColor: string; bgColor: string; creditsBgColor: string }
  pricing: PricingBadgeSources
}

function badgeTextVisible(
  nodeDef: NodeDefBadgeSources | null,
  badgeMode: NodeBadgeMode
): boolean {
  return !(
    badgeMode === NodeBadgeMode.None ||
    (nodeDef?.isCoreNode && badgeMode === NodeBadgeMode.HideBuiltIn)
  )
}

/** Projects a node's core and credits badge rows from their sources. */
export function computeBadges(sources: BadgeSources): BadgeData[] {
  const { nodeId, nodeDef, badgeModes, colors, pricing } = sources
  const coreParts: [CoreBadgePart, NodeBadgeMode, string][] = [
    ['lifecycle', badgeModes.lifecycle, nodeDef?.lifecycleText ?? ''],
    ['id', badgeModes.id, `#${nodeId}`],
    ['source', badgeModes.source, nodeDef?.sourceText ?? '']
  ]
  const rows: BadgeData[] = coreParts
    .filter(
      ([, mode, text]) => badgeTextVisible(nodeDef, mode) && text.length > 0
    )
    .map(([part, , text]) => ({
      kind: 'core',
      part,
      text,
      fgColor: colors.fgColor,
      bgColor: colors.bgColor
    }))

  const creditsText = computeCreditsText(pricing)
  if (creditsText) {
    rows.push({
      kind: 'credits',
      text: creditsText,
      iconKey: 'credits',
      fgColor: colors.fgColor,
      bgColor: colors.creditsBgColor
    })
  }
  return rows
}

function computeCreditsText(pricing: PricingBadgeSources): string {
  switch (pricing.kind) {
    case 'none':
      return ''
    case 'api-node':
      return pricing.label
    case 'subgraph':
      if (pricing.apiNodeCount > 1) {
        return t('nodeBadge.partnerNodesCount', {
          count: pricing.apiNodeCount
        })
      }
      return pricing.apiNodeCount === 1 ? pricing.singleLabel : ''
  }
}

const CREDITS_BASE_BG_COLOR = '#8D6932'

function registerCreditsIcon(): void {
  const icon = new Image()
  icon.src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='oklch(83.01%25 0.163 83.16)' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0zm-13.239 0a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0zm6.619 6.619a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0zm0-13.238a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z'/%3E%3C/svg%3E"
  registerBadgeIcon('credits', { image: icon, size: 8 })
}

/**
 * Reads the pricing-relevant store state so the calling computed re-runs
 * when a price revision, priced widget value, or priced input connection
 * changes.
 */
function touchPricingSources(graphId: UUID, node: LGraphNode): void {
  const pricing = useNodePricing()
  const nodeId = node.id
  void pricing.getNodeRevisionRef(nodeId).value

  if (!node.type || !pricing.hasDynamicPricing(node.type)) return
  const widgetStore = useWidgetValueStore()
  for (const name of pricing.getRelevantWidgetNames(node.type)) {
    void widgetStore.getWidget(widgetId(graphId, nodeId, name))?.value
  }
  const linkStore = useLinkStore()
  const inputNames = pricing.getInputNames(node.type)
  const groupPrefixes = pricing.getInputGroupPrefixes(node.type)
  node.inputs?.forEach((input, index) => {
    const relevant =
      (input.name && inputNames.includes(input.name)) ||
      groupPrefixes.some((prefix) => input.name?.startsWith(prefix + '.'))
    if (relevant) void linkStore.isInputSlotConnected(graphId, nodeId, index)
  })
}

/** Promoted widget values on the wrapper override the inner node's own. */
function collectPromotedOverrides(
  wrapper: SubgraphNode,
  innerNode: LGraphNode
): ReadonlyMap<string, unknown> {
  const overrides = new Map<string, unknown>()
  for (const input of wrapper.inputs) {
    if (!input.widgetId) continue
    for (const linkId of input._subgraphSlot?.linkIds ?? []) {
      const link = wrapper.subgraph.getLink(linkId)
      if (link?.target_id !== innerNode.id) continue
      const widgetName = innerNode.inputs[link.target_slot]?.widget?.name
      if (!widgetName) continue
      overrides.set(
        widgetName,
        useWidgetValueStore().getWidget(input.widgetId)?.value
      )
    }
  }
  return overrides
}

/**
 * Aggregates the inner api nodes' credits for a wrapper, tracking their
 * pricing revisions so inner price changes recompute the wrapper.
 */
function gatherSubgraphCredits(wrapper: SubgraphNode): PricingBadgeSources {
  const pricing = useNodePricing()
  const apiLeaves = mapUniqueNodes(wrapper.subgraph, (node) =>
    !node.isSubgraphNode() && node.constructor?.nodeData?.api_node
      ? node
      : undefined
  )
  for (const leaf of apiLeaves) {
    void pricing.getNodeRevisionRef(leaf.id).value
  }

  if (apiLeaves.length !== 1) {
    return { kind: 'subgraph', apiNodeCount: apiLeaves.length, singleLabel: '' }
  }
  const leaf = apiLeaves[0]
  const singleLabel = pricing.getNodeDisplayPrice(
    leaf,
    collectPromotedOverrides(wrapper, leaf)
  )
  return { kind: 'subgraph', apiNodeCount: 1, singleLabel }
}

function gatherPricing(node: LGraphNode): PricingBadgeSources {
  if (node.isSubgraphNode()) return gatherSubgraphCredits(node)
  if (!node.constructor?.nodeData?.api_node) return { kind: 'none' }
  const graphId = node.graph?.rootGraph.id
  if (graphId !== undefined) touchPricingSources(graphId, node)
  return { kind: 'api-node', label: useNodePricing().getNodeDisplayPrice(node) }
}

function gatherSources(node: LGraphNode): BadgeSources {
  const settingStore = useSettingStore()
  const palette = useColorPaletteStore().completedActivePalette
  const def = useNodeDefStore().fromLGraphNode(node)
  const showApiPricing = !!settingStore.get('Comfy.NodeBadge.ShowApiPricing')

  return {
    nodeId: node.id,
    nodeDef: def
      ? {
          isCoreNode: def.isCoreNode,
          lifecycleText: def.nodeLifeCycleBadgeText,
          sourceText: def.nodeSource?.badgeText ?? ''
        }
      : null,
    badgeModes: {
      id: settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode,
      lifecycle: settingStore.get(
        'Comfy.NodeBadge.NodeLifeCycleBadgeMode'
      ) as NodeBadgeMode,
      source: settingStore.get(
        'Comfy.NodeBadge.NodeSourceBadgeMode'
      ) as NodeBadgeMode
    },
    colors: {
      fgColor: palette.colors.litegraph_base.BADGE_FG_COLOR,
      bgColor: palette.colors.litegraph_base.BADGE_BG_COLOR,
      creditsBgColor: palette.light_theme
        ? adjustColor(CREDITS_BASE_BG_COLOR, { lightness: 0.5 })
        : CREDITS_BASE_BG_COLOR
    },
    pricing: showApiPricing ? gatherPricing(node) : { kind: 'none' }
  }
}

const badgeComputeds = new WeakMap<LGraphNode, ComputedRef<BadgeData[]>>()

/**
 * A node's derived badge rows, memoized per node instance and recomputed
 * when a source changes. The computed tracks the graph structure revision
 * so graph-id-keyed sources and subgraph aggregation re-resolve after
 * loads and structural edits. Entries die with their nodes; there is no
 * registration or teardown.
 */
export function nodeBadges(node: LGraphNode): readonly BadgeData[] {
  let rows = badgeComputeds.get(node)
  if (!rows) {
    // Instantiate source stores outside the computed: a store's first
    // instantiation mutates pinia.state and would invalidate it.
    useSettingStore()
    useNodeDefStore()
    useColorPaletteStore()
    useWidgetValueStore()
    useLinkStore()
    rows = computed(() => {
      trackGraphStructure()
      return computeBadges(gatherSources(node))
    })
    badgeComputeds.set(node, rows)
  }
  return rows.value
}

/** Installs {@link nodeBadges} as the legacy canvas's badge row source. */
export function installNodeBadges(): void {
  registerCreditsIcon()
  setBadgeRowsProvider(nodeBadges)
}
