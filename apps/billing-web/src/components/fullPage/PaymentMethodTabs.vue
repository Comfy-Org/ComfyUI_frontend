<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { PaymentTab } from '@/checkout/checkoutPage'

const { selected } = defineProps<{ selected: PaymentTab }>()

const emit = defineEmits<{ select: [tab: PaymentTab] }>()

const { t } = useI18n()

const TABS = [
  { tab: 'saved', icon: 'icon-[lucide--wallet]' },
  { tab: 'new', icon: 'icon-[lucide--credit-card]' }
] as const satisfies readonly { tab: PaymentTab; icon: string }[]
</script>

<template>
  <div
    role="tablist"
    :aria-label="t('checkout.paymentMethod')"
    class="grid grid-cols-2 gap-4"
  >
    <button
      v-for="{ tab, icon } in TABS"
      :key="tab"
      type="button"
      role="tab"
      :aria-selected="selected === tab"
      :class="
        cn(
          'flex h-14 cursor-pointer items-center gap-3 rounded-lg border bg-base-background px-4 text-sm text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none',
          selected === tab ? 'border-base-foreground' : 'border-transparent'
        )
      "
      @click="emit('select', tab)"
    >
      <i :class="cn(icon, 'size-4 shrink-0')" aria-hidden="true" />
      {{ t(`checkout.fullPage.tabs.${tab}`) }}
    </button>
  </div>
</template>
