<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const subTitleTooltip = ref<string | null>(null)
const isEditing = ref(false)

function isTruncated(e: MouseEvent): boolean {
  const el = e.currentTarget as HTMLElement
  return el.scrollWidth > el.clientWidth
}
const { title, rename, remove } = defineProps<{
  title: string
  subTitle?: string
  rename?: () => void
  remove?: () => void
}>()

const emit = defineEmits<{
  rename: [newName: string]
}>()

function onEditComplete(newName: string) {
  isEditing.value = false
  const trimmed = newName.trim()
  if (trimmed && trimmed !== title) emit('rename', trimmed)
}

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
    <div class="drag-handle mr-auto flex w-full min-w-0 flex-col gap-1">
      <EditableText
        :model-value="title"
        :is-editing="isEditing"
        :input-attrs="{ class: 'p-1' }"
        :class="
          cn(
            'drag-handle h-5 text-sm',
            isEditing && 'relative -top-0.5 -left-1 -mt-px mb-px -ml-px',
            !isEditing && 'truncate'
          )
        "
        data-testid="builder-io-item-title"
        @dblclick="rename && (isEditing = true)"
        @edit="onEditComplete"
        @cancel="isEditing = false"
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
        <Button variant="muted-textonly" data-testid="widget-actions-menu">
          <i class="icon-[lucide--ellipsis]" />
        </Button>
      </template>
    </Popover>
  </div>
</template>
