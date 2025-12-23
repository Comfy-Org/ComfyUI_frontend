<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import InputSlider from '@/components/common/InputSlider.vue'
import { useSettingStore } from '@/platform/settings/settingStore'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'

const { t } = useI18n()
const settingStore = useSettingStore()

// NODES settings
const showInfoBadges = computed({
  get: () => settingStore.get('Comfy.NodeBadge.ShowApiPricing'),
  set: (value) => settingStore.set('Comfy.NodeBadge.ShowApiPricing', value)
})

const showToolbox = computed({
  get: () => settingStore.get('Comfy.Canvas.SelectionToolbox'),
  set: (value) => settingStore.set('Comfy.Canvas.SelectionToolbox', value)
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
</script>

<template>
  <div class="flex flex-col">
    <!-- NODES Section -->
    <PropertiesAccordionItem>
      <template #label>
        {{ t('rightSidePanel.globalSettings.nodes') }}
      </template>
      <div class="space-y-3 px-4 text-sm">
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
      </div>
    </PropertiesAccordionItem>

    <!-- CANVAS Section -->
    <PropertiesAccordionItem>
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
  </div>
</template>
