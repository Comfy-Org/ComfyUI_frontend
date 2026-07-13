<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        v-tooltip.bottom="tip(t('load3d.menuBar.upDirection'))"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.upDirection') : undefined"
      >
        <i class="icon-[lucide--move-3d] size-4" />
        <span v-if="!compact">{{ t('load3d.menuBar.upDirection') }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="8"
      :class="panelClass"
    >
      <button
        v-for="d in upDirections"
        :key="d"
        type="button"
        :class="cn(rowClass, upDirection === d && 'bg-button-active-surface')"
        @click="setUpDirection(d)"
      >
        {{ d.toUpperCase() }}
      </button>
    </PopoverContent>
  </Popover>

  <Popover v-if="materialModes.length">
    <PopoverTrigger as-child>
      <button
        v-tooltip.bottom="tip(t('load3d.menuBar.material'))"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.material') : undefined"
      >
        <i class="icon-[lucide--box] size-4" />
        <span v-if="!compact">{{ t('load3d.menuBar.material') }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="8"
      :class="panelClass"
    >
      <button
        v-for="m in materialModes"
        :key="m"
        type="button"
        :class="cn(rowClass, materialMode === m && 'bg-button-active-surface')"
        @click="setMaterialMode(m)"
      >
        {{ t(`load3d.materialModes.${m}`) }}
      </button>
    </PopoverContent>
  </Popover>

  <button
    v-if="hasSkeleton"
    v-tooltip.bottom="tip(t('load3d.menuBar.skeleton'))"
    :class="actionClass(showSkeleton)"
    :aria-pressed="showSkeleton"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.skeleton') : undefined"
    @click="toggleSkeleton"
  >
    <i class="icon-[lucide--bone] size-4" />
    <span v-if="!compact">{{ t('load3d.menuBar.skeleton') }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  panelClass,
  rowClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import type {
  MaterialMode,
  ModelConfig,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'

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
