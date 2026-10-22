<template>
  <div ref="container" class="flex flex-wrap items-center gap-1">
    <AppColorPicker
      v-for="(hex, i) in modelValue"
      :key="i"
      :model-value="hex"
      :alpha="false"
      @update:model-value="(value) => updateAt(i, value)"
    >
      <template #trigger>
        <button
          type="button"
          :data-index="i"
          :data-hex="hex"
          class="relative size-5 cursor-pointer rounded-sm border border-node-border p-0"
          :style="{ background: hex }"
          :title="t('palette.swatchTitle')"
          @contextmenu.prevent.stop="remove(i)"
          @pointerdown="onPointerDown(i, $event)"
        />
      </template>
    </AppColorPicker>
    <button
      v-if="modelValue.length < max"
      type="button"
      class="h-5 rounded-sm border border-node-border bg-input px-2 text-xs leading-none"
      :title="t('palette.addColor')"
      @click="addColor"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import AppColorPicker from '@/components/common/AppColorPicker.vue'
import { usePaletteSwatchRow } from '@/composables/palette/usePaletteSwatchRow'

const { max = 5 } = defineProps<{ max?: number }>()
const modelValue = defineModel<string[]>({ required: true })
const emit = defineEmits<{
  editEnd: [mergeKey?: string]
}>()
const { t } = useI18n()

const container = useTemplateRef<HTMLDivElement>('container')

const { updateAt, remove, addColor, onPointerDown } = usePaletteSwatchRow({
  modelValue,
  container,
  onEditEnd: (mergeKey) => emit('editEnd', mergeKey)
})
</script>
