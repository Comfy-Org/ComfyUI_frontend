<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
</script>

<template>
  <DialogClose as-child>
    <slot>
      <Button size="icon" variant="muted-textonly">
        <i class="icon-[lucide--x]" />
      </Button>
    </slot>
  </DialogClose>
</template>
