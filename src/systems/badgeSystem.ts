import { trim } from 'es-toolkit'
import { effectScope, watch, watchEffect } from 'vue'
import type { EffectScope } from 'vue'

import { useNodePricing } from '@/composables/node/useNodePricing'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import type { BadgeData } from '@/types/badgeData'
import type { NodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'
import { widgetId } from '@/types/widgetId'
import { adjustColor } from '@/utils/colorUtil'
import type { UUID } from '@/utils/uuid'

/** The badge-relevant projection of a node's definition. */
export interface NodeDefBadgeSources {
  isCoreNode: boolean
  lifecycleText: string
  sourceText: string
}

/**
 * The domain state a node's system-written badges are computed from; see
 * domain-glossary.md § Badges. Plain data so {@link computeBadges} stays
 * pure — the watch shell gathers these from the live stores.
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
  pricing: { isApiNode: boolean; showApiPricing: boolean; priceLabel: string }
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
  const coreTexts = [
    badgeTextVisible(nodeDef, badgeModes.lifecycle)
      ? trim(nodeDef?.lifecycleText ?? '', ['[', ']'])
      : '',
    badgeTextVisible(nodeDef, badgeModes.id) ? `#${nodeId}` : '',
    badgeTextVisible(nodeDef, badgeModes.source)
      ? (nodeDef?.sourceText ?? '')
      : ''
  ]
  const rows: BadgeData[] = coreTexts
    .filter((text) => text.length > 0)
    .map((text) => ({
      kind: 'core',
      text,
      fgColor: colors.fgColor,
      bgColor: colors.bgColor
    }))

  const showCredits =
    pricing.isApiNode && pricing.showApiPricing && pricing.priceLabel.length > 0
  if (showCredits) {
    rows.push({
      kind: 'credits',
      text: pricing.priceLabel,
      iconKey: 'credits',
      fgColor: colors.fgColor,
      bgColor: colors.creditsBgColor
    })
  }
  return rows
}

export interface BadgeSystemOptions {
  graphId: UUID
  resolveNode: (nodeId: NodeId) => LGraphNode | undefined
}

const CREDITS_BASE_BG_COLOR = '#8D6932'

/**
 * Reads the pricing-relevant store state so the calling effect re-runs when
 * a price revision, priced widget value, or priced input connection changes.
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

function gatherSources(
  options: BadgeSystemOptions,
  nodeId: NodeId
): BadgeSources {
  const { graphId, resolveNode } = options
  const settingStore = useSettingStore()
  const palette = useColorPaletteStore().completedActivePalette
  const node = resolveNode(nodeId)
  const def = node ? useNodeDefStore().fromLGraphNode(node) : null
  const isApiNode = !!node?.constructor?.nodeData?.api_node
  const showApiPricing = !!settingStore.get('Comfy.NodeBadge.ShowApiPricing')

  let priceLabel = ''
  if (node && isApiNode && showApiPricing) {
    touchPricingSources(graphId, node)
    priceLabel = useNodePricing().getNodeDisplayPrice(node) ?? ''
  }

  return {
    nodeId,
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
    pricing: { isApiNode, showApiPricing, priceLabel }
  }
}

/**
 * Starts the badge system for one root graph: every node registered in
 * {@link useNodeBadgeStore} gets an effect scope that recomputes its core
 * and credits rows whenever a badge source changes.
 * @returns A disposer stopping every scope the system created.
 */
export function startBadgeSystem(options: BadgeSystemOptions): () => void {
  const badgeStore = useNodeBadgeStore()
  useSettingStore()
  useNodeDefStore()
  useColorPaletteStore()

  const nodeScopes = new Map<NodeId, EffectScope>()

  function watchNodeBadges(nodeId: NodeId): EffectScope {
    const scope = effectScope(true)
    scope.run(() => {
      watchEffect(() => {
        const rows = computeBadges(gatherSources(options, nodeId))
        badgeStore.setBadgesOfKind(
          options.graphId,
          nodeId,
          'core',
          rows.filter((row) => row.kind === 'core')
        )
        badgeStore.setBadgesOfKind(
          options.graphId,
          nodeId,
          'credits',
          rows.filter((row) => row.kind === 'credits')
        )
      })
    })
    return scope
  }

  const systemScope = effectScope(true)
  systemScope.run(() => {
    watch(
      () => badgeStore.registeredNodeIds(options.graphId),
      (nodeIds) => {
        const live = new Set(nodeIds)
        for (const [nodeId, scope] of nodeScopes) {
          if (live.has(nodeId)) continue
          scope.stop()
          nodeScopes.delete(nodeId)
        }
        for (const nodeId of nodeIds) {
          if (!nodeScopes.has(nodeId)) {
            nodeScopes.set(nodeId, watchNodeBadges(nodeId))
          }
        }
      },
      { immediate: true }
    )
  })

  return () => {
    systemScope.stop()
    for (const scope of nodeScopes.values()) scope.stop()
    nodeScopes.clear()
  }
}
