<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()
</script>

<template>
  <DialogClose as-child>
    <slot>
      <Button :aria-label="t('g.close')" size="icon" variant="muted-textonly">
        <i class="icon-[lucide--x]" />
      </Button>
    </slot>
  </DialogClose>
</template>
