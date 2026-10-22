<template>
  <ul class="m-0 flex list-none flex-col gap-2 p-0">
    <li
      v-for="(region, index) in regions"
      :key="index"
      ref="items"
      :aria-current="index === activeIndex"
      :class="
        cn(
          'rounded-sm transition-shadow',
          index === activeIndex && 'ring-2 ring-ring'
        )
      "
      @pointerdown="emit('select', index)"
      @focusin="emit('select', index)"
    >
      <BoundingBoxesRegionForm
        :region="region"
        :max-colors="maxColors"
        @update:type="emit('update:type', index, $event)"
        @update:text="emit('update:text', index, $event)"
        @update:desc="emit('update:desc', index, $event)"
        @update:palette="emit('update:palette', index, $event)"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <span
              class="rounded-xs px-1 font-mono text-xs font-bold"
              :style="tagStyle(region)"
            >
              {{ regionTag(index) }}
            </span>
            <Button
              class="ml-auto"
              variant="textonly"
              size="icon-sm"
              icon="icon-[lucide--trash-2]"
              :aria-label="
                $t('boundingBoxes.deleteRegion', { tag: regionTag(index) })
              "
              :tooltip="
                $t('boundingBoxes.deleteRegion', { tag: regionTag(index) })
              "
              @click="emit('delete', index)"
            />
          </div>
        </template>
      </BoundingBoxesRegionForm>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import BoundingBoxesRegionForm from '@/components/boundingBoxes/BoundingBoxesRegionForm.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  regionColor,
  regionTag
} from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { Region } from '@/composables/boundingBoxes/boundingBoxesUtil'
import { textOnColor } from '@/utils/colorUtil'

const { regions, activeIndex, maxColors } = defineProps<{
  regions: readonly Region[]
  activeIndex: number
  maxColors: number
}>()

const emit = defineEmits<{
  select: [index: number]
  delete: [index: number]
  'update:type': [index: number, type: Region['type']]
  'update:text': [index: number, text: string]
  'update:desc': [index: number, desc: string]
  'update:palette': [index: number, palette: string[]]
}>()

const items = useTemplateRef<HTMLLIElement[]>('items')

function tagStyle(region: Region) {
  const color = regionColor(region)
  return { backgroundColor: color, color: textOnColor(color) }
}

watch(
  () => activeIndex,
  (index) => items.value?.[index]?.scrollIntoView?.({ block: 'nearest' })
)
</script>
