<!-- A single setting item -->
<template>
  <div class="setting-group">
    <h3>{{ group.label }}</h3>
    <div
      v-for="setting in group.settings"
      :key="setting.id"
      class="setting-item"
    >
      <div class="setting-label">
        <span>{{ setting.name }}</span>
        <Chip
          v-if="setting.tooltip"
          icon="pi pi-info-circle"
          severity="secondary"
          v-tooltip="setting.tooltip"
          class="info-chip"
        />
      </div>
      <div class="setting-input">
        <component
          :is="markRaw(getSettingComponent(setting))"
          :id="setting.id"
          :modelValue="settingStore.get(setting.id)"
          @update:modelValue="updateSetting(setting, $event)"
          v-bind="getSettingAttrs(setting)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import { markRaw, type Component } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Chip from 'primevue/chip'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'
import InputSlider from '@/components/dialog/content/setting/InputSlider.vue'

const props = defineProps<{
  group: {
    label: string
    settings: SettingParams[]
  }
}>()

const settingStore = useSettingStore()

function getSettingAttrs(setting: SettingParams) {
  const attrs = { ...(setting.attrs || {}) }
  const settingType = setting.type
  if (typeof settingType === 'function') {
    attrs['renderFunction'] = () =>
      settingType(
        setting.name,
        (v) => updateSetting(setting, v),
        settingStore.get(setting.id),
        setting.attrs
      )
  }
  switch (setting.type) {
    case 'combo':
      attrs['options'] = setting.options
      if (typeof setting.options[0] !== 'string') {
        attrs['optionLabel'] = 'text'
        attrs['optionValue'] = 'value'
      }
      break
  }
  return attrs
}

const updateSetting = (setting: SettingParams, value: any) => {
  if (setting.onChange) setting.onChange(value, settingStore.get(setting.id))
  settingStore.set(setting.id, value)
}

function getSettingComponent(setting: SettingParams): Component {
  if (typeof setting.type === 'function') {
    return CustomSettingValue
  }
  switch (setting.type) {
    case 'boolean':
      return ToggleSwitch
    case 'number':
      return InputNumber
    case 'slider':
      return InputSlider
    case 'combo':
      return Select
    default:
      return InputText
  }
}
</script>
