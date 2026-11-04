<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { useI18n } from 'vue-i18n'

const { items } = defineProps<{ items: MenuItem[] }>()

const { t } = useI18n()
</script>

<template>
  <Menu :items align="end">
    <template #trigger>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('superComfy.node.more')"
        data-no-drag
      >
        <i class="icon-[lucide--ellipsis] size-3.5" />
      </Button>
    </template>
  </Menu>
</template>
