<script setup lang="ts">
import MenuItem from '@comfyorg/design-system/menu/MenuItem'

const { icon, label, shortcut } = defineProps<{
  icon: string
  label: string
  shortcut?: string
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <MenuItem @select="emit('select')">
    <i aria-hidden="true" :class="icon" />
    <span class="min-w-0 flex-1 truncate">
      {{ label }}
    </span>
    <span
      v-if="shortcut"
      aria-hidden="true"
      class="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-xs/4 text-muted-foreground"
    >
      {{ shortcut }}
    </span>
  </MenuItem>
</template>
