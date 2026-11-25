<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Menu from '@comfyorg/design-system/menu/Menu'

const {
  title,
  buttonId,
  disabled = false
} = defineProps<{
  title: string
  buttonId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  open: []
  discard: []
}>()

const { t } = useI18n()
const noteId = useId()

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('agent.discardDraft'),
    icon: 'icon-[lucide--trash-2]',
    variant: 'destructive',
    command: () => emit('discard')
  }
])
</script>

<template>
  <li class="flex min-w-0 items-start gap-1 rounded-sm pr-1 hover:bg-accent">
    <Button
      :id="buttonId"
      type="button"
      variant="textonly"
      size="unset"
      class="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left font-normal whitespace-normal hover:bg-transparent"
      :aria-label="title"
      :aria-describedby="noteId"
      :disabled
      @click="emit('open')"
    >
      <span class="w-full truncate text-sm font-medium text-foreground">
        {{ title }}
      </span>
      <span :id="noteId" class="text-xs text-muted-foreground">
        {{ t('agent.skillDraftNote') }}
      </span>
    </Button>
    <Menu
      :items="menuItems"
      side="bottom"
      align="end"
      :side-offset="4"
      class="agent-scope"
    >
      <template #trigger>
        <Button
          variant="muted-textonly"
          size="icon-sm"
          class="mt-1 size-6 shrink-0"
          :aria-label="t('agent.skillOptions', { name: title })"
        >
          <i aria-hidden="true" class="icon-[lucide--chevron-down] size-3" />
        </Button>
      </template>
    </Menu>
  </li>
</template>
