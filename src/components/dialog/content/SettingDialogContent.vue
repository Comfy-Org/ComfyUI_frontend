<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <Menu :model="topLevelCategories" />
    </div>
    <div class="settings-content">
      <TabView v-model:activeIndex="activeCategory">
        <TabPanel v-for="(category, index) in categories" :key="index">
          <template #header>
            <span class="sr-only">{{ category.label }}</span>
          </template>
          <div
            v-for="group in category.items"
            :key="group.label"
            class="setting-group"
          >
            <Card>
              <template #title>
                <h3>{{ group.label }}</h3>
              </template>
              <template #content>
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
              </template>
            </Card>
          </div>
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, type Component } from 'vue'
import Menu from 'primevue/menu'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Chip from 'primevue/chip'
import ToggleSwitch from 'primevue/toggleswitch'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import CustomSettingValue from '@/components/dialog/content/setting/CustomSettingValue.vue'
import InputSlider from '@/components/dialog/content/setting/InputSlider.vue'

const settingStore = useSettingStore()
const activeCategory = ref(0)

const categories = computed(() => {
  const categorizedSettings = {} as Record<string, SettingParams[]>

  Object.values(settingStore.settings)
    .filter((setting: SettingParams) => setting.type !== 'hidden')
    .forEach((setting) => {
      const category = setting.id.split('.')[0]
      if (!categorizedSettings[category]) {
        categorizedSettings[category] = []
      }
      categorizedSettings[category].push(setting)
    })

  return Object.entries(categorizedSettings).map(([category, settings]) => ({
    label: category,
    items: groupSettingsBySubcategory(settings)
  }))
})

const topLevelCategories = computed(() => {
  return categories.value.map((category) => ({
    label: category.label,
    command: () => {
      activeCategory.value = categories.value.findIndex(
        (c) => c.label === category.label
      )
    }
  }))
})

function groupSettingsBySubcategory(settings: SettingParams[]) {
  const groups = {} as Record<string, SettingParams[]>
  settings.forEach((setting) => {
    const [, subcategory] = setting.id.split('.')
    if (!groups[subcategory]) {
      groups[subcategory] = []
    }
    groups[subcategory].push(setting)
  })
  return Object.entries(groups).map(([label, settings]) => ({
    label,
    settings
  }))
}

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
  attrs['class'] += ' comfy-vue-setting-input'
  return attrs
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

const updateSetting = (setting: SettingParams, value: any) => {
  if (setting.onChange) setting.onChange(value, settingStore.get(setting.id))
  settingStore.set(setting.id, value)
}
</script>

<style scoped>
.settings-container {
  display: flex;
  height: 100%;
}

.settings-sidebar {
  width: 200px;
  border-right: 1px solid var(--surface-border);
}

.settings-content {
  flex: 1;
  padding: 1rem;
}

.setting-group {
  margin-bottom: 2rem;
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
  gap: 0.5rem;
  flex: 1;
}

.setting-input {
  width: 60%;
  display: flex;
  justify-content: flex-end;
}

.info-chip {
  background: transparent !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

:deep(.p-card) {
  margin-bottom: 1rem;
}

:deep(.p-card-title) {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--surface-border);
}

:deep(.p-card-content) {
  padding-top: 1rem;
}
</style>
