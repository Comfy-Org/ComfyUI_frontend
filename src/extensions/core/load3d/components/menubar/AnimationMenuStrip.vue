<template>
  <div
    class="flex h-10 shrink-0 items-center gap-1 bg-popover px-2"
    data-testid="load3d-animation-strip"
    @wheel.stop
  >
    <Button
      variant="textonly"
      size="icon"
      :tooltip="playLabel"
      type="button"
      :aria-label="playLabel"
      @click="playing = !playing"
    >
      <i :class="playing ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'" />
    </Button>

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
      class="shrink-0 text-xs text-foreground tabular-nums"
      data-testid="load3d-animation-time"
    >
      {{ formatAnimationTime(currentTime) }} /
      {{ formatAnimationTime(animationDuration) }}
    </span>

    <PopoverRoot v-model:open="speedOpen">
      <PopoverTrigger as-child>
        <Button
          variant="textonly"
          size="unset"
          :tooltip="t('load3d.menuBar.playbackSpeed')"
          :class="chipClass"
          type="button"
          :aria-label="t('load3d.menuBar.playbackSpeed')"
        >
          {{ speedLabel }}
          <i class="icon-[lucide--chevron-down] opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="8"
        :class="menuPanelClass"
      >
        <button
          v-for="speed in speedOptions"
          :key="speed"
          type="button"
          :class="
            cn(
              menuButtonClass,
              selectedSpeed === speed && selectedMenuButtonClass
            )
          "
          :aria-pressed="selectedSpeed === speed"
          @click="setSpeed(speed)"
        >
          {{ formatSpeed(speed) }}
        </button>
      </PopoverContent>
    </PopoverRoot>

    <PopoverRoot v-model:open="clipOpen">
      <PopoverTrigger as-child>
        <Button
          variant="textonly"
          size="unset"
          :tooltip="t('load3d.menuBar.animationClip')"
          :class="cn(chipClass, 'max-w-40')"
          type="button"
          :aria-label="t('load3d.menuBar.animationClip')"
        >
          <i class="icon-[lucide--clapperboard] shrink-0" />
          <span v-if="!compact" class="truncate">{{ selectedClipName }}</span>
          <i class="icon-[lucide--chevron-down] shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="8"
        :class="menuPanelClass"
      >
        <button
          v-for="clip in animations"
          :key="clip.index"
          type="button"
          :class="
            cn(
              menuButtonClass,
              selectedAnimation === clip.index && selectedMenuButtonClass
            )
          "
          :aria-pressed="selectedAnimation === clip.index"
          @click="setClip(clip.index)"
        >
          <span class="truncate">{{ clip.name }}</span>
        </button>
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import { formatAnimationTime } from '@/extensions/core/load3d/components/formatAnimationTime'
import {
  chipClass,
  menuPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import {
  menuButtonClass,
  selectedMenuButtonClass
} from '@comfyorg/design-system/lib/menu/menuStyles'
import Slider from '@comfyorg/design-system/slider/Slider'
import type { AnimationItem } from '@comfyorg/viewport3d/load3d/interfaces'

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
