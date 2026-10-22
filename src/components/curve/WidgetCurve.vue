<template>
  <div class="flex flex-col gap-1">
    <div v-if="!isDisabled" class="flex items-center gap-1">
      <div class="min-w-0 flex-1">
        <Select
          :model-value="modelValue.interpolation"
          @update:model-value="onInterpolationChange"
        >
          <SelectTrigger size="md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="interp in CURVE_INTERPOLATIONS"
              :key="interp"
              :value="interp"
            >
              {{ $t(`curveWidget.${interp}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <WidgetHistoryButtons :can-undo :can-redo @undo="undo" @redo="redo" />
    </div>
    <CurveEditor
      :model-value="effectiveCurve.points"
      :disabled="isDisabled"
      :interpolation="effectiveCurve.interpolation"
      :histogram="histogram"
      @update:model-value="onPointsChange"
      @edit-end="commitAfterUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'

import {
  singleValueExtractor,
  useUpstreamValue
} from '@/composables/useUpstreamValue'
import { useWidgetValueHistory } from '@/composables/useWidgetValueHistory'
import { widgetHistoryScope } from '@/composables/widgetHistoryScope'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'

import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

import CurveEditor from './CurveEditor.vue'
import { isCurveData } from './curveUtils'
import { CURVE_INTERPOLATIONS } from './types'
import type { CurveData, CurveInterpolation, CurvePoint } from './types'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget
  nodeId?: NodeId
}>()

const modelValue = defineModel<CurveData>({
  default: () => ({
    points: [
      [0, 0],
      [1, 1]
    ],
    interpolation: 'monotone_cubic'
  })
})

const isDisabled = computed(() => !!widget.options?.disabled)

const nodeOutputStore = useNodeOutputStore()
const histogram = computed(() => {
  const locatorId = widget.nodeLocatorId
  if (!locatorId) return null
  const output = nodeOutputStore.nodeOutputs[locatorId]
  const data = output?.histogram
  if (!Array.isArray(data) || data.length === 0) return null
  return new Uint32Array(data)
})

const upstreamValue = useUpstreamValue(
  () => widget.linkedUpstream,
  singleValueExtractor(isCurveData)
)

const { canUndo, canRedo, undo, redo, commit, discardHistory } =
  useWidgetValueHistory({
    scope: () => widgetHistoryScope(widget, nodeId),
    read: () => modelValue.value,
    apply: (value) => {
      if (isCurveData(value)) modelValue.value = value
    }
  })

function commitAfterUpdate() {
  void nextTick(() => commit())
}

watch(upstreamValue, (upstream) => {
  if (isDisabled.value && upstream) {
    modelValue.value = upstream
    void nextTick(discardHistory)
  }
})

const effectiveCurve = computed(() =>
  isDisabled.value && upstreamValue.value
    ? upstreamValue.value
    : modelValue.value
)

function onPointsChange(points: CurvePoint[]) {
  modelValue.value = { ...modelValue.value, points }
}

function onInterpolationChange(value: unknown) {
  if (typeof value !== 'string') return
  modelValue.value = {
    ...modelValue.value,
    interpolation: value as CurveInterpolation
  }
  commitAfterUpdate()
}
</script>
