<template>
  <div class="flex flex-col gap-1">
    <div
      class="max-w-full overflow-hidden rounded-lg border border-border-default"
      role="region"
      :aria-label="t('g.imageGallery')"
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
        <RovingFocusGroup
          :current-tab-stop-id="`gallery-thumbnail-${activeIndex}`"
          orientation="horizontal"
          class="flex min-w-max items-center justify-center gap-1"
        >
          <RovingFocusItem
            v-for="(image, index) in images"
            :key="`${image}-${index}`"
            as-child
            :tab-stop-id="`gallery-thumbnail-${index}`"
          >
            <button
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
              @focus="activeIndex = index"
              @click="activeIndex = index"
            >
              <img
                :src="image"
                alt=""
                class="size-full rounded-lg object-cover"
              />
            </button>
          </RovingFocusItem>
        </RovingFocusGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RovingFocusGroup, RovingFocusItem } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const modelValue = defineModel<unknown>({ required: true })
const images = computed(() =>
  Array.isArray(modelValue.value)
    ? modelValue.value.filter(
        (image): image is string =>
          typeof image === 'string' && image.length > 0
      )
    : []
)
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
