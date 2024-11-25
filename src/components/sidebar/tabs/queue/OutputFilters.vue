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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ToggleSwitch from 'primevue/toggleswitch'
import { useSettingStore } from '@/stores/settingStore'
const SETTING_FILTER = 'Comfy.Queue.Filter'

const settingStore = useSettingStore()
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
</script>
