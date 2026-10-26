<template>
  <Button
    :tooltip="$t('g.frameNodes')"
    variant="muted-textonly"
    :aria-label="$t('g.frameNodes')"
    @click="frameNodes"
  >
    <i class="icon-[lucide--frame]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'

const { frameNodes } = useFrameNodes()
</script>
