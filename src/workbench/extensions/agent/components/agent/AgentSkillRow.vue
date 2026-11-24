<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Menu from '@comfyorg/design-system/menu/Menu'

import type { SkillPack } from '@/platform/skills/types'
import { packByteSize } from '@/platform/skills/types'

const {
  pack,
  buttonId,
  busy = false,
  disabled = false,
  hasDraft = false
} = defineProps<{
  pack: SkillPack
  buttonId: string
  busy?: boolean
  disabled?: boolean
  hasDraft?: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  discardDraft: []
}>()

const { t } = useI18n()
const descriptionId = useId()

const sizeLabel = computed(() =>
  t('agent.skillSize', { bytes: packByteSize(pack) })
)

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('g.edit'),
    icon: 'icon-[lucide--square-pen]',
    command: () => emit('edit')
  },
  ...(hasDraft
    ? [
        {
          label: t('agent.discardDraftChanges'),
          icon: 'icon-[lucide--undo-2]',
          command: () => emit('discardDraft')
        }
      ]
    : []),
  { separator: true },
  {
    label: t('g.delete'),
    icon: 'icon-[lucide--trash-2]',
    variant: 'destructive',
    command: () => emit('delete')
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
      :aria-label="pack.name"
      :aria-describedby="descriptionId"
      :aria-busy="busy || undefined"
      :disabled="busy || disabled"
      @click="emit('edit')"
    >
      <span class="w-full truncate text-sm font-medium text-foreground">
        {{ pack.name }}
      </span>
      <span
        :id="descriptionId"
        class="line-clamp-2 text-xs text-muted-foreground"
      >
        {{ pack.description }}
      </span>
      <span class="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{{ sizeLabel }}</span>
        <span v-if="hasDraft" class="font-medium text-foreground">
          {{ t('agent.skillDraftChanges') }}
        </span>
      </span>
    </Button>
    <i
      v-if="busy"
      aria-hidden="true"
      class="mt-2 mr-1 icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground"
    />
    <Menu
      v-else
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
          :aria-label="t('agent.skillOptions', { name: pack.name })"
          :disabled
        >
          <i aria-hidden="true" class="icon-[lucide--chevron-down] size-3" />
        </Button>
      </template>
    </Menu>
  </li>
</template>
