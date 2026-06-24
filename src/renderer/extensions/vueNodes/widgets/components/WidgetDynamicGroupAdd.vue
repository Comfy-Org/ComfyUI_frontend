<template>
  <div class="col-span-2 flex justify-start">
    <Button
      class="border-0 bg-component-node-widget-background px-2 py-1 text-base-foreground"
      :disabled="widget.options?.disabled"
      size="sm"
      variant="textonly"
      @click="handleClick"
    >
      <span
        class="mr-1 icon-[material-symbols--add] size-4"
        aria-hidden="true"
      />
      {{ t('dynamicGroup.addRow') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget } = defineProps<{
  widget: SimplifiedWidget<number>
}>()

const { t } = useI18n()

function handleClick() {
  widget.callback?.(widget.value)
}
</script>
