<template>
  <div class="pointer-events-none absolute inset-0 flex flex-col">
    <!-- Top bar: category selector + active category's controls -->
    <div
      ref="topBarRef"
      class="pointer-events-auto flex h-10 items-center gap-1 bg-black px-2"
      @wheel.stop
    >
      <Popover v-model:open="catMenuOpen">
        <PopoverTrigger as-child>
          <button :class="chipClass" type="button">
            {{ activeLabel }}
            <i class="icon-[lucide--chevron-down] size-4 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          :side-offset="8"
          :class="panelClass"
        >
          <button
            v-for="c in categoryDefs"
            :key="c.key"
            type="button"
            :class="
              cn(
                rowClass,
                activeCategory === c.key && 'bg-button-active-surface'
              )
            "
            @click="selectCategory(c.key)"
          >
            {{ c.label }}
          </button>
        </PopoverContent>
      </Popover>

      <div class="mx-1 h-5 w-px bg-white/10" />

      <!-- Scene -->
      <template v-if="activeCategory === 'scene' && !!sceneConfig">
        <button
          v-tooltip.bottom="tip(t('load3d.menuBar.showGrid'))"
          :class="actionClass(sceneConfig!.showGrid)"
          type="button"
          @click="sceneConfig!.showGrid = !sceneConfig!.showGrid"
        >
          <i class="icon-[lucide--grid-3x3] size-4" />
          <span v-if="!compact">{{ t('load3d.menuBar.showGrid') }}</span>
        </button>
        <template v-if="!sceneHasImage">
          <button
            v-tooltip.bottom="tip(t('load3d.menuBar.bgColor'))"
            :class="actionClass(false)"
            type="button"
            @click="colorRef?.click()"
          >
            <i class="icon-[lucide--palette] size-4" />
            <span v-if="!compact">{{ t('load3d.menuBar.bgColor') }}</span>
            <input
              ref="colorRef"
              type="color"
              class="pointer-events-none absolute size-0 opacity-0"
              :value="sceneConfig!.backgroundColor"
              @input="
                sceneConfig!.backgroundColor = (
                  $event.target as HTMLInputElement
                ).value
              "
            />
          </button>
          <button
            v-if="canUseBackgroundImage"
            v-tooltip.bottom="tip(t('load3d.menuBar.bgImage'))"
            :class="actionClass(false)"
            type="button"
            @click="bgImageRef?.click()"
          >
            <i class="icon-[lucide--image] size-4" />
            <span v-if="!compact">{{ t('load3d.menuBar.bgImage') }}</span>
            <input
              ref="bgImageRef"
              type="file"
              accept="image/*"
              class="pointer-events-none absolute size-0 opacity-0"
              @change="onBackgroundImagePicked"
            />
          </button>
        </template>
        <template v-else>
          <button
            v-tooltip.bottom="tip(t('load3d.menuBar.panorama'))"
            :class="
              actionClass(sceneConfig!.backgroundRenderMode === 'panorama')
            "
            type="button"
            @click="togglePanorama"
          >
            <i class="icon-[lucide--globe] size-4" />
            <span v-if="!compact">{{ t('load3d.menuBar.panorama') }}</span>
          </button>
          <button
            v-tooltip.bottom="tip(t('load3d.menuBar.removeBackground'))"
            :class="actionClass(false)"
            type="button"
            @click="emit('updateBackgroundImage', null)"
          >
            <i class="icon-[lucide--x] size-4" />
            <span v-if="!compact">{{
              t('load3d.menuBar.removeBackground')
            }}</span>
          </button>
        </template>
      </template>

      <!-- 3D Model -->
      <template v-else-if="activeCategory === 'model' && !!modelConfig">
        <Popover>
          <PopoverTrigger as-child>
            <button
              v-tooltip.bottom="tip(t('load3d.menuBar.upDirection'))"
              :class="actionClass(false)"
              type="button"
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
              :class="
                cn(
                  rowClass,
                  modelConfig!.upDirection === d && 'bg-button-active-surface'
                )
              "
              @click="modelConfig!.upDirection = d"
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
              :class="
                cn(
                  rowClass,
                  modelConfig!.materialMode === m && 'bg-button-active-surface'
                )
              "
              @click="modelConfig!.materialMode = m"
            >
              {{ t(`load3d.materialModes.${m}`) }}
            </button>
          </PopoverContent>
        </Popover>
        <button
          v-if="hasSkeleton"
          v-tooltip.bottom="tip(t('load3d.menuBar.skeleton'))"
          :class="actionClass(modelConfig!.showSkeleton)"
          type="button"
          @click="modelConfig!.showSkeleton = !modelConfig!.showSkeleton"
        >
          <i class="icon-[lucide--bone] size-4" />
          <span v-if="!compact">{{ t('load3d.menuBar.skeleton') }}</span>
        </button>
      </template>

      <!-- Camera -->
      <template v-else-if="activeCategory === 'camera' && !!cameraConfig">
        <button
          v-tooltip.bottom="tip(t('load3d.menuBar.switchProjection'))"
          :class="actionClass(false)"
          type="button"
          @click="switchCamera"
        >
          <i class="icon-[lucide--camera] size-4" />
          <span v-if="!compact">{{ cap(cameraConfig!.cameraType) }}</span>
        </button>
        <Popover v-if="cameraConfig!.cameraType === 'perspective'">
          <PopoverTrigger as-child>
            <button
              v-tooltip.bottom="tip(t('load3d.menuBar.fov'))"
              :class="actionClass(false)"
              type="button"
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
                :model-value="[cameraConfig!.fov]"
                :min="1"
                :max="150"
                :step="1"
                class="w-full"
                @update:model-value="
                  (v) => v?.length && (cameraConfig!.fov = v[0])
                "
              />
            </div>
          </PopoverContent>
        </Popover>
      </template>

      <!-- Lighting -->
      <template
        v-else-if="activeCategory === 'light' && !!lightConfig && !!modelConfig"
      >
        <Popover v-if="modelConfig!.materialMode === 'original'">
          <PopoverTrigger as-child>
            <button
              v-tooltip.bottom="tip(t('load3d.menuBar.intensity'))"
              :class="actionClass(false)"
              type="button"
            >
              <i class="icon-[lucide--sun] size-4" />
              <span v-if="!compact">{{ t('load3d.menuBar.intensity') }}</span>
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
                t('load3d.lightIntensity')
              }}</span>
              <Slider
                :model-value="[lightConfig!.intensity]"
                :min="0"
                :max="10"
                :step="0.1"
                class="w-full"
                @update:model-value="
                  (v) => v?.length && (lightConfig!.intensity = v[0])
                "
              />
            </div>
          </PopoverContent>
        </Popover>
        <span v-else class="px-2 text-sm text-muted">{{
          t('load3d.menuBar.originalMaterialOnly')
        }}</span>
      </template>
    </div>

    <!-- Viewport shows through here (pointer events pass to the 3D canvas) -->
    <div class="flex-1" />

    <!-- Bottom bar: Record (left) · fit + export (right) -->
    <div
      class="pointer-events-auto flex h-10 items-center justify-between bg-black px-2"
      @wheel.stop
    >
      <button
        v-tooltip.top="
          tip(
            recording
              ? t('load3d.menuBar.stopRecording')
              : t('load3d.menuBar.record')
          )
        "
        :class="chipClass"
        type="button"
        @click="recording = !recording"
      >
        <span
          v-if="recording"
          class="size-2 animate-pulse rounded-full bg-red-500"
        />
        {{ t('load3d.menuBar.record') }}
      </button>

      <div class="flex items-center gap-1">
        <button
          v-tooltip.top="tip(t('load3d.fitToViewer'))"
          :class="iconBtnClass"
          type="button"
          :aria-label="t('load3d.fitToViewer')"
          @click="emit('fitToViewer')"
        >
          <i class="icon-[lucide--scan] size-4" />
        </button>
        <Popover v-if="canExport" v-model:open="exportOpen">
          <PopoverTrigger as-child>
            <button
              v-tooltip.top="tip(t('load3d.export'))"
              :class="iconBtnClass"
              type="button"
              :aria-label="t('load3d.export')"
            >
              <i class="icon-[lucide--download] size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            :side-offset="8"
            :class="panelClass"
          >
            <button
              v-for="format in exportFormats"
              :key="format.value"
              type="button"
              :class="rowClass"
              @click="onExport(format.value)"
            >
              {{ format.label }}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { getExportFormatOptions } from '@/extensions/core/load3d/constants'
