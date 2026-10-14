<script setup lang="ts">
import { Ellipsis } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import AdminButton from '@/components/cms/ui/AdminButton.vue'

/** A "more actions" button that opens a short list of menu items. */
const { label } = defineProps<{ label: string }>()
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <AdminButton
        variant="ghost"
        size="icon"
        :aria-label="label"
        :title="label"
      >
        <Ellipsis class="size-4" />
      </AdminButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 grid min-w-40 gap-0.5 rounded-lg border border-admin-line bg-admin-card p-1 font-admin text-xs text-admin-fg shadow-admin-popover"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
