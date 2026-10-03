<template>
  <div class="flex flex-col gap-1">
    <div
      class="max-w-full overflow-hidden rounded-lg border border-border-default"
      role="region"
      :aria-label="t('g.galleryImage')"
    >
      <div class="relative flex items-center justify-center">
        <img
          v-if="images.length"
          :src="images[activeIndex]"
          :alt="
            t('g.galleryImagePosition', {
              index: activeIndex + 1,
              total: images.length
            })
          "
          class="h-auto max-h-64 w-full object-contain"
        />
        <button
          v-if="images.length > 1"
          type="button"
          :aria-label="t('g.previousImage')"
          :disabled="activeIndex === 0"
          :class="cn(navButtonClass, 'left-2')"
          @click="activeIndex--"
        >
          <i class="icon-[lucide--chevron-left] size-4" aria-hidden="true" />
        </button>
        <button
          v-if="images.length > 1"
          type="button"
          :aria-label="t('g.nextImage')"
          :disabled="activeIndex === images.length - 1"
          :class="cn(navButtonClass, 'right-2')"
          @click="activeIndex++"
        >
          <i class="icon-[lucide--chevron-right] size-4" aria-hidden="true" />
        </button>
      </div>

      <div v-if="images.length > 1" class="overflow-x-auto px-2 py-4">
        <div class="flex min-w-max items-center justify-center gap-1">
          <button
            v-for="(image, index) in images"
            :key="`${image}-${index}`"
            type="button"
            :class="
              cn(
                'size-12 shrink-0 overflow-hidden rounded-lg border-0 bg-transparent p-1 opacity-50 transition-opacity hover:opacity-100',
                index === activeIndex && 'opacity-100'
              )
            "
            :aria-label="
              t('g.galleryThumbnailPosition', {
                index: index + 1,
                total: images.length
              })
            "
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="activeIndex = index"
          >
            <img
              :src="image"
              alt=""
              class="size-full rounded-lg object-cover"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const images = defineModel<string[]>({ required: true })
const activeIndex = ref(0)
const { t } = useI18n()

const navButtonClass =
  'absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-secondary-background/80 text-base-foreground transition-colors hover:bg-secondary-background disabled:pointer-events-none disabled:opacity-40'

watch(
  () => images.value.length,
  (length) => {
    activeIndex.value = Math.max(0, Math.min(activeIndex.value, length - 1))
  }
)
</script>
