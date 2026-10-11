<template>
  <div
    class="flex flex-col gap-2 rounded-sm bg-node-component-surface p-2 text-xs"
  >
    <ToggleGroup
      type="single"
      :model-value="light.type"
      class="w-full min-w-0 rounded-md bg-component-node-widget-background p-1"
      @update:model-value="onTypeChange"
    >
      <ToggleGroupItem
        v-for="type in LIGHT_TYPES"
        :key="type"
        :value="type"
        size="sm"
        class="flex-1 px-2"
      >
        {{ $t(LIGHT_TYPE_LABEL_KEYS[type]) }}
      </ToggleGroupItem>
    </ToggleGroup>
    <div
      :class="
        cn(
          'grid items-center gap-x-2 gap-y-1',
          compact
            ? 'grid-cols-[auto_minmax(0,1fr)]'
            : 'grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]'
        )
      "
    >
      <label :class="FIELD_LABEL_CLASS">{{ $t('lightInfo.color') }}</label>
      <ColorPicker
        :model-value="light.color"
        :alpha="false"
        :aria-label="$t('lightInfo.color')"
        @update:model-value="(color) => emit('update', { color })"
      />
      <label :class="FIELD_LABEL_CLASS">
        {{ $t('lightInfo.castShadow') }}
      </label>
      <Switch
        :model-value="light.castShadow !== false"
        :aria-label="$t('lightInfo.castShadow')"
        @update:model-value="(castShadow) => emit('update', { castShadow })"
      />
      <template v-for="field in numberFields" :key="field.key">
        <label :class="FIELD_LABEL_CLASS">{{ $t(field.labelKey) }}</label>
        <ScrubableNumberInput
          :model-value="field.value"
          :display-value="formatField(field.key, field.value)"
          :input-attrs="{ 'aria-label': $t(field.labelKey) }"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          @update:model-value="(value) => setNumber(field.key, value)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  LIGHT_TYPES,
  LIGHT_TYPE_LABEL_KEYS
} from '@/extensions/core/lightInfo/types'
import type {
  LightInfoEntry,
  LightInfoType
} from '@/extensions/core/lightInfo/types'
import { cn } from '@comfyorg/tailwind-utils'

type NumberField =
  | 'intensity'
  | 'range'
  | 'innerConeAngle'
  | 'outerConeAngle'
  | 'radius'

interface NumberFieldSpec {
  key: NumberField
  labelKey: string
  value: number
  min: number
  max?: number
  step: number
}

const FIELD_LABEL_CLASS =
  'content-center truncate text-node-component-slot-text'

const { light, compact } = defineProps<{
  light: LightInfoEntry
  compact: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<LightInfoEntry>]
  changeType: [type: LightInfoType]
}>()

const { locale } = useI18n()

const numberFields = computed<NumberFieldSpec[]>(() => {
  const directional = light.type === 'directional'
  const fields: NumberFieldSpec[] = [
    {
      key: 'intensity',
      labelKey: 'lightInfo.intensity',
      value: light.intensity,
      min: 0,
      step: 0.1
    },
    {
      key: 'radius',
      labelKey: directional ? 'lightInfo.angle' : 'lightInfo.size',
      value: light.radius ?? 0,
      min: 0,
      step: directional ? 0.1 : 0.05
    }
  ]
  if (!directional) {
    fields.push({
      key: 'range',
      labelKey: 'lightInfo.range',
      value: light.range ?? 0,
      min: 0,
      step: 0.5
    })
  }
  if (light.type === 'spot') {
    fields.push(
      {
        key: 'innerConeAngle',
        labelKey: 'lightInfo.innerCone',
        value: light.innerConeAngle ?? 30,
        min: 0,
        max: 90,
        step: 1
      },
      {
        key: 'outerConeAngle',
        labelKey: 'lightInfo.outerCone',
        value: light.outerConeAngle ?? 45,
        min: 1,
        max: 90,
        step: 1
      }
    )
  }
  return fields
})

function onTypeChange(value: unknown) {
  const type = LIGHT_TYPES.find((candidate) => candidate === value)
  if (type) emit('changeType', type)
}

function fieldDecimals(field: NumberField): number {
  if (field === 'innerConeAngle' || field === 'outerConeAngle') return 0
  if (field === 'radius' && light.type !== 'directional') return 2
  return 1
}

function formatField(field: NumberField, value: number): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: fieldDecimals(field),
    useGrouping: false
  }).format(value)
}

function setNumber(field: NumberField, raw: number) {
  if (!Number.isFinite(raw)) return
  const value = Number(raw.toFixed(fieldDecimals(field)))
  if (field === 'innerConeAngle') {
    emit('update', {
      innerConeAngle: Math.min(value, light.outerConeAngle ?? 45)
    })
    return
  }
  if (field === 'outerConeAngle') {
    emit('update', {
      outerConeAngle: value,
      innerConeAngle: Math.min(light.innerConeAngle ?? 30, value)
    })
    return
  }
  emit('update', { [field]: value })
}
</script>
