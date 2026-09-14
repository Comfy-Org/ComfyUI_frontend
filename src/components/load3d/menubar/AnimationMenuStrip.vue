<template>
  <div
    class="flex h-10 shrink-0 items-center gap-1 bg-interface-menu-surface px-2"
    data-testid="load3d-animation-strip"
    @wheel.stop
  >
    <button
      v-tooltip.top="tip(playLabel)"
      :class="iconBtnClass"
      type="button"
      :aria-label="playLabel"
      @click="playing = !playing"
    >
      <i
        :class="
          cn(playing ? 'icon-[lucide--pause]' : 'icon-[lucide--play]', 'size-4')
        "
      />
    </button>

    <Slider
      :model-value="[animationProgress]"
      :min="0"
      :max="100"
      :step="0.1"
      class="min-w-12 flex-1"
      @update:model-value="handleSliderChange"
    />

    <span
      v-if="!compact"
      class="shrink-0 text-xs text-base-foreground tabular-nums"
      data-testid="load3d-animation-time"
    >
      {{ formatAnimationTime(currentTime) }} /
      {{ formatAnimationTime(animationDuration) }}
    </span>

    <Popover v-model:open="speedOpen">
      <PopoverTrigger as-child>
        <button
          v-tooltip.top="tip(t('load3d.menuBar.playbackSpeed'))"
          :class="chipClass"
          type="button"
          :aria-label="t('load3d.menuBar.playbackSpeed')"
        >
          {{ speedLabel }}
          <i class="icon-[lucide--chevron-down] size-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="8"
        :class="panelClass"
      >
        <button
          v-for="speed in speedOptions"
          :key="speed"
          type="button"
          :class="
            cn(rowClass, selectedSpeed === speed && 'bg-button-active-surface')
          "
          @click="setSpeed(speed)"
        >
          {{ formatSpeed(speed) }}
        </button>
      </PopoverContent>
    </Popover>

    <Popover v-model:open="clipOpen">
      <PopoverTrigger as-child>
        <button
          v-tooltip.top="tip(t('load3d.menuBar.animationClip'))"
          :class="cn(chipClass, 'max-w-40')"
          type="button"
          :aria-label="t('load3d.menuBar.animationClip')"
        >
          <i class="icon-[lucide--clapperboard] size-4 shrink-0" />
          <span v-if="!compact" class="truncate">{{ selectedClipName }}</span>
          <i class="icon-[lucide--chevron-down] size-4 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="8"
        :class="panelClass"
      >
        <button
          v-for="clip in animations"
          :key="clip.index"
          type="button"
          :class="
            cn(
              rowClass,
              selectedAnimation === clip.index && 'bg-button-active-surface'
            )
          "
          @click="setClip(clip.index)"
        >
          <span class="truncate">{{ clip.name }}</span>
        </button>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatAnimationTime } from '@/components/load3d/formatAnimationTime'
import {
  chipClass,
  iconBtnClass,
  panelClass,
  rowClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/components/load3d/menubar/usePopoverExclusivity'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import type { AnimationItem } from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'

const {
  animations = [],
  animationDuration = 0,
  compact = false
} = defineProps<{
  animations?: AnimationItem[]
  animationDuration?: number
  compact?: boolean
}>()

const playing = defineModel<boolean>('playing', { default: false })
const selectedSpeed = defineModel<number>('selectedSpeed', { default: 1 })
const selectedAnimation = defineModel<number>('selectedAnimation', {
  default: 0
})
const animationProgress = defineModel<number>('animationProgress', {
  default: 0
})

const emit = defineEmits<{
  seek: [progress: number]
}>()

const { t } = useI18n()

const speedOptions = [0.1, 0.5, 1, 1.5, 2]

const exclusivePopover = usePopoverExclusivity()
const speedOpen = exclusivePopover('animation-speed')
const clipOpen = exclusivePopover('animation-clip')

const playLabel = computed(() => t(playing.value ? 'g.pause' : 'g.play'))
const speedLabel = computed(() => formatSpeed(selectedSpeed.value))
const selectedClipName = computed(
  () =>
    animations.find((clip) => clip.index === selectedAnimation.value)?.name ??
    ''
)
const currentTime = computed(
  () => (animationProgress.value / 100) * animationDuration
)

function formatSpeed(speed: number) {
  return `${speed}x`
}

function setSpeed(speed: number) {
  selectedSpeed.value = speed
  speedOpen.value = false
}

function setClip(index: number) {
  selectedAnimation.value = index
  clipOpen.value = false
}

function handleSliderChange(value: number[] | undefined) {
  if (!value) return
  const progress = value[0]
  animationProgress.value = progress
  emit('seek', progress)
}
</script>
