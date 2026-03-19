<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          class="job-actions-menu-trigger"
          variant="secondary"
          size="icon"
          :aria-label="t('g.more')"
        >
          <i class="icon-[lucide--ellipsis] size-4" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side-offset="4"
        :collision-padding="8"
        class="z-50 bg-transparent p-0 shadow-lg"
      >
        <JobMenuPanel :entries @action="emit('action', $event)" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

import JobMenuPanel from './JobMenuPanel.vue'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

const { t } = useI18n()
</script>
