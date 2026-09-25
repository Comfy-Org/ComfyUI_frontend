<script setup lang="ts">
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import type { MenuItem } from '@/components/ui/menu/types'

defineProps<{
  entries: MenuItem[]
}>()
</script>

<template>
  <DropdownMenu :entries>
    <template #button>
      <Tooltip
        :config="{ value: $t('g.moreOptions'), showDelay: 300 }"
        side="right"
      >
        <Button
          variant="secondary"
          size="icon-lg"
          class="rounded-lg bg-interface-menu-component-surface-selected text-text-primary"
          :aria-label="$t('g.moreOptions')"
        >
          <i class="pi pi-ellipsis-h" />
        </Button>
      </Tooltip>
    </template>
  </DropdownMenu>
</template>
