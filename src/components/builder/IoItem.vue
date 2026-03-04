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
  <div class="p-2 my-2 rounded-lg flex items-center-safe gap-2">
    <span
      class="mr-auto flex-[4_1_0%] max-w-max min-w-0 truncate"
      v-text="title"
    />
    <span
      class="flex-[2_1_0%] max-w-max min-w-0 truncate text-muted-foreground text-end"
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
