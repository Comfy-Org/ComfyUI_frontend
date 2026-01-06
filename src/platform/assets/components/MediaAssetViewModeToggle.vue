<template>
  <div
    class="inline-flex items-center gap-1 rounded-lg bg-secondary-background p-1"
    role="group"
  >
    <Button
      type="button"
      variant="muted-textonly"
      size="icon"
      :aria-label="t('sideToolbar.queueProgressOverlay.viewList')"
      :aria-pressed="viewMode === 'list'"
      :class="
        cn(
          'rounded-lg',
          viewMode === 'list'
            ? 'bg-secondary-background-selected text-text-primary hover:bg-secondary-background-selected'
            : 'text-text-secondary hover:bg-secondary-background-hover'
        )
      "
      @click="viewMode = 'list'"
    >
      <i class="icon-[lucide--table-of-contents] size-4" />
    </Button>
    <Button
      type="button"
      variant="muted-textonly"
      size="icon"
      :aria-label="t('sideToolbar.queueProgressOverlay.viewGrid')"
      :aria-pressed="viewMode === 'grid'"
      :class="
        cn(
          'rounded-lg',
          viewMode === 'grid'
            ? 'bg-secondary-background-selected text-text-primary hover:bg-secondary-background-selected'
            : 'text-text-secondary hover:bg-secondary-background-hover'
        )
      "
      @click="viewMode = 'grid'"
    >
      <i class="icon-[lucide--layout-grid] size-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const { t } = useI18n()
</script>