import type {
  CameraConfig,
  LightConfig,
  MaterialMode,
  ModelConfig,
  SceneConfig,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { cn } from '@comfyorg/tailwind-utils'

const {
  canUseLighting = true,
  canExport = true,
  canUseBackgroundImage = true,
  materialModes = ['original', 'clay', 'normal', 'wireframe'],
  hasSkeleton = false,
  sourceFormat = null
} = defineProps<{
  canUseLighting?: boolean
  canExport?: boolean
  canUseBackgroundImage?: boolean
  materialModes?: readonly MaterialMode[]
  hasSkeleton?: boolean
  sourceFormat?: string | null
}>()

const sceneConfig = defineModel<SceneConfig>('sceneConfig')
const modelConfig = defineModel<ModelConfig>('modelConfig')
const cameraConfig = defineModel<CameraConfig>('cameraConfig')
const lightConfig = defineModel<LightConfig>('lightConfig')

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
  (e: 'exportModel', format: string): void
  (e: 'fitToViewer'): void
}>()

const { t } = useI18n()

const categoryDefs = computed(() =>
  [
    { key: 'scene', label: t('load3d.scene'), show: !!sceneConfig.value },
    {
      key: 'model',
      label: `3D ${t('load3d.model')}`,
      show: !!modelConfig.value
    },
    { key: 'camera', label: t('load3d.camera'), show: !!cameraConfig.value },
    {
      key: 'light',
      label: t('load3d.light'),
      show: canUseLighting && !!lightConfig.value && !!modelConfig.value
    }
  ].filter((c) => c.show)
)

