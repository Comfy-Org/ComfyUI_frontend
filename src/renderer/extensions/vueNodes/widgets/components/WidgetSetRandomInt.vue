<template>
  <div class="grid grid-cols-subgrid gap-y-1">
    <WidgetInputNumber v-model="modelValue" :widget class="col-span-2" />
    <Button
      class="col-span-2 w-full justify-center gap-1 border-0 bg-component-node-widget-background p-2 text-base-foreground"
      size="sm"
      variant="textonly"
      @click="randomizeSeed"
    >
      <i class="icon-[lucide--dices]" />
      {{ $t('g.randomizeSeed') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { randomizeNumberValue } from '@/scripts/valueControl'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetInputNumber from './WidgetInputNumber.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const modelValue = defineModel<number>({ default: 0 })

function randomizeSeed() {
  modelValue.value = randomizeNumberValue(widget.options ?? {})
}
</script>
