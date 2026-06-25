<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { computed, ref, watch, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { WidgetInputBaseClass } from '@/renderer/extensions/vueNodes/widgets/components/layout'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { cn } from '@comfyorg/tailwind-utils'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import FieldSwitch from './FieldSwitch.vue'
import LayoutField from './LayoutField.vue'

import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const { t } = useI18n()
const settingStore = useSettingStore()
const settingsDialog = useSettingsDialog()
const rightSidePanelStore = useRightSidePanelStore()
const colorPaletteStore = useColorPaletteStore()

const isHighlightingAdvanced = ref(false)
let highlightTimeout: ReturnType<typeof setTimeout> | null = null
let resetTimeout: ReturnType<typeof setTimeout> | null = null

function triggerHighlightAnimation() {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout)
    highlightTimeout = null
  }
  if (resetTimeout) {
    clearTimeout(resetTimeout)
    resetTimeout = null
  }

  isHighlightingAdvanced.value = false

  resetTimeout = setTimeout(() => {
    isHighlightingAdvanced.value = true
    resetTimeout = null

    highlightTimeout = setTimeout(() => {
      isHighlightingAdvanced.value = false
      highlightTimeout = null
    }, 900)
  }, 30)

  rightSidePanelStore.clearHighlight()
}

onScopeDispose(() => {
  if (highlightTimeout) clearTimeout(highlightTimeout)
  if (resetTimeout) clearTimeout(resetTimeout)
})

watch(
  () => rightSidePanelStore.highlightGlobalSetting,
  (newVal) => {
    if (newVal === 'Comfy.Node.AlwaysShowAdvancedWidgets') {
      triggerHighlightAnimation()
    }
  },
  { immediate: true }
)

// NODES settings
const showAdvancedParameters = computed({
  get: () => settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets'),
  set: (value) =>
    settingStore.set('Comfy.Node.AlwaysShowAdvancedWidgets', value)
})

const showToolbox = computed({
  get: () => settingStore.get('Comfy.Canvas.SelectionToolbox'),
  set: (value) => settingStore.set('Comfy.Canvas.SelectionToolbox', value)
})

const nodes2Enabled = computed({
  get: () => settingStore.get('Comfy.VueNodes.Enabled'),
  set: (value) => settingStore.set('Comfy.VueNodes.Enabled', value)
})

// CANVAS settings
const gridSpacing = computed({
  get: () => settingStore.get('Comfy.SnapToGrid.GridSize'),
  set: (value) => settingStore.set('Comfy.SnapToGrid.GridSize', value)
})

const snapToGrid = computed({
  get: () => settingStore.get('pysssss.SnapToGrid'),
  set: (value) => settingStore.set('pysssss.SnapToGrid', value)
})

// CONNECTION LINKS settings
const linkShape = computed({
  get: () => settingStore.get('Comfy.Graph.LinkMarkers'),
  set: (value) => settingStore.set('Comfy.Graph.LinkMarkers', value)
})

const linkShapeOptions = computed(() => [
  { value: LinkMarkerShape.None, label: t('g.none') },
  { value: LinkMarkerShape.Circle, label: t('shape.circle') },
  { value: LinkMarkerShape.Arrow, label: t('shape.arrow') }
])

let theOldLinkRenderMode: LinkRenderType = LiteGraph.SPLINE_LINK
const showConnectedLinks = computed({
  get: () => settingStore.get('Comfy.LinkRenderMode') !== LiteGraph.HIDDEN_LINK,
  set: (value) => {
    let oldLinkRenderMode = settingStore.get('Comfy.LinkRenderMode')
    if (oldLinkRenderMode !== LiteGraph.HIDDEN_LINK) {
      theOldLinkRenderMode = oldLinkRenderMode
    }
    const newMode = value ? theOldLinkRenderMode : LiteGraph.HIDDEN_LINK
    settingStore.set('Comfy.LinkRenderMode', newMode)
  }
})

const GRID_SIZE_MIN = 1
const GRID_SIZE_MAX = 100
const GRID_SIZE_STEP = 1

function updateGridSpacingFromSlider(values?: number[]) {
  if (!values?.length) return
  gridSpacing.value = values[0]
}

function updateGridSpacingFromInput(value: number | null | undefined) {
  if (typeof value !== 'number') return

  const clampedValue = Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, value))
  gridSpacing.value = Math.round(clampedValue / GRID_SIZE_STEP) * GRID_SIZE_STEP
}

function openFullSettings() {
  settingsDialog.show()
}
</script>

