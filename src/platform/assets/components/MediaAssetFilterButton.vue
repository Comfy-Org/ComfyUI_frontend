<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        v-tooltip.top="tooltip ? { value: tooltip } : null"
        variant="secondary"
        size="icon"
        :aria-label="$t('assetBrowser.filterBy')"
      >
        <i class="icon-[lucide--list-filter]" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent size="lg" align="end" :side-offset="4">
      <slot />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'

defineProps<{ tooltip?: string }>()
</script>
