<script setup lang="ts">
/**
 * The pay action and everything that has to be true before it fires: a refused
 * subscribe to read, and — when the quote or the server asks for it — the
 * reactivation charge to agree to.
 */
import { useI18n } from 'vue-i18n'

const { amountCents, disabled, submitting, reactivationRequired, failure } =
  defineProps<{
    amountCents: number
    disabled: boolean
    submitting: boolean
    reactivationRequired: boolean
    failure?: string
  }>()

const confirmed = defineModel<boolean>('confirmed', { required: true })

const { n, t } = useI18n()
</script>

<template>
  <p
    v-if="failure"
    role="alert"
    class="mb-3 text-sm text-destructive-background"
  >
    {{ failure }}
  </p>
  <label
    v-if="reactivationRequired"
    class="mb-3 flex items-start gap-3 rounded-xl bg-base-background/60 px-4 py-3 text-sm text-base-foreground"
  >
    <input v-model="confirmed" type="checkbox" class="mt-0.5 size-4" />
    <span>
      {{
        t('checkout.reactivationConfirm', {
          amount: n(amountCents / 100, 'currency')
        })
      }}
    </span>
  </label>
  <button
    type="submit"
    :disabled="disabled || submitting"
    class="h-12 w-full cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
  >
    {{ t('checkout.payAndSubscribe') }}
  </button>
</template>