<template>
  <div class="flex flex-col border-t border-interface-stroke">
    <!-- NODES Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.nodes') }}
      </template>
      <div class="space-y-4 px-4 py-3">
        <FieldSwitch
          v-model="showAdvancedParameters"
          :label="t('rightSidePanel.globalSettings.showAdvanced')"
          :tooltip="t('settings.Comfy_Node_AlwaysShowAdvancedWidgets.tooltip')"
          :class="{ 'animate-highlight': isHighlightingAdvanced }"
          :data-theme="colorPaletteStore.activePaletteId"
        />
        <FieldSwitch
          v-model="showToolbox"
          :label="t('rightSidePanel.globalSettings.showToolbox')"
          :tooltip="t('settings.Comfy_Canvas_SelectionToolbox.tooltip')"
        />
        <FieldSwitch
          v-model="nodes2Enabled"
          :label="t('rightSidePanel.globalSettings.nodes2')"
          :tooltip="t('settings.Comfy_VueNodes_Enabled.tooltip')"
        />
      </div>
    </PropertiesAccordionItem>

    <!-- CANVAS Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.canvas') }}
      </template>
      <div class="space-y-4 px-4 py-3">
        <LayoutField :label="t('rightSidePanel.globalSettings.gridSpacing')">
          <div
            :class="
              cn(WidgetInputBaseClass, 'flex items-center gap-2 pr-2 pl-3')
            "
          >
            <Slider
              :model-value="[gridSpacing]"
              class="grow text-xs"
              :min="GRID_SIZE_MIN"
              :max="GRID_SIZE_MAX"
              :step="GRID_SIZE_STEP"
              @update:model-value="updateGridSpacingFromSlider"
            />
            <InputNumber
              :model-value="gridSpacing"
              class="w-16"
              size="small"
              pt:pc-input-text:root="min-w-[4ch] bg-transparent border-none text-center truncate"
              :min="GRID_SIZE_MIN"
              :max="GRID_SIZE_MAX"
              :step="GRID_SIZE_STEP"
              :allow-empty="false"
              @update:model-value="updateGridSpacingFromInput"
            />
          </div>
        </LayoutField>
        <FieldSwitch
          v-model="snapToGrid"
          :label="t('rightSidePanel.globalSettings.snapNodesToGrid')"
          :tooltip="t('settings.pysssss_SnapToGrid.tooltip')"
        />
      </div>
    </PropertiesAccordionItem>

    <!-- CONNECTION LINKS Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.connectionLinks') }}
      </template>
      <div class="space-y-4 px-4 py-3">
        <LayoutField :label="t('rightSidePanel.globalSettings.linkShape')">
          <Select
            v-model="linkShape"
            :options="linkShapeOptions"
            :aria-label="t('rightSidePanel.globalSettings.linkShape')"
            :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
            size="small"
            :pt="{
              option: 'text-xs',
              dropdown: 'w-8',
              label: cn('min-w-[4ch] truncate', $slots.default && 'mr-5'),
              overlay: 'w-fit min-w-full'
            }"
            data-capture-wheel="true"
            option-label="label"
            option-value="value"
          />
        </LayoutField>
        <FieldSwitch
          v-model="showConnectedLinks"
          :label="t('rightSidePanel.globalSettings.showConnectedLinks')"
          :tooltip="t('settings.Comfy_LinkRenderMode.tooltip')"
        />
      </div>
    </PropertiesAccordionItem>

    <!-- View all settings button -->
    <div
      class="flex items-center justify-center border-b border-interface-stroke p-4"
    >
      <Button
        variant="muted-textonly"
        size="sm"
        class="gap-2 text-sm"
        @click="openFullSettings"
      >
        {{ t('rightSidePanel.globalSettings.viewAllSettings') }}
        <i class="icon-[lucide--settings] size-4" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes highlight-animation {
  0% {
    background-color: transparent;
    box-shadow: 0 0 0 6px transparent;
    border-radius: 4px;
  }
  6%,
  63% {
    background-color: var(--highlight-color);
    box-shadow: 0 0 0 6px var(--highlight-color);
    border-radius: 4px;
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 6px transparent;
    border-radius: 4px;
  }
}

.animate-highlight {
  --highlight-color: color-mix(
    in srgb,
    var(--p-primary-color) 35%,
    transparent
  );
  --highlight-text-color: #ffffff;
  animation: highlight-animation 0.9s ease-out;
}

[data-theme='solarized'].animate-highlight {
  --highlight-color: rgb(0 0 0 / 0.45);
}

[data-theme='arc'].animate-highlight {
  --highlight-color: rgb(82 148 226 / 0.45);
}

[data-theme='github'].animate-highlight {
  --highlight-color: rgb(9 105 218 / 0.45);
}

[data-theme='light'].animate-highlight {
  --highlight-text-color: #111827;
}

@keyframes highlight-text-flash {
  6%,
  63% {
    color: var(--highlight-text-color);
  }
}

.animate-highlight :deep(span) {
  animation: highlight-text-flash 0.9s ease-out;
}
</style>
