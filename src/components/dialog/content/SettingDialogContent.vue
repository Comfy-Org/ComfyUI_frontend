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
            :is="markRaw(getSettingComponent(setting))"
            :id="setting.id"
            :modelValue="settingStore.get(setting.id)"
            @update:modelValue="updateSetting(setting, $event)"
            v-bind="getSettingAttrs(setting)"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { type Component, computed, markRaw } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import Chip from 'primevue/chip'
import ToggleSwitch from 'primevue/toggleswitch'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'

const settingStore = useSettingStore()
const sortedSettings = computed<SettingParams[]>(() => {
  return Object.values(settingStore.settings)
    .filter((setting: SettingParams) => setting.type !== 'hidden')
    .sort((a, b) => a.name.localeCompare(b.name))
})

function getSettingAttrs(setting: SettingParams) {
  const attrs = setting.attrs || {}
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

function getSettingComponent(setting: SettingParams): Component {
  if (typeof setting.type === 'function') {
    // return setting.type(
    //   setting.name, (v) => updateSetting(setting, v), settingStore.get(setting.id), setting.attrs)
    return CustomSettingValue
  }
  switch (setting.type) {
    case 'boolean':
      return ToggleSwitch
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

const updateSetting = (setting: SettingParams, value: any) => {
  if (setting.onChange) setting.onChange(value, settingStore.get(setting.id))

  settingStore.set(setting.id, value)
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
