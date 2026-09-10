<template>
  <div>
    <ZoomControlsModal :visible="isModalVisible" @close="hideModal" />

    <!-- Backdrop -->
    <div
      v-if="hasActivePopup"
      class="fixed inset-0 z-1200"
      @click="hideModal"
    ></div>

    <ButtonGroup
      role="toolbar"
      :aria-label="t('graphCanvasMenu.canvasToolbar')"
      class="absolute right-0 bottom-0 z-1200 flex-row gap-1 border border-interface-stroke bg-comfy-menu-bg p-2"
      :style="{
        ...stringifiedMinimapStyles.buttonGroupStyles
      }"
      @wheel="canvasInteractions.handleWheel"
    >
      <CanvasModeSelector
        :button-styles="stringifiedMinimapStyles.buttonStyles"
      />

      <div class="h-[27px] w-px self-center bg-node-divider" />

      <Tooltip :config="fitViewTooltip" side="top">
        <Button
          variant="secondary"
          :aria-label="fitViewTooltip"
          :style="stringifiedMinimapStyles.buttonStyles"
          class="size-8 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface"
          @click="() => commandStore.execute('Comfy.Canvas.FitView')"
        >
          <i class="icon-[lucide--focus] size-4" aria-hidden="true" />
        </Button>
      </Tooltip>

      <Tooltip :config="t('zoomControls.label')" side="top">
        <Button
          variant="secondary"
          :class="zoomButtonClass"
          :aria-label="t('zoomControls.label')"
          data-testid="zoom-controls-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          @click="toggleModal"
        >
          <span class="inline-flex items-center gap-1 px-2 text-xs">
            <span>{{ canvasStore.appScalePercentage }}%</span>
            <i class="icon-[lucide--chevron-down] size-4" aria-hidden="true" />
          </span>
        </Button>
      </Tooltip>

      <div class="h-[27px] w-px self-center bg-node-divider" />

      <Tooltip :config="minimapTooltip" side="top">
        <Button
          variant="secondary"
          :aria-label="minimapTooltip"
          data-testid="toggle-minimap-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          :class="minimapButtonClass"
          @click="onMinimapToggleClick"
        >
          <i class="icon-[lucide--map] size-4" aria-hidden="true" />
        </Button>
      </Tooltip>

      <Tooltip :config="linkVisibilityTooltip" side="top" :side-offset="26">
        <Button
          variant="secondary"
          :class="linkVisibleClass"
          :aria-label="linkVisibilityAriaLabel"
          data-testid="toggle-link-visibility-button"
          :style="stringifiedMinimapStyles.buttonStyles"
          @click="onLinkVisibilityToggleClick"
        >
          <i class="icon-[lucide--route-off] size-4" aria-hidden="true" />
        </Button>
      </Tooltip>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useZoomControls } from '@/composables/useZoomControls'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useCommandStore } from '@/stores/commandStore'

import CanvasModeSelector from './CanvasModeSelector.vue'
import ZoomControlsModal from './modals/ZoomControlsModal.vue'

const { t } = useI18n()
const commandStore = useCommandStore()
const { formatKeySequence } = useCommandStore()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const canvasInteractions = useCanvasInteractions()
const minimap = useMinimap()

const { isModalVisible, toggleModal, hideModal, hasActivePopup } =
  useZoomControls()

const stringifiedMinimapStyles = computed(() => {
  const buttonGroupKeys = ['borderRadius']
  const buttonKeys = ['borderRadius']
  const additionalButtonStyles = {
    border: 'none'
  }

  const containerStyles = minimap.containerStyles.value

  const buttonStyles = {
    ...Object.fromEntries(
      Object.entries(containerStyles).filter(([key]) =>
        buttonKeys.includes(key)
      )
    ),
    ...additionalButtonStyles
  }
  const buttonGroupStyles = Object.entries(containerStyles)
    .filter(([key]) => buttonGroupKeys.includes(key))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  return { buttonStyles, buttonGroupStyles }
})

// Computed properties for reactive states
const linkHidden = computed(
  () => settingStore.get('Comfy.LinkRenderMode') === LiteGraph.HIDDEN_LINK
)

// Computed properties for command text
const fitViewCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.FitView')
  ).toUpperCase()
)
const minimapCommandText = computed(() =>
  formatKeySequence(
    commandStore.getCommand('Comfy.Canvas.ToggleMinimap')
  ).toUpperCase()
)

// Computed properties for button classes and states
const zoomButtonClass = computed(() =>
  cn(
    'h-8 w-15 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface',
    isModalVisible.value && 'not-active:bg-interface-panel-selected-surface'
  )
)

const minimapButtonClass = computed(() =>
  cn(
    'size-8 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface',
    settingStore.get('Comfy.Minimap.Visible') &&
      'not-active:bg-interface-panel-selected-surface'
  )
)

// Computed properties for tooltip and aria-label texts
const fitViewTooltip = computed(() => {
  const label = t('graphCanvasMenu.fitView')
  const shortcut = fitViewCommandText.value
  return shortcut ? `${label} (${shortcut})` : label
})
const minimapTooltip = computed(() => {
  const label = settingStore.get('Comfy.Minimap.Visible')
    ? t('zoomControls.hideMinimap')
    : t('zoomControls.showMinimap')
  const shortcut = minimapCommandText.value
  return shortcut ? `${label} (${shortcut})` : label
})
const linkVisibilityTooltip = computed(() =>
  linkHidden.value
    ? t('graphCanvasMenu.showLinks')
    : t('graphCanvasMenu.hideLinks')
)
const linkVisibilityAriaLabel = computed(() =>
  linkHidden.value
    ? t('graphCanvasMenu.showLinks')
    : t('graphCanvasMenu.hideLinks')
)
const linkVisibleClass = computed(() =>
  cn(
    'size-8 bg-comfy-menu-bg p-0 hover:bg-interface-button-hover-surface',
    linkHidden.value && 'not-active:bg-interface-panel-selected-surface'
  )
)

onMounted(() => {
  canvasStore.initScaleSync()
})

/**
 * Track minimap toggle button click and execute the command.
 */
const onMinimapToggleClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_menu_minimap_toggle_clicked',
    element_group: 'graph_menu'
  })
  void commandStore.execute('Comfy.Canvas.ToggleMinimap')
}

/**
 * Track hide/show links button click and execute the command.
 */
const onLinkVisibilityToggleClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'graph_menu_hide_links_toggle_clicked',
    element_group: 'graph_menu'
  })
  void commandStore.execute('Comfy.Canvas.ToggleLinkVisibility')
}

onBeforeUnmount(() => {
  canvasStore.cleanupScaleSync()
})
</script>
