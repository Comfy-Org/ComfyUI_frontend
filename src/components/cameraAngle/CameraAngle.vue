<template>
  <ViewportWidgetShell
    ref="shell"
    bottom-class="h-12"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <template #top>
      <button
        v-for="option in viewModeOptions"
        :key="option.value"
        v-tooltip.bottom="tip(option.tooltip)"
        type="button"
        :class="actionClass(viewMode === option.value)"
        :aria-pressed="viewMode === option.value"
        :aria-label="option.label"
        @click="setViewMode(option.value)"
      >
        <i :class="cn('size-4', option.icon)" />
        <span v-if="!compact">{{ option.label }}</span>
      </button>
      <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />
      <button
        v-tooltip.bottom="tip(previewLabel)"
        type="button"
        :disabled="viewMode === 'object'"
        :class="
          cn(
            actionClass(viewMode === 'camera' && previewVisible),
            viewMode === 'object' && 'cursor-not-allowed opacity-40'
          )
        "
        :aria-pressed="viewMode === 'camera' && previewVisible"
        :aria-label="previewLabel"
        @click="setPreviewVisible(!previewVisible)"
      >
        <i class="icon-[lucide--picture-in-picture-2] size-4" />
        <span v-if="!compact">{{ $t('cameraAngle.preview') }}</span>
      </button>
      <span
        class="ml-auto min-w-0 truncate text-xs text-muted-foreground"
        :title="prompt"
        data-testid="camera-angle-prompt"
      >
        {{ prompt }}
      </span>
    </template>
    <template #bottom>
      <Select
        v-for="group in presetGroups"
        :key="group.field"
        :model-value="group.current"
        @update:model-value="(key) => selectPreset(group.field, key)"
      >
        <SelectTrigger
          size="md"
          class="min-w-0 flex-1"
          :aria-label="group.label"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="term in group.terms"
            :key="term.key"
            :value="term.key"
          >
            {{ $t(`cameraAngle.${group.field}.${term.key}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </template>
  </ViewportWidgetShell>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ViewportWidgetShell from '@/components/load3d/ViewportWidgetShell.vue'
import { actionClass, tip } from '@/components/load3d/menubar/menuBarStyles'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import { useCameraAngle } from '@/composables/useCameraAngle'
import {
  DISTANCE_TERMS,
  HORIZONTAL_TERMS,
  VERTICAL_TERMS,
  distanceTerm,
  horizontalTerm,
  verticalTerm
} from '@/extensions/core/cameraAngle/cameraAngleMath'
import type { CameraAngleTerm } from '@/extensions/core/cameraAngle/cameraAngleMath'
import type {
  CameraAngleField,
  CameraAngleViewMode
} from '@/extensions/core/cameraAngle/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { widget } = defineProps<{
  widget: SimplifiedWidget
}>()

const node = ref<LGraphNode | null>(null)

const { t } = useI18n()
const shell = useTemplateRef<InstanceType<typeof ViewportWidgetShell>>('shell')
const { width: toolbarWidth } = useElementSize(
  computed(() => shell.value?.toolbar ?? null)
)
const compactWidthThreshold = 420
const compact = computed(
  () => toolbarWidth.value > 0 && toolbarWidth.value < compactWidthThreshold
)

const {
  initialize,
  cleanup,
  handleMouseEnter,
  handleMouseLeave,
  setViewMode,
  setPreviewVisible,
  setField,
  state,
  viewMode,
  previewVisible,
  prompt
} = useCameraAngle(node as Ref<LGraphNode | null>, {
  faceLabels: () => ({
    back: t('cameraAngle.faces.back'),
    left: t('cameraAngle.faces.left'),
    right: t('cameraAngle.faces.right'),
    top: t('cameraAngle.faces.top'),
    bottom: t('cameraAngle.faces.bottom')
  })
})

const previewLabel = computed(() =>
  previewVisible.value
    ? t('cameraAngle.hidePreview')
    : t('cameraAngle.showPreview')
)

const viewModeOptions = computed<
  {
    value: CameraAngleViewMode
    label: string
    tooltip: string
    icon: string
  }[]
>(() => [
  {
    value: 'camera',
    label: t('cameraAngle.cameraView'),
    tooltip: t('cameraAngle.cameraViewTooltip'),
    icon: 'icon-[lucide--video]'
  },
  {
    value: 'object',
    label: t('cameraAngle.objectView'),
    tooltip: t('cameraAngle.objectViewTooltip'),
    icon: 'icon-[lucide--box]'
  }
])

interface PresetGroup {
  field: CameraAngleField
  label: string
  terms: readonly CameraAngleTerm[]
  current: string
}

const presetGroups = computed<PresetGroup[]>(() => [
  {
    field: 'horizontal',
    label: t('cameraAngle.horizontalLabel'),
    terms: HORIZONTAL_TERMS,
    current: horizontalTerm(state.value.horizontal).key
  },
  {
    field: 'vertical',
    label: t('cameraAngle.verticalLabel'),
    terms: VERTICAL_TERMS,
    current: verticalTerm(state.value.vertical).key
  },
  {
    field: 'zoom',
    label: t('cameraAngle.zoomLabel'),
    terms: DISTANCE_TERMS,
    current: distanceTerm(state.value.zoom).key
  }
])

function selectPreset(field: CameraAngleField, key: unknown) {
  const group = presetGroups.value.find((g) => g.field === field)
  const term = group?.terms.find((candidate) => candidate.key === key)
  if (term) setField(field, term.preset)
}

const canvasStore = useCanvasStore()

function resolveOwnerNode(): LGraphNode | null {
  const locatorId = widget.nodeLocatorId
  const graph = app.rootGraphOrUndefined
  return locatorId && graph ? getNodeByLocatorId(graph, locatorId) : null
}

onMounted(() => {
  watch(
    () => canvasStore.rootGraphId,
    () => {
      const container = shell.value?.container
      if (node.value || !container) return
      node.value = resolveOwnerNode()
      if (node.value) initialize(container)
    },
    { immediate: true }
  )
})

onUnmounted(() => {
  cleanup()
})
</script>
