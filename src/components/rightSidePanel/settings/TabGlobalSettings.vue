<script setup lang="ts">
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import InputSlider from '@/components/common/InputSlider.vue'
import Button from '@/components/ui/button/Button.vue'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogService } from '@/services/dialogService'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import SidePanelSearch from '../layout/SidePanelSearch.vue'

const { t } = useI18n()
const settingStore = useSettingStore()
const dialogService = useDialogService()

const searchQuery = ref('')

// NODES settings
const showAdvancedParameters = ref(false) // Placeholder for future implementation

const showInfoBadges = computed({
  get: () => settingStore.get('Comfy.NodeBadge.ShowApiPricing'),
  set: (value) => settingStore.set('Comfy.NodeBadge.ShowApiPricing', value)
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

const linkShapeOptions = [
  { value: LinkMarkerShape.None, label: 'None' },
  { value: LinkMarkerShape.Circle, label: 'Circle' },
  { value: LinkMarkerShape.Arrow, label: 'Arrow' }
]

const showConnectedLinks = computed({
  get: () => settingStore.get('Comfy.LinkRenderMode') !== LiteGraph.HIDDEN_LINK,
  set: (value) => {
    const newMode = value ? LiteGraph.SPLINE_LINK : LiteGraph.HIDDEN_LINK
    settingStore.set('Comfy.LinkRenderMode', newMode)
  }
})

function openFullSettings() {
  dialogService.showSettingsDialog()
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Search -->
    <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
      <SidePanelSearch
        v-model="searchQuery"
        :placeholder="t('rightSidePanel.globalSettings.searchPlaceholder')"
      />
    </div>

    <!-- NODES Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.nodes') }}
      </template>
      <div class="space-y-3 px-4 text-sm">
        <!-- Show advanced parameters -->
        <div class="flex items-center justify-between">
          <span
            v-tooltip.top="{
              value: t('rightSidePanel.globalSettings.showAdvancedTooltip'),
              showDelay: 300
            }"
            class="text-muted-foreground"
          >
            {{ t('rightSidePanel.globalSettings.showAdvanced') }}
          </span>
          <ToggleSwitch v-model="showAdvancedParameters" />
        </div>

        <!-- Show info badges -->
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.showInfoBadges') }}
          </span>
          <ToggleSwitch v-model="showInfoBadges" />
        </div>

        <!-- Show toolbox on selection -->
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.showToolbox') }}
          </span>
          <ToggleSwitch v-model="showToolbox" />
        </div>

        <!-- Nodes 2.0 -->
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.nodes2') }}
          </span>
          <ToggleSwitch v-model="nodes2Enabled" />
        </div>
      </div>
    </PropertiesAccordionItem>

    <!-- CANVAS Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.canvas') }}
      </template>
      <div class="space-y-3 px-4 text-sm">
        <!-- Grid spacing -->
        <div class="flex flex-col gap-2">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.gridSpacing') }}
          </span>
          <InputSlider
            v-model="gridSpacing"
            :min="1"
            :max="100"
            :step="1"
            slider-class="flex-1"
            input-class="w-20"
          />
        </div>

        <!-- Snap nodes to grid -->
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.snapNodesToGrid') }}
          </span>
          <ToggleSwitch v-model="snapToGrid" />
        </div>
      </div>
    </PropertiesAccordionItem>

    <!-- CONNECTION LINKS Section -->
    <PropertiesAccordionItem class="border-b border-interface-stroke">
      <template #label>
        {{ t('rightSidePanel.globalSettings.connectionLinks') }}
      </template>
      <div class="space-y-3 px-4 text-sm">
        <!-- Link shape -->
        <div class="flex flex-col gap-2">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.linkShape') }}
          </span>
          <Select
            v-model="linkShape"
            :options="linkShapeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>

        <!-- Show connected links -->
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">
            {{ t('rightSidePanel.globalSettings.showConnectedLinks') }}
          </span>
          <ToggleSwitch v-model="showConnectedLinks" />
        </div>
      </div>
    </PropertiesAccordionItem>

    <!-- View all settings button -->
    <div
      class="flex items-center justify-center p-4 border-b border-interface-stroke"
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
