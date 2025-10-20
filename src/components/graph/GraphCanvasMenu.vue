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
      class="absolute right-0 bottom-0 z-[1200] flex-row gap-1 border-[1px] border-node-border bg-interface-panel-surface p-2"
      :style="stringifiedMinimapStyles.buttonGroupStyles"
      @wheel="canvasInteractions.handleWheel"
    >
      <CanvasModeSelector
        :button-styles="stringifiedMinimapStyles.buttonStyles"
      />

      <div class="h-[27px] w-[1px] self-center bg-node-divider" />

      <Button
        v-tooltip.top="fitViewTooltip"
        severity="secondary"
        icon="pi pi-expand"
        :aria-label="fitViewTooltip"
        :style="stringifiedMinimapStyles.buttonStyles"
        class="h-8 w-8 bg-interface-panel-surface p-0 hover:bg-button-hover-surface!"
        @click="() => commandStore.execute('Comfy.Canvas.FitView')"
      >
        <template #icon>
          <i class="icon-[lucide--focus] h-4 w-4" />
        </template>
      </Button>

      <Button
        ref="zoomButton"
        v-tooltip.top="t('zoomControls.label')"
        severity="secondary"
        :label="t('zoomControls.label')"
        :class="zoomButtonClass"
        :aria-label="t('zoomControls.label')"
        data-testid="zoom-controls-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        @click="toggleModal"
      >
        <span class="inline-flex items-center gap-1 px-2 text-xs">
          <span>{{ canvasStore.appScalePercentage }}%</span>
          <i class="icon-[lucide--chevron-down] h-4 w-4" />
        </span>
      </Button>

      <div class="h-[27px] w-[1px] self-center bg-node-divider" />

      <Button
        ref="minimapButton"
        v-tooltip.top="minimapTooltip"
        severity="secondary"
        :aria-label="minimapTooltip"
        data-testid="toggle-minimap-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        :class="minimapButtonClass"
        @click="() => commandStore.execute('Comfy.Canvas.ToggleMinimap')"
      >
        <template #icon>
          <i class="icon-[lucide--map] h-4 w-4" />
        </template>
      </Button>

      <Button
        v-tooltip.top="{
          value: linkVisibilityTooltip,
          pt: {
            root: {
              style: 'z-index: 2; transform: translateY(-20px);'
            }
          }
        }"
        severity="secondary"
        :class="linkVisibleClass"
        :aria-label="linkVisibilityAriaLabel"
        data-testid="toggle-link-visibility-button"
        :style="stringifiedMinimapStyles.buttonStyles"
        @click="() => commandStore.execute('Comfy.Canvas.ToggleLinkVisibility')"
      >
        <template #icon>
          <i class="icon-[lucide--route-off] h-4 w-4" />
        </template>
      </Button>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useZoomControls } from '@/composables/useZoomControls'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
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
const zoomButtonClass = computed(() => [
  'bg-interface-panel-surface',
  isModalVisible.value ? 'not-active:bg-button-active-surface!' : '',
  'hover:bg-button-hover-surface!',
  'p-0',
  'h-8',
  'w-15'
])

const minimapButtonClass = computed(() => ({
  'bg-interface-panel-surface': true,
  'hover:bg-button-hover-surface!': true,
  'not-active:bg-button-active-surface!': settingStore.get(
    'Comfy.Minimap.Visible'
  ),
  'p-0': true,
  'w-8': true,
  'h-8': true
}))

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
const linkVisibleClass = computed(() => [
  'bg-interface-panel-surface',
  linkHidden.value ? 'not-active:bg-button-active-surface!' : '',
  'hover:bg-button-hover-surface!',
  'p-0',
  'w-8',
  'h-8'
])

onMounted(() => {
  canvasStore.initScaleSync()
})

onBeforeUnmount(() => {
  canvasStore.cleanupScaleSync()
})
</script>
