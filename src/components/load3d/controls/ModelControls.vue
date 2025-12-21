<template>
  <div class="flex flex-col">
    <div class="show-up-direction relative">
      <Button
        v-tooltip.right="{
          value: t('load3d.upDirection'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        class="rounded-full"
        :aria-label="t('load3d.upDirection')"
        @click="toggleUpDirection"
      >
        <i class="pi pi-arrow-up text-lg text-white" />
      </Button>
      <div
        v-show="showUpDirection"
        class="absolute top-0 left-12 rounded-lg bg-black/50 shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="direction in upDirections"
            :key="direction"
            variant="textonly"
            :class="
              cn('text-white', upDirection === direction && 'bg-blue-500')
            "
            @click="selectUpDirection(direction)"
          >
            {{ direction.toUpperCase() }}
          </Button>
        </div>
      </div>
    </div>

    <div class="show-material-mode relative">
      <Button
        v-tooltip.right="{
          value: t('load3d.materialMode'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        class="rounded-full"
        :aria-label="t('load3d.materialMode')"
        @click="toggleMaterialMode"
      >
        <i class="pi pi-box text-lg text-white" />
      </Button>
      <div
        v-show="showMaterialMode"
        class="absolute top-0 left-12 rounded-lg bg-black/50 shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="mode in materialModes"
            :key="mode"
            variant="textonly"
            :class="
              cn(
                'whitespace-nowrap text-white',
                materialMode === mode && 'bg-blue-500'
              )
            "
            @click="selectMaterialMode(mode)"
          >
            {{ formatMaterialMode(mode) }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import { cn } from '@/utils/tailwindUtil'

const materialMode = defineModel<MaterialMode>('materialMode')
const upDirection = defineModel<UpDirection>('upDirection')

const showUpDirection = ref(false)
const showMaterialMode = ref(false)

const upDirections: UpDirection[] = [
  'original',
  '-x',
  '+x',
  '-y',
  '+y',
  '-z',
  '+z'
]

const materialModes = computed(() => {
  const modes: MaterialMode[] = [
    'original',
    'normal',
    'wireframe'
    //'depth' disable for now
  ]

  return modes
})

function toggleUpDirection() {
  showUpDirection.value = !showUpDirection.value
  showMaterialMode.value = false
}

function selectUpDirection(direction: UpDirection) {
  upDirection.value = direction
  showUpDirection.value = false
}

function toggleMaterialMode() {
  showMaterialMode.value = !showMaterialMode.value
  showUpDirection.value = false
}

function selectMaterialMode(mode: MaterialMode) {
  materialMode.value = mode
  showMaterialMode.value = false
}

function formatMaterialMode(mode: MaterialMode) {
  return t(`load3d.materialModes.${mode}`)
}

function closeSceneSlider(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (!target.closest('.show-up-direction')) {
    showUpDirection.value = false
  }

  if (!target.closest('.show-material-mode')) {
    showMaterialMode.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSceneSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSceneSlider)
})
</script>
