<script setup lang="ts">
import { injectDialogRootContext } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'

const { class: className, onClose } = defineProps<{
  class?: HTMLAttributes['class']
  onClose?: () => void
}>()

const { t } = useI18n()
const dialogRoot = injectDialogRootContext(null)
</script>

<template>
  <Card :class="cn('flex flex-col shadow-lg', className)">
    <CardHeader>
      <CardTitle :id="dialogRoot?.titleId">
        <slot name="title" />
      </CardTitle>
      <Button
        v-if="onClose"
        size="icon"
        variant="muted-textonly"
        :aria-label="t('g.close')"
        @click="onClose"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </CardHeader>
    <slot />
    <CardFooter v-if="$slots.footer">
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
