<template>
  <div class="flex flex-col gap-2">
    <label class="flex items-center gap-2">
      {{ $t('sideToolbar.queueTab.filters.hideCached') }}
      <ToggleSwitch v-model="hideCached" />
    </label>
    <label class="flex items-center gap-2">
      {{ $t('sideToolbar.queueTab.filters.hideCanceled') }}
      <ToggleSwitch v-model="hideCanceled" />
    </label>
    <span class="mt-2">Hide Node Types:</span>
    <MultiSelect
      class="w-48 min-w-48 max-w-48"
      v-model="hideNodeTypes"
      filter
      optionLabel="display_name"
      optionValue="name"
      :options="outputNodes"
      :maxSelectedLabels="2"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from 'primevue/toggleswitch'
import MultiSelect from 'primevue/multiselect'
import { useSettingStore } from '@/stores/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
const SETTING_FILTER = 'Comfy.Queue.Filter'

const { t } = useI18n()
const settingStore = useSettingStore()
const nodeDefStore = useNodeDefStore()
const filter = settingStore.get(SETTING_FILTER) ?? {}

const createCompute = (k: string) =>
  computed({
    get() {
      return filter[k]
    },
    set(value) {
      filter[k] = value
      settingStore.set(SETTING_FILTER, filter)
    }
  })

const hideCached = createCompute('hideCached')
const hideCanceled = createCompute('hideCanceled')
const hideNodeTypes = createCompute('hideNodeTypes')

const outputNodes = nodeDefStore.visibleNodeDefs.filter(
  (def) => def.isOutputNode
)
</script>
