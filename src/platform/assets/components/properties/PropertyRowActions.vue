<template>
  <div class="flex items-center gap-1">
    <span
      v-if="
        count !== undefined && totalCount !== undefined && count < totalCount
      "
      class="text-2xs text-muted-foreground"
    >
      {{ count }}/{{ totalCount }}
    </span>
    <Button
      v-if="!readonly"
      size="icon-sm"
      variant="muted-textonly"
      class="opacity-0 transition-opacity group-hover:opacity-100"
      :aria-label="t('g.delete')"
      @click="emit('delete')"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const {
  readonly = false,
  count,
  totalCount
} = defineProps<{
  readonly?: boolean
  count?: number
  totalCount?: number
}>()

const emit = defineEmits<{
  delete: []
}>()
</script>
