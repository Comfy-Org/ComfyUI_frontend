<template>
  <div class="absolute bottom-2 left-2 flex flex-wrap justify-start gap-1">
    <span
      v-for="badge in badges"
      :key="badge.label"
      :class="
        cn(
          'rounded bg-modal-card-tag-background px-2 py-1 text-xs font-bold tracking-wider break-all text-modal-card-tag-foreground uppercase'
        )
      "
    >
      {{ badge.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

type AssetBadge = {
  label: string
  type: 'type' | 'base' | 'size'
}

defineProps<{
  badges: AssetBadge[]
}>()
</script>
