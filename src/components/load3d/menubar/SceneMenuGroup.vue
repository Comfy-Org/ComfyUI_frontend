<template>
  <button
    v-tooltip.bottom="tip(t('load3d.menuBar.showGrid'))"
    :class="actionClass(showGrid)"
    :aria-pressed="showGrid"
    type="button"
    :aria-label="compact ? t('load3d.menuBar.showGrid') : undefined"
    @click="toggleGrid"
  >
    <i class="icon-[lucide--grid-3x3] size-4" />
    <span v-if="!compact">{{ t('load3d.menuBar.showGrid') }}</span>
  </button>

  <template v-if="!hasImage && !hdriActive">
    <button
      v-tooltip.bottom="tip(t('load3d.menuBar.bgColor'))"
      :class="actionClass(false)"
      type="button"
      :aria-label="compact ? t('load3d.menuBar.bgColor') : undefined"
      @click="colorRef?.click()"
    >
      <i class="icon-[lucide--palette] size-4" />
      <span v-if="!compact">{{ t('load3d.menuBar.bgColor') }}</span>
    </button>
    <input
      ref="colorRef"
      type="color"
      class="pointer-events-none absolute size-0 opacity-0"
      :value="bgColor"
      @input="setBackgroundColor"
    />
    <template v-if="canUseBackgroundImage">
      <button
        v-tooltip.bottom="tip(t('load3d.menuBar.bgImage'))"
        :class="actionClass(false)"
        type="button"
        :aria-label="compact ? t('load3d.menuBar.bgImage') : undefined"
        @click="bgImageRef?.click()"
      >
        <i class="icon-[lucide--image] size-4" />
        <span v-if="!compact">{{ t('load3d.menuBar.bgImage') }}</span>
      </button>
      <input
        ref="bgImageRef"
        type="file"
        accept="image/*"
        class="pointer-events-none absolute size-0 opacity-0"
        data-testid="scene-bg-image-input"
        @change="onBackgroundImagePicked"
      />
    </template>
  </template>

  <template v-if="hasImage">
    <button
      v-tooltip.bottom="tip(t('load3d.menuBar.panorama'))"
      :class="actionClass(isPanorama)"
      :aria-pressed="isPanorama"
      type="button"
      :aria-label="compact ? t('load3d.menuBar.panorama') : undefined"
      @click="togglePanorama"
    >
      <i class="icon-[lucide--globe] size-4" />
      <span v-if="!compact">{{ t('load3d.menuBar.panorama') }}</span>
    </button>
    <Popover v-if="isPanorama">
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
          <span class="text-sm text-base-foreground">{{
            t('load3d.fov')
          }}</span>
          <Slider
            :model-value="[fovValue]"
            :min="10"
            :max="150"
            :step="1"
            class="w-full"
            @update:model-value="setFov"
          />
        </div>
      </PopoverContent>
    </Popover>
    <button
      v-tooltip.bottom="tip(t('load3d.menuBar.removeBackground'))"
      :class="actionClass(false)"
      type="button"
      :aria-label="compact ? t('load3d.menuBar.removeBackground') : undefined"
      @click="removeBackgroundImage"
    >
      <i class="icon-[lucide--x] size-4" />
      <span v-if="!compact">{{ t('load3d.menuBar.removeBackground') }}</span>
    </button>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  panelClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import type { SceneConfig } from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'
import { PopoverTrigger } from 'reka-ui'

const {
  compact = false,
  canUseBackgroundImage = true,
  hdriActive = false
} = defineProps<{
  compact?: boolean
  canUseBackgroundImage?: boolean
  hdriActive?: boolean
}>()

const config = defineModel<SceneConfig>('config')
const fov = defineModel<number>('fov')

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const { t } = useI18n()

const showGrid = computed(() => config.value?.showGrid ?? false)
const bgColor = computed(() => config.value?.backgroundColor ?? '#000000')
const hasImage = computed(
  () => !!config.value?.backgroundImage && config.value.backgroundImage !== ''
)
const isPanorama = computed(
  () => config.value?.backgroundRenderMode === 'panorama'
)
const fovValue = computed(() => fov.value ?? 10)

const colorRef = ref<HTMLInputElement | null>(null)
const bgImageRef = ref<HTMLInputElement | null>(null)

function toggleGrid() {
  if (config.value) config.value.showGrid = !config.value.showGrid
}

function setBackgroundColor(event: Event) {
  if (config.value) {
    config.value.backgroundColor = (event.target as HTMLInputElement).value
  }
}

function onBackgroundImagePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('updateBackgroundImage', file)
}

function removeBackgroundImage() {
  emit('updateBackgroundImage', null)
}

function togglePanorama() {
  if (!config.value) return
  config.value.backgroundRenderMode =
    config.value.backgroundRenderMode === 'panorama' ? 'tiled' : 'panorama'
}

function setFov(value?: number[]) {
  if (value?.length) fov.value = value[0]
}
</script>
