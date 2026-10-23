<template>
  <div class="flex flex-col gap-2 rounded-sm bg-node p-2">
    <slot name="header" />
    <div class="flex h-8 items-center gap-1 rounded-sm bg-input p-1">
      <Button
        v-for="option in typeOptions"
        :key="option.value"
        variant="textonly"
        size="unset"
        :aria-pressed="region.type === option.value"
        :class="
          cn(
            'flex-1 self-stretch px-2 text-xs transition-colors',
            region.type === option.value
              ? 'rounded-sm bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )
        "
        @click="emit('update:type', option.value)"
      >
        {{ option.label }}
      </Button>
    </div>
    <div
      v-if="region.type === 'text'"
      class="group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring hover:bg-muted"
    >
      <span
        class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
      >
        {{ $t('boundingBoxes.textLabel') }}
      </span>
      <Textarea
        :model-value="region.text"
        :placeholder="$t('boundingBoxes.textPlaceholder')"
        :class="cn(textareaClass, 'min-h-14')"
        data-capture-wheel="true"
        @update:model-value="emit('update:text', String($event))"
      />
    </div>
    <div
      class="group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring hover:bg-muted"
    >
      <span
        class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
      >
        {{ $t('boundingBoxes.descLabel') }}
      </span>
      <Textarea
        :model-value="region.desc"
        :placeholder="$t('boundingBoxes.descPlaceholder')"
        :class="cn(textareaClass, 'min-h-20')"
        data-capture-wheel="true"
        @update:model-value="emit('update:desc', String($event))"
      />
    </div>
    <div class="flex items-center gap-2">
      <span class="shrink-0 truncate text-sm text-muted-foreground">
        {{ $t('boundingBoxes.colors') }}
      </span>
      <PaletteSwatchRow
        :model-value="region.palette"
        :max="maxColors"
        @update:model-value="emit('update:palette', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import PaletteSwatchRow from '@/components/palette/PaletteSwatchRow.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { Region } from '@/composables/boundingBoxes/boundingBoxesUtil'

const textareaClass =
  'resize-none overflow-hidden pt-5 font-mono text-(length:--comfy-textarea-font-size) leading-normal not-disabled:bg-input not-disabled:text-foreground hover:overflow-auto focus:overflow-auto'

const { region, maxColors } = defineProps<{
  region: Region
  maxColors: number
}>()

const emit = defineEmits<{
  'update:type': [type: Region['type']]
  'update:text': [text: string]
  'update:desc': [desc: string]
  'update:palette': [palette: string[]]
}>()

const { t } = useI18n()

const typeOptions = computed(() => [
  { value: 'obj' as const, label: t('boundingBoxes.typeObj') },
  { value: 'text' as const, label: t('boundingBoxes.typeText') }
])
</script>
