<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      size="icon"
      :class="cn('rounded-full', showGrid && 'ring-2 ring-white/50')"
      @click="toggleGrid"
    >
      <i
        v-tooltip.right="{ value: $t('load3d.showGrid'), showDelay: 300 }"
        class="pi pi-table text-lg text-white"
      />
    </Button>

    <div v-if="!hasBackgroundImage">
      <Button
        variant="textonly"
        size="icon"
        class="rounded-full"
        @click="openColorPicker"
      >
        <i
          v-tooltip.right="{
            value: $t('load3d.backgroundColor'),
            showDelay: 300
          }"
          class="pi pi-palette text-lg text-white"
        />
        <input
          ref="colorPickerRef"
          type="color"
          :value="backgroundColor"
          class="pointer-events-none absolute m-0 h-0 w-0 p-0 opacity-0"
          @input="
            updateBackgroundColor(($event.target as HTMLInputElement).value)
          "
        />
      </Button>
    </div>

    <div v-if="!hasBackgroundImage">
      <Button
        variant="textonly"
        size="icon"
        class="rounded-full"
        @click="openImagePicker"
      >
        <i
          v-tooltip.right="{
            value: $t('load3d.uploadBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-image text-lg text-white"
        />
        <input
          ref="imagePickerRef"
          type="file"
          accept="image/*"
          class="pointer-events-none absolute m-0 h-0 w-0 p-0 opacity-0"
          @change="uploadBackgroundImage"
        />
      </Button>
    </div>

    <div v-if="hasBackgroundImage">
      <Button
        variant="textonly"
        size="icon"
        :class="
          cn(
            'rounded-full',
            backgroundRenderMode === 'panorama' && 'ring-2 ring-white/50'
          )
        "
        @click="toggleBackgroundRenderMode"
      >
        <i
          v-tooltip.right="{
            value: $t('load3d.panoramaMode'),
            showDelay: 300
          }"
          class="pi pi-globe text-lg text-white"
        />
      </Button>
    </div>

    <PopupSlider
      v-if="hasBackgroundImage && backgroundRenderMode === 'panorama'"
      v-model="fov"
      :tooltip-text="$t('load3d.fov')"
    />

    <div v-if="hasBackgroundImage">
      <Button
        variant="textonly"
        size="icon"
        class="rounded-full"
        @click="removeBackgroundImage"
      >
        <i
          v-tooltip.right="{
            value: $t('load3d.removeBackgroundImage'),
            showDelay: 300
          }"
          class="pi pi-times text-lg text-white"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import PopupSlider from '@/components/load3d/controls/PopupSlider.vue'
import Button from '@/components/ui/button/Button.vue'
import type { BackgroundRenderModeType } from '@/extensions/core/load3d/interfaces'
import { cn } from '@/utils/tailwindUtil'

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const showGrid = defineModel<boolean>('showGrid')
const backgroundColor = defineModel<string>('backgroundColor')
const backgroundImage = defineModel<string>('backgroundImage')
const backgroundRenderMode = defineModel<BackgroundRenderModeType>(
  'backgroundRenderMode',
  { default: 'tiled' }
)
const fov = defineModel<number>('fov')
const hasBackgroundImage = computed(
  () => backgroundImage.value && backgroundImage.value !== ''
)

const colorPickerRef = ref<HTMLInputElement | null>(null)
const imagePickerRef = ref<HTMLInputElement | null>(null)

const toggleGrid = () => {
  showGrid.value = !showGrid.value
}

const updateBackgroundColor = (color: string) => {
  backgroundColor.value = color
}

const openColorPicker = () => {
  colorPickerRef.value?.click()
}

const openImagePicker = () => {
  imagePickerRef.value?.click()
}

const uploadBackgroundImage = (event: Event) => {
  const input = event.target as HTMLInputElement

  if (input.files && input.files[0]) {
    emit('updateBackgroundImage', input.files[0])
  }
}

const removeBackgroundImage = () => {
  emit('updateBackgroundImage', null)
}

const toggleBackgroundRenderMode = () => {
  backgroundRenderMode.value =
    backgroundRenderMode.value === 'panorama' ? 'tiled' : 'panorama'
}
</script>
