<template>
  <div
    class="relative size-full min-h-[300px]"
    @pointerdown.stop
    @mousedown.stop
  >
    <div
      ref="container"
      class="relative size-full"
      data-capture-wheel="true"
      tabindex="-1"
      @pointerdown.stop="focusContainer"
      @contextmenu.stop.prevent
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    />
    <div class="pointer-events-none absolute inset-x-0 top-0">
      <div
        ref="toolbar"
        class="pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2"
        @wheel.stop
      >
        <button
          v-tooltip.bottom="tip(gizmosLabel)"
          type="button"
          :disabled="lookingThrough"
          :class="
            cn(
              actionClass(!lookingThrough && gizmosOn),
              lookingThrough && 'cursor-not-allowed opacity-40'
            )
          "
          :aria-pressed="!lookingThrough && gizmosOn"
          :aria-label="compact ? gizmosLabel : undefined"
          @click="toggleGizmos"
        >
          <i
            :class="
              cn(
                'size-4',
                gizmosOn ? 'icon-[lucide--eye]' : 'icon-[lucide--eye-off]'
              )
            "
          />
          <span v-if="!compact">{{ gizmosLabel }}</span>
        </button>
        <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />
        <button
          v-for="option in transformGizmoOptions"
          :key="option.value"
          v-tooltip.bottom="tip($t(option.labelKey))"
          type="button"
          :disabled="lookingThrough || !option.enabled"
          :aria-pressed="!lookingThrough && transformGizmoMode === option.value"
          :aria-label="compact ? $t(option.labelKey) : undefined"
          :class="
            cn(
              actionClass(
                !lookingThrough && transformGizmoMode === option.value
              ),
              (lookingThrough || !option.enabled) &&
                'cursor-not-allowed opacity-40'
            )
          "
          @click="selectTransformGizmo(option.value)"
        >
          <i :class="cn('size-4', option.icon)" />
          <span v-if="!compact">{{ $t(option.labelKey) }}</span>
        </button>
      </div>
    </div>
    <div class="pointer-events-none absolute inset-x-0 bottom-0">
      <div
        class="pointer-events-auto flex h-10 items-center justify-end gap-1 bg-interface-menu-surface px-2"
        @wheel.stop
      >
        <button
          v-tooltip.top="tip(lookThroughLabel)"
          type="button"
          :class="
            cn(iconBtnClass, lookingThrough && 'bg-button-active-surface')
          "
          :aria-pressed="lookingThrough"
          :aria-label="lookThroughLabel"
          @click="toggleLookThrough"
        >
          <i class="icon-[lucide--video] size-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  iconBtnClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import { useCameraInfo } from '@/composables/useCameraInfo'
import type { TransformGizmoMode } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { widget, nodeId } = defineProps<{
  widget: ComponentWidget<string[]> | SimplifiedWidget
  nodeId?: NodeId
}>()

function isComponentWidget(
  w: ComponentWidget<string[]> | SimplifiedWidget
): w is ComponentWidget<string[]> {
  return 'node' in w && w.node !== undefined
}

const node = ref<LGraphNode | null>(null)
if (isComponentWidget(widget)) {
  node.value = widget.node
} else if (nodeId) {
  onMounted(() => {
    node.value = resolveNode(nodeId) ?? null
  })
}

const { t } = useI18n()

const container = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const { width: toolbarWidth } = useElementSize(toolbar)
const compactWidthThreshold = 480
const compact = computed(
  () => toolbarWidth.value > 0 && toolbarWidth.value < compactWidthThreshold
)
const gizmosOn = ref(true)
const lookingThrough = ref(false)
const transformGizmoMode = ref<TransformGizmoMode>('none')
const {
  initialize,
  cleanup,
  handleMouseEnter,
  handleMouseLeave,
  setGizmosVisible,
  setTransformGizmoMode,
  setLookThrough,
  mode
} = useCameraInfo(node as Ref<LGraphNode | null>)

const gizmosLabel = computed(() =>
  gizmosOn.value ? t('load3d.hideGizmos') : t('load3d.showGizmos')
)

const lookThroughLabel = computed(() =>
  lookingThrough.value ? t('load3d.exitLookThrough') : t('load3d.lookThrough')
)

const transformGizmoOptions = computed(() => [
  {
    value: 'none' as const,
    labelKey: 'load3d.transformGizmo.none',
    icon: 'icon-[lucide--ban]',
    enabled: true
  },
  {
    value: 'target' as const,
    labelKey: 'load3d.transformGizmo.target',
    icon: 'icon-[lucide--target]',
    enabled: mode.value === 'orbit' || mode.value === 'look_at'
  },
  {
    value: 'camera-translate' as const,
    labelKey: 'load3d.transformGizmo.cameraTranslate',
    icon: 'icon-[lucide--move-3d]',
    enabled: mode.value === 'look_at' || mode.value === 'quaternion'
  },
  {
    value: 'camera-rotate' as const,
    labelKey: 'load3d.transformGizmo.cameraRotate',
    icon: 'icon-[lucide--rotate-3d]',
    enabled: mode.value === 'quaternion'
  }
])

function focusContainer() {
  container.value?.focus()
}

function toggleGizmos() {
  gizmosOn.value = !gizmosOn.value
}

function toggleLookThrough() {
  lookingThrough.value = !lookingThrough.value
}

function selectTransformGizmo(value: TransformGizmoMode) {
  transformGizmoMode.value = value
}

watch(gizmosOn, (on) => setGizmosVisible(on))
watch(transformGizmoMode, (m) => setTransformGizmoMode(m))
watch(lookingThrough, (on) => setLookThrough(on))
watch(mode, () => {
  const selected = transformGizmoOptions.value.find(
    ({ value }) => value === transformGizmoMode.value
  )
  if (!selected?.enabled) transformGizmoMode.value = 'none'
})

onMounted(() => {
  if (container.value) initialize(container.value)
})

onUnmounted(() => {
  cleanup()
})
</script>
