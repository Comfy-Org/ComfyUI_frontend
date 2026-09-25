<template>
  <Tooltip
    :config="{
      value: $t('g.frameNodes'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      :aria-label="$t('g.frameNodes')"
      @click="frameNodes"
    >
      <i class="icon-[lucide--frame]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { useFrameNodes } from '@/composables/graph/useFrameNodes'

const { frameNodes } = useFrameNodes()
</script>
