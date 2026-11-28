import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputsExport } from '@/platform/assets/integration/useNodeOutputsExport'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  shouldHideLinkedCoreMediaInputActions,
  shouldHideLinkedCoreMediaInputPreview
} from '@/renderer/extensions/vueNodes/utils/linkedCoreMediaUtils'
import { getExtraOptionsForWidget } from '@/services/litegraphService'
import { getNodeMenuCallbackId } from '@/lib/litegraph/src/types/nodeMenu'
import { clipspace, pasteFromClipspace } from '@/scripts/clipspace'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { isLGraphGroup } from '@/utils/litegraphUtil'

import { buildStructuredMenu } from './contextMenuConverter'
import { useGroupMenuOptions } from './useGroupMenuOptions'
import { useImageMenuOptions } from './useImageMenuOptions'
import { useNodeMenuOptions } from './useNodeMenuOptions'
import { useSelectionMenuOptions } from './useSelectionMenuOptions'
import type { MenuOption } from './menuOption'
import { useSelectionState } from './useSelectionState'

// Global singleton for NodeOptions component reference
let nodeOptionsInstance: null | NodeOptionsInstance = null

const invocationContext = ref<{ nodeId: NodeId; widgetName?: string }>()

/**
 * Toggle the node options popover
 * @param event - The trigger event
 */
export function toggleNodeOptions(event: Event) {
  invocationContext.value = undefined
  if (nodeOptionsInstance?.toggle) {
    nodeOptionsInstance.toggle(event)
  }
}

/**
 * Show the node options popover (always shows, doesn't toggle)
 * Use this for contextmenu events where we always want to show at the new position
 * @param event - The trigger event (must be MouseEvent for position)
 */
export function showNodeOptions(
  event: MouseEvent,
  context?: { nodeId: NodeId; widgetName?: string }
) {
  invocationContext.value = context
  if (nodeOptionsInstance?.show) {
    nodeOptionsInstance.show(event)
  }
}

/**
 * Check if the node options menu is currently open
 */
export function isNodeOptionsOpen(): boolean {
  return nodeOptionsInstance?.isOpen.value ?? false
}

interface NodeOptionsInstance {
  toggle: (event: Event) => void
  show: (event: MouseEvent) => void
  hide: () => void
  isOpen: Ref<boolean>
}

/**
 * Register the NodeOptions component instance
 * @param instance - The NodeOptions component instance
 */
export function registerNodeOptionsInstance(
  instance: null | NodeOptionsInstance
) {
  nodeOptionsInstance = instance
}

