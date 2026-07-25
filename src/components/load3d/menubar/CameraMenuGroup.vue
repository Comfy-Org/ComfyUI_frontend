<template>
  <button
    v-tooltip.bottom="tip(t('load3d.menuBar.switchProjection'))"
    :class="actionClass(false)"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.switchProjection') : undefined"
    @click="switchCamera"
  >
    <i class="icon-[lucide--camera] size-4" />
    <span v-if="!compact">{{ cameraTypeLabel }}</span>
  </button>

  <Popover v-if="isPerspective">
    <PopoverTrigger as-child>
      <button
        v-tooltip.bottom="tip(t('load3d.menuBar.fov'))"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.fov') : undefined"
      >
        <i class="icon-[lucide--focus] size-4" />
        <span v-if="!compact">{{ t('load3d.menuBar.fov') }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="8"
      :class="cn(panelClass, 'w-56')"
    >
      <div class="flex flex-col gap-2 p-1">
        <span class="text-sm text-base-foreground">{{ t('load3d.fov') }}</span>
        <Slider
          :model-value="[fov]"
          :min="10"
          :max="150"
          :step="1"
          class="w-full"
          @update:model-value="setFov"
        />
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  panelClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import type { CameraConfig } from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'

const { compact = false } = defineProps<{
  compact?: boolean
}>()

const config = defineModel<CameraConfig>('config')

const { t } = useI18n()

const cameraType = computed(() => config.value?.cameraType)
const isPerspective = computed(() => cameraType.value === 'perspective')
const cameraTypeLabel = computed(() =>
  cameraType.value ? t(`load3d.cameraType.${cameraType.value}`) : ''
)
const fov = computed(() => config.value?.fov ?? 0)

function switchCamera() {
  if (!config.value) return
  config.value.cameraType =
    config.value.cameraType === 'perspective' ? 'orthographic' : 'perspective'
}

function setFov(value?: number[]) {
  if (config.value && value?.length) config.value.fov = value[0]
}
</script>
