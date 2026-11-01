<template>
  <Button
    variant="textonly"
    size="unset"
    :tooltip="t('load3d.menuBar.switchProjection')"
    tooltip-side="bottom"
    :class="actionClass(false)"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.switchProjection') : undefined"
    @click="switchCamera"
  >
    <i class="icon-[lucide--camera]" />
    <span v-if="!compact">{{ cameraTypeLabel }}</span>
  </Button>

  <Button
    v-if="hasCustomUp"
    variant="textonly"
    size="unset"
    :tooltip="upActionLabel"
    tooltip-side="bottom"
    :class="actionClass(false)"
    type="button"
    :aria-label="compact ? upActionLabel : undefined"
    @click="toggleUp"
  >
    <i
      :class="
        useCustomUp ? 'icon-[lucide--compass]' : 'icon-[lucide--rotate-ccw]'
      "
    />
    <span v-if="!compact">{{ upLabel }}</span>
  </Button>

  <PopoverRoot v-if="isPerspective" v-model:open="fovOpen">
    <PopoverTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="t('load3d.menuBar.fov')"
        tooltip-side="bottom"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.fov') : undefined"
      >
        <i class="icon-[lucide--focus]" />
        <span v-if="!compact">{{ t('load3d.menuBar.fov') }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="8"
      :class="cn(formPanelClass, 'w-56')"
    >
      <div class="flex flex-col gap-2 p-1">
        <span class="text-sm text-foreground">{{ t('load3d.fov') }}</span>
        <Slider
          :model-value="[fov]"
          :min="10"
          :max="150"
          :step="1"
          @update:model-value="setFov"
        />
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  actionClass,
  formPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Slider from '@comfyorg/design-system/slider/Slider'
import type { CameraConfig } from '@comfyorg/viewport3d/load3d/interfaces'

const { compact = false } = defineProps<{
  compact?: boolean
}>()

const config = defineModel<CameraConfig>('config')

const { t } = useI18n()

const fovOpen = usePopoverExclusivity()('camera-fov')

const cameraType = computed(() => config.value?.cameraType)
const isPerspective = computed(() => cameraType.value === 'perspective')
const cameraTypeLabel = computed(() =>
  cameraType.value ? t(`load3d.cameraType.${cameraType.value}`) : ''
)
const fov = computed(() => config.value?.fov ?? 0)
const hasCustomUp = computed(() => config.value?.hasCustomUp === true)
const useCustomUp = computed(
  () => config.value?.hasCustomUp === true && config.value.useCustomUp
)
const upActionLabel = computed(() =>
  useCustomUp.value ? t('load3d.useNaturalUp') : t('load3d.useCustomUp')
)
const upLabel = computed(() =>
  useCustomUp.value
    ? t('load3d.menuBar.customUp')
    : t('load3d.menuBar.naturalUp')
)

function toggleUp() {
  const current = config.value
  if (!current?.hasCustomUp) return
  current.useCustomUp = !current.useCustomUp
}

function switchCamera() {
  if (!config.value) return
  config.value.cameraType =
    config.value.cameraType === 'perspective' ? 'orthographic' : 'perspective'
}

function setFov(value?: number[]) {
  if (config.value && value?.length) config.value.fov = value[0]
}
</script>
