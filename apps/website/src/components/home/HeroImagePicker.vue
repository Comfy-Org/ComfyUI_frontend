<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import type { ImageVariant } from './heroGraphData'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  variants,
  activeId,
  locale = 'en',
  previewSrc,
  previewAlt,
  previewTestId = 'hero-active-image',
  hint,
  hidePreview = false,
  thumbClass = 'aspect-square'
} = defineProps<{
  variants: readonly ImageVariant[]
  activeId: string
  locale?: Locale
  // Override the large preview with the result the active input produces, so the
  // mobile card can lead with the OUTPUT while the thumbnails stay the selector.
  previewSrc?: string
  previewAlt?: string
  previewTestId?: string
  hint?: string
  // Render only the thumbnail strip, e.g. beneath a standalone output frame.
  hidePreview?: boolean
  // Sizing for each thumbnail; defaults to square, overridable for tight rows.
  thumbClass?: string
}>()

const emit = defineEmits<{ select: [id: string] }>()

const active = computed(
  () => variants.find((v) => v.id === activeId) ?? variants[0]
)

const preview = computed(() => ({
  src: previewSrc ?? active.value.src,
  alt: previewAlt ?? t(active.value.altKey, locale)
}))

// Hover (mouse) and focus (keyboard) both swap the active variant. Click stays
// as the activation path for touch, where there is no hover.
function selectOnHover(id: string, e: PointerEvent) {
  if (e.pointerType === 'mouse') emit('select', id)
}
</script>

<template>
  <div>
    <div
      v-if="!hidePreview"
      class="relative aspect-square w-full overflow-hidden rounded-xl"
    >
      <Transition name="hero-glitch">
        <img
          :key="preview.src"
          :src="preview.src"
          :alt="preview.alt"
          :data-testid="previewTestId"
          draggable="false"
          class="absolute inset-0 size-full object-cover"
        />
      </Transition>
    </div>

    <p v-if="hint" class="text-primary-warm-gray pl-1 text-xs/relaxed">
      {{ hint }}
    </p>

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
            'focus-visible:outline-primary-comfy-yellow relative flex-1 overflow-hidden rounded-md transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2',
            thumbClass,
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
          draggable="false"
          class="size-full object-cover"
        />
      </button>
    </div>
  </div>
</template>
