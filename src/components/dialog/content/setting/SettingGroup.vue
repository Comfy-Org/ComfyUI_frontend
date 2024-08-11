<template>
  <div class="setting-group">
    <Divider v-if="divider" />
    <h3>{{ formatCamelCase(group.label) }}</h3>
    <div
      v-for="setting in group.settings"
      :key="setting.id"
      class="setting-item"
    >
      <div class="setting-label">
        <span
          >{{ setting.name }}
          <i
            v-if="setting.tooltip"
            class="pi pi-info-circle info-chip"
            v-tooltip="setting.tooltip"
        /></span>
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
import Divider from 'primevue/divider'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'
import InputSlider from '@/components/dialog/content/setting/InputSlider.vue'
import { formatCamelCase } from '@/utils/formatUtil'

defineProps<{
  group: {
    label: string
    settings: SettingParams[]
  }
  divider?: boolean
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

<style scoped>
.info-chip {
  background: transparent;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.setting-label {
  display: flex;
  align-items: center;
  flex: 1;
}

.setting-input {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  margin-left: 1rem;
}

/* Ensure PrimeVue components take full width of their container */
.setting-input :deep(.p-inputtext),
.setting-input :deep(.input-slider),
.setting-input :deep(.p-select),
.setting-input :deep(.p-togglebutton) {
  width: 100%;
  max-width: 200px;
}

.setting-input :deep(.p-inputtext) {
  max-width: unset;
}

/* Special case for ToggleSwitch to align it to the right */
.setting-input :deep(.p-toggleswitch) {
  margin-left: auto;
}
</style>
