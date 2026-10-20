<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'

const { closeLabel } = defineProps<{ closeLabel: string }>()
</script>

<template>
  <DialogClose as-child>
    <slot>
      <Button :aria-label="closeLabel" size="icon" variant="muted-textonly">
        <i class="icon-[lucide--x]" />
      </Button>
    </slot>
  </DialogClose>
</template>
