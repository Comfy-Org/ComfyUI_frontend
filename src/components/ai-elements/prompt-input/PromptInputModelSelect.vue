<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const model = defineModel<string>({ default: 'Auto' })
</script>

<template>
  <Button type="button" variant="muted-textonly" size="sm" :class="className">
    {{ model }}
    <i class="icon-[lucide--chevron-down] size-3" />
  </Button>
</template>
