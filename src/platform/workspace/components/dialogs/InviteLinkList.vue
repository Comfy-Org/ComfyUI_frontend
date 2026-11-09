<template>
  <ul
    class="m-0 flex max-h-56 list-none flex-col overflow-y-auto rounded-lg border p-0"
  >
    <li
      v-for="(row, index) in rows"
      :key="row.id"
      :class="
        cn(
          'flex h-12 shrink-0 items-center justify-between gap-2 px-3',
          index > 0 && 'border-t border-border'
        )
      "
    >
      <span class="min-w-0 truncate text-sm">
        {{ row.email }}
      </span>
      <Button
        v-if="row.url"
        :tooltip="copyLabel(row.id)"
        variant="muted-textonly"
        size="icon-lg"
        class="shrink-0"
        :aria-label="copyLabel(row.id)"
        @click="copyLink(row.id, row.url)"
      >
        <i
          :class="
            copiedId === row.id ? 'icon-[lucide--check]' : 'icon-[lucide--link]'
          "
        />
      </Button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { refAutoReset } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { copyTextSilently } from '@/platform/workspace/utils/inviteLinks'
import { cn } from '@comfyorg/tailwind-utils'

export interface InviteLinkRow {
  id: string
  email: string
  url?: string
}

defineProps<{ rows: InviteLinkRow[] }>()

const { t } = useI18n()
const copiedId = refAutoReset<string | null>(null, 2000)

function copyLabel(id: string) {
  return copiedId.value === id
    ? t('workspacePanel.inviteLinks.copied')
    : t('workspacePanel.inviteLinks.copyLink')
}

async function copyLink(id: string, url: string) {
  if (await copyTextSilently(url)) {
    copiedId.value = id
  }
}
</script>
