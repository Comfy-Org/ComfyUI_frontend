<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import type { WorkflowListItem } from './workflowListItem'

const { item, icon, opening, failed } = defineProps<{
  item: WorkflowListItem
  icon: string
  opening: boolean
  failed: boolean
}>()

const emit = defineEmits<{
  open: []
}>()

const { t } = useI18n()
const folderId = useId()
const errorId = useId()

const describedBy = computed(() => {
  const ids = [...(item.folder ? [folderId] : []), ...(failed ? [errorId] : [])]
  return ids.length > 0 ? ids.join(' ') : undefined
})

const iconClass = computed(() =>
  opening ? 'icon-[lucide--loader-circle] animate-spin' : icon
)
</script>

<template>
  <li class="flex flex-col">
    <Button
      type="button"
      variant="muted-textonly"
      size="unset"
      :aria-label="item.name"
      :aria-describedby="describedBy"
      :aria-busy="opening"
      :disabled="opening"
      class="w-full justify-start gap-2 rounded-sm px-2 py-1 text-left text-xs font-normal"
      @click="emit('open')"
    >
      <i aria-hidden="true" :class="iconClass" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-foreground">{{ item.name }}</span>
        <span
          v-if="item.folder"
          :id="folderId"
          class="truncate text-muted-foreground"
          >{{ item.folder }}</span
        >
      </span>
    </Button>
    <span
      v-if="failed"
      :id="errorId"
      role="alert"
      class="pr-2 pb-1 pl-8 text-xs text-destructive"
      >{{ t('agent.nav.openFailed', { name: item.name }) }}</span
    >
  </li>
</template>