const activeCategory = ref('scene')
const activeLabel = computed(
  () =>
    categoryDefs.value.find((c) => c.key === activeCategory.value)?.label ?? ''
)
watch(categoryDefs, (defs) => {
  if (!defs.some((c) => c.key === activeCategory.value)) {
    activeCategory.value = defs[0]?.key ?? 'scene'
  }
})

const catMenuOpen = ref(false)
const exportOpen = ref(false)
const recording = ref(false)

const selectCategory = (key: string) => {
  activeCategory.value = key
  catMenuOpen.value = false
}

const sceneHasImage = computed(
  () =>
    !!sceneConfig.value?.backgroundImage &&
    sceneConfig.value.backgroundImage !== ''
)
const exportFormats = computed(() => getExportFormatOptions(sourceFormat))
const upDirections: UpDirection[] = [
  'original',
  '-x',
  '+x',
  '-y',
  '+y',
  '-z',
  '+z'
]

const colorRef = ref<HTMLInputElement | null>(null)
const bgImageRef = ref<HTMLInputElement | null>(null)
const topBarRef = ref<HTMLElement | null>(null)
const { width: topW } = useElementSize(topBarRef)
const compact = computed(() => topW.value > 0 && topW.value < 380)

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const tip = (label: string) => ({ value: label, showDelay: 300 })

const onBackgroundImagePicked = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) emit('updateBackgroundImage', input.files[0])
}
const togglePanorama = () => {
  if (!sceneConfig.value) return
  sceneConfig.value.backgroundRenderMode =
    sceneConfig.value.backgroundRenderMode === 'panorama' ? 'tiled' : 'panorama'
}
const switchCamera = () => {
  if (!cameraConfig.value) return
  cameraConfig.value.cameraType =
    cameraConfig.value.cameraType === 'perspective'
      ? 'orthographic'
      : 'perspective'
}
const onExport = (format: string) => {
  emit('exportModel', format)
  exportOpen.value = false
}

const chipClass =
  'flex items-center gap-1.5 rounded-lg border-0 bg-interface-menu-surface px-2.5 py-1 text-sm text-base-foreground outline-none transition-colors hover:bg-button-active-surface'
const iconBtnClass =
  'flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-base-foreground outline-none transition-colors hover:bg-white/10'
const panelClass =
  'w-48 max-h-80 overflow-y-auto flex flex-col gap-0.5 p-1.5 rounded-lg border-border-default bg-base-background shadow-[0_2px_12px_0_rgba(0,0,0,0.10)]'
const rowClass =
  'flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm text-base-foreground outline-none hover:bg-white/10'
const actionClass = (active: boolean) =>
  cn(
    'flex shrink-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-sm text-base-foreground transition-colors outline-none hover:bg-white/10',
    active && 'bg-white/10'
  )
</script>
