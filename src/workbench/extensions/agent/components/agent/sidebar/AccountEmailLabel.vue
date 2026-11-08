<script setup lang="ts">
import { DropdownMenuLabel } from 'reka-ui'

const { email } = defineProps<{
  email: string
}>()
</script>

<template>
  <DropdownMenuLabel class="truncate px-3 py-1.5 text-xs text-muted-foreground">
    {{ email }}
  </DropdownMenuLabel>
</template>
