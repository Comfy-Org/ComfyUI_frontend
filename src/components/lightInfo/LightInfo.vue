<template>
  <div
    class="flex size-full min-h-[300px] flex-col gap-1"
    @pointerdown.stop
    @mousedown.stop
    @contextmenu.stop.prevent
  >
    <div
      class="relative min-h-[220px] shrink-0"
      :style="{ height: `calc(100% - ${panelBudget}px)` }"
    >
      <div
        ref="container"
        class="relative size-full"
        data-capture-wheel="true"
        tabindex="-1"
        @pointerdown.stop="focusContainer"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      />
      <div class="pointer-events-none absolute inset-0 flex flex-col">
        <div
          ref="toolbar"
          class="pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2"
          @wheel.stop
        >
          <button
            v-tooltip.bottom="
              tip(gizmosOn ? $t('load3d.hideGizmos') : $t('load3d.showGizmos'))
            "
            type="button"
            :class="actionClass(gizmosOn)"
            :aria-pressed="gizmosOn"
            :aria-label="
              gizmosOn ? $t('load3d.hideGizmos') : $t('load3d.showGizmos')
            "
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
            <span v-if="!compact">
              {{ gizmosOn ? $t('load3d.hideGizmos') : $t('load3d.showGizmos') }}
            </span>
          </button>
          <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />
          <button
            v-for="option in transformGizmoOptions"
            :key="option.value"
            v-tooltip.bottom="tip($t(option.labelKey))"
            type="button"
            :disabled="!option.enabled"
            :aria-pressed="transformGizmoMode === option.value"
            :aria-label="$t(option.labelKey)"
            :class="
              cn(
                actionClass(transformGizmoMode === option.value),
                !option.enabled && 'cursor-not-allowed opacity-40'
              )
            "
            @click="selectTransformGizmo(option.value)"
          >
            <i :class="cn('size-4', option.icon)" />
            <span v-if="!compact">{{ $t(option.labelKey) }}</span>
          </button>
        </div>
        <div class="flex-1" />
        <div
          class="pointer-events-auto flex h-10 items-center justify-end gap-1 bg-interface-menu-surface px-2"
          @wheel.stop
        >
          <button
            v-tooltip.top="tip($t('load3d.outputView'))"
            type="button"
            :class="iconBtnClass"
            :aria-label="$t('load3d.outputView')"
            @click="resetViewToOutput"
          >
            <i class="icon-[lucide--focus] size-4" />
          </button>
          <button
            v-tooltip.top="
              tip(
                cameraLocked
                  ? $t('load3d.unlockCamera')
                  : $t('load3d.lockCamera')
              )
            "
            type="button"
            :class="
              cn(iconBtnClass, cameraLocked && 'bg-button-active-surface')
            "
            :aria-pressed="cameraLocked"
            :aria-label="
              cameraLocked ? $t('load3d.unlockCamera') : $t('load3d.lockCamera')
            "
            @click="toggleCameraLock"
          >
            <i
              :class="
                cn(
                  'size-4',
                  cameraLocked
                    ? 'icon-[lucide--lock]'
                    : 'icon-[lucide--lock-open]'
                )
              "
            />
          </button>
        </div>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      data-capture-wheel="true"
    >
      <div class="flex h-9 items-center gap-1 overflow-x-auto px-1">
        <Button
          v-for="(light, index) in lights"
          :key="index"
          v-tooltip.top="tip($t(lightTypeLabelKey[light.type]))"
          variant="textonly"
          size="unset"
          :aria-pressed="index === selectedIndex"
          :class="lightChipClass(index === selectedIndex)"
          @click="selectLight(index)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: light.color }"
          />
          {{ String(index + 1).padStart(2, '0') }}
        </Button>
        <Button
          v-tooltip.top="tip($t('lightInfo.addLight'))"
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
          v-tooltip.top="tip($t('lightInfo.removeLight'))"
          variant="textonly"
          size="unset"
          :class="iconBtnClass"
          :aria-label="$t('lightInfo.removeLight')"
          @click="removeSelectedLight"
        >
          <i class="icon-[lucide--trash-2] size-4" />
        </Button>
      </div>

      <div
        v-if="selectedLight"
        class="flex flex-col gap-2 rounded-sm bg-node-component-surface p-2 text-xs"
      >
        <ToggleGroup
          type="single"
          :model-value="selectedLight.type"
          class="w-full min-w-0 rounded-md bg-component-node-widget-background p-1"
          @update:model-value="onTypeChange"
        >
          <ToggleGroupItem
            v-for="type in LIGHT_TYPES"
            :key="type"
            :value="type"
            size="sm"
            class="flex-1 px-2"
          >
            {{ $t(lightTypeLabelKey[type]) }}
          </ToggleGroupItem>
        </ToggleGroup>
        <div
          :class="
            cn(
              'grid items-center gap-x-2 gap-y-1',
              compact
                ? 'grid-cols-[auto_minmax(0,1fr)]'
                : 'grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]'
            )
          "
        >
          <label :class="fieldLabelClass">{{ $t('lightInfo.color') }}</label>
          <ColorPicker
            :model-value="selectedLight.color"
            :alpha="false"
            @update:model-value="(color) => updateSelectedLight({ color })"
          />
          <label :class="fieldLabelClass">
            {{ $t('lightInfo.intensity') }}
          </label>
          <ScrubableNumberInput
            :model-value="selectedLight.intensity"
            :display-value="formatField('intensity', selectedLight.intensity)"
            :min="0"
            :step="0.1"
            @update:model-value="(value) => setNumber('intensity', value)"
          />
          <label :class="fieldLabelClass">
            {{ $t('lightInfo.castShadow') }}
          </label>
          <Switch
            :model-value="selectedLight.castShadow !== false"
            :aria-label="$t('lightInfo.castShadow')"
            @update:model-value="
              (castShadow) => updateSelectedLight({ castShadow })
            "
          />
          <label :class="fieldLabelClass">
            {{
              selectedLight.type === 'directional'
                ? $t('lightInfo.angle')
                : $t('lightInfo.size')
            }}
          </label>
          <ScrubableNumberInput
            :model-value="selectedLight.radius ?? 0"
            :display-value="formatField('radius', selectedLight.radius ?? 0)"
            :min="0"
            :step="selectedLight.type === 'directional' ? 0.1 : 0.05"
            @update:model-value="(value) => setNumber('radius', value)"
          />
          <template v-if="selectedLight.type !== 'directional'">
            <label :class="fieldLabelClass">{{ $t('lightInfo.range') }}</label>
            <ScrubableNumberInput
              :model-value="selectedLight.range ?? 0"
              :display-value="formatField('range', selectedLight.range ?? 0)"
              :min="0"
              :step="0.5"
              @update:model-value="(value) => setNumber('range', value)"
            />
          </template>
          <template v-if="selectedLight.type === 'spot'">
            <label :class="fieldLabelClass">
              {{ $t('lightInfo.innerCone') }}
            </label>
            <ScrubableNumberInput
              :model-value="selectedLight.innerConeAngle ?? 30"
              :display-value="
                formatField(
                  'innerConeAngle',
                  selectedLight.innerConeAngle ?? 30
                )
              "
              :min="0"
              :max="90"
              :step="1"
              @update:model-value="
                (value) => setNumber('innerConeAngle', value)
              "
            />
            <label :class="fieldLabelClass">
              {{ $t('lightInfo.outerCone') }}
            </label>
            <ScrubableNumberInput
              :model-value="selectedLight.outerConeAngle ?? 45"
              :display-value="
                formatField(
                  'outerConeAngle',
                  selectedLight.outerConeAngle ?? 45
                )
              "
              :min="1"
              :max="90"
              :step="1"
              @update:model-value="
                (value) => setNumber('outerConeAngle', value)
              "
            />
          </template>
        </div>
      </div>
      <div v-else class="text-node-text-muted px-2 pb-1 text-xs">
        {{ $t('lightInfo.noLights') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import {
  actionClass,
  chipClass,
  iconBtnClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import Button from '@/components/ui/button/Button.vue'
import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { LightTransformGizmoMode } from '@/extensions/core/lightInfo/LightInfoViewport'
import {
  lightPositionApplies,
  targetApplies
} from '@/extensions/core/lightInfo/LightInfoViewport'
import { LIGHT_TYPES } from '@/extensions/core/lightInfo/types'
import type { LightInfoType } from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { useLightInfo } from './useLightInfo'
import type { NodeId } from '@/types/nodeId'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

function lightChipClass(active: boolean) {
  return cn(
    chipClass,
    'border border-transparent bg-transparent font-mono text-xs',
    active
      ? 'border-component-node-border bg-component-node-widget-background-selected text-base-foreground'
      : 'text-node-text-muted hover:text-node-text hover:bg-button-hover-surface'
  )
}

const fieldLabelClass = 'content-center truncate text-node-component-slot-text'

const { nodeId } = defineProps<{
  nodeId: NodeId
}>()

const node = shallowRef<LGraphNode | null>(null)

const container = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const { width: toolbarWidth } = useElementSize(toolbar)
const COMPACT_WIDTH_THRESHOLD = 480
const PANEL_BUDGET_WIDE = 208
const PANEL_BUDGET_COMPACT = 352
const compact = computed(
  () => toolbarWidth.value > 0 && toolbarWidth.value < COMPACT_WIDTH_THRESHOLD
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

const transformGizmoOptions = computed(() => [
  {
    value: 'none' as const,
    labelKey: 'load3d.transformGizmo.none',
    icon: 'icon-[lucide--ban]',
    enabled: true
  },
  {
    value: 'light-position' as const,
    labelKey: 'load3d.transformGizmo.lightPosition',
    icon: 'icon-[lucide--move-3d]',
    enabled:
      selectedLight.value !== null &&
      lightPositionApplies(selectedLight.value.type)
  },
  {
    value: 'target' as const,
    labelKey: 'load3d.transformGizmo.target',
    icon: 'icon-[lucide--target]',
    enabled:
      selectedLight.value !== null && targetApplies(selectedLight.value.type)
  }
])

function focusContainer() {
  container.value?.focus()
}

function toggleGizmos() {
  gizmosOn.value = !gizmosOn.value
}

function selectTransformGizmo(value: LightTransformGizmoMode) {
  transformGizmoMode.value = value
}

function toggleCameraLock() {
  cameraLocked.value = !cameraLocked.value
}

function onTypeChange(value: unknown) {
  const type = LIGHT_TYPES.find((candidate) => candidate === value)
  if (type) setSelectedLightType(type)
}

type NumberField =
  | 'intensity'
  | 'range'
  | 'innerConeAngle'
  | 'outerConeAngle'
  | 'radius'

function fieldDecimals(field: NumberField): number {
  if (field === 'innerConeAngle' || field === 'outerConeAngle') return 0
  if (field === 'radius' && selectedLight.value?.type !== 'directional')
    return 2
  return 1
}

function formatField(field: NumberField, value: number): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: fieldDecimals(field),
    useGrouping: false
  }).format(value)
}

function setNumber(field: NumberField, raw: number) {
  if (!Number.isFinite(raw) || !selectedLight.value) return
  const value = Number(raw.toFixed(fieldDecimals(field)))
  if (field === 'innerConeAngle') {
    const outer = selectedLight.value.outerConeAngle ?? 45
    updateSelectedLight({ innerConeAngle: Math.min(value, outer) })
    return
  }
  if (field === 'outerConeAngle') {
    const inner = selectedLight.value.innerConeAngle ?? 30
    updateSelectedLight({
      outerConeAngle: value,
      innerConeAngle: Math.min(inner, value)
    })
    return
  }
  updateSelectedLight({ [field]: value })
}

watch(gizmosOn, (on) => setGizmosVisible(on))
watch(transformGizmoMode, (m) => setTransformGizmoMode(m))
watch(cameraLocked, (locked) => setCameraLocked(locked))

onMounted(() => {
  node.value = resolveNode(nodeId) ?? null
  if (container.value) initialize(container.value)
})

onUnmounted(() => {
  cleanup()
})

const { locale } = useI18n()

const lightTypeLabelKey: Record<LightInfoType, string> = {
  directional: 'lightInfo.directional',
  point: 'lightInfo.point',
  spot: 'lightInfo.spot'
}
</script>
