<template>
  <SettingsSection>
    <template #title>{{ t('maskEditor.colorSelectSettings') }}</template>

    <SliderField
      :label="t('maskEditor.tolerance')"
      :model-value="colorTolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.toleranceHelp')"
      @update:model-value="onToleranceChange"
    />

    <SliderField
      :label="t('maskEditor.selectionOpacity')"
      :model-value="store.selectionOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.selectionOpacityHelp')"
      @update:model-value="onSelectionOpacityChange"
    />

    <SettingRow
      :label="t('maskEditor.livePreview')"
      :help-text="t('maskEditor.livePreviewHelp')"
    >
      <template #default="{ labelId }">
        <Switch
          class="[&>span]:bg-secondary"
          :model-value="store.colorSelectLivePreview"
          :aria-labelledby="labelId"
          @update:model-value="onLivePreviewChange"
        />
      </template>
    </SettingRow>

    <SettingRow
      :label="t('maskEditor.applyToWholeImage')"
      :help-text="t('maskEditor.applyToWholeImageHelp')"
    >
      <template #default="{ labelId }">
        <Switch
          class="[&>span]:bg-secondary"
          :model-value="store.applyWholeImage"
          :aria-labelledby="labelId"
          @update:model-value="onWholeImageChange"
        />
      </template>
    </SettingRow>

    <SettingRow
      :label="t('maskEditor.method')"
      :help-text="t('maskEditor.methodHelp')"
    >
      <template #default="{ labelId }">
        <Menu
          v-model:open="methodMenuOpen"
          :modal="false"
          :items="methodMenuItems"
          align="end"
          :side-offset="5"
          :collision-padding="10"
        >
          <template #trigger>
            <MenuTriggerButton
              :aria-labelledby="`${labelId} color-comparison-method-value`"
            >
              <span id="color-comparison-method-value">
                {{ methodLabels[store.colorComparisonMethod] }}
              </span>
            </MenuTriggerButton>
          </template>
        </Menu>
      </template>
    </SettingRow>

    <SettingRow
      :label="t('maskEditor.stopAtMask')"
      :help-text="t('maskEditor.stopAtMaskHelp')"
    >
      <template #default="{ labelId }">
        <Switch
          class="[&>span]:bg-secondary"
          :model-value="store.maskBoundary"
          :aria-labelledby="labelId"
          @update:model-value="onMaskBoundaryChange"
        />
      </template>
    </SettingRow>

    <SliderField
      :label="t('maskEditor.maskTolerance')"
      :model-value="maskTolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.maskToleranceHelp')"
      @update:model-value="onMaskToleranceChange"
    />
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Switch from '@/components/ui/switch/Switch.vue'
import { ColorComparisonMethod } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

import MenuTriggerButton from './controls/MenuTriggerButton.vue'
import SettingRow from './controls/SettingRow.vue'
import SettingsSection from './controls/SettingsSection.vue'
import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()
const methodMenuOpen = ref(false)

const methodLabels = computed(
  (): Record<ColorComparisonMethod, string> => ({
    [ColorComparisonMethod.Simple]: t('maskEditor.methodSimple'),
    [ColorComparisonMethod.HSL]: t('maskEditor.methodHsl'),
    [ColorComparisonMethod.LAB]: t('maskEditor.methodLab')
  })
)

const methodMenuItems = computed<MenuItem[]>(() =>
  Object.values(ColorComparisonMethod).map((method) => ({
    key: method,
    label: methodLabels.value[method],
    checked: store.colorComparisonMethod === method,
    command: () => {
      store.colorComparisonMethod = method
    }
  }))
)

const colorTolerancePercent = computed(() =>
  Math.round((store.colorSelectTolerance / 255) * 100)
)
const maskTolerancePercent = computed(() =>
  Math.round((store.maskTolerance / 255) * 100)
)

function percentToChannel(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent))
  return Math.round((clamped / 100) * 255)
}

function onToleranceChange(value: number) {
  store.setColorSelectTolerance(percentToChannel(value))
}

function onMaskToleranceChange(value: number) {
  store.setMaskTolerance(percentToChannel(value))
}

function onSelectionOpacityChange(value: number) {
  store.setSelectionOpacity(value)
}

function onLivePreviewChange(value: boolean) {
  store.colorSelectLivePreview = value
}

function onWholeImageChange(value: boolean) {
  store.applyWholeImage = value
}

function onMaskBoundaryChange(value: boolean) {
  store.maskBoundary = value
}
</script>
