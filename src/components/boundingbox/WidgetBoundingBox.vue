<template>
  <div class="flex flex-col gap-1" data-testid="bounding-box">
    <WidgetHistoryButtons
      v-if="widget"
      class="self-end"
      :can-undo
      :can-redo
      @undo="undo"
      @redo="redo"
    />
    <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
      <label class="content-center">
        {{ $t('boundingBox.x') }}
      </label>
      <ScrubableNumberInput
        v-model="x"
        :min="0"
        :step="1"
        :disabled
        data-testid="bounding-box-x"
      />
      <label class="content-center">
        {{ $t('boundingBox.y') }}
      </label>
      <ScrubableNumberInput
        v-model="y"
        :min="0"
        :step="1"
        :disabled
        data-testid="bounding-box-y"
      />
      <label class="content-center">
        {{ $t('boundingBox.width') }}
      </label>
      <ScrubableNumberInput
        v-model="width"
        :min="1"
        :step="1"
        :disabled
        data-testid="bounding-box-width"
      />
      <label class="content-center">
        {{ $t('boundingBox.height') }}
      </label>
      <ScrubableNumberInput
        v-model="height"
        :min="1"
        :step="1"
        :disabled
        data-testid="bounding-box-height"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import WidgetHistoryButtons from '@/components/widgetHistory/WidgetHistoryButtons.vue'
import { isBoundsObject } from '@/renderer/core/layout/utils/geometry'
import { useWidgetValueHistory } from '@/composables/useWidgetValueHistory'
import { widgetHistoryScope } from '@/composables/widgetHistoryScope'
import type { Bounds } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const {
  disabled = false,
  widget,
  nodeId
} = defineProps<{
  disabled?: boolean
  widget?: SimplifiedWidget
  nodeId?: NodeId
}>()

const emit = defineEmits<{
  editEnd: [field: keyof Bounds]
}>()

const modelValue = defineModel<Bounds>({
  default: () => ({ x: 0, y: 0, width: 512, height: 512 })
})

const { canUndo, canRedo, undo, redo, commit } = useWidgetValueHistory({
  scope: () => (widget ? widgetHistoryScope(widget, nodeId) : null),
  read: () => modelValue.value,
  apply: (value) => {
    if (isBoundsObject(value)) modelValue.value = value
  }
})

function boundsField(field: keyof Bounds) {
  return computed({
    get: () => modelValue.value[field],
    set: (value: number) => {
      modelValue.value = { ...modelValue.value, [field]: value }
      emit('editEnd', field)
      void nextTick(() => commit(field))
    }
  })
}

const x = boundsField('x')
const y = boundsField('y')
const width = boundsField('width')
const height = boundsField('height')
</script>