export function useMoreOptionsMenu() {
  const { t } = useI18n()
  const {
    selectedItems,
    selectedNodes,
    canOpenNodeInfo,
    openNodeInfo,
    hasSubgraphs: hasSubgraphsComputed,
    hasImageNode,
    hasOutputNodesSelected,
    hasMultipleSelection,
    isSingleNode,
    computeSelectionFlags
  } = useSelectionState()

  const canvasStore = useCanvasStore()
  const nodeOutputStore = useNodeOutputStore()

  const { getImageMenuOptions, getPreviewResolutionOption } =
    useImageMenuOptions()
  const { hasMultipleOutputs } = useNodeOutputsExport()
  const {
    getNodeInfoOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption
  } = useNodeMenuOptions()
  const {
    getFitGroupToNodesOption,
    getGroupColorOptions,
    getGroupModeOptions
  } = useGroupMenuOptions()
  const {
    getBasicSelectionOptions,
    getMultipleNodesOptions,
    getSubgraphOptions,
    getAlignmentOptions,
    getDeleteOption
  } = useSelectionMenuOptions()

  const hasSubgraphs = hasSubgraphsComputed
  const hasMultipleNodes = hasMultipleSelection

  const optionsVersion = ref(0)
  const bump = () => {
    optionsVersion.value++
  }

  const menuOptions = computed((): MenuOption[] => {
    void optionsVersion.value
    const states = computeSelectionFlags()

    const selectedGroups = selectedItems.value.filter(isLGraphGroup)
    const groupContext: LGraphGroup | null =
      selectedGroups.length === 1 && selectedNodes.value.length === 0
        ? selectedGroups[0]
        : null
    const hasSubgraphsSelected = hasSubgraphs.value

    const node: LGraphNode | undefined =
      (invocationContext.value === undefined
        ? undefined
        : canvasStore.currentGraph?.getNodeById(
            invocationContext.value.nodeId
          )) ?? selectedNodes.value.at(0)
    const hideLinkedInputActions = node
      ? shouldHideLinkedCoreMediaInputActions(node)
      : false
    const hideLinkedInputPreview = node
      ? shouldHideLinkedCoreMediaInputPreview(
          node,
          nodeOutputStore.getNodeOutputs(node)
        )
      : false
    const options: MenuOption[] = []

    options.push(...getBasicSelectionOptions())

    if (hasOutputNodesSelected.value) {
      const runBranch = getRunBranchOption()
      options.push(runBranch)
    }
    if (!groupContext) {
      const pin = getPinOption(states, bump)
      const bypass = getBypassOption(bump)
      options.push(pin)
      options.push(bypass)
    }
    if (groupContext) {
      const groupModes = getGroupModeOptions(groupContext, bump)
      options.push(...groupModes)
    }
    options.push(
      ...getSubgraphOptions({
        hasSubgraphs: hasSubgraphsSelected,
        hasMultipleSelection: hasMultipleNodes.value
      })
    )
    if (hasMultipleNodes.value) {
      options.push(...getMultipleNodesOptions())
      options.push(...getAlignmentOptions(node))
    }
    if (groupContext) {
      options.push(getFitGroupToNodesOption(groupContext))
    } else {
      options.push(...getNodeVisualOptions(states, bump))
    }

    if (canOpenNodeInfo.value) {
      options.push(getNodeInfoOption(openNodeInfo))
    }
    if (groupContext) {
      options.push(getGroupColorOptions(groupContext, bump))
    }

    if (node?.hasAdvancedWidgets()) {
      options.push({
        id: 'advanced',
        label: node.showAdvanced
          ? t('contextMenu.Hide Advanced')
          : t('contextMenu.Show Advanced'),
        action: () => {
          node.graph?.beforeChange()
          for (const selected of selectedNodes.value) selected.toggleAdvanced()
          node.graph?.afterChange()
          bump()
        }
      })
    }
    if (node instanceof SubgraphNode) {
      options.push({
        id: 'editSubgraphWidgets',
        label: t('contextMenu.Edit Subgraph Widgets'),
        action: () => usePropertiesPanelStore().openPanel('subgraph')
      })
    }
    if (
      node &&
      !hideLinkedInputActions &&
      !clipspace.returnNode &&
      clipspace.current !== null
    ) {
      options.push({
        id: 'pasteClipspace',
        label: t('contextMenu.Paste (Clipspace)'),
        action: () => pasteFromClipspace(node)
      })
    }

    if (
      (hasImageNode.value && selectedNodes.value.length > 0) ||
      (isSingleNode.value && hasMultipleOutputs(selectedNodes.value[0]))
    ) {
      options.push(
        ...getImageMenuOptions(selectedNodes.value[0], {
          input: !hideLinkedInputActions,
          preview: !hideLinkedInputPreview
        })
      )
    }
    const previewResolutionOption =
      isSingleNode.value && !hideLinkedInputPreview
        ? getPreviewResolutionOption(selectedNodes.value[0])
        : undefined
    if (previewResolutionOption) options.push(previewResolutionOption)
    const widgetName = invocationContext.value?.widgetName
    const widget = node?.widgets?.find((w) => w.name === widgetName)
    if (node && widget) {
      const widgetOptions = getExtraOptionsForWidget(node, widget).map(
        (item) => {
          const callback = item.callback
          return {
            id: callback
              ? (getNodeMenuCallbackId(callback) ?? undefined)
              : undefined,
            label: item.content,
            disabled: item.disabled,
            action: callback
              ? () => Reflect.apply(callback, undefined, [])
              : undefined
          }
        }
      )
      options.push(...widgetOptions)
    }

    options.push(
      getDeleteOption(
        selectedNodes.value.some(
          (node) => node.removable === false || node.block_delete
        )
      )
    )

    return buildStructuredMenu(options, t('contextMenu.Extensions'))
  })

  const menuOptionsWithSubmenu = computed(() =>
    menuOptions.value.filter((option) => option.hasSubmenu && option.submenu)
  )

  return {
    menuOptions,
    invocationContext,
    menuOptionsWithSubmenu,
    bump,
    hasSubgraphs,
    registerNodeOptionsInstance
  }
}
