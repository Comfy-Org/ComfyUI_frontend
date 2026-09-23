<template>
  <ul
    class="m-0 flex max-h-56 list-none flex-col overflow-y-auto rounded-lg border border-border-default p-0"
  >
    <li
      v-for="(row, index) in rows"
      :key="row.id"
      :class="
        cn(
          'flex h-12 shrink-0 items-center justify-between gap-2 px-3',
          index > 0 && 'border-t border-border-default'
        )
      "
    >
      <span class="min-w-0 truncate text-sm text-base-foreground">
        {{ row.email }}
      </span>
      <Button
        v-if="row.url"
        v-tooltip="{ value: copyLabel(row.id), showDelay: 300 }"
        variant="muted-textonly"
        size="icon-lg"
        class="shrink-0"
        :aria-label="copyLabel(row.id)"
        @click="copyLink(row.id, row.url)"
      >
        <i
          :class="
            copiedId === row.id
              ? 'icon-[lucide--check] size-4'
              : 'icon-[lucide--link] size-4'
          "
        />
      </Button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { refAutoReset } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { copyTextSilently } from '@/platform/workspace/utils/inviteLinks'

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
