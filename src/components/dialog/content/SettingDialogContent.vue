<template>
  <table class="comfy-modal-content comfy-table">
    <tbody>
      <tr v-for="setting in sortedSettings" :key="setting.id">
        <td>
          <span>
            {{ setting.name }}
          </span>
          <Chip
            v-if="setting.tooltip"
            icon="pi pi-info-circle"
            severity="secondary"
            v-tooltip="setting.tooltip"
            class="info-chip"
          />
        </td>
        <td>
          <component
            :is="getSettingComponent(setting)"
            :id="setting.id"
            :value="settingStore.get(setting.id)"
            @update:value="settingStore.set(setting.id, $event)"
            v-bind="setting.attrs"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import Chip from 'primevue/chip'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'

const settingStore = useSettingStore()
const sortedSettings = computed<SettingParams[]>(() => {
  return Object.values(settingStore.settings)
    .filter((setting: SettingParams) => setting.type !== 'hidden')
    .sort((a, b) => a.name.localeCompare(b.name))
})

function getSettingComponent(setting: SettingParams) {
  switch (setting.type) {
    case 'boolean':
      return Checkbox
    case 'number':
      return InputNumber
    case 'slider':
      return Slider
    case 'combo':
      return Select
    default:
      return InputText
  }
}
</script>

<style>
.info-chip {
  background: transparent !important;
}
</style>

<style scoped>
.comfy-table {
  width: 100%;
}
</style>
