<script setup lang="ts">
import { useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { Reactivation } from '@/checkout/checkoutPage'
import type { KeepSubscriptionCopy } from '@/checkout/keepSubscription'

/** The consent as the page holds it: asked, ticked, or refused by a Pay click. */
export interface KeepSubscriptionConsent {
  readonly state: Exclude<Reactivation, 'not_required'>
  readonly copy: KeepSubscriptionCopy
}

const { consent } = defineProps<{ consent: KeepSubscriptionConsent }>()

const emit = defineEmits<{ confirm: [confirmed: boolean] }>()

const { t } = useI18n()

const errorId = useId()
const box = useTemplateRef<HTMLInputElement>('box')

/** A Pay without the tick hands focus to the box it is waiting on. */
watch(
  () => consent.state,
  (state) => {
    if (state === 'invalid') box.value?.focus()
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-lg bg-tertiary-background p-4"
    data-testid="keep-subscription-notice"
  >
    <p
      class="m-0 flex items-center gap-2 text-sm/5 font-medium text-base-foreground"
    >
      <i
        class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
        aria-hidden="true"
      />
      {{ consent.copy.title }}
    </p>
    <p class="m-0 text-sm/5 text-muted-foreground">{{ consent.copy.body }}</p>
    <label class="flex cursor-pointer items-start gap-2 py-0.5">
      <input
        ref="box"
        type="checkbox"
        class="peer sr-only"
        :checked="consent.state === 'confirmed'"
        :aria-invalid="consent.state === 'invalid'"
        :aria-describedby="consent.state === 'invalid' ? errorId : undefined"
        @change="emit('confirm', ($event.target as HTMLInputElement).checked)"
      />
      <span
        :class="
          cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-default text-transparent transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-base-foreground peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-tertiary-background',
            'peer-checked:border-base-foreground peer-checked:bg-base-foreground peer-checked:text-base-background',
            'peer-aria-invalid:border-destructive-background peer-aria-invalid:ring-3 peer-aria-invalid:ring-destructive-background/20'
          )
        "
        aria-hidden="true"
      >
        <i class="icon-[lucide--check] size-3.5" />
      </span>
      <span
        class="text-sm/5 text-base-foreground peer-aria-invalid:text-destructive-background"
      >
        {{ t('checkout.fullPage.keepSubscription.checkbox') }}
      </span>
    </label>
    <p
      v-if="consent.state === 'invalid'"
      :id="errorId"
      role="alert"
      class="m-0 text-sm/5 text-destructive-background"
    >
      {{ t('checkout.fullPage.keepSubscription.required') }}
    </p>
  </div>
</template>
