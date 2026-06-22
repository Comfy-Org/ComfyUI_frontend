<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import type { ImageVariant } from './heroGraphData'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  variants,
  activeId,
  locale = 'en'
} = defineProps<{
  variants: readonly ImageVariant[]
  activeId: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const active = computed(
  () => variants.find((v) => v.id === activeId) ?? variants[0]
)

// Hover (mouse) and focus (keyboard) both swap the active variant. Click stays
// as the activation path for touch, where there is no hover.
function selectOnHover(id: string, e: PointerEvent) {
  if (e.pointerType === 'mouse') emit('select', id)
}
</script>

<template>
  <div>
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <Transition name="hero-glitch">
        <img
          :key="active.id"
          :src="active.src"
          :alt="t(active.altKey, locale)"
          data-testid="hero-active-image"
          class="absolute inset-0 size-full object-cover"
        />
      </Transition>
    </div>

    <div
      class="mt-2 flex gap-2"
      role="group"
      :aria-label="t('hero.image.pickerLabel', locale)"
    >
      <button
        v-for="variant in variants"
        :key="variant.id"
        type="button"
        :aria-pressed="variant.id === activeId"
        :aria-label="t(variant.altKey, locale)"
        :class="
          cn(
            'focus-visible:outline-primary-comfy-yellow relative aspect-square flex-1 overflow-hidden rounded-md transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2',
            variant.id === activeId
              ? 'ring-primary-comfy-yellow opacity-100 ring-2'
              : 'opacity-50 hover:opacity-90'
          )
        "
        @pointerenter="selectOnHover(variant.id, $event)"
        @focus="emit('select', variant.id)"
        @click="emit('select', variant.id)"
      >
        <img
          :src="variant.src"
          alt=""
          aria-hidden="true"
          class="size-full object-cover"
        />
      </button>
    </div>
  </div>
</template>
