import type { TooltipDirectivePassThroughOptions } from 'primevue'
import { type MaybeRef, type Ref, computed, unref, watch } from 'vue'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import { st } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

/**
 * Hide all visible tooltips by finding them via class and dispatching mouseleave
 * Tooltips only exist in DOM when visible, so we can query them directly
 */
const hideTooltipsGlobally = () => {
  // Get all visible tooltip elements (PrimeVue uses .p-tooltip class)
  const tooltips = document.querySelectorAll('.p-tooltip')

  // Early return if no tooltips are visible - avoid unnecessary work
  if (tooltips.length === 0) return

  tooltips.forEach((tooltipEl) => {
    const tooltipId = tooltipEl.id
    if (!tooltipId) return

    // Find the target element that owns this tooltip
    const targetElements = document.querySelectorAll('[data-pd-tooltip="true"]')
    for (const targetEl of targetElements) {
      if ((targetEl as any).$_ptooltipId === tooltipId) {
        ;(targetEl as HTMLElement).dispatchEvent(
          new MouseEvent('mouseleave', { bubbles: true })
        )
        break
      }
    }
  })
}

// Global tooltip hiding system
const globalTooltipState = { watchersSetup: false }

function setupGlobalTooltipHiding() {
  if (globalTooltipState.watchersSetup) return

  // Watch isDraggingVueNodes from useNodePointerInteractions
  // This tracks when ANY node is being dragged (set by pointerHandlers in useNodePointerInteractions)
  // When dragging starts, hide all tooltips immediately
  watch(
    () => layoutStore.isDraggingVueNodes.value,
    (isDragging) => {
      if (isDragging) {
        hideTooltipsGlobally()
      }
    }
  )

  // Hide on any pointerdown (immediate click hiding)
  // This catches clicks that don't result in drags
  document.addEventListener('pointerdown', hideTooltipsGlobally)

  // Hide on wheel/scroll (for zoom operations)
  // Use capture phase to catch wheel events before they reach canvas/nodes
  window.addEventListener('wheel', hideTooltipsGlobally, {
    capture: true,
    passive: true
  })

  globalTooltipState.watchersSetup = true
}

/**
 * Composable for managing Vue node tooltips
 * Provides tooltip text for node headers, slots, and widgets
 */
export function useNodeTooltips(
  nodeType: MaybeRef<string>,
  containerRef?: Ref<HTMLElement | undefined>
) {
  const nodeDefStore = useNodeDefStore()
  const settingsStore = useSettingStore()

  // Setup global pointerdown listener once
  setupGlobalTooltipHiding()

  // Check if tooltips are globally enabled
  const tooltipsEnabled = computed(() =>
    settingsStore.get('Comfy.EnableTooltips')
  )

  // Get node definition for tooltip data
  const nodeDef = computed(() => nodeDefStore.nodeDefsByName[unref(nodeType)])

  /**
   * Get tooltip text for node description (header hover)
   */
  const getNodeDescription = computed(() => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.description`
    return st(key, nodeDef.value.description || '')
  })

  /**
   * Get tooltip text for input slots
   */
  const getInputSlotTooltip = (slotName: string) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.inputs.${normalizeI18nKey(slotName)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[slotName]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  /**
   * Get tooltip text for output slots
   */
  const getOutputSlotTooltip = (slotIndex: number) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.outputs.${slotIndex}.tooltip`
    const outputTooltip = nodeDef.value.outputs?.[slotIndex]?.tooltip ?? ''
    return st(key, outputTooltip)
  }

  /**
   * Get tooltip text for widgets
   */
  const getWidgetTooltip = (widget: SafeWidgetData) => {
    if (!tooltipsEnabled.value || !nodeDef.value) return ''

    // First try widget-specific tooltip
    const widgetTooltip = (widget as { tooltip?: string }).tooltip
    if (widgetTooltip) return widgetTooltip

    // Then try input-based tooltip lookup
    const key = `nodeDefs.${normalizeI18nKey(unref(nodeType))}.inputs.${normalizeI18nKey(widget.name)}.tooltip`
    const inputTooltip = nodeDef.value.inputs?.[widget.name]?.tooltip ?? ''
    return st(key, inputTooltip)
  }

  /**
   * Create tooltip configuration object for v-tooltip directive
   * Includes automatic pointerdown-to-hide behavior
   */
  const createTooltipConfig = (text: string) => {
    const tooltipDelay = settingsStore.get('LiteGraph.Node.TooltipDelay')
    const tooltipText = text || ''

    const config: {
      value: string
      showDelay: number
      hideDelay: number
      disabled: boolean
      appendTo?: HTMLElement
      pt?: TooltipDirectivePassThroughOptions
    } = {
      value: tooltipText,
      showDelay: tooltipDelay as number,
      hideDelay: 0, // Immediate hiding
      disabled:
        !tooltipsEnabled.value ||
        !tooltipText ||
        layoutStore.isDraggingVueNodes.value,
      pt: {
        text: {
          class:
            'border-sand-100 bg-pure-white dark-theme:bg-charcoal-800 border dark-theme:border-slate-300 rounded-md px-4 py-2 text-charcoal-700 dark-theme:text-pure-white text-sm font-normal leading-tight max-w-75 shadow-none'
        },
        arrow: ({ context }) => ({
          class: cn(
            context?.top && 'border-t-sand-100 dark-theme:border-t-slate-300',
            context?.bottom &&
              'border-b-sand-100 dark-theme:border-b-slate-300',
            context?.left && 'border-l-sand-100 dark-theme:border-l-slate-300',
            context?.right && 'border-r-sand-100 dark-theme:border-r-slate-300'
          )
        })
      }
    }

    // If we have a container reference, append tooltips to it
    if (containerRef?.value) {
      config.appendTo = containerRef.value
    }

    return config
  }

  return {
    tooltipsEnabled,
    getNodeDescription,
    getInputSlotTooltip,
    getOutputSlotTooltip,
    getWidgetTooltip,
    createTooltipConfig
  }
}
