<script setup lang="ts">
import Input from '@comfyorg/design-system/input/Input'
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import SearchableSingleSelect from '@comfyorg/design-system/single-select/SearchableSingleSelect'
import SingleSelect from '@comfyorg/design-system/single-select/SingleSelect'
import Switch from '@comfyorg/design-system/switch/Switch'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'

const SEARCHABLE_OVER = 12

const { spec } = defineProps<{ spec: SettingSpec }>()

const model = defineModel<SettingValue | undefined>()

const { t } = useI18n()

const options = computed(() =>
  spec.control === 'select'
    ? spec.options.map((option) => ({ name: String(option), value: option }))
    : []
)

const selectValue = computed({
  get: () => (typeof model.value === 'boolean' ? undefined : model.value),
  set: (next: string | number | undefined) => {
    model.value = next
  }
})

const numberValue = computed({
  get: () => (typeof model.value === 'number' ? model.value : undefined),
  set: (next: number) => {
    model.value = next
  }
})

const toggleValue = computed({
  get: () => model.value === true,
  set: (next: boolean) => {
    model.value = next
  }
})

const textValue = computed({
  get: () =>
    typeof model.value === 'string' || typeof model.value === 'number'
      ? model.value
      : '',
  set: (next: string | number | undefined) => {
    model.value = next === undefined ? undefined : String(next)
  }
})

const isWide = computed(() => spec.control === 'text' && spec.multiline)
</script>

<template>
  <label :class="cn('flex min-w-0 flex-col gap-1', isWide && 'col-span-2')">
    <span class="truncate text-xs text-muted-foreground">{{ spec.label }}</span>
    <SingleSelect
      v-if="spec.control === 'select' && options.length <= SEARCHABLE_OVER"
      v-model="selectValue"
      size="md"
      class="bg-input"
      :accessible-label="spec.label"
      :options
    />
    <SearchableSingleSelect
      v-else-if="spec.control === 'select'"
      v-model="selectValue"
      size="md"
      class="bg-input"
      :accessible-label="spec.label"
      :search-label="t('g.search')"
      :empty-text="t('g.noResults')"
      :options
    />
    <NumberField
      v-else-if="spec.control === 'number'"
      v-model="numberValue"
      :min="spec.min"
      :max="spec.max"
      :step="spec.step ?? (spec.integer ? 1 : 0.01)"
      :format-options="{
        useGrouping: false,
        maximumFractionDigits: spec.integer ? 0 : 4
      }"
      class="h-7 rounded-md bg-input"
    >
      <NumberFieldInput :aria-label="spec.label" class="text-xs" />
    </NumberField>
    <Switch
      v-else-if="spec.control === 'toggle'"
      v-model="toggleValue"
      :aria-label="spec.label"
    />
    <Textarea
      v-else-if="spec.control === 'text' && spec.multiline"
      v-model="textValue"
      :aria-label="spec.label"
      class="min-h-14 bg-input px-2 py-1 text-xs"
    />
    <Input
      v-else
      v-model="textValue"
      :aria-label="spec.label"
      class="h-7 rounded-md bg-input px-2 text-xs"
    />
  </label>
</template>
