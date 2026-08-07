<template>
  <span
    data-testid="credit-badge-required"
    :aria-label="accessibleLabel"
    :class="
      cn(
        'flex h-5 shrink-0 items-center bg-component-node-widget-background p-1 text-xs',
        rest ? 'rounded-l-full pr-1' : 'rounded-full'
      )
    "
  >
    <i
      aria-hidden="true"
      class="icon-[lucide--component] h-full bg-amber-400"
    />
    <span aria-hidden="true" class="truncate" v-text="text" />
  </span>
  <span
    v-if="rest"
    aria-hidden="true"
    data-testid="credit-badge-rest"
    class="-ml-1 flex h-5 max-w-max min-w-0 grow basis-0 items-center truncate rounded-r-full bg-component-node-widget-background text-xs"
  >
    <span class="pr-2" v-text="rest" />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { text, rest } = defineProps<{
  text: string
  rest?: string
}>()

const { t } = useI18n()
const accessibleLabel = computed(
  () =>
    `${t('nodePricing.costEstimate')}: ${[text, rest].filter(Boolean).join(' ')}`
)
</script>
