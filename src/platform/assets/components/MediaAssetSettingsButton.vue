<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        size="icon"
        :aria-label="$t('sideToolbar.mediaAssets.viewSettings')"
      >
        <i class="icon-[lucide--settings-2]" />
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
</script>
