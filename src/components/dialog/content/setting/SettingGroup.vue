<template>
  <div class="setting-group">
    <Divider v-if="divider" />
    <h3>{{ formatCamelCase(group.label) }}</h3>
    <div
      v-for="setting in group.settings"
      :key="setting.id"
      class="setting-item flex items-center mb-4"
    >
      <div class="setting-label flex flex-grow items-center">
        <span class="text-[var(--p-text-muted-color)]">
          <Tag v-if="setting.experimental" :value="$t('experimental')" />
          <Tag
            v-if="setting.deprecated"
            :value="$t('deprecated')"
            severity="danger" />
          {{ setting.name }}
          <i
            v-if="setting.tooltip"
            class="pi pi-info-circle bg-transparent"
            v-tooltip="setting.tooltip"
        /></span>
      </div>
      <div class="setting-input flex justify-end">
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
import Tag from 'primevue/tag'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'
import InputSlider from '@/components/common/InputSlider.vue'
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
      attrs['options'] =
        typeof setting.options === 'function'
          ? setting.options(settingStore.get(setting.id))
          : setting.options
      if (typeof setting.options[0] !== 'string') {
        attrs['optionLabel'] = 'text'
        attrs['optionValue'] = 'value'
      }
      break
  }
  return attrs
}

const updateSetting = (setting: SettingParams, value: any) => {
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
.setting-input :deep(.input-slider) .p-inputnumber input,
.setting-input :deep(.input-slider) .slider-part {
  @apply w-20;
}

.setting-input :deep(.p-inputtext),
.setting-input :deep(.p-select) {
  @apply w-44;
}
</style>
