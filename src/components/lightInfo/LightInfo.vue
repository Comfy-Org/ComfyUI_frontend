<template>
  <div
    class="flex size-full min-h-[300px] flex-col gap-1"
    @pointerdown.stop
    @mousedown.stop
    @contextmenu.stop.prevent
  >
    <div
      ref="viewportArea"
      class="relative min-h-[220px] shrink-0"
      :style="{ height: `calc(100% - ${panelBudget}px)` }"
    >
      <div
        ref="container"
        class="relative size-full"
        data-capture-wheel="true"
        tabindex="-1"
        @pointerdown.stop="container?.focus()"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      />
      <LightInfoViewportToolbar
        v-model:gizmos-on="gizmosOn"
        v-model:transform-gizmo-mode="transformGizmoMode"
        v-model:camera-locked="cameraLocked"
        :compact
        :light-type="selectedLight?.type ?? null"
        @reset-view="resetViewToOutput"
      />
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      data-capture-wheel="true"
    >
      <div class="flex h-9 items-center gap-1 overflow-x-auto px-1">
        <Button
          v-for="(light, index) in lights"
          :key="index"
          :tooltip="$t(LIGHT_TYPE_LABEL_KEYS[light.type])"
          variant="textonly"
          size="unset"
          :aria-pressed="index === selectedIndex"
          :aria-label="
            $t('lightInfo.lightChip', {
              index: chipNumber(index),
              type: $t(LIGHT_TYPE_LABEL_KEYS[light.type])
            })
          "
          :class="lightChipClass(index === selectedIndex)"
          @click="selectLight(index)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: light.color }"
          />
          {{ chipNumber(index) }}
        </Button>
        <Button
          :tooltip="$t('lightInfo.addLight')"
          variant="textonly"
          size="unset"
          :class="iconBtnClass"
          :aria-label="$t('lightInfo.addLight')"
          @click="addLight('directional')"
        >
          <i class="icon-[lucide--plus] size-4" />
        </Button>
        <Button
          v-if="selectedLight"
          :tooltip="$t('lightInfo.removeLight')"
          variant="textonly"
          size="unset"
          :class="iconBtnClass"
          :aria-label="$t('lightInfo.removeLight')"
          @click="removeSelectedLight"
        >
          <i class="icon-[lucide--trash-2] size-4" />
        </Button>
      </div>

      <LightInfoLightEditor
        v-if="selectedLight"
        :light="selectedLight"
        :compact
        @update="updateSelectedLight"
        @change-type="setSelectedLightType"
      />
      <div v-else class="px-2 pb-1 text-xs text-muted-foreground">
        {{ $t('lightInfo.noLights') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import {
  chipClass,
  iconBtnClass
} from '@/components/load3d/menubar/menuBarStyles'
import Button from '@/components/ui/button/Button.vue'
import type { LightTransformGizmoMode } from '@/extensions/core/lightInfo/LightInfoViewport'
import { LIGHT_TYPE_LABEL_KEYS } from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

import LightInfoLightEditor from './LightInfoLightEditor.vue'
import LightInfoViewportToolbar from './LightInfoViewportToolbar.vue'
import { useLightInfo } from './useLightInfo'

const COMPACT_WIDTH_THRESHOLD = 480
const PANEL_BUDGET_WIDE = 208
const PANEL_BUDGET_COMPACT = 352

function chipNumber(index: number) {
  return String(index + 1).padStart(2, '0')
}

function lightChipClass(active: boolean) {
  return cn(
    chipClass,
    'border border-transparent bg-transparent font-mono text-xs',
    active
      ? 'border-component-node-border bg-component-node-widget-background-selected text-base-foreground'
      : 'text-muted-foreground hover:bg-button-hover-surface hover:text-base-foreground'
  )
}

const { nodeId } = defineProps<{
  nodeId: NodeId
}>()

const node = shallowRef<LGraphNode | null>(null)
const container = ref<HTMLElement | null>(null)
const viewportArea = ref<HTMLElement | null>(null)
const { width: viewportWidth } = useElementSize(viewportArea)
const compact = computed(
  () => viewportWidth.value > 0 && viewportWidth.value < COMPACT_WIDTH_THRESHOLD
)
const panelBudget = computed(() =>
  compact.value ? PANEL_BUDGET_COMPACT : PANEL_BUDGET_WIDE
)
const gizmosOn = ref(true)
const transformGizmoMode = ref<LightTransformGizmoMode>('none')
const cameraLocked = ref(false)

const {
  initialize,
  cleanup,
  handleMouseEnter,
  handleMouseLeave,
  setGizmosVisible,
  setTransformGizmoMode,
  resetViewToOutput,
  setCameraLocked,
  lights,
  selectedIndex,
  selectedLight,
  selectLight,
  addLight,
  removeSelectedLight,
  updateSelectedLight,
  setSelectedLightType
} = useLightInfo(node)

watch(gizmosOn, (on) => setGizmosVisible(on))
watch(transformGizmoMode, (mode) => setTransformGizmoMode(mode))
watch(cameraLocked, (locked) => setCameraLocked(locked))

onMounted(() => {
  node.value = resolveNode(nodeId) ?? null
  if (container.value) initialize(container.value)
})

onUnmounted(() => {
  cleanup()
})
</script>
