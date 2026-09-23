<template>
  <div
    class="relative flex items-center gap-2 overflow-hidden rounded-lg p-2 select-none"
    :aria-describedby="
      videoStatus === 'failed' ? videoFailedDescriptionId : undefined
    "
  >
    <div
      v-if="hasAnyProgressPercent(progressTotalPercent, progressCurrentPercent)"
      :class="progressBarContainerClass"
    >
      <div
        v-if="hasProgressPercent(progressTotalPercent)"
        :class="progressBarPrimaryClass"
        :style="progressPercentStyle(progressTotalPercent)"
      />
      <div
        v-if="hasProgressPercent(progressCurrentPercent)"
        :class="progressBarSecondaryClass"
        :style="progressPercentStyle(progressCurrentPercent)"
      />
    </div>

    <div
      :class="
        cn(
          'relative z-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-secondary-background',
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
        <div
          v-if="previewUrl"
          class="relative size-full"
          @click="emit('preview-click')"
        >
          <template v-if="isVideoPreview">
            <video
              v-if="videoStatus !== 'failed'"
              :src="videoSrc"
              preload="metadata"
              muted
              playsinline
              class="pointer-events-none size-full object-cover"
              @error="onVideoError"
            />
            <VideoPlayOverlay v-if="videoStatus !== 'failed'" size="sm" />
            <i
              v-if="videoStatus === 'failed'"
              aria-hidden="true"
              class="absolute inset-0 m-auto icon-[lucide--video-off] size-4 text-text-secondary"
            />
          </template>
          <img
            v-else
            :src="previewUrl"
            :alt="previewAlt"
            class="size-full object-cover"
            :draggable="false"
          />
        </div>
        <div
          v-else
          class="flex size-full items-center justify-center"
          @click="emit('preview-click')"
        >
          <i
            aria-hidden="true"
            :class="
              cn(
                iconName ?? 'icon-[lucide--image]',
                'size-4 text-text-secondary',
                iconClass
              )
            "
          />
        </div>
      </slot>
    </div>

    <div class="relative z-1 flex min-w-0 flex-1 flex-col gap-1">
      <div
        v-if="$slots.primary || primaryText"
        class="min-w-0 text-xs leading-none text-text-primary"
      >
        <slot v-if="$slots.primary" name="primary" />
        <span v-else class="block truncate" :title="primaryText">
          {{ primaryText }}
        </span>
      </div>
      <div
        v-if="$slots.secondary || secondaryText"
        class="min-w-0 text-xs leading-none text-text-secondary"
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
        <i aria-hidden="true" class="icon-[lucide--layers] size-4" />
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
import { cn } from '@comfyorg/tailwind-utils'
import { useId } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
import { useProgressBarBackground } from '@/composables/useProgressBarBackground'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

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
  hasAnyProgressPercent,
  progressPercentStyle
} = useProgressBarBackground()
</script>
