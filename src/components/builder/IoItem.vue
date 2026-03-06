<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const { rename, remove } = defineProps<{
  title: string
  subTitle?: string
  rename?: () => void
  remove?: () => void
}>()

const entries = computed(() => {
  const items = []
  if (rename)
    items.push({
      label: t('g.rename'),
      command: rename,
      icon: 'icon-[lucide--pencil]'
    })
  if (remove)
    items.push({
      label: t('g.delete'),
      command: remove,
      icon: 'icon-[lucide--trash-2]'
    })
  return items
})
</script>
<template>
  <div class="my-2 flex items-center-safe gap-2 rounded-lg p-2">
    <div
      class="drag-handle mr-auto inline max-w-max min-w-0 flex-[4_1_0%] truncate"
      v-text="title"
    />
    <div
      class="drag-handle inline max-w-max min-w-0 flex-[2_1_0%] truncate text-end text-muted-foreground"
      v-text="subTitle"
    />
    <Popover :entries>
      <template #button>
        <Button variant="muted-textonly">
          <i class="icon-[lucide--ellipsis]" />
        </Button>
      </template>
    </Popover>
  </div>
</template>
