<script setup lang="ts">
import { DropdownMenuSub } from 'reka-ui'
import { provide } from 'vue'

import { menuSubOpenKey } from './menuSubContext'

const open = defineModel<boolean>('open', { default: false })
provide(menuSubOpenKey, open)
</script>

<template>
  <DropdownMenuSub v-model:open="open">
    <slot :open />
  </DropdownMenuSub>
</template>
