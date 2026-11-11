<template>
  <div
    v-if="skeleton"
    :data-testid="testid"
    class="relative aspect-square overflow-hidden rounded-2xl"
  >
    <Skeleton class="absolute inset-0 rounded-2xl" />
    <Skeleton class="absolute inset-x-4 bottom-4 h-4 w-2/3" />
  </div>
  <div
    v-else
    ref="cardRef"
    role="button"
    :tabindex="loading ? -1 : 0"
    :aria-disabled="loading"
    :data-testid="testid"
    :aria-label="failed ? t('gettingStarted.retryTemplate', { title }) : title"
    :aria-busy="loading"
    class="group/card relative cursor-pointer overflow-hidden rounded-2xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    @click="onSelect"
    @keydown.enter.prevent="onSelect"
    @keydown.space.prevent="onSelect"
  >
    <DefaultThumbnail
      :src="imageSrc"
      :alt="title"
      :is-hovered
      :is-video
      :hover-zoom="5"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/60 via-black/20 via-50% to-black/70 transition-opacity duration-300 ease-out group-hover/card:opacity-0"
    />
    <div
      v-if="badgeIcon"
      aria-hidden="true"
      class="pointer-events-none absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
    >
      <i :class="badgeIcon" />
    </div>
    <h3
      class="absolute inset-x-0 bottom-0 m-0 truncate p-4 text-sm font-semibold drop-shadow-md"
      :title
    >
      {{ title }}
    </h3>
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-md"
    >
      <Loader size="md" />
    </div>
    <div
      v-else-if="failed"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 p-4 text-xs backdrop-blur-md"
    >
      <span class="text-center font-medium">
        {{ t('gettingStarted.templateFailed') }}
      </span>
      <span class="font-semibold text-primary">
        {{ t('gettingStarted.retry') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import DefaultThumbnail from '@/platform/workflow/templates/components/thumbnails/DefaultThumbnail.vue'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

const {
  imageSrc = '',
  title = '',
  loading
} = defineProps<{
  imageSrc?: string
  title?: string
  loading?: boolean
  /** Shows an inline error; selecting the card again retries. */
  failed?: boolean
  skeleton?: boolean
  isVideo?: boolean
  badgeIcon?: string
  testid?: string
}>()

const emit = defineEmits<{ select: [] }>()

const { t } = useI18n()

const cardRef = useTemplateRef<HTMLElement>('cardRef')
const isHovered = useElementHover(cardRef)

function onSelect() {
  if (loading) return
  emit('select')
}
</script>
