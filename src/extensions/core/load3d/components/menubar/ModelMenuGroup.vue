<template>
  <PopoverRoot v-model:open="upDirectionOpen">
    <PopoverTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="t('load3d.menuBar.upDirection')"
        tooltip-side="bottom"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.upDirection') : undefined"
      >
        <i class="icon-[lucide--move-3d]" />
        <span v-if="!compact">{{ t('load3d.menuBar.upDirection') }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" :side-offset="8" :class="menuPanelClass">
      <button
        v-for="d in upDirections"
        :key="d"
        type="button"
        :class="
          cn(menuButtonClass, upDirection === d && selectedMenuButtonClass)
        "
        :aria-pressed="upDirection === d"
        @click="setUpDirection(d)"
      >
        {{ d.toUpperCase() }}
      </button>
    </PopoverContent>
  </PopoverRoot>

  <PopoverRoot v-if="materialModes.length" v-model:open="materialOpen">
    <PopoverTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="t('load3d.menuBar.material')"
        tooltip-side="bottom"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.material') : undefined"
      >
        <i class="icon-[lucide--box]" />
        <span v-if="!compact">{{ t('load3d.menuBar.material') }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" :side-offset="8" :class="menuPanelClass">
      <button
        v-for="m in materialModes"
        :key="m"
        type="button"
        :class="
          cn(menuButtonClass, materialMode === m && selectedMenuButtonClass)
        "
        :aria-pressed="materialMode === m"
        @click="setMaterialMode(m)"
      >
        {{ t(`load3d.materialModes.${m}`) }}
      </button>
    </PopoverContent>
  </PopoverRoot>

  <Button
    v-if="hasSkeleton"
    variant="textonly"
    size="unset"
    :tooltip="t('load3d.menuBar.skeleton')"
    tooltip-side="bottom"
    :class="actionClass(showSkeleton)"
    :aria-pressed="showSkeleton"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.skeleton') : undefined"
    @click="toggleSkeleton"
  >
    <i class="icon-[lucide--bone]" />
    <span v-if="!compact">{{ t('load3d.menuBar.skeleton') }}</span>
  </Button>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  actionClass,
  menuPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import {
  menuButtonClass,
  selectedMenuButtonClass
} from '@comfyorg/design-system/lib/menu/menuStyles'
import type {
  MaterialMode,
  ModelConfig,
  UpDirection
} from '@comfyorg/viewport3d/load3d/interfaces'

const {
  compact = false,
  hasSkeleton = false,
  materialModes = ['original', 'clay', 'normal', 'wireframe']
} = defineProps<{
  compact?: boolean
  hasSkeleton?: boolean
  materialModes?: readonly MaterialMode[]
}>()

const config = defineModel<ModelConfig>('config')

const { t } = useI18n()

const upDirection = computed(() => config.value?.upDirection)
const materialMode = computed(() => config.value?.materialMode)
const showSkeleton = computed(() => config.value?.showSkeleton ?? false)

const exclusivePopover = usePopoverExclusivity()
const upDirectionOpen = exclusivePopover('model-up-direction')
const materialOpen = exclusivePopover('model-material')

const upDirections: UpDirection[] = [
  'original',
  '-x',
  '+x',
  '-y',
  '+y',
  '-z',
  '+z'
]

function setUpDirection(direction: UpDirection) {
  if (config.value) config.value.upDirection = direction
}

function setMaterialMode(mode: MaterialMode) {
  if (config.value) config.value.materialMode = mode
}

function toggleSkeleton() {
  if (config.value) config.value.showSkeleton = !config.value.showSkeleton
}
</script>
