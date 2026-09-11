<template>
  <div class="flex items-center gap-2">
    <span class="h-px flex-1 bg-border-default" />
    <span class="text-xs text-muted-foreground">{{ widget.label }}</span>
    <Button
      variant="textonly"
      size="icon"
      class="size-6"
      :disabled="widget.options?.disabled"
      :aria-label="t('dynamicGroup.remove', { row: widget.label })"
      @click="widget.callback?.(undefined)"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget } = defineProps<{ widget: SimplifiedWidget }>()
const { t } = useI18n()
</script>
