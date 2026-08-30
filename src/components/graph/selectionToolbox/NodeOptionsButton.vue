<template>
  <Tooltip
    :config="{
      value: $t('g.moreOptions'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      data-testid="more-options-button"
      variant="muted-textonly"
      :aria-label="$t('g.moreOptions')"
      @click="handleClick"
    >
      <i class="icon-[lucide--more-vertical]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'

const handleClick = (event: Event) => {
  toggleNodeOptions(event)
}
</script>
