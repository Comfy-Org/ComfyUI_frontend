<template>
  <Menu v-if="menuItems.length > 0" :items="menuItems" align="end">
    <template #trigger>
      <Button
        :tooltip="$t('g.moreOptions')"
        :variant
        size="icon-lg"
        :aria-label="$t('g.moreOptions')"
        icon="icon-[lucide--ellipsis]"
      />
    </template>
  </Menu>
</template>

<script setup lang="ts">
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'

import Menu from '@/components/ui/menu/Menu.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkspaceActionMenuItems } from '@/platform/workspace/composables/useWorkspaceMenuItems'

const { variant = 'muted-textonly' } = defineProps<{
  variant?: ButtonVariants['variant']
}>()

const menuItems = useWorkspaceActionMenuItems()
</script>
