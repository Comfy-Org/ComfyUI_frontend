<template>
  <Button
    :tooltip="$t('g.frameNodes')"
    variant="muted-textonly"
    :aria-label="$t('g.frameNodes')"
    @click="frameNodes"
  >
    <i class="icon-[lucide--frame] size-[1.2em]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'

const { frameNodes } = useFrameNodes()
</script>
