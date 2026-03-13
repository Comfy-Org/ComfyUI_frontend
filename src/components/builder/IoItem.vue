<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const titleTooltip = ref<string | null>(null)
const subTitleTooltip = ref<string | null>(null)

function isTruncated(e: MouseEvent): boolean {
  const el = e.currentTarget as HTMLElement
  return el.scrollWidth > el.clientWidth
}
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
  <div
    class="my-2 flex items-center-safe gap-2 rounded-lg p-2"
    data-testid="builder-io-item"
  >
    <div class="drag-handle mr-auto flex min-w-0 flex-col gap-1">
      <div
        v-tooltip.left="{ value: titleTooltip, showDelay: 300 }"
        class="drag-handle truncate text-sm"
        data-testid="builder-io-item-title"
        @mouseenter="titleTooltip = isTruncated($event) ? title : null"
        v-text="title"
      />
      <div
        v-tooltip.left="{ value: subTitleTooltip, showDelay: 300 }"
        class="drag-handle truncate text-xs text-muted-foreground"
        data-testid="builder-io-item-subtitle"
        @mouseenter="
          subTitleTooltip = isTruncated($event) ? (subTitle ?? null) : null
        "
        v-text="subTitle"
      />
    </div>
    <Popover :entries>
      <template #button>
        <Button variant="muted-textonly">
          <i class="icon-[lucide--ellipsis]" />
        </Button>
      </template>
    </Popover>
  </div>
</template>
