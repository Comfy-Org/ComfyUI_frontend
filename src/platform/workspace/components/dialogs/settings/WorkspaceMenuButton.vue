<template>
  <Menu
    v-if="menuItems.length > 0"
    :new-label="$t('contextMenu.new')"
    :items="menuItems"
    align="end"
  >
    <template #trigger>
      <Button
        :tooltip="$t('g.moreOptions')"
        variant="muted-textonly"
        size="icon-lg"
        :aria-label="$t('g.moreOptions')"
        icon="icon-[lucide--ellipsis]"
      />
    </template>
  </Menu>
</template>

<script setup lang="ts">
import Menu from '@/components/ui/menu/Menu.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceActionMenuItems } from '@/platform/workspace/composables/useWorkspaceMenuItems'

const menuItems = useWorkspaceActionMenuItems()
</script>
