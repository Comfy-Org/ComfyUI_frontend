<template>
  <Menu v-if="menuItems.length > 0" :items="menuItems" align="end">
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
import Menu from '@comfyorg/design-system/menu/Menu'
import Button from '@comfyorg/design-system/button/Button'
import { useWorkspaceActionMenuItems } from '@/platform/workspace/composables/useWorkspaceMenuItems'

const menuItems = useWorkspaceActionMenuItems()
</script>
