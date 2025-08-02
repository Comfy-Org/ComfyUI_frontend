<template>
  <div class="flex flex-col">
    <div class="relative show-up-direction">
      <Button class="p-button-rounded p-button-text" @click="toggleUpDirection">
        <i
          v-tooltip.right="{
            value: t('load3d.upDirection'),
            showDelay: 300
          }"
          class="pi pi-arrow-up text-white text-lg"
        />
      </Button>
      <div
        v-show="showUpDirection"
        class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="direction in upDirections"
            :key="direction"
            class="p-button-text text-white"
            :class="{ 'bg-blue-500': upDirection === direction }"
            @click="selectUpDirection(direction)"
          >
            {{ formatOption(direction) }}
          </Button>
        </div>
      </div>
    </div>

    <div class="relative show-material-mode">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleMaterialMode"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.materialMode'),
            showDelay: 300
          }"
          class="pi pi-box text-white text-lg"
        />
      </Button>
      <div
        v-show="showMaterialMode"
        class="absolute left-12 top-0 bg-black bg-opacity-50 rounded-lg shadow-lg"
      >
        <div class="flex flex-col">
          <Button
            v-for="mode in materialModes"
            :key="mode"
            class="p-button-text text-white"
            :class="{ 'bg-blue-500': materialMode === mode }"
            @click="selectMaterialMode(mode)"
          >
            {{ formatMaterialMode(mode) }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="
        materialMode === 'original' &&
        !props.inputSpec.isAnimation &&
        !props.inputSpec.isPreview
      "
      class="relative show-texture-upload"
    >
      <Button class="p-button-rounded p-button-text" @click="openTextureUpload">
        <i
          v-tooltip.right="{
            value: t('load3d.uploadTexture'),
            showDelay: 300
          }"
          class="pi pi-image text-white text-lg"
        />
        <input
          ref="texturePickerRef"
          type="file"
          accept="image/*"
          class="absolute opacity-0 w-0 h-0 p-0 m-0 pointer-events-none"
          @change="uploadTexture"
        />
      </Button>
    </div>

    <div v-if="materialMode === 'lineart'" class="relative show-edge-threshold">
      <Button
        class="p-button-rounded p-button-text"
        @click="toggleEdgeThreshold"
      >
        <i
          v-tooltip.right="{
            value: t('load3d.edgeThreshold'),
            showDelay: 300
          }"
          class="pi pi-sliders-h text-white text-lg"
        />
      </Button>
      <div
        v-show="showEdgeThreshold"
        class="absolute left-12 top-0 bg-black bg-opacity-50 p-4 rounded-lg shadow-lg"
        style="width: 150px"
      >
        <label class="text-white text-xs mb-1 block"
          >{{ t('load3d.edgeThreshold') }}: {{ edgeThreshold }}°</label
        >
        <Slider
          v-model="edgeThreshold"
          class="w-full"
          :min="0"
          :max="120"
          :step="1"
          @change="updateEdgeThreshold"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { MaterialMode, UpDirection } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const vTooltip = Tooltip

const props = defineProps<{
  inputSpec: CustomInputSpec
  upDirection: UpDirection
  materialMode: MaterialMode
  edgeThreshold?: number
}>()

const emit = defineEmits<{
  (e: 'updateUpDirection', direction: UpDirection): void
  (e: 'updateMaterialMode', mode: MaterialMode): void
  (e: 'updateEdgeThreshold', value: number): void
  (e: 'uploadTexture', file: File): void
}>()

const upDirection = ref(props.upDirection || 'original')
const materialMode = ref(props.materialMode || 'original')
const edgeThreshold = ref(props.edgeThreshold || 85)
const showUpDirection = ref(false)
const showMaterialMode = ref(false)
const showEdgeThreshold = ref(false)
const texturePickerRef = ref<HTMLInputElement | null>(null)

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

  if (!props.inputSpec.isAnimation && !props.inputSpec.isPreview) {
    modes.push('lineart')
  }

  return modes
})

watch(
  () => props.upDirection,
  (newValue) => {
    if (newValue) {
      upDirection.value = newValue
    }
  }
)

watch(
  () => props.materialMode,
  (newValue) => {
    if (newValue) {
      materialMode.value = newValue
    }
  }
)

watch(
  () => props.edgeThreshold,
  (newValue) => {
    // @ts-expect-error fixme ts strict error
    edgeThreshold.value = newValue
  }
)

const toggleUpDirection = () => {
  showUpDirection.value = !showUpDirection.value
  showMaterialMode.value = false
  showEdgeThreshold.value = false
}

const selectUpDirection = (direction: UpDirection) => {
  upDirection.value = direction
  emit('updateUpDirection', direction)
  showUpDirection.value = false
}

const formatOption = (option: string) => {
  if (option === 'original') return 'Original'
  return option.toUpperCase()
}

const toggleMaterialMode = () => {
  showMaterialMode.value = !showMaterialMode.value
  showUpDirection.value = false
  showEdgeThreshold.value = false
}

const selectMaterialMode = (mode: MaterialMode) => {
  materialMode.value = mode
  emit('updateMaterialMode', mode)
  showMaterialMode.value = false
}

const formatMaterialMode = (mode: MaterialMode) => {
  return t(`load3d.materialModes.${mode}`)
}

const toggleEdgeThreshold = () => {
  showEdgeThreshold.value = !showEdgeThreshold.value
  showUpDirection.value = false
  showMaterialMode.value = false
}

const updateEdgeThreshold = () => {
  emit('updateEdgeThreshold', edgeThreshold.value)
}

const openTextureUpload = () => {
  texturePickerRef.value?.click()
}

const uploadTexture = (event: Event) => {
  const input = event.target as HTMLInputElement

  if (input.files && input.files[0]) {
    emit('uploadTexture', input.files[0])
  }
}

const closeSceneSlider = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (!target.closest('.show-up-direction')) {
    showUpDirection.value = false
  }

  if (!target.closest('.show-material-mode')) {
    showMaterialMode.value = false
  }

  if (!target.closest('.show-edge-threshold')) {
    showEdgeThreshold.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSceneSlider)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSceneSlider)
})
</script>
