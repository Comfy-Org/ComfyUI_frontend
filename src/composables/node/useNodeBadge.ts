import _ from 'es-toolkit/compat'
import { computed, onMounted, watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'

// Markers stamped on widgets / nodes we've already chain-wrapped with
// the pricing recalculation callback. Re-running useNodeBadge on the
// same widget or node (copy/paste, undo/redo, badge re-init) would
// otherwise stack another wrapper each cycle, multiplying the per-edit
// work by the number of init cycles since the widget/node was created.
const WIDGET_PRICING_PATCHED = Symbol('pricingWidgetPatched')
const NODE_CONN_PRICING_PATCHED = Symbol('pricingNodeConnPatched')
type WidgetWithPatchMark = {
  callback?: (...args: unknown[]) => unknown
  [WIDGET_PRICING_PATCHED]?: true
}
type NodeWithConnPatchMark = {
  [NODE_CONN_PRICING_PATCHED]?: true
}
import { useNodePricing } from '@/composables/node/useNodePricing'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { BadgePosition, LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { NodeBadgeMode } from '@/types/nodeSource'

/**
 * Add LGraphBadge to LGraphNode based on settings.
 *
 * Following badges are added:
 * - Node ID badge
 * - Node source badge
 * - Node life cycle badge
 * - API node credits badge
 */
export const useNodeBadge = () => {
  const settingStore = useSettingStore()
  const extensionStore = useExtensionStore()
  const colorPaletteStore = useColorPaletteStore()
  const priceBadge = usePriceBadge()

  const nodeSourceBadgeMode = computed(
    () =>
      settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') as NodeBadgeMode
  )
  const nodeIdBadgeMode = computed(
    () => settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode
  )
  const nodeLifeCycleBadgeMode = computed(
    () =>
      settingStore.get(
        'Comfy.NodeBadge.NodeLifeCycleBadgeMode'
      ) as NodeBadgeMode
  )

  const showApiPricingBadge = computed(() =>
    settingStore.get('Comfy.NodeBadge.ShowApiPricing')
  )

  watch(
    [
      nodeSourceBadgeMode,
      nodeIdBadgeMode,
      nodeLifeCycleBadgeMode,
      showApiPricingBadge
    ],
    () => {
      app.canvas?.setDirty(true, true)
    }
  )

  const nodeDefStore = useNodeDefStore()
  function badgeTextVisible(
    nodeDef: ComfyNodeDefImpl | null,
    badgeMode: NodeBadgeMode
  ): boolean {
    return !(
      badgeMode === NodeBadgeMode.None ||
      (nodeDef?.isCoreNode && badgeMode === NodeBadgeMode.HideBuiltIn)
    )
  }

  onMounted(() => {
    if (extensionStore.isExtensionInstalled('Comfy.NodeBadge')) return

    // TODO: Fix the composables and watchers being setup in onMounted
    const nodePricing = useNodePricing()

    watch(
      () => nodePricing.pricingRevision.value,
      () => {
        if (!showApiPricingBadge.value) return
        app.canvas?.setDirty(true, true)
      }
    )

    extensionStore.registerExtension({
      name: 'Comfy.NodeBadge',
      nodeCreated(node: LGraphNode) {
        node.badgePosition = BadgePosition.TopRight

        const badge = computed(() => {
          const nodeDef = nodeDefStore.fromLGraphNode(node)
          return new LGraphBadge({
            text: _.truncate(
              [
                badgeTextVisible(nodeDef, nodeIdBadgeMode.value)
                  ? `#${node.id}`
                  : '',
                badgeTextVisible(nodeDef, nodeLifeCycleBadgeMode.value)
                  ? (nodeDef?.nodeLifeCycleBadgeText ?? '')
                  : '',
                badgeTextVisible(nodeDef, nodeSourceBadgeMode.value)
                  ? (nodeDef?.nodeSource?.badgeText ?? '')
                  : ''
              ]
                .filter((s) => s.length > 0)
                .join(' '),
              {
                length: 31
              }
            ),
            fgColor:
              colorPaletteStore.completedActivePalette.colors.litegraph_base
                .BADGE_FG_COLOR,
            bgColor:
              colorPaletteStore.completedActivePalette.colors.litegraph_base
                .BADGE_BG_COLOR
          })
        })

        node.badges.push(() => badge.value)

        if (node.constructor.nodeData?.api_node) {
          // JSONata rules are dynamic if they depend on any widgets/inputs/input_groups
          const pricingConfig = nodePricing.getNodePricingConfig(node)
          const hasDynamicPricing =
            !!pricingConfig &&
            ((pricingConfig.depends_on?.widgets?.length ?? 0) > 0 ||
              (pricingConfig.depends_on?.inputs?.length ?? 0) > 0 ||
              (pricingConfig.depends_on?.input_groups?.length ?? 0) > 0)

          // Watchers are installed regardless of ShowApiPricing because the
          // aggregator (actionbar chip + sign-in dialog) reads pricing even
          // when per-node badges are hidden. Previously this wiring was
          // nested inside the ShowApiPricing guard, so disabling the badge
          // stopped widget/input edits from ever waking the aggregator —
          // dynamic totals went stale until a graph-structure event.
          if (hasDynamicPricing) {
            const relevantWidgetNames = nodePricing.getRelevantWidgetNames(
              node.constructor.nodeData?.name
            )

            if (node.widgets) {
              const widgetsToWatch = node.widgets.filter((w) =>
                relevantWidgetNames.includes(w.name)
              )
              for (const widget of widgetsToWatch) {
                const marked = widget as unknown as WidgetWithPatchMark
                if (marked[WIDGET_PRICING_PATCHED]) continue
                widget.callback = useChainCallback(widget.callback, () => {
                  nodePricing.triggerPriceRecalculation(node)
                  if (showApiPricingBadge.value) {
                    node.graph?.setDirtyCanvas(true, true)
                  }
                })
                marked[WIDGET_PRICING_PATCHED] = true
              }
            }

            const relevantInputs = pricingConfig?.depends_on?.inputs ?? []
            const inputGroupPrefixes =
              pricingConfig?.depends_on?.input_groups ?? []
            const hasRelevantInputs =
              relevantInputs.length > 0 || inputGroupPrefixes.length > 0

            if (hasRelevantInputs) {
              const markedNode = node as unknown as NodeWithConnPatchMark
              if (!markedNode[NODE_CONN_PRICING_PATCHED]) {
                node.onConnectionsChange = useChainCallback(
                  node.onConnectionsChange,
                  function (_type, _slotIndex, _isConnected, _link, ioSlot) {
                    const inputName = ioSlot?.name
                    if (!inputName) return
                    const isRelevantInput =
                      relevantInputs.includes(inputName) ||
                      inputGroupPrefixes.some((prefix) =>
                        inputName.startsWith(prefix + '.')
                      )
                    if (isRelevantInput) {
                      nodePricing.triggerPriceRecalculation(node)
                    }
                  }
                )
                markedNode[NODE_CONN_PRICING_PATCHED] = true
              }
            }
          }

          if (showApiPricingBadge.value) {
            let lastLabel = nodePricing.getNodeDisplayPrice(node)
            let lastBadge = priceBadge.getCreditsBadge(lastLabel)

            const creditsBadgeGetter: () => LGraphBadge = () => {
              const label = nodePricing.getNodeDisplayPrice(node)
              if (label !== lastLabel) {
                lastLabel = label
                lastBadge = priceBadge.getCreditsBadge(label)
              }
              return lastBadge
            }

            node.badges.push(creditsBadgeGetter)
          }
        }
      },
      init() {
        app.canvas.canvas.addEventListener<'litegraph:set-graph'>(
          'litegraph:set-graph',
          () => {
            for (const node of app.canvas.graph?.nodes ?? [])
              priceBadge.updateSubgraphCredits(node)
          }
        )
        app.canvas.canvas.addEventListener<'subgraph-converted'>(
          'subgraph-converted',
          (e) => priceBadge.updateSubgraphCredits(e.detail.subgraphNode)
        )
      },
      afterConfigureGraph() {
        for (const node of app.canvas.graph?.nodes ?? [])
          priceBadge.updateSubgraphCredits(node)
      }
    })
  })
}
