<template>
  <Button
    v-tooltip.top="{
      value: $t('g.frameNodes'),
      showDelay: 1000
    }"
    variant="textonly"
    size="icon"
    @click="frameNodes"
  >
    <i class="icon-[lucide--frame] size-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'

const { frameNodes } = useFrameNodes()
</script>
