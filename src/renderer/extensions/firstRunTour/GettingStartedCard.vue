<template>
  <div
    v-if="skeleton"
    :data-testid="testid"
    class="relative aspect-square overflow-hidden rounded-2xl"
  >
    <Skeleton class="absolute inset-0 rounded-2xl" />
    <Skeleton class="absolute inset-x-4 bottom-4 h-4 w-2/3 rounded-md" />
  </div>
  <div
    v-else
    role="button"
    :tabindex="loading ? -1 : 0"
    :aria-disabled="loading"
    :data-testid="testid"
    :aria-label="title"
    :aria-busy="loading"
    class="group/card focus-visible:ring-ring relative aspect-square cursor-pointer overflow-hidden rounded-2xl focus-visible:ring-1 focus-visible:outline-none"
    @click="onSelect"
    @keydown.enter.prevent="onSelect"
    @keydown.space.prevent="onSelect"
  >
    <LazyImage
      :src="imageSrc"
      :alt="title"
      image-class="size-full object-cover opacity-60 transition-all duration-300 ease-out group-hover/card:scale-105 group-hover/card:opacity-100"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/40 via-transparent via-50% to-black/40 transition-opacity duration-300 ease-out group-hover/card:opacity-60"
    />
    <div
      v-if="badgeIcon"
      aria-hidden="true"
      data-testid="getting-started-card-badge"
      class="pointer-events-none absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-black/50 text-base-foreground backdrop-blur-sm"
    >
      <i :class="cn(badgeIcon, 'size-4')" />
    </div>
    <h3
      class="absolute inset-x-0 bottom-0 m-0 truncate p-4 text-sm font-semibold text-base-foreground drop-shadow-md"
      :title
    >
      {{ title }}
    </h3>
    <div
      v-if="loading"
      aria-live="polite"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-background/70 backdrop-blur-md"
    >
      <DotSpinner :size="24" />
      <span class="text-xs font-medium text-base-foreground/80">
        {{ t('onboardingTour.preparing') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import DotSpinner from '@/components/common/DotSpinner.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'

const {
  imageSrc = '',
  title = '',
  loading = false,
  skeleton = false,
  badgeIcon = '',
  testid
} = defineProps<{
  imageSrc?: string
  title?: string
  loading?: boolean
  skeleton?: boolean
  badgeIcon?: string
  testid?: string
}>()

const emit = defineEmits<{ select: [] }>()

const { t } = useI18n()

function onSelect() {
  if (loading) return
  emit('select')
}
</script>
