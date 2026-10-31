<template>
  <div
    class="relative flex items-center gap-2 overflow-hidden rounded-lg p-2 select-none"
    :aria-describedby="
      videoStatus === 'failed' ? videoFailedDescriptionId : undefined
    "
  >
    <div v-if="progressBars.length" :class="progressBarContainerClass">
      <div
        v-for="bar in progressBars"
        :key="bar.id"
        :class="bar.class"
        :style="progressPercentStyle(bar.percent)"
      />
    </div>

    <div
      :class="
        cn(
          'relative z-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-secondary',
          iconWrapperClass
        )
      "
      :aria-label="iconAriaLabel || undefined"
    >
      <slot
        name="icon"
        :preview-url="previewUrl"
        :preview-alt="previewAlt"
        :icon-name="iconName"
        :icon-class="iconClass"
        :icon-aria-label="iconAriaLabel"
      >
        <AssetsListItemPreview
          :preview-url
          :preview-alt
          :icon-name
          :icon-class
          :is-video-preview
          :video-src
          :video-failed="videoStatus === 'failed'"
          @preview-click="emit('preview-click')"
          @video-error="onVideoError"
        />
      </slot>
    </div>

    <div
      class="relative z-1 flex min-w-0 flex-1 flex-col gap-1 text-xs leading-none"
    >
      <div v-if="$slots.primary || primaryText" class="min-w-0 text-foreground">
        <slot v-if="$slots.primary" name="primary" />
        <span v-else class="block truncate" :title="primaryText">
          {{ primaryText }}
        </span>
      </div>
      <div
        v-if="$slots.secondary || secondaryText"
        class="min-w-0 text-muted-foreground"
      >
        <slot v-if="$slots.secondary" name="secondary" />
        <span v-else class="block truncate" :title="secondaryText">
          {{ secondaryText }}
        </span>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="relative z-1 flex shrink-0 items-center gap-2"
    >
      <slot name="actions" />
    </div>

    <div
      v-if="typeof stackCount === 'number' && stackCount > 1"
      class="relative z-1 flex shrink-0 items-center"
    >
      <Button
        variant="secondary"
        size="md"
        class="gap-1 font-bold"
        :aria-label="stackIndicatorLabel"
        :aria-expanded="stackExpanded"
        @click.stop="emit('stack-toggle')"
      >
        <i aria-hidden="true" class="icon-[lucide--layers]" />
        <span class="text-xs leading-none">{{ stackCount }}</span>
        <i
          aria-hidden="true"
          :class="
            cn(
              stackExpanded
                ? 'icon-[lucide--chevron-down]'
                : 'icon-[lucide--chevron-right]',
              'size-3'
            )
          "
        />
      </Button>
    </div>

    <span
      v-if="videoStatus === 'failed'"
      :id="videoFailedDescriptionId"
      class="sr-only"
    >
      {{ $t('g.videoFailedToLoad') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import AssetsListItemPreview from './AssetsListItemPreview.vue'

const emit = defineEmits<{
  'stack-toggle': []
  'preview-click': []
}>()

const {
  previewUrl,
  previewAlt = '',
  iconName,
  iconAriaLabel,
  iconClass,
  iconWrapperClass,
  isVideoPreview = false,
  primaryText,
  secondaryText,
  stackCount,
  stackIndicatorLabel,
  stackExpanded = false,
  progressTotalPercent,
  progressCurrentPercent
} = defineProps<{
  previewUrl?: string
  previewAlt?: string
  iconName?: string
  iconAriaLabel?: string
  iconClass?: string
  iconWrapperClass?: string
  isVideoPreview?: boolean
  primaryText?: string
  secondaryText?: string
  stackCount?: number
  stackIndicatorLabel?: string
  stackExpanded?: boolean
  progressTotalPercent?: number
  progressCurrentPercent?: number
}>()

const {
  src: videoSrc,
  status: videoStatus,
  onError: onVideoError
} = useRetryableMediaSrc(() => (isVideoPreview ? previewUrl : undefined))

const videoFailedDescriptionId = useId()

const {
  progressBarContainerClass,
  progressBarPrimaryClass,
  progressBarSecondaryClass,
  hasProgressPercent,
  progressPercentStyle
} = useProgressBarBackground()

const progressBars = computed(() =>
  [
    {
      id: 'total',
      percent: progressTotalPercent,
      class: progressBarPrimaryClass
    },
    {
      id: 'current',
      percent: progressCurrentPercent,
      class: progressBarSecondaryClass
    }
  ].filter((bar) => hasProgressPercent(bar.percent))
)
</script>
