<!-- A generalized setting item without binding the behavior to the setting store. -->
<template>
  <div class="setting-label flex flex-grow items-center">
    <span class="text-[var(--p-text-muted-color)]">
      <slot name="name-prefix"></slot>
      {{ props.setting.name }}
      <i
        v-if="props.setting.tooltip"
        class="pi pi-info-circle bg-transparent"
        v-tooltip="props.setting.tooltip"
      />
      <slot name="name-suffix"></slot>
    </span>
  </div>
  <div class="setting-input flex justify-end">
    <component
      :is="markRaw(getSettingComponent(props.setting))"
      :id="props.id"
      v-model:modelValue="settingValue"
      v-bind="getSettingAttrs(props.setting)"
    />
  </div>
</template>

<script setup lang="ts">
import { SettingItem } from '@/types/settingTypes'
import { markRaw, type Component } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'
import InputSlider from '@/components/common/InputSlider.vue'

const settingValue = defineModel<any>('settingValue')
const props = withDefaults(
  defineProps<{
    setting: SettingItem
    id: string | undefined
  }>(),
  {
    id: undefined
  }
)

function getSettingAttrs(setting: SettingItem) {
  const attrs = { ...(setting.attrs || {}) }
  const settingType = setting.type
  if (typeof settingType === 'function') {
    attrs['renderFunction'] = () =>
      settingType(
        props.setting.name,
        (v) => (settingValue.value = v),
        settingValue.value,
        setting.attrs
      )
  }
  switch (setting.type) {
    case 'combo':
      attrs['options'] =
        typeof setting.options === 'function'
          ? setting.options(settingValue.value)
          : setting.options
      if (typeof setting.options[0] !== 'string') {
        attrs['optionLabel'] = 'text'
        attrs['optionValue'] = 'value'
      }
      break
  }
  return attrs
}

function getSettingComponent(setting: SettingItem): Component {
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
