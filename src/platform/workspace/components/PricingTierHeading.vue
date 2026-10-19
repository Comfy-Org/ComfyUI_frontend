<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'

const { name, isPopular = false } = defineProps<{
  name: string
  isPopular?: boolean
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2 font-bold">
    <span class="text-base/normal">{{ name }}</span>
    <Badge
      v-if="isPopular"
      variant="pill"
      severity="contrast"
      class="font-bold tracking-tight uppercase"
    >
      {{ $t('subscription.mostPopular') }}
    </Badge>
  </div>
</template>
