<template>
  <ViewportWidgetShell
    ref="shell"
    bottom-class="justify-end"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <template #top>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="gizmosLabel"
        tooltip-side="bottom"
        type="button"
        :disabled="lookingThrough"
        :class="actionClass(!lookingThrough && gizmosOn)"
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
      </Button>
      <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />
      <Button
        v-for="option in transformGizmoOptions"
        :key="option.value"
        variant="textonly"
        size="unset"
        :tooltip="$t(option.labelKey)"
        tooltip-side="bottom"
        type="button"
        :disabled="lookingThrough || !option.enabled"
        :aria-pressed="
          !lookingThrough && effectiveTransformGizmoMode === option.value
        "
        :aria-label="compact ? $t(option.labelKey) : undefined"
        :class="
          actionClass(
            !lookingThrough && effectiveTransformGizmoMode === option.value
          )
        "
        @click="selectTransformGizmo(option.value)"
      >
        <i :class="cn('size-4', option.icon)" />
        <span v-if="!compact">{{ $t(option.labelKey) }}</span>
      </Button>
    </template>
    <template #bottom>
      <Button
        variant="textonly"
        size="icon"
        :tooltip="lookThroughLabel"
        type="button"
        :class="cn(lookingThrough && 'bg-button-active-surface')"
        :aria-pressed="lookingThrough"
        :aria-label="lookThroughLabel"
        @click="toggleLookThrough"
      >
        <i class="icon-[lucide--video] size-4" />
      </Button>
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

import { cn } from '@comfyorg/tailwind-utils'

import ViewportWidgetShell from '@/components/load3d/ViewportWidgetShell.vue'
import { actionClass } from '@/components/load3d/menubar/menuBarStyles'
import Button from '@/components/ui/button/Button.vue'
import { useCameraInfo } from '@/composables/useCameraInfo'
import type { TransformGizmoMode } from '@/extensions/core/cameraInfo/CameraInfoViewport'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { resolveNode } from '@/utils/litegraphUtil'

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

const shell = useTemplateRef<InstanceType<typeof ViewportWidgetShell>>('shell')
const { width: toolbarWidth } = useElementSize(
  computed(() => shell.value?.toolbar ?? null)
)
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

const effectiveTransformGizmoMode = computed<TransformGizmoMode>(() =>
  transformGizmoOptions.value.some(
    ({ value, enabled }) => value === transformGizmoMode.value && enabled
  )
    ? transformGizmoMode.value
    : 'none'
)

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
watch(effectiveTransformGizmoMode, (m) => setTransformGizmoMode(m))
watch(lookingThrough, (on) => setLookThrough(on))

onMounted(() => {
  const container = shell.value?.container
  if (container) initialize(container)
})

onUnmounted(() => {
  cleanup()
})
</script>
