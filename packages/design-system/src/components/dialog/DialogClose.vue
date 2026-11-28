<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import Button from '@comfyorg/design-system/button/Button'
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
